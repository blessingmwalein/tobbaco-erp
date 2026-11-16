import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { BuyerPermission } from "@tobacco/shared";
import { AppError } from "../../common/app-error";
import { BUYER_PERMISSIONS_KEY, IS_PUBLIC_KEY, PRINCIPAL_TYPE_KEY } from "../../common/decorators";
import type { AppRequest } from "../../common/principal";
import { PrincipalService } from "./principal.service";
import { TokenService } from "./token.service";

/**
 * Global guard. Order of checks (all server-side — the UI hiding a button is never the control):
 *  1. @Public() routes pass.
 *  2. A valid access token is required.
 *  3. The principal is reloaded from the database (inactive user / inactive organisation ⇒ 401).
 *  4. The principal TYPE must match @StaffOnly / @BuyerOnly (a buyer token can never act as staff, and vice versa).
 *  5. Every permission named by @RequireBuyerPermission must be held.
 * Endpoints without any of these decorators still require a signed-in principal (secure by default).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(PrincipalService) private readonly principals: PrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = context.switchToHttp().getRequest<AppRequest>();
    const header = req.headers["authorization"];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw || !/^Bearer\s+\S+$/i.test(raw)) throw AppError.unauthorized();
    const claims = this.tokens.verifyAccess(raw.replace(/^Bearer\s+/i, ""));

    const principal = await this.principals.load(claims.typ, claims.sub);
    if (!principal) throw AppError.unauthorized("This account is no longer active", "ACCOUNT_INACTIVE");
    // The token's tenant claim must still match the account's organisation (defence against a stale/forged claim).
    if (principal.type === "BUYER" && claims.org !== principal.organisationId) {
      throw AppError.unauthorized("Your session no longer matches your account", "TOKEN_INVALID");
    }
    req.principal = principal;

    const required = this.reflector.getAllAndOverride<"STAFF" | "BUYER" | undefined>(PRINCIPAL_TYPE_KEY, targets);
    if (required && principal.type !== required) {
      throw AppError.forbidden(required === "STAFF" ? "This area is for ERP staff" : "This area is for buyer users", required === "STAFF" ? "STAFF_ONLY" : "BUYER_ONLY");
    }

    const perms = this.reflector.getAllAndOverride<BuyerPermission[] | undefined>(BUYER_PERMISSIONS_KEY, targets);
    if (perms && perms.length > 0) {
      if (principal.type !== "BUYER") throw AppError.forbidden("This area is for buyer users", "BUYER_ONLY");
      const missing = perms.filter((p) => !principal.permissions.has(p));
      if (missing.length > 0) {
        throw AppError.forbidden("Your role does not allow this action", "PERMISSION_DENIED", { missing });
      }
    }
    return true;
  }
}

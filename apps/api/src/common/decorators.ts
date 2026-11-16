import { ExecutionContext, SetMetadata, createParamDecorator } from "@nestjs/common";
import type { BuyerPermission } from "@tobacco/shared";
import { AppError } from "./app-error";
import type { AppRequest, BuyerPrincipal, Principal, StaffPrincipal } from "./principal";

export const IS_PUBLIC_KEY = "auth:public";
export const PRINCIPAL_TYPE_KEY = "auth:principalType";
export const BUYER_PERMISSIONS_KEY = "auth:buyerPermissions";

/** No authentication required (login, password reset, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
/** Only ERP staff may call this. */
export const StaffOnly = () => SetMetadata(PRINCIPAL_TYPE_KEY, "STAFF");
/** Only buyer-organisation users may call this (no specific permission). */
export const BuyerOnly = () => SetMetadata(PRINCIPAL_TYPE_KEY, "BUYER");

/**
 * Buyer users only, and ALL listed permissions are required. Enforced server-side by the global AuthGuard.
 * Usage: @RequireBuyerPermission("buyer.receiving.scan")
 */
export const RequireBuyerPermission = (...permissions: BuyerPermission[]) => (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
  SetMetadata(PRINCIPAL_TYPE_KEY, "BUYER")(target, key as string, descriptor as PropertyDescriptor);
  SetMetadata(BUYER_PERMISSIONS_KEY, permissions)(target, key as string, descriptor as PropertyDescriptor);
};

const principalOf = (ctx: ExecutionContext): Principal | undefined => ctx.switchToHttp().getRequest<AppRequest>().principal;

export const CurrentPrincipal = createParamDecorator((_data: unknown, ctx: ExecutionContext): Principal => {
  const p = principalOf(ctx);
  if (!p) throw AppError.unauthorized();
  return p;
});

/** The signed-in buyer user (403 for staff). The organisation id on it is the ONLY source of tenant identity. */
export const CurrentBuyer = createParamDecorator((_data: unknown, ctx: ExecutionContext): BuyerPrincipal => {
  const p = principalOf(ctx);
  if (!p) throw AppError.unauthorized();
  if (p.type !== "BUYER") throw AppError.forbidden("This endpoint is for buyer users", "BUYER_ONLY");
  return p;
});

export const CurrentStaff = createParamDecorator((_data: unknown, ctx: ExecutionContext): StaffPrincipal => {
  const p = principalOf(ctx);
  if (!p) throw AppError.unauthorized();
  if (p.type !== "STAFF") throw AppError.forbidden("This endpoint is for ERP staff", "STAFF_ONLY");
  return p;
});

export interface RequestMeta {
  ip?: string;
  requestId?: string;
  userAgent?: string;
}

export const ReqMeta = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest<AppRequest & { socket?: { remoteAddress?: string } }>();
  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() ?? req.ip ?? req.socket?.remoteAddress;
  const ua = req.headers["user-agent"];
  return { ip, requestId: req.id, userAgent: Array.isArray(ua) ? ua[0] : ua };
});

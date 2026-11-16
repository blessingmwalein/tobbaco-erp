import { Body, Controller, Get, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  activateAccountSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
} from "@tobacco/validation";
import { CurrentPrincipal, Public, ReqMeta, type RequestMeta } from "../../common/decorators";
import type { Principal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { toPublicPrincipal } from "./principal.service";
import { PrincipalService } from "./principal.service";

const LOGIN_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrincipalService) private readonly principals: PrincipalService,
  ) {}

  @Public()
  @Throttle(LOGIN_LIMIT)
  @Post("buyer/login")
  @HttpCode(200)
  @ApiOperation({ summary: "Buyer portal sign-in (email + password)" })
  buyerLogin(@Body(new ZodValidationPipe(loginSchema)) body: { email: string; password: string }, @ReqMeta() meta: RequestMeta) {
    return this.auth.loginBuyer(body.email, body.password, meta);
  }

  @Public()
  @Throttle(LOGIN_LIMIT)
  @Post("staff/login")
  @HttpCode(200)
  @ApiOperation({ summary: "ERP staff sign-in (administrators)" })
  staffLogin(@Body(new ZodValidationPipe(loginSchema)) body: { email: string; password: string }, @ReqMeta() meta: RequestMeta) {
    return this.auth.loginStaff(body.email, body.password, meta);
  }

  @Public()
  @Throttle(LOGIN_LIMIT)
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Rotate the refresh token and get a new access token" })
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string }, @ReqMeta() meta: RequestMeta) {
    return this.auth.refresh(body.refreshToken, meta);
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "Revoke the refresh-token family (sign out)" })
  async logout(@Body() body: { refreshToken?: string }, @ReqMeta() meta: RequestMeta) {
    await this.auth.logout(body?.refreshToken, null, meta);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  @HttpCode(202)
  @ApiOperation({ summary: "Request a password-reset link (never reveals whether the email exists)" })
  async forgot(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: { email: string; audience: "BUYER" | "STAFF" }, @ReqMeta() meta: RequestMeta) {
    await this.auth.forgotPassword(body.email, body.audience, meta);
    return { message: "If that email belongs to an active account, a reset link has been sent." };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("reset-password")
  @HttpCode(204)
  async reset(@Body(new ZodValidationPipe(resetPasswordSchema)) body: { token: string; password: string }, @ReqMeta() meta: RequestMeta) {
    await this.auth.resetPassword(body.token, body.password, meta);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("activate")
  @HttpCode(204)
  async activate(@Body(new ZodValidationPipe(activateAccountSchema)) body: { token: string; password: string }, @ReqMeta() meta: RequestMeta) {
    await this.auth.activate(body.token, body.password, meta);
  }

  @ApiBearerAuth()
  @Get("me")
  @ApiOperation({ summary: "The signed-in user, organisation, roles and permissions" })
  me(@CurrentPrincipal() principal: Principal) {
    return toPublicPrincipal(principal);
  }

  @ApiBearerAuth()
  @Post("change-password")
  @HttpCode(204)
  async changePassword(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: { currentPassword: string; newPassword: string },
    @ReqMeta() meta: RequestMeta,
  ) {
    await this.auth.changePassword(principal, body.currentPassword, body.newPassword, meta);
  }
}

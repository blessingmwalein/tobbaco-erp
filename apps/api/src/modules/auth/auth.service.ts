import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { OneTimeTokenKind, PrincipalType } from "@prisma/client";
import { passwordPolicyIssues } from "@tobacco/validation";
import { AppError } from "../../common/app-error";
import type { RequestMeta } from "../../common/decorators";
import type { Principal } from "../../common/principal";
import { ENV, type Env } from "../../config/env";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { PasswordService } from "./password.service";
import { PrincipalService, toPublicPrincipal, type PublicPrincipal } from "./principal.service";
import { TokenService, sha256Hex } from "./token.service";

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  principal: PublicPrincipal;
}

const INVALID_CREDENTIALS = () => AppError.unauthorized("Incorrect email or password", "INVALID_CREDENTIALS");
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const ACTIVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(PrincipalService) private readonly principals: PrincipalService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ── Login ────────────────────────────────────────────────────────────────
  async loginBuyer(email: string, password: string, meta: RequestMeta): Promise<Session> {
    const user = await this.prisma.buyerUser.findUnique({ where: { email }, include: { organisation: true } });
    if (!user) {
      await this.passwords.dummyVerify(password);
      await this.audit.record(undefined, null, { action: "auth.login.failed", entityType: "BuyerUser", entityRef: email, reason: "unknown email" }, meta);
      throw INVALID_CREDENTIALS();
    }
    this.assertNotLocked(user.lockedUntil);
    if (!user.passwordHash) {
      // Not activated yet. Answer exactly like a wrong password so nobody can probe which emails have pending invitations.
      await this.passwords.dummyVerify(password);
      await this.audit.record(undefined, null, { action: "auth.login.failed", entityType: "BuyerUser", entityId: user.id, entityRef: email, organisationId: user.buyerOrganisationId, reason: "account not activated" }, meta);
      throw INVALID_CREDENTIALS();
    }
    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) {
      await this.registerFailure("BUYER", user.id, user.failedLogins);
      await this.audit.record(undefined, null, { action: "auth.login.failed", entityType: "BuyerUser", entityId: user.id, entityRef: email, organisationId: user.buyerOrganisationId, reason: "wrong password" }, meta);
      throw INVALID_CREDENTIALS();
    }
    if (!user.active || user.organisation.status !== "ACTIVE") {
      throw AppError.forbidden("This account has been deactivated. Contact your administrator or the auction floor.", "ACCOUNT_DISABLED");
    }
    await this.prisma.buyerUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const principal = await this.principals.loadBuyer(user.id);
    if (!principal) throw AppError.forbidden("This account has been deactivated.", "ACCOUNT_DISABLED");
    await this.audit.record(undefined, principal, { action: "auth.login", entityType: "BuyerUser", entityId: user.id, entityRef: email }, meta);
    return this.issueSession(principal, meta);
  }

  async loginStaff(email: string, password: string, meta: RequestMeta): Promise<Session> {
    const user = await this.prisma.staffUser.findUnique({ where: { email } });
    if (!user) {
      await this.passwords.dummyVerify(password);
      await this.audit.record(undefined, null, { action: "auth.login.failed", entityType: "StaffUser", entityRef: email, reason: "unknown email" }, meta);
      throw INVALID_CREDENTIALS();
    }
    this.assertNotLocked(user.lockedUntil);
    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) {
      await this.registerFailure("STAFF", user.id, user.failedLogins);
      await this.audit.record(undefined, null, { action: "auth.login.failed", entityType: "StaffUser", entityId: user.id, entityRef: email, reason: "wrong password" }, meta);
      throw INVALID_CREDENTIALS();
    }
    if (!user.active) throw AppError.forbidden("This account has been deactivated.", "ACCOUNT_DISABLED");
    await this.prisma.staffUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const principal = await this.principals.loadStaff(user.id);
    if (!principal) throw AppError.forbidden("This account has been deactivated.", "ACCOUNT_DISABLED");
    await this.audit.record(undefined, principal, { action: "auth.login", entityType: "StaffUser", entityId: user.id, entityRef: email }, meta);
    return this.issueSession(principal, meta);
  }

  // ── Sessions ─────────────────────────────────────────────────────────────
  async issueSession(principal: Principal, meta: RequestMeta, familyId: string = randomUUID()): Promise<Session> {
    const accessToken = this.tokens.signAccess({
      sub: principal.id,
      typ: principal.type,
      org: principal.type === "BUYER" ? principal.organisationId : undefined,
    });
    const refresh = this.tokens.generateOpaque();
    await this.prisma.refreshToken.create({
      data: {
        principalType: principal.type,
        principalId: principal.id,
        tokenHash: refresh.hash,
        familyId,
        expiresAt: this.tokens.refreshExpiry(),
        userAgent: meta.userAgent?.slice(0, 250) ?? null,
        ip: meta.ip ?? null,
      },
    });
    return { accessToken, refreshToken: refresh.token, expiresIn: this.tokens.accessTtlSeconds, principal: toPublicPrincipal(principal) };
  }

  /**
   * Rotate a refresh token. Reusing an already-rotated token is treated as theft: the whole family is revoked.
   */
  async refresh(refreshToken: string, meta: RequestMeta): Promise<Session> {
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256Hex(refreshToken) } });
    if (!record) throw AppError.unauthorized("Your session has expired — please sign in again", "TOKEN_INVALID");
    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record(undefined, null, { action: "auth.refresh.reuse_detected", entityType: "RefreshToken", entityId: record.id, reason: "revoked token presented again; family revoked" }, meta);
      throw AppError.unauthorized("Your session has expired — please sign in again", "TOKEN_REUSED");
    }
    if (record.expiresAt < new Date()) throw AppError.unauthorized("Your session has expired — please sign in again", "TOKEN_EXPIRED");
    const principal = await this.principals.load(record.principalType, record.principalId);
    if (!principal) {
      await this.prisma.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw AppError.unauthorized("This account is no longer active", "ACCOUNT_INACTIVE");
    }
    // Atomic rotate: only one concurrent caller can revoke the token; the loser is treated as reuse.
    const revoked = await this.prisma.refreshToken.updateMany({ where: { id: record.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (revoked.count !== 1) throw AppError.unauthorized("Your session has expired — please sign in again", "TOKEN_REUSED");
    return this.issueSession(principal, meta, record.familyId);
  }

  async logout(refreshToken: string | undefined, principal: Principal | null, meta: RequestMeta): Promise<void> {
    if (!refreshToken) return;
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256Hex(refreshToken) } });
    if (!record) return;
    await this.prisma.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record(undefined, principal, { action: "auth.logout", entityType: principal?.type === "STAFF" ? "StaffUser" : "BuyerUser", entityId: record.principalId }, meta);
  }

  async revokeAllSessions(type: PrincipalType, id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { principalType: type, principalId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  // ── Password reset & activation ──────────────────────────────────────────
  /** Always resolves quietly: the response never reveals whether the email exists. */
  async forgotPassword(email: string, audience: "BUYER" | "STAFF", meta: RequestMeta): Promise<void> {
    if (audience === "BUYER") {
      const user = await this.prisma.buyerUser.findUnique({ where: { email }, include: { organisation: true } });
      if (user && user.active && user.organisation.status === "ACTIVE" && user.passwordHash) {
        const raw = await this.createOneTimeToken("PASSWORD_RESET", "BUYER", user.id, RESET_TTL_MS);
        await this.mail.send({
          to: user.email,
          subject: "Reset your Buyer Portal password",
          kind: "password-reset",
          text: `Hello ${user.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${this.env.APP_BASE_URL}/buyer/reset-password?token=${raw}\n\nIf you did not ask for this, ignore this email.`,
        });
        await this.audit.record(undefined, null, { action: "auth.password_reset.requested", entityType: "BuyerUser", entityId: user.id, entityRef: email, organisationId: user.buyerOrganisationId }, meta);
      }
      return;
    }
    const staff = await this.prisma.staffUser.findUnique({ where: { email } });
    if (staff && staff.active) {
      const raw = await this.createOneTimeToken("PASSWORD_RESET", "STAFF", staff.id, RESET_TTL_MS);
      await this.mail.send({
        to: staff.email,
        subject: "Reset your ERP administrator password",
        kind: "password-reset",
        text: `Use this link to choose a new password (valid for 1 hour):\n${this.env.APP_BASE_URL}/staff/reset-password?token=${raw}`,
      });
    }
  }

  async resetPassword(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const record = await this.consumeToken(token, "PASSWORD_RESET");
    await this.setPassword(record.principalType, record.principalId, newPassword);
    await this.revokeAllSessions(record.principalType, record.principalId);
    await this.audit.record(undefined, null, { action: "auth.password_reset.completed", entityType: record.principalType === "BUYER" ? "BuyerUser" : "StaffUser", entityId: record.principalId }, meta);
  }

  async activate(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const record = await this.consumeToken(token, "ACCOUNT_ACTIVATION");
    await this.setPassword(record.principalType, record.principalId, newPassword);
    await this.audit.record(undefined, null, { action: "auth.account.activated", entityType: "BuyerUser", entityId: record.principalId }, meta);
  }

  /** Called by the users module after an administrator creates (or re-invites) a buyer user. */
  async sendActivation(user: { id: string; email: string; name: string; organisationName: string }): Promise<void> {
    const raw = await this.createOneTimeToken("ACCOUNT_ACTIVATION", "BUYER", user.id, ACTIVATION_TTL_MS);
    await this.mail.send({
      to: user.email,
      subject: `Activate your ${user.organisationName} Buyer Portal account`,
      kind: "account-activation",
      text: `Hello ${user.name},\n\nAn account has been created for you on the Buyer Portal for ${user.organisationName}.\nSet your password to activate it (link valid for 7 days):\n${this.env.APP_BASE_URL}/buyer/activate?token=${raw}`,
    });
  }

  async changePassword(principal: Principal, current: string, next: string, meta: RequestMeta): Promise<void> {
    const hash =
      principal.type === "BUYER"
        ? (await this.prisma.buyerUser.findUnique({ where: { id: principal.id } }))?.passwordHash
        : (await this.prisma.staffUser.findUnique({ where: { id: principal.id } }))?.passwordHash;
    if (!hash || !(await this.passwords.verify(hash, current))) {
      throw AppError.badRequest("WRONG_CURRENT_PASSWORD", "Your current password is incorrect");
    }
    await this.setPassword(principal.type, principal.id, next, principal.email);
    await this.revokeAllSessions(principal.type, principal.id);
    await this.audit.record(undefined, principal, { action: "auth.password_changed", entityType: principal.type === "BUYER" ? "BuyerUser" : "StaffUser", entityId: principal.id }, meta);
  }

  // ── internals ────────────────────────────────────────────────────────────
  private assertNotLocked(lockedUntil: Date | null): void {
    if (lockedUntil && lockedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
      throw new AppError("ACCOUNT_LOCKED", `Too many failed attempts. Try again in ${minutes} minute(s).`, 429);
    }
  }

  private async registerFailure(type: PrincipalType, id: string, currentFailures: number): Promise<void> {
    const failures = currentFailures + 1;
    const lock = failures >= this.env.LOGIN_MAX_FAILURES ? new Date(Date.now() + this.env.LOGIN_LOCK_MINUTES * 60000) : null;
    const data = { failedLogins: lock ? 0 : failures, lockedUntil: lock };
    if (type === "BUYER") await this.prisma.buyerUser.update({ where: { id }, data });
    else await this.prisma.staffUser.update({ where: { id }, data });
  }

  private async createOneTimeToken(kind: OneTimeTokenKind, type: PrincipalType, principalId: string, ttlMs: number): Promise<string> {
    // Invalidate earlier unused tokens of the same kind so only the newest link works.
    await this.prisma.oneTimeToken.updateMany({ where: { kind, principalType: type, principalId, usedAt: null }, data: { usedAt: new Date() } });
    const { token, hash } = this.tokens.generateOpaque(32);
    await this.prisma.oneTimeToken.create({ data: { kind, principalType: type, principalId, tokenHash: hash, expiresAt: new Date(Date.now() + ttlMs) } });
    return token;
  }

  private async consumeToken(token: string, kind: OneTimeTokenKind) {
    const record = await this.prisma.oneTimeToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
    if (!record || record.kind !== kind || record.usedAt || record.expiresAt < new Date()) {
      throw AppError.badRequest("TOKEN_INVALID", "This link is invalid or has expired. Request a new one.");
    }
    // Single-use: only one concurrent caller can mark it used.
    const used = await this.prisma.oneTimeToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw AppError.badRequest("TOKEN_INVALID", "This link has already been used.");
    return record;
  }

  private async setPassword(type: PrincipalType, id: string, password: string, email?: string): Promise<void> {
    const issues = passwordPolicyIssues(password, { email });
    if (issues.length > 0) throw AppError.unprocessable("WEAK_PASSWORD", issues.join(". "), issues);
    const passwordHash = await this.passwords.hash(password);
    if (type === "BUYER") await this.prisma.buyerUser.update({ where: { id }, data: { passwordHash, failedLogins: 0, lockedUntil: null } });
    else await this.prisma.staffUser.update({ where: { id }, data: { passwordHash, failedLogins: 0, lockedUntil: null } });
  }
}

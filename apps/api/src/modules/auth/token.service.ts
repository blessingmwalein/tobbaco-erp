import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AppError } from "../../common/app-error";
import type { AccessTokenClaims } from "../../common/principal";
import { ENV, type Env } from "../../config/env";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Access tokens are short-lived JWTs (identity only: who + which tenant). Authorisation is NEVER read from the token —
 * AuthGuard reloads the account, roles and organisation status from the database on every request.
 * Refresh and one-time tokens are opaque random values; only their SHA-256 hash is stored.
 */
@Injectable()
export class TokenService {
  private readonly jwt: JwtService;
  readonly accessTtlSeconds: number;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.jwt = new JwtService({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: env.ACCESS_TOKEN_TTL as never, issuer: "tobacco-erp-api" },
      verifyOptions: { issuer: "tobacco-erp-api" },
    });
    this.accessTtlSeconds = ttlToSeconds(env.ACCESS_TOKEN_TTL);
  }

  signAccess(claims: AccessTokenClaims): string {
    return this.jwt.sign({ ...claims });
  }

  verifyAccess(token: string): AccessTokenClaims {
    try {
      const payload = this.jwt.verify<AccessTokenClaims>(token);
      if (!payload.sub || (payload.typ !== "STAFF" && payload.typ !== "BUYER")) throw new Error("bad claims");
      return payload;
    } catch {
      throw AppError.unauthorized("Your session has expired — please sign in again", "TOKEN_INVALID");
    }
  }

  /** A fresh opaque token (shown to the user once) and the hash that is stored. */
  generateOpaque(bytes = 48): { token: string; hash: string } {
    const token = randomBytes(bytes).toString("base64url");
    return { token, hash: sha256Hex(token) };
  }

  refreshExpiry(): Date {
    return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }
}

export function ttlToSeconds(ttl: string): number {
  const m = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!m) return 900;
  const n = Number(m[1]);
  switch (m[2]) {
    case "d":
      return n * 86400;
    case "h":
      return n * 3600;
    case "m":
      return n * 60;
    default:
      return n;
  }
}

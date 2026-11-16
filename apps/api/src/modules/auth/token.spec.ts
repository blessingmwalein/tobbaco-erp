import { parseEnv } from "../../config/env";
import { AppError } from "../../common/app-error";
import { TokenService, sha256Hex, ttlToSeconds } from "./token.service";

const source = {
  DATABASE_URL: "postgresql://u:p@h/db",
  DIRECT_URL: "postgresql://u:p@h/db",
  JWT_ACCESS_SECRET: "a-very-long-test-secret-that-is-at-least-32-chars",
  ACCESS_TOKEN_TTL: "15m",
};
const env = parseEnv(source);

describe("TokenService", () => {
  const svc = new TokenService(env);

  it("round-trips identity claims (and nothing about permissions)", () => {
    const token = svc.signAccess({ sub: "u1", typ: "BUYER", org: "o1" });
    const claims = svc.verifyAccess(token);
    expect(claims).toMatchObject({ sub: "u1", typ: "BUYER", org: "o1" });
    expect(JSON.stringify(claims)).not.toMatch(/permission|role/i);
  });

  it("rejects a tampered token, a token signed with another secret, and garbage", () => {
    const token = svc.signAccess({ sub: "u1", typ: "STAFF" });
    const tampered = token.slice(0, -3) + (token.endsWith("aaa") ? "bbb" : "aaa");
    expect(() => svc.verifyAccess(tampered)).toThrow(AppError);
    const other = new TokenService(parseEnv({ ...source, JWT_ACCESS_SECRET: "another-secret-that-is-also-long-enough-123456" }));
    expect(() => svc.verifyAccess(other.signAccess({ sub: "u1", typ: "STAFF" }))).toThrow(AppError);
    expect(() => svc.verifyAccess("not-a-jwt")).toThrow(AppError);
  });

  it("rejects an expired token", () => {
    const short = new TokenService(parseEnv({ ...source, ACCESS_TOKEN_TTL: "1" }));
    const token = short.signAccess({ sub: "u1", typ: "STAFF" });
    return new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        try {
          expect(() => short.verifyAccess(token)).toThrow(AppError);
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 1500),
    );
  });

  it("issues unguessable opaque tokens and stores only their hash", () => {
    const a = svc.generateOpaque();
    const b = svc.generateOpaque();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
    expect(a.hash).toBe(sha256Hex(a.token));
    expect(a.hash).not.toContain(a.token);
  });

  it("converts TTL strings", () => {
    expect(ttlToSeconds("15m")).toBe(900);
    expect(ttlToSeconds("2h")).toBe(7200);
    expect(ttlToSeconds("1d")).toBe(86400);
    expect(ttlToSeconds("90")).toBe(90);
    expect(svc.accessTtlSeconds).toBe(900);
  });
});

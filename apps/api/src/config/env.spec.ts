import { EnvError, parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgresql://u:p@host-pooler.neon.tech/db?sslmode=require",
  DIRECT_URL: "postgresql://u:p@host.neon.tech/db?sslmode=require",
  JWT_ACCESS_SECRET: "x".repeat(40),
};

describe("environment", () => {
  it("accepts a minimal valid configuration and applies safe defaults", () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.MAIL_DRIVER).toBe("outbox");
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(14);
    expect(env.LOGIN_MAX_FAILURES).toBe(5);
  });

  it("fails with a readable message listing every problem (missing Neon strings, weak secret)", () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    try {
      parseEnv({ JWT_ACCESS_SECRET: "short" });
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("DATABASE_URL");
      expect(msg).toContain("DIRECT_URL");
      expect(msg).toContain("JWT_ACCESS_SECRET must be at least 32 characters");
      expect(msg).toContain("env:init");
    }
  });

  it("parses booleans and numbers from strings", () => {
    const env = parseEnv({ ...valid, PORT: "5001", SWAGGER_ENABLED: "false", DEMO_MODE: "1", LOGIN_LOCK_MINUTES: "30" });
    expect(env.PORT).toBe(5001);
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.DEMO_MODE).toBe(true);
    expect(env.LOGIN_LOCK_MINUTES).toBe(30);
  });

  it("rejects an unknown storage or mail driver", () => {
    expect(() => parseEnv({ ...valid, STORAGE_DRIVER: "ftp" })).toThrow(EnvError);
    expect(() => parseEnv({ ...valid, MAIL_DRIVER: "pigeon" })).toThrow(EnvError);
  });
});

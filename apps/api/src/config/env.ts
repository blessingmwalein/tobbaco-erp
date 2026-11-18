import { z } from "zod";

/**
 * Environment configuration — validated once at startup with a clear message.
 * Secrets live in apps/api/.env (never in source control, never in chat). See .env.example.
 */
const boolish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  /** Neon pooled connection string (pgbouncer) — used by the running API. */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Neon pooled connection string)"),
  /** Neon direct connection string — used by Prisma migrations. */
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required (Neon direct connection string)"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),

  /** Comma-separated list of web origins allowed by CORS (the Next.js app). */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  /** Base URL used to build links in emails (activation / password reset). */
  APP_BASE_URL: z.string().default("http://localhost:3000"),

  /**
   * Where uploaded files (Flow Disk, invoices) are kept:
   *  - local:    files on disk under STORAGE_LOCAL_DIR — development only (a serverless host has no durable disk);
   *  - database: file bytes in the PostgreSQL database (private, backed up with the data) — the default on Vercel;
   *  - blob:     object storage — not implemented.
   * Unset = "database" on Vercel (VERCEL=1), otherwise "local". See resolveStorageDriver.
   */
  STORAGE_DRIVER: z.enum(["local", "database", "blob"]).optional(),
  STORAGE_LOCAL_DIR: z.string().default(".storage"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  MAIL_DRIVER: z.enum(["outbox", "smtp"]).default("outbox"),
  MAIL_FROM: z.string().default("Tobacco ERP <no-reply@localhost>"),

  SWAGGER_ENABLED: boolish.default(true),
  /** Dev/demo only: seeds demo accounts and lets the login page list them. */
  DEMO_MODE: boolish.default(true),
  /** Password given to seeded accounts (development only). */
  SEED_PASSWORD: z.string().min(10).optional(),

  LOGIN_MAX_FAILURES: z.coerce.number().int().min(3).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).default(15),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      `Invalid or missing environment configuration:\n  - ${issues.join("\n  - ")}\n` +
        `Copy apps/api/.env.example to apps/api/.env (run "pnpm --filter @tobacco/api env:init" to generate secrets) ` +
        `and add your Neon connection strings.`,
    );
    this.name = "EnvError";
  }
}

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvError(parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`));
  }
  return parsed.data;
}

let cached: Env | undefined;
export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}

/** Test helper. */
export function resetEnvCache(): void {
  cached = undefined;
}

export const ENV = Symbol("ENV");

export type StorageDriver = NonNullable<Env["STORAGE_DRIVER"]>;

/** The storage driver to use: the explicit setting, else the database on serverless (Vercel), else local disk. */
export function resolveStorageDriver(env: Pick<Env, "STORAGE_DRIVER">, runtime: Record<string, string | undefined> = process.env): StorageDriver {
  return env.STORAGE_DRIVER ?? (runtime.VERCEL ? "database" : "local");
}

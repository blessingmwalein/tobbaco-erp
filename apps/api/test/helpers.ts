import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { seedDemo, type SeedResult } from "../prisma/seed-data";

export const HAS_TEST_DB = Boolean(process.env.TEST_DATABASE_URL);
/** Integration suites run only when a test database is configured; otherwise they skip with a message. */
export const describeDb: typeof describe = HAS_TEST_DB
  ? describe
  : ((name: string, fn: () => void) => {
      describe.skip(`${name} [skipped — set TEST_DATABASE_URL to the Neon test branch]`, fn);
    }) as unknown as typeof describe;

export const API = "/api/v1";
export const PASSWORD = process.env.SEED_PASSWORD ?? "Test-Password-2026";

export interface Harness {
  app: NestExpressApplication;
  prisma: PrismaClient;
  seed: SeedResult;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

/** Wipe every table except Prisma's migration history (TRUNCATE does not fire the immutability triggers). */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function boot(): Promise<Harness> {
  const { resetEnvCache } = await import("../src/config/env");
  resetEnvCache();
  const { createApp } = await import("../src/bootstrap");
  const app = await createApp();
  await app.init();
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  await resetDatabase(prisma);
  const seed = await seedDemo(prisma, PASSWORD);
  return {
    app,
    prisma,
    seed,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export async function loginBuyer(h: Harness, email: string, password = PASSWORD): Promise<Tokens> {
  const res = await h.http().post(`${API}/auth/buyer/login`).send({ email, password }).expect(200);
  return res.body as Tokens;
}

export async function loginStaff(h: Harness, email = "admin@tobacco-erp.test", password = PASSWORD): Promise<Tokens> {
  const res = await h.http().post(`${API}/auth/staff/login`).send({ email, password }).expect(200);
  return res.body as Tokens;
}

export const bearer = (t: Tokens | string) => `Bearer ${typeof t === "string" ? t : t.accessToken}`;

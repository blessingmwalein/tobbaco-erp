#!/usr/bin/env node
/**
 * Creates apps/api/.env from .env.example with a freshly generated JWT secret.
 * It deliberately leaves the Neon connection strings EMPTY — you add those yourself (never paste them in chat).
 * Safe to re-run: it never overwrites an existing .env.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, ".env");

if (existsSync(target)) {
  console.log("apps/api/.env already exists — left untouched.");
  console.log("Make sure DATABASE_URL, DIRECT_URL and TEST_DATABASE_URL are filled in (Neon console → Connect).");
  process.exit(0);
}

const example = readFileSync(join(root, ".env.example"), "utf8");
const secret = randomBytes(48).toString("base64url");
writeFileSync(target, example.replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret}`));

console.log("Created apps/api/.env with a generated JWT_ACCESS_SECRET.");
console.log("\nNext, open apps/api/.env and paste your Neon connection strings:");
console.log("  DATABASE_URL       pooled string of the `dev` branch   (host contains -pooler)");
console.log("  DIRECT_URL         direct string of the `dev` branch");
console.log("  TEST_DATABASE_URL  direct string of the `test` branch  (integration tests RESET this branch)");
console.log("\nThen:  pnpm --filter @tobacco/api prisma:migrate:deploy && pnpm --filter @tobacco/api db:seed");

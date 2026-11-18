/**
 * Integration-test environment. Integration tests run against a DISPOSABLE database (TEST_DATABASE_URL — a separate
 * Neon `test` BRANCH, or a scratch Postgres) and RESET its data: `boot()` TRUNCATEs every table.
 * Without TEST_DATABASE_URL the suites skip with a clear message instead of failing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDevelopmentDatabase, sameDatabase } from "../src/common/db-safety";

const url = process.env.TEST_DATABASE_URL;

if (url) {
  // SAFETY: the suites wipe the database they run against. Refuse outright when TEST_DATABASE_URL is the development
  // database — either the DATABASE_URL in this process or the one written in apps/api/.env (jest does not load .env, so
  // the process variable alone would miss the usual mistake of pasting the same Neon URL into both).
  const envText = (() => {
    try {
      return readFileSync(resolve(__dirname, "../.env"), "utf8");
    } catch {
      return undefined;
    }
  })();
  const dev = process.env.DATABASE_URL;
  if ((dev && sameDatabase(dev, url)) || isDevelopmentDatabase(url, envText)) {
    throw new Error(
      "Refusing to run integration tests: TEST_DATABASE_URL points at the SAME database as DATABASE_URL (the development database). " +
        "The tests TRUNCATE every table. Create a separate Neon branch (or a scratch Postgres) for TEST_DATABASE_URL.",
    );
  }
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET ??= "integration-test-secret-that-is-long-enough-123456";
process.env.SEED_PASSWORD ??= "Test-Password-2026";
process.env.STORAGE_LOCAL_DIR ??= ".storage-test";
process.env.MAIL_DRIVER ??= "outbox";
process.env.SWAGGER_ENABLED ??= "false";
process.env.LOGIN_MAX_FAILURES ??= "5";

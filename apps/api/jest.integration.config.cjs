/**
 * Integration tests: real HTTP (Supertest) against a real PostgreSQL — the Neon `test` branch (TEST_DATABASE_URL).
 * They are skipped with a clear message when TEST_DATABASE_URL is not set. Run with --runInBand.
 */
const base = require("./jest.config.cjs");

module.exports = {
  ...base,
  testMatch: ["<rootDir>/test/**/*.e2e-spec.ts"],
  setupFiles: ["<rootDir>/test/setup-env.ts"],
  testTimeout: 60000,
};

/**
 * Integration-test environment. Integration tests run against the Neon `test` BRANCH (TEST_DATABASE_URL) and RESET its data.
 * Without TEST_DATABASE_URL the suites skip with a clear message instead of failing.
 */
const url = process.env.TEST_DATABASE_URL;
if (url) {
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

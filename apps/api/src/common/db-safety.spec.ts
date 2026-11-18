import { databaseIdentity, databaseUrlFromEnvText, isDevelopmentDatabase, sameDatabase } from "./db-safety";

// fake hosts and credentials only — these tests never touch a database
const DEV = "postgresql://owner:secret@ep-fake-dev-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require";

describe("database safety guard", () => {
  it("recognises the same database whatever the pooler suffix, password or parameters", () => {
    expect(sameDatabase(DEV, "postgresql://owner:other@ep-fake-dev.c-9.us-east-2.aws.neon.tech/neondb?channel_binding=require")).toBe(true);
    expect(databaseIdentity(DEV)).toBe("ep-fake-dev.c-9.us-east-2.aws.neon.tech|/neondb|owner");
  });

  it("tells a different database apart (other branch host, other database name, other user, local)", () => {
    expect(sameDatabase(DEV, "postgresql://owner:x@ep-fake-test.c-9.us-east-2.aws.neon.tech/neondb")).toBe(false);
    expect(sameDatabase(DEV, "postgresql://owner:x@ep-fake-dev.c-9.us-east-2.aws.neon.tech/scratch")).toBe(false);
    expect(sameDatabase(DEV, "postgresql://other:x@ep-fake-dev.c-9.us-east-2.aws.neon.tech/neondb")).toBe(false);
    expect(sameDatabase(DEV, "postgresql://postgres:postgres@localhost:54330/tobacco_reports")).toBe(false);
  });

  it("reads DATABASE_URL from .env text (quoted or not, with other keys around it) and ignores TEST_DATABASE_URL", () => {
    expect(databaseUrlFromEnvText(`PORT=4000\nDATABASE_URL="${DEV}"\nTEST_DATABASE_URL="postgresql://x"`)).toBe(DEV);
    expect(databaseUrlFromEnvText(`DATABASE_URL=${DEV}\r\n`)).toBe(DEV);
    expect(databaseUrlFromEnvText("TEST_DATABASE_URL=postgresql://x")).toBeUndefined();
    expect(databaseUrlFromEnvText("")).toBeUndefined();
  });

  it("flags only the development database as off-limits", () => {
    const env = `DATABASE_URL="${DEV}"\nTEST_DATABASE_URL="${DEV}"`;
    expect(isDevelopmentDatabase(DEV, env)).toBe(true);
    expect(isDevelopmentDatabase("postgresql://postgres:postgres@localhost:54330/tobacco_reports", env)).toBe(false);
    expect(isDevelopmentDatabase(DEV, undefined)).toBe(false); // no .env to compare with
    expect(isDevelopmentDatabase("not a url", env)).toBe(false);
  });
});

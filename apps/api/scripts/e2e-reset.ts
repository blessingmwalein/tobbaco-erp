/**
 * Wipe the database and re-seed the demo accounts so browser journeys start from a known state.
 * DESTRUCTIVE — it TRUNCATEs every table. It refuses to run unless you opt in explicitly:
 *
 *   ALLOW_DB_RESET=yes pnpm --filter @tobacco/api e2e:reset
 *
 * Point DATABASE_URL at the Neon `test` branch (or a scratch database), never at data you want to keep.
 */
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../prisma/seed-data";

async function main() {
  if (process.env.ALLOW_DB_RESET !== "yes") {
    console.error('Refusing to reset: set ALLOW_DB_RESET=yes to confirm that DATABASE_URL is a disposable test database.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const host = new URL(url).host;
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length > 0) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
    }
    const password = process.env.SEED_PASSWORD ?? "Test-Password-2026";
    await seedDemo(prisma, password);
    console.log(`Reset and re-seeded demo data on ${host}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

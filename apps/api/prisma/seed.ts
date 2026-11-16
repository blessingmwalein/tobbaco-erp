/**
 * Seed — DEMO data for development (idempotent; safe to re-run).
 *   - 1 ERP staff administrator
 *   - Buyer organisation MOROZ TOBACCO (MZ) with one user per buyer role, warehouses/bays/rows, processing companies
 *   - A second buyer organisation (KT) so tenant isolation can be demonstrated and tested
 * All accounts get SEED_PASSWORD. Names/emails are clearly demo values. No purchases are seeded: they arrive by
 * importing the sample Flow Disk (see samples/flowdisk/).
 */
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 10) throw new Error("Set SEED_PASSWORD (min 10 characters) in apps/api/.env before seeding.");
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo accounts in production.");
  await seedDemo(prisma, password);
  console.log("Seed complete.");
  console.log("  ERP staff:  admin@tobacco-erp.test");
  console.log("  MOROZ (MZ): admin@ / warehouse@ / operations@ / finance@ / viewer@ moroz-demo.test");
  console.log("  KT (demo):  admin@kt-demo.test");
  console.log("  Password:   the value of SEED_PASSWORD");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Demo seed data as a reusable function (used by prisma/seed.ts and by the integration tests).
 * Idempotent: safe to run repeatedly.
 */
import { hash } from "@node-rs/argon2";
import { type BuyerRole, type PrismaClient } from "@prisma/client";

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export interface SeedResult {
  mzId: string;
  ktId: string;
}

export async function seedDemo(prisma: PrismaClient, password: string): Promise<SeedResult> {
  if (password.length < 10) throw new Error("Seed password must be at least 10 characters");
  const passwordHash = await hash(password, OPTIONS);
  await prisma.staffUser.upsert({
    where: { email: "admin@tobacco-erp.test" },
    update: { passwordHash, active: true },
    create: { email: "admin@tobacco-erp.test", name: "ERP Administrator", passwordHash, role: "ADMIN" },
  });

  const mz = await upsertOrgWith(prisma, { code: "MZ", name: "MOROZ TOBACCO", contactPerson: "Demo Contact", phone: "+263 77 000 0001", email: "office@moroz-demo.test", address: "Demo address, Harare (DEMO)", registrationNo: "DEMO-MZ-001" });
  const kt = await upsertOrgWith(prisma, { code: "KT", name: "KT TOBACCO (demo)", contactPerson: "Demo Contact", phone: "+263 77 000 0002", email: "office@kt-demo.test", address: "Demo address, Bulawayo (DEMO)", registrationNo: "DEMO-KT-001" });

  const users: Array<[string, string, string, BuyerRole]> = [
    [mz.id, "admin@moroz-demo.test", "Moroz Administrator", "BUYER_ADMINISTRATOR"],
    [mz.id, "warehouse@moroz-demo.test", "Tafara Warehouse", "WAREHOUSE_MANAGER"],
    [mz.id, "operations@moroz-demo.test", "Nyasha Operations", "OPERATIONS_OFFICER"],
    [mz.id, "finance@moroz-demo.test", "Rudo Finance", "FINANCE_OFFICER"],
    [mz.id, "viewer@moroz-demo.test", "Vimbai Viewer", "VIEWER"],
    [kt.id, "admin@kt-demo.test", "KT Administrator", "BUYER_ADMINISTRATOR"],
  ];
  for (const [orgId, email, name, role] of users) {
    await prisma.buyerUser.upsert({
      where: { email },
      update: { passwordHash, active: true, roles: [role], name },
      create: { buyerOrganisationId: orgId, email, name, passwordHash, roles: [role] },
    });
  }

  // MOROZ warehouses: Buyer → Warehouse → Bay → Row
  await warehouse(prisma, mz.id, { code: "MAIN", name: "Buyer Main Warehouse", kind: "STANDARD" }, ["BAY-01", "BAY-02", "BAY-03"], ["ROW-A", "ROW-B", "ROW-C", "ROW-D"], 40);
  await warehouse(prisma, mz.id, { code: "SEC", name: "Buyer Secondary Warehouse", kind: "STANDARD" }, ["BAY-01", "BAY-02"], ["ROW-A", "ROW-B"], 30);
  await warehouse(prisma, mz.id, { code: "PROC", name: "Processing Warehouse", kind: "PROCESSING" }, ["BAY-01", "BAY-02"], ["ROW-A", "ROW-B", "ROW-C"], 40);
  await warehouse(prisma, kt.id, { code: "MAIN", name: "KT Main Warehouse (demo)", kind: "STANDARD" }, ["BAY-01"], ["ROW-A", "ROW-B"], 30);

  // DEMO processing companies (the real partners are the buyer's own data)
  for (const [name, reg, contact] of [
    ["Demo Processing Co (Pvt) Ltd", "DEMO-PC-001", "Processing Contact"],
    ["Sample Redrying Services", "DEMO-PC-002", "Redrying Contact"],
  ] as const) {
    await prisma.processingCompany.upsert({
      where: { buyerOrganisationId_name: { buyerOrganisationId: mz.id, name } },
      update: {},
      create: { buyerOrganisationId: mz.id, name, registrationNo: reg, contactPerson: contact, phone: "+263 77 000 0100", email: "ops@processing-demo.test", address: "Demo industrial site (DEMO)" },
    });
  }

  return { mzId: mz.id, ktId: kt.id };
}

async function upsertOrgWith(prisma: PrismaClient, o: { code: string; name: string; contactPerson: string; phone: string; email: string; address: string; registrationNo: string }) {
  return prisma.buyerOrganisation.upsert({ where: { code: o.code }, update: { name: o.name, status: "ACTIVE" }, create: o });
}

async function warehouse(
  prisma: PrismaClient,
  orgId: string,
  w: { code: string; name: string; kind: "STANDARD" | "PROCESSING" },
  bays: string[],
  rows: string[],
  capacity: number,
) {
  const wh = await prisma.warehouse.upsert({
    where: { buyerOrganisationId_code: { buyerOrganisationId: orgId, code: w.code } },
    update: {},
    create: { buyerOrganisationId: orgId, code: w.code, name: w.name, kind: w.kind },
  });
  for (const bayCode of bays) {
    const bay = await prisma.bay.upsert({
      where: { warehouseId_code: { warehouseId: wh.id, code: bayCode } },
      update: {},
      create: { buyerOrganisationId: orgId, warehouseId: wh.id, code: bayCode },
    });
    for (const rowCode of rows) {
      await prisma.warehouseRow.upsert({
        where: { bayId_code: { bayId: bay.id, code: rowCode } },
        update: {},
        create: { buyerOrganisationId: orgId, bayId: bay.id, code: rowCode, capacityBales: capacity },
      });
    }
  }
}

import { TenantViolationError } from "../src/database/tenant-extension";
import { PrismaService } from "../src/database/prisma.service";
import { nextSequence } from "../src/common/reference";
import { boot, describeDb, type Harness } from "./helpers";
import { makeBale, makePurchase } from "./fixtures";

describeDb("data integrity (enforced by the database, not just the API)", () => {
  let h: Harness;
  let mz: string;
  let kt: string;
  beforeAll(async () => {
    h = await boot();
    mz = h.seed.mzId;
    kt = h.seed.ktId;
  });
  afterAll(async () => {
    await h?.close();
  });

  describe("tenant isolation (Prisma extension)", () => {
    it("a scoped client only sees its own organisation's rows", async () => {
      const prisma = h.app.get(PrismaService);
      const mzWarehouses = await prisma.forOrganisation(mz).warehouse.findMany();
      const ktWarehouses = await prisma.forOrganisation(kt).warehouse.findMany();
      expect(mzWarehouses.length).toBe(3);
      expect(ktWarehouses.length).toBe(1);
      expect(mzWarehouses.every((w) => w.buyerOrganisationId === mz)).toBe(true);
    });

    it("cannot read, update or delete another organisation's row even by its exact id", async () => {
      const prisma = h.app.get(PrismaService);
      const ktWarehouse = await prisma.warehouse.findFirstOrThrow({ where: { buyerOrganisationId: kt } });
      const asMz = prisma.forOrganisation(mz);
      expect(await asMz.warehouse.findUnique({ where: { id: ktWarehouse.id } })).toBeNull();
      expect(await asMz.warehouse.findFirst({ where: { id: ktWarehouse.id } })).toBeNull();
      expect((await asMz.warehouse.updateMany({ where: { id: ktWarehouse.id }, data: { name: "hijacked" } })).count).toBe(0);
      expect((await asMz.warehouse.deleteMany({ where: { id: ktWarehouse.id } })).count).toBe(0);
      expect(await asMz.warehouse.count({ where: { id: ktWarehouse.id } })).toBe(0);
      expect((await prisma.warehouse.findUniqueOrThrow({ where: { id: ktWarehouse.id } })).name).not.toBe("hijacked");
    });

    it("stamps its organisation on create and refuses to write for another one", async () => {
      const prisma = h.app.get(PrismaService);
      const created = await prisma.forOrganisation(mz).processingCompany.create({ data: { name: "Scoped Create Co" } as never });
      expect(created.buyerOrganisationId).toBe(mz);
      await expect(
        prisma.forOrganisation(mz).processingCompany.create({ data: { name: "Smuggled Co", buyerOrganisationId: kt } as never }),
      ).rejects.toBeInstanceOf(TenantViolationError);
    });
  });

  describe("immutable ledgers (database triggers)", () => {
    it("bale events and movements can be appended but never edited or deleted", async () => {
      const purchase = await makePurchase(h.prisma, mz);
      const bale = await makeBale(h.prisma, mz, purchase.id, "111000937M");
      const event = await h.prisma.baleEvent.create({ data: { buyerOrganisationId: mz, baleId: bale.id, type: "PURCHASED", performedByName: "Test" } });
      const move = await h.prisma.baleMovement.create({ data: { buyerOrganisationId: mz, baleId: bale.id, type: "STORE", reason: "test", performedById: h.seed.mzId } });
      await expect(h.prisma.$executeRawUnsafe(`UPDATE bale_events SET notes = 'x' WHERE id = '${event.id}'::uuid`)).rejects.toThrow(/immutable ledger/);
      await expect(h.prisma.$executeRawUnsafe(`DELETE FROM bale_events WHERE id = '${event.id}'::uuid`)).rejects.toThrow(/immutable ledger/);
      await expect(h.prisma.$executeRawUnsafe(`UPDATE bale_movements SET reason = 'x' WHERE id = '${move.id}'::uuid`)).rejects.toThrow(/immutable ledger/);
      await expect(h.prisma.baleEvent.update({ where: { id: event.id }, data: { notes: "x" } })).rejects.toThrow(/immutable ledger/);
    });
  });

  describe("bale identity and barcodes", () => {
    it("keeps the blank check character exactly (a barcode may end in a space) and never trims it", async () => {
      const purchase = await makePurchase(h.prisma, mz);
      const bale = await makeBale(h.prisma, mz, purchase.id, "111089477 ");
      const back = await h.prisma.bale.findUniqueOrThrow({ where: { id: bale.id } });
      expect(back.barcode).toBe("111089477 ");
      expect(back.barcode).toHaveLength(10);
    });

    it("a barcode is unique within a season — even across organisations", async () => {
      const a = await makePurchase(h.prisma, mz);
      const b = await makePurchase(h.prisma, kt, "KT");
      await makeBale(h.prisma, mz, a.id, "111000978R");
      await expect(makeBale(h.prisma, kt, b.id, "111000978R")).rejects.toThrow(/Unique constraint/);
      await expect(makeBale(h.prisma, kt, b.id, "111000978R", { season: 2027 })).resolves.toBeTruthy(); // another season is fine
    });

    it("rejects impossible bales: wrong barcode length, zero mass, negative value", async () => {
      const p = await makePurchase(h.prisma, mz);
      await expect(makeBale(h.prisma, mz, p.id, "11100093")).rejects.toThrow(/bales_barcode_length/);
      await expect(makeBale(h.prisma, mz, p.id, "111000999U", { massKg: "0" })).rejects.toThrow(/bales_mass_positive/);
      await expect(makeBale(h.prisma, mz, p.id, "111000999U", { usdValue: "-1" })).rejects.toThrow(/bales_value_not_negative/);
    });

    it("a bale has at most one coherent location, and only stored bales have one", async () => {
      const p = await makePurchase(h.prisma, mz);
      const wh = await h.prisma.warehouse.findFirstOrThrow({ where: { buyerOrganisationId: mz, code: "MAIN" }, include: { bays: { include: { rows: true } } } });
      const bay = wh.bays[0]!;
      const row = bay.rows[0]!;
      // row without bay is incoherent
      await expect(makeBale(h.prisma, mz, p.id, "111001036D", { status: "IN_STOCK", currentWarehouseId: wh.id, currentRowId: row.id })).rejects.toThrow(/bales_location_hierarchy/);
      // a dispatched bale cannot sit in a warehouse
      await expect(makeBale(h.prisma, mz, p.id, "1110010419", { status: "DISPATCHED", currentWarehouseId: wh.id })).rejects.toThrow(/bales_no_location_unless_stored/);
      await expect(makeBale(h.prisma, mz, p.id, "111001046E", { status: "IN_STOCK", currentWarehouseId: wh.id, currentBayId: bay.id, currentRowId: row.id })).resolves.toBeTruthy();
    });
  });

  describe("one live receipt per bale / one open dispatch per bale / one live import per file", () => {
    it("a bale cannot be received twice without voiding the first receipt (authorised correction)", async () => {
      const p = await makePurchase(h.prisma, mz);
      const bale = await makeBale(h.prisma, mz, p.id, "111001047F");
      const session = await h.prisma.receivingSession.create({ data: { buyerOrganisationId: mz, purchaseId: p.id, reference: "RCV-T-1", startedById: h.seed.mzId } });
      const scan = () => h.prisma.receivingScan.create({ data: { sessionId: session.id, buyerOrganisationId: mz, barcode: "111001047F", result: "RECEIVED", baleId: bale.id, scannedById: h.seed.mzId } });
      const first = await scan();
      await expect(scan()).rejects.toThrow(/Unique constraint/);
      // duplicate scans are recorded as attempts (not RECEIVED) and are always allowed
      await h.prisma.receivingScan.create({ data: { sessionId: session.id, buyerOrganisationId: mz, barcode: "111001047F", result: "DUPLICATE_SCAN", baleId: bale.id, scannedById: h.seed.mzId } });
      await h.prisma.receivingScan.update({ where: { id: first.id }, data: { voidedAt: new Date(), voidReason: "wrong bale scanned" } });
      await expect(scan()).resolves.toBeTruthy();
    });

    it("a bale can be outstanding on only one dispatch at a time", async () => {
      const p = await makePurchase(h.prisma, mz);
      const bale = await makeBale(h.prisma, mz, p.id, "111001061B", { status: "DISPATCHED" });
      const company = await h.prisma.processingCompany.findFirstOrThrow({ where: { buyerOrganisationId: mz } });
      const mk = (ref: string) =>
        h.prisma.dispatch.create({ data: { buyerOrganisationId: mz, reference: ref, processingCompanyId: company.id, dispatchDate: new Date("2026-06-01"), reason: "test", totalBales: 1, totalMassKg: "84", createdById: h.seed.mzId } });
      const d1 = await mk("DSP-T-1");
      const d2 = await mk("DSP-T-2");
      const line = (dispatchId: string) =>
        h.prisma.dispatchBale.create({ data: { buyerOrganisationId: mz, dispatchId, baleId: bale.id, massKgAtDispatch: "84" } });
      const first = await line(d1.id);
      await expect(line(d2.id)).rejects.toThrow(/Unique constraint/);
      await h.prisma.dispatchBale.update({ where: { id: first.id }, data: { status: "RETURNED" } });
      await expect(line(d2.id)).resolves.toBeTruthy();
    });

    it("the same file cannot become two live imports for one buyer, but a rejected duplicate can be recorded", async () => {
      const mk = (ref: string, status: "STAGED" | "COMPLETED" | "REJECTED_DUPLICATE" | "CANCELLED") =>
        h.prisma.flowDiskImport.create({
          data: { buyerOrganisationId: mz, reference: ref, status, filename: "MZ_20260522.V", parserId: "v0", parserVersion: "0", fileSha256: "abc123", header: {}, stagedRows: [], createdById: h.seed.mzId },
        });
      await mk("IMP-T-1", "STAGED");
      await expect(mk("IMP-T-2", "STAGED")).rejects.toThrow(/Unique constraint/);
      await expect(mk("IMP-T-3", "COMPLETED")).rejects.toThrow(/Unique constraint/);
      await expect(mk("IMP-T-4", "REJECTED_DUPLICATE")).resolves.toBeTruthy();
      // another buyer importing an identical file is not a duplicate of ours
      await expect(
        h.prisma.flowDiskImport.create({ data: { buyerOrganisationId: kt, reference: "IMP-T-5", status: "STAGED", filename: "x.V", parserId: "v0", parserVersion: "0", fileSha256: "abc123", header: {}, stagedRows: [], createdById: h.seed.ktId } }),
      ).resolves.toBeTruthy();
    });
  });

  describe("document reference numbers", () => {
    it("are unique under concurrency (25 parallel requests get 25 different numbers)", async () => {
      const results = await Promise.all(Array.from({ length: 25 }, () => nextSequence(h.prisma, mz, "DSP-2026")));
      expect(new Set(results).size).toBe(25);
      expect(Math.min(...results)).toBe(1);
      expect(Math.max(...results)).toBe(25);
    });

    it("are independent per organisation and per key", async () => {
      expect(await nextSequence(h.prisma, kt, "DSP-2026")).toBe(1);
      expect(await nextSequence(h.prisma, mz, "RCV-2026")).toBe(1);
      expect(await nextSequence(h.prisma, mz, "DSP-2026")).toBe(26);
    });
  });
});

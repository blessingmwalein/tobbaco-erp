import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import type { ReportResultDto, ReportRow } from "@tobacco/shared";
import { API, bearer, boot, describeDb, loginBuyer, type Harness } from "./helpers";
import { buildReportScenario, type Scenario } from "./scenario";

const harareDay = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
const binary = (res: NodeJS.ReadableStream & { on: (e: string, cb: (c?: Buffer) => void) => void }, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on("data", (c?: Buffer) => c && chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

describeDb("reports (real HTTP + real database)", () => {
  let h: Harness;
  let s: Scenario;
  let admin: string, viewer: string, finance: string, ops: string, warehouse: string, kt: string;

  beforeAll(async () => {
    h = await boot();
    s = await buildReportScenario(h.prisma, h.seed.mzId, h.seed.ktId);
    admin = bearer(await loginBuyer(h, "admin@moroz-demo.test"));
    viewer = bearer(await loginBuyer(h, "viewer@moroz-demo.test"));
    finance = bearer(await loginBuyer(h, "finance@moroz-demo.test"));
    ops = bearer(await loginBuyer(h, "operations@moroz-demo.test"));
    warehouse = bearer(await loginBuyer(h, "warehouse@moroz-demo.test"));
    kt = bearer(await loginBuyer(h, "admin@kt-demo.test"));
  });
  afterAll(async () => {
    await h?.close();
  });

  const call = (token: string, id: string, query: Record<string, string | number | boolean> = {}) => h.http().get(`${API}/buyer/reports/${id}`).query(query).set("Authorization", token);
  const report = async (id: string, query: Record<string, string | number | boolean> = {}, token = admin): Promise<ReportResultDto> => (await call(token, id, query).expect(200)).body;
  const byDate = (r: ReportResultDto, saleDate: string): ReportRow => r.rows.find((x) => x.saleDate === saleDate)!;
  const tile = (r: ReportResultDto, label: string) => r.tiles.find((t) => t.label === label);
  const download = (token: string, id: string, query: Record<string, string | number | boolean>) =>
    h.http().get(`${API}/buyer/reports/${id}/export`).query(query).set("Authorization", token).buffer(true).parse(binary as never);

  // ── Purchase reports ───────────────────────────────────────────────────────
  describe("Purchase Register", () => {
    it("lists every purchase with exact figures, whole-set totals and tiles", async () => {
      const r = await report("purchase-register");
      expect(r).toMatchObject({ reportId: "purchase-register", area: "purchases", total: 3, page: 1 });
      expect(r.rows.map((x) => x.saleDate)).toEqual(["2026-06-10", "2026-05-22", "2026-04-01"]); // newest first
      const a = byDate(r, "2026-05-22");
      expect(a).toMatchObject({ invoiceNo: "INV-A-001", floorName: "ETHICAL SALES FLOOR", bales: 10, massKg: "960.0", avgUsc: "241.67", usd: "2320.00", payableUsd: "1631.50", payableZig: "20340.00", shipments: 2, receivingStatus: "PARTIALLY_RECEIVED", reconciliationStatus: "IN_PROGRESS" });
      const b = byDate(r, "2026-06-10");
      expect(String(b.invoiceNo)).toMatch(/^BINV-MZ-/); // no printed number → the system reference
      expect(b).toMatchObject({ payableUsd: null, payableZig: null, shipments: 0, reconciliationStatus: "AWAITING_SHIPMENTS" });
      expect(r.totals).toEqual({ bales: 17, massKg: "1660.0", usd: "4070.00", payableUsd: "1631.50", payableZig: "20340.00" });
      expect(tile(r, "Purchases")?.value).toBe("3");
      expect(tile(r, "Bales bought")?.value).toBe("17");
      expect(tile(r, "Payable US$")?.value).toBe("US$ 1,631.50");
      expect(r.columns.map((c) => c.key)).toContain("reconciliationStatus");
    });

    it("filters by date range (the end day is included), floor, status, reconciliation and search", async () => {
      expect((await report("purchase-register", { from: "2026-05-01", to: "2026-05-31" })).rows).toHaveLength(1);
      expect((await report("purchase-register", { from: "2026-05-22", to: "2026-05-22" })).total).toBe(1); // same day both ends
      expect((await report("purchase-register", { floor: "other" })).rows.map((x) => x.saleDate)).toEqual(["2026-06-10"]);
      expect((await report("purchase-register", { status: "COMPLETE" })).rows.map((x) => x.saleDate)).toEqual(["2026-04-01"]);
      expect((await report("purchase-register", { kind: "AWAITING_SHIPMENTS" })).rows.map((x) => x.saleDate)).toEqual(["2026-06-10"]);
      expect((await report("purchase-register", { search: "inv-a-001" })).rows).toHaveLength(1);
      const none = await report("purchase-register", { floor: "no such floor" });
      expect(none).toMatchObject({ total: 0, rows: [] });
      expect(none.totals).toMatchObject({ bales: 0, usd: "0.00" }); // empty set → zeros, not an error
      expect(none.filters).toEqual([{ label: "Floor", value: "no such floor" }]);
    });

    it("pages and sorts only by whitelisted columns", async () => {
      const p2 = await report("purchase-register", { pageSize: 2, page: 2 });
      expect(p2.rows).toHaveLength(1);
      expect(p2.total).toBe(3);
      expect((await report("purchase-register", { sort: "usd", dir: "desc" })).rows[0]).toMatchObject({ usd: "2320.00" });
      expect((await report("purchase-register", { sort: "usd", dir: "asc" })).rows[0]).toMatchObject({ usd: "500.00" });
      // an unknown / non-sortable column is ignored (default order), never passed to the database
      expect((await report("purchase-register", { sort: "invoiceNo; DROP TABLE purchases" })).rows[0]).toMatchObject({ saleDate: "2026-06-10" });
    });

    it("rejects bad input with a clear 422", async () => {
      expect((await call(admin, "purchase-register", { status: "BOGUS" }).expect(422)).body.error.code).toBe("INVALID_FILTER");
      expect((await call(admin, "purchase-register", { from: "2026-06-01", to: "2026-05-01" }).expect(422)).body.error.code).toBe("VALIDATION_FAILED");
      expect((await call(admin, "purchase-register", { from: "01/06/2026" }).expect(422)).body.error.code).toBe("VALIDATION_FAILED");
      await call(admin, "purchase-register", { pageSize: 101 }).expect(422);
      expect((await call(admin, "no-such-report").expect(422)).body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("Invoices & Charges", () => {
    it("shows tobacco value, each levy and the payable amount; payable is section B only", async () => {
      const r = await report("invoice-charges");
      const a = r.rows.find((x) => x.invoiceNo === "INV-A-001")!;
      expect(a).toMatchObject({ tobaccoUsd: "2320.00", tobaccoZig: "61000.00", govLevyUsd: "0.00", govLevyZig: "1500.00", ttaUsd: "7.50", ttaZig: "90.00", clearingUsd: "0.00", clearingZig: "450.00", payableUsd: "1631.50", payableZig: "20340.00" });
      expect(r.totals).toMatchObject({ tobaccoUsd: "2320.00", ttaUsd: "7.50", payableUsd: "1631.50", payableZig: "20340.00" });
      expect(tile(r, "Levies & clearing ZiG")?.value).toBe("ZiG 2,040.00"); // 1500 + 90 + 450
      expect(tile(r, "Levies & clearing US$")?.value).toBe("US$ 7.50");
    });
    it("needs the invoices permission as well as the reports permission", async () => {
      for (const token of [viewer, ops, warehouse]) expect((await call(token, "invoice-charges").expect(403)).body.error.code).toBe("PERMISSION_DENIED");
      await call(finance, "invoice-charges").expect(200);
    });
  });

  describe("Purchases by Grade and Flow Disk imports", () => {
    it("groups bales by grade with exact mass, value, average price and share", async () => {
      const r = await report("purchases-by-grade");
      expect(r.rows).toEqual([
        { grade: "L4OMA", bales: 15, massKg: "1500.0", usd: "3750.00", avgUsc: "250.00", share: "88.2" },
        { grade: "L4R", bales: 2, massKg: "160.0", usd: "320.00", avgUsc: "200.00", share: "11.8" },
      ]);
      expect(r.totals).toMatchObject({ bales: 17, massKg: "1660.0", usd: "4070.00", avgUsc: "245.18" });
      expect((await report("purchases-by-grade", { grade: "L4R" })).rows).toHaveLength(1);
      expect((await report("purchases-by-grade", { purchaseId: s.mz.purchaseA })).totals).toMatchObject({ bales: 10 });
    });

    it("registers every import with its status and row counts", async () => {
      const r = await report("flow-disk-imports");
      expect(r.total).toBe(2);
      expect(r.rows.map((x) => x.status).sort()).toEqual(["COMPLETED", "STAGED"]);
      expect(r.totals).toEqual({ records: 15, valid: 14, invalid: 1 });
      expect(tile(r, "Completed")?.value).toBe("1");
      expect(tile(r, "Staged (not confirmed)")?.value).toBe("1");
      expect(String(r.rows[0]!.format)).toContain("unverified format");
      expect((await report("flow-disk-imports", { status: "COMPLETED" })).rows).toHaveLength(1);
    });
  });

  // ── Receiving reports ──────────────────────────────────────────────────────
  describe("Purchase vs Shipment vs Received", () => {
    it("compares invoice, shipment manifests and scans with the exact differences", async () => {
      const r = await report("purchase-shipment-received");
      expect(r.total).toBe(3);
      expect(byDate(r, "2026-05-22")).toMatchObject({
        purchasedBales: 10, purchasedKg: "960.0",
        dispatchedBales: 9, dispatchedKg: "880.0",
        receivedBales: 6, receivedKg: "401.0", weighed: "4 / 6",
        notDispatched: 1, outstanding: 3, massVarianceKg: "1.0",
        reconciliationStatus: "IN_PROGRESS",
      });
      expect(byDate(r, "2026-06-10")).toMatchObject({ purchasedBales: 5, dispatchedBales: 0, receivedBales: 0, weighed: "—", notDispatched: 5, outstanding: 0, massVarianceKg: null });
      expect(byDate(r, "2026-04-01")).toMatchObject({ purchasedBales: 2, dispatchedBales: 2, receivedBales: 2, weighed: "2 / 2", notDispatched: 0, outstanding: 0, massVarianceKg: "0.0", reconciliationStatus: "CLOSED" });
      expect(r.totals).toEqual({ purchasedBales: 17, purchasedKg: "1660.0", dispatchedBales: 11, dispatchedKg: "1080.0", receivedBales: 8, receivedKg: "601.0", notDispatched: 6, outstanding: 3, massVarianceKg: "1.0" });
      expect(tile(r, "Outstanding bales")?.value).toBe("3");
      expect(tile(r, "Weighed at receiving")?.value).toBe("6 of 8");
    });

    it("'only with differences' drops purchases that match exactly, and puts the worst first", async () => {
      const r = await report("purchase-shipment-received", { onlyVariances: true });
      expect(r.rows.map((x) => x.saleDate)).toEqual(["2026-05-22", "2026-06-10"]); // C (no differences) is gone
      expect(r.total).toBe(2);
      expect(r.filters).toContainEqual({ label: "Show", value: "only with differences" });
    });

    it("filters by sale date and reconciliation status", async () => {
      expect((await report("purchase-shipment-received", { from: "2026-06-01", to: "2026-06-30" })).rows).toHaveLength(1);
      expect((await report("purchase-shipment-received", { kind: "CLOSED" })).rows.map((x) => x.saleDate)).toEqual(["2026-04-01"]);
    });

    it("a cancelled shipment is not counted as dispatched", async () => {
      await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "CANCELLED" } });
      try {
        const a = byDate(await report("purchase-shipment-received"), "2026-05-22");
        expect(a).toMatchObject({ dispatchedBales: 6, dispatchedKg: "600.0", notDispatched: 4, outstanding: 0 });
      } finally {
        await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "IN_TRANSIT" } });
      }
    });
  });

  describe("Shipment Register", () => {
    it("lists shipments with truck, destination, received vs expected and days in transit", async () => {
      const r = await report("shipment-register");
      expect(r.total).toBe(3);
      expect(r.rows.map((x) => x.dispatchDate)).toEqual(["2026-05-28", "2026-05-23", "2026-04-02"]);
      const s1 = r.rows.find((x) => x.dispatchDate === "2026-05-23")!;
      expect(s1).toMatchObject({ truck: "TRK 9900 / TRL 1", driver: "Tendai (Acme Haulage)", destination: "Buyer Main Warehouse", expectedBales: 6, receivedBales: 6, expectedKg: "600.0", receivedKg: "600.0", daysInTransit: 2, status: "ALLOCATED" });
      const s2 = r.rows.find((x) => x.dispatchDate === "2026-05-28")!;
      expect(s2).toMatchObject({ receivedBales: 0, receivedKg: "0.0", arrivedAt: null, status: "IN_TRANSIT" });
      expect(Number(s2.daysInTransit)).toBeGreaterThan(100); // still in transit: counted up to today
      expect(tile(r, "In transit")).toMatchObject({ value: "1", detail: "3 bales" });
      expect(tile(r, "Received and stored")).toMatchObject({ value: "2", detail: "8 bales" });
      expect(r.totals).toEqual({ expectedBales: 11, expectedKg: "1080.0" });
    });

    it("filters by status, dispatch date (inclusive), destination warehouse and search", async () => {
      expect((await report("shipment-register", { status: "IN_TRANSIT" })).total).toBe(1);
      expect((await report("shipment-register", { from: "2026-05-24", to: "2026-05-31" })).rows).toHaveLength(1);
      expect((await report("shipment-register", { from: "2026-05-28", to: "2026-05-28" })).rows).toHaveLength(1);
      expect((await report("shipment-register", { warehouseId: s.mz.sec.warehouseId })).total).toBe(0);
      expect((await report("shipment-register", { warehouseId: s.mz.main.warehouseId })).total).toBe(3);
      expect((await report("shipment-register", { search: "tendai" })).rows).toHaveLength(1);
      expect((await report("shipment-register", { search: "ABC 1234" })).rows).toHaveLength(1);
      expect((await report("shipment-register", { sort: "reference", dir: "asc" })).rows).toHaveLength(3);
    });
  });

  describe("Receiving Sessions", () => {
    it("shows who ran each session, scanned vs expected, duration and exceptions", async () => {
      const r = await report("receiving-sessions");
      expect(r.total).toBe(2);
      expect(r.rows[0]).toMatchObject({ startedBy: "Moroz Administrator", expectedBales: 6, scannedBales: 6, exceptions: "1 / 2", duration: "1 h 15 min", status: "ALLOCATED" });
      expect(tile(r, "Bales scanned in")?.value).toBe("8");
      expect(tile(r, "Open exceptions")?.value).toBe("1");
      expect(tile(r, "Open")?.value).toBe("0");
    });

    it("counts a session by the Harare calendar day (00:30 on the 3rd is the 3rd, not the 2nd)", async () => {
      expect((await report("receiving-sessions", { from: "2026-04-02", to: "2026-04-02" })).total).toBe(0); // started 22:30 UTC on the 2nd
      expect((await report("receiving-sessions", { from: "2026-04-03", to: "2026-04-03" })).total).toBe(1);
      expect((await report("receiving-sessions", { from: "2026-05-25", to: "2026-05-25" })).total).toBe(1);
      expect((await report("receiving-sessions", { status: "OPEN" })).total).toBe(0);
    });
  });

  describe("Bale Discrepancies", () => {
    it("lists outstanding bales and exceptions with their explanations", async () => {
      const r = await report("bale-discrepancies");
      expect(r.total).toBe(5);
      expect(r.rows.filter((x) => x.kind === "OUTSTANDING")).toHaveLength(3);
      const unexpected = r.rows.find((x) => x.kind === "UNEXPECTED")!;
      expect(unexpected).toMatchObject({ barcode: "9990000001", detail: "Bale not on the manifest", state: "OPEN" });
      const wrong = r.rows.find((x) => x.kind === "WRONG_PURCHASE")!;
      expect(wrong).toMatchObject({ state: "RESOLVED" });
      expect(String(wrong.detail)).toContain("Resolved: Returned to the dock");
      expect(String(r.rows.find((x) => x.kind === "OUTSTANDING")!.detail)).toContain("Dispatched 28 May 2026");
      expect(tile(r, "Outstanding bales")?.value).toBe("3");
      expect(tile(r, "Missing bales")?.value).toBe("0");
      expect(tile(r, "Open exceptions")?.value).toBe("1");
      expect(tile(r, "Resolved exceptions")?.value).toBe("1");
    });

    it("filters by kind, purchase, date and barcode", async () => {
      expect((await report("bale-discrepancies", { kind: "OUTSTANDING" })).total).toBe(3);
      expect((await report("bale-discrepancies", { kind: "UNEXPECTED" })).total).toBe(1);
      expect((await report("bale-discrepancies", { kind: "MISSING" })).total).toBe(0);
      expect((await report("bale-discrepancies", { purchaseId: s.mz.purchaseA })).total).toBe(5);
      expect((await report("bale-discrepancies", { purchaseId: s.mz.purchaseC })).total).toBe(0);
      expect((await report("bale-discrepancies", { from: "2026-05-25", to: "2026-05-25" })).total).toBe(2); // the two exceptions
      expect((await report("bale-discrepancies", { search: "9990000002" })).rows).toHaveLength(1);
      expect((await call(admin, "bale-discrepancies", { kind: "BOGUS" }).expect(422)).body.error.code).toBe("INVALID_FILTER");
    });

    it("a dispatched bale becomes MISSING once its shipment is finished without it", async () => {
      await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "CONFIRMED" } });
      try {
        const r = await report("bale-discrepancies", { kind: "MISSING" });
        expect(r.total).toBe(3);
        expect(tile(await report("bale-discrepancies"), "Missing bales")?.value).toBe("3");
      } finally {
        await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "IN_TRANSIT" } });
      }
    });
  });

  // ── Inventory reports ──────────────────────────────────────────────────────
  describe("Stock by Warehouse & Location", () => {
    it("shows bales, mass, value and occupancy per row for stock on hand", async () => {
      const r = await report("stock-by-location");
      expect(r.rows).toHaveLength(4);
      expect(r.rows.find((x) => x.bay === "BAY-01" && x.row === "ROW-A" && String(x.warehouse).startsWith("MAIN"))).toMatchObject({ warehouse: "MAIN · Buyer Main Warehouse", kind: "Buyer warehouse", bales: 2, massKg: "200.0", usd: "500.00", capacity: 40, occupancy: "5.0" });
      expect(r.rows.find((x) => String(x.warehouse).startsWith("SEC"))).toMatchObject({ bales: 1, capacity: 30, occupancy: "3.3" });
      expect(r.rows.find((x) => x.bay === "BAY-02")).toMatchObject({ bales: 2 }); // purchase C's two bales
      expect(r.totals).toMatchObject({ bales: 7, massKg: "700.0", usd: "1750.00" });
      expect(tile(r, "Rows in use")?.value).toBe("4 of 22");
      expect(tile(r, "Received, not yet stored")?.value).toBe("1"); // bale b6 has no location yet
    });

    it("can include empty rows and filter by warehouse type, warehouse and bay", async () => {
      expect((await report("stock-by-location", { includeEmpty: true })).total).toBe(22);
      expect((await report("stock-by-location", { kind: "PROCESSING" })).total).toBe(0);
      expect((await report("stock-by-location", { kind: "PROCESSING", includeEmpty: true })).total).toBe(6);
      expect((await report("stock-by-location", { warehouseId: s.mz.sec.warehouseId })).total).toBe(1);
      expect((await report("stock-by-location", { bayId: s.mz.main.bayId })).total).toBe(2); // MAIN BAY-01: rows A and B
    });
  });

  describe("Stock by Grade", () => {
    it("groups stock on hand by grade and warehouse, including bales not yet stored", async () => {
      const r = await report("stock-by-grade");
      expect(r.rows.map((x) => [x.warehouse, x.bales])).toEqual([["MAIN · Buyer Main Warehouse", 6], ["Received, not yet stored", 1], ["SEC · Buyer Secondary Warehouse", 1]]);
      expect(r.rows[0]).toMatchObject({ grade: "L4OMA", massKg: "600.0", usd: "1500.00", avgUsc: "250.00" });
      expect(r.totals).toMatchObject({ bales: 8, massKg: "800.0", usd: "2000.00", avgUsc: "250.00" });
      expect((await report("stock-by-grade", { purchaseId: s.mz.purchaseC })).rows).toHaveLength(1);
      expect((await report("stock-by-grade", { grade: "L4R" })).total).toBe(0);
    });
  });

  describe("Inventory Position", () => {
    it("lists every bale on hand with location, age and ageing buckets", async () => {
      const r = await report("inventory-position");
      expect(r.total).toBe(8);
      expect(r.rows[0]).toMatchObject({ barcode: "1110000001", location: "MAIN › BAY-01 › ROW-A", status: "IN_STOCK" }); // most recently received first
      expect(r.rows.find((x) => x.barcode === "1110000006")).toMatchObject({ location: "Received, not yet stored", ageDays: 100 });
      expect(r.rows.find((x) => x.barcode === "111000003 ")).toMatchObject({ ageDays: 10 }); // the blank check character survives
      expect(tile(r, "Bales")?.value).toBe("8");
      expect(tile(r, "Mass")?.value).toBe("800.0 kg");
      expect(tile(r, "Value")?.value).toBe("US$ 2,000.00");
      expect(tile(r, "In stock 0–7 days")?.value).toBe("2");
      expect(tile(r, "8–30 days")?.value).toBe("2");
      expect(tile(r, "31–90 days")?.value).toBe("1");
      expect(tile(r, "Over 90 days")?.value).toBe("3");
    });

    it("filters by status, warehouse, bay, purchase, grade and received date", async () => {
      expect((await report("inventory-position", { status: "EXPECTED" })).total).toBe(6);
      expect((await report("inventory-position", { status: "DISPATCHED" })).total).toBe(3);
      expect((await report("inventory-position", { warehouseId: s.mz.sec.warehouseId })).total).toBe(1);
      expect((await report("inventory-position", { bayId: s.mz.main.bayId })).total).toBe(4);
      expect((await report("inventory-position", { purchaseId: s.mz.purchaseC })).total).toBe(2);
      expect((await report("inventory-position", { grade: "L4R" })).total).toBe(0); // L4R bales are in transit / expected, not on hand
      const from = harareDay(new Date(s.now.getTime() - 20 * 86_400_000));
      const to = harareDay(new Date(s.now.getTime() - 5 * 86_400_000));
      expect((await report("inventory-position", { from, to })).total).toBe(2); // received 10 days ago
      expect((await call(admin, "inventory-position", { status: "NOPE" }).expect(422)).body.error.code).toBe("INVALID_FILTER");
    });

    it("finds a bale by barcode WITHOUT trimming (a barcode may end in a blank)", async () => {
      const exact = await report("inventory-position", { search: "111000003 " });
      expect(exact.total).toBe(1);
      expect(exact.rows[0]!.barcode).toBe("111000003 ");
      expect((await report("inventory-position", { search: "1110000001" })).total).toBe(1);
    });

    it("pages and sorts server-side", async () => {
      const p3 = await report("inventory-position", { pageSize: 3, page: 3 });
      expect(p3.rows).toHaveLength(2);
      expect(p3.total).toBe(8);
      expect((await report("inventory-position", { sort: "barcode", dir: "asc", pageSize: 2 })).rows.map((x) => x.barcode)).toEqual(["1110000001", "1110000002"]);
      await call(admin, "inventory-position", { sort: "location" }).expect(200); // not sortable → ignored
    });
  });

  describe("Warehouse Movements", () => {
    it("shows the ledger with readable locations, user and reference", async () => {
      const r = await report("warehouse-movements");
      expect(r.total).toBe(8);
      const move = (await report("warehouse-movements", { kind: "MOVE" })).rows[0]!;
      expect(move).toMatchObject({ barcode: "1110000002", type: "MOVE", from: "MAIN › BAY-01 › ROW-A", to: "MAIN › BAY-01 › ROW-B", reason: "Consolidation", performedBy: "Moroz Administrator", reference: "Manual" });
      expect(r.rows.find((x) => x.type === "STORE")).toMatchObject({ reference: "Receiving", from: null });
      expect(tile(r, "Stored")?.value).toBe("7");
      expect(tile(r, "Moved")?.value).toBe("1");
    });

    it("filters by date (Harare days), warehouse and barcode", async () => {
      expect((await report("warehouse-movements", { from: "2026-04-02", to: "2026-04-02" })).total).toBe(2);
      expect((await report("warehouse-movements", { from: "2026-05-25", to: "2026-05-25" })).total).toBe(6);
      expect((await report("warehouse-movements", { warehouseId: s.mz.sec.warehouseId })).total).toBe(1);
      expect((await report("warehouse-movements", { search: "1110000002" })).total).toBe(2);
    });
  });

  // ── Permissions and tenancy ────────────────────────────────────────────────
  describe("access control", () => {
    it("requires sign-in", async () => {
      await h.http().get(`${API}/buyer/reports/purchase-register`).expect(401);
      await h.http().get(`${API}/buyer/reports/purchase-register/export`).query({ format: "csv" }).expect(401);
    });

    it("each report also needs the permission of the data it shows", async () => {
      expect((await call(finance, "stock-by-location").expect(403)).body.error.code).toBe("PERMISSION_DENIED"); // finance has no warehouse access
      await call(finance, "purchase-register").expect(200);
      await call(ops, "shipment-register").expect(200);
      await call(warehouse, "inventory-position").expect(200);
      await call(viewer, "stock-by-location").expect(200);
    });

    it("exporting needs buyer.reports.export: a Viewer can read but not download", async () => {
      await call(viewer, "purchase-register").expect(200);
      const res = await h.http().get(`${API}/buyer/reports/purchase-register/export`).query({ format: "csv" }).set("Authorization", viewer).expect(403);
      expect(res.body.error.code).toBe("PERMISSION_DENIED");
      await h.http().get(`${API}/buyer/reports/purchase-register/export`).query({ format: "csv" }).set("Authorization", finance).expect(200);
    });

    it("another company sees only its own data and cannot reference ours", async () => {
      const own = await report("purchase-register", {}, kt);
      expect(own.total).toBe(1);
      expect(own.totals).toMatchObject({ bales: 3 });
      expect((await report("shipment-register", {}, kt)).total).toBe(1);
      expect((await report("purchase-shipment-received", {}, kt)).rows).toHaveLength(1);
      expect((await report("inventory-position", {}, kt)).total).toBe(0);
      expect((await report("warehouse-movements", {}, kt)).total).toBe(0);
      expect((await report("bale-discrepancies", {}, kt)).total).toBe(3); // KT's own outstanding bales only
      // naming MZ's records in KT's filters is a plain not-found — nothing about MZ is revealed
      expect((await call(kt, "shipment-register", { purchaseId: s.mz.purchaseA }).expect(404)).body.error.code).toBe("NOT_FOUND");
      expect((await call(kt, "inventory-position", { warehouseId: s.mz.main.warehouseId }).expect(404)).body.error.code).toBe("NOT_FOUND");
    });
  });

  // ── Exports ────────────────────────────────────────────────────────────────
  describe("exports", () => {
    it("CSV: raw values, a totals row, only the filtered rows, and an audit entry", async () => {
      const res = await download(admin, "purchase-register", { format: "csv", from: "2026-05-01", to: "2026-05-31" }).expect(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toBe('attachment; filename="purchase-register_2026-05-01_to_2026-05-31.csv"');
      const text = (res.body as Buffer).toString("utf8");
      expect(text.charCodeAt(0)).toBe(0xfeff);
      const lines = text.slice(1).trimEnd().split("\r\n");
      expect(lines).toHaveLength(3); // header, purchase A, totals
      expect(lines[1]).toContain("INV-A-001");
      expect(lines[1]).toContain("2320.00"); // raw decimal, no currency symbol or thousands separator
      expect(lines[2]).toMatch(/^Total,/);
      const audit = await h.prisma.auditLog.findFirst({ where: { action: "report.exported", entityRef: "purchase-register" }, orderBy: { occurredAt: "desc" } });
      expect(audit).toMatchObject({ principalName: "Moroz Administrator", buyerOrganisationId: s.mz.orgId });
      expect(audit?.next).toMatchObject({ format: "csv", rows: 1 });
    });

    it("Excel: a Summary sheet with the filters and key figures, and typed data", async () => {
      const res = await download(admin, "purchase-shipment-received", { format: "xlsx", onlyVariances: true }).expect(200);
      expect(res.headers["content-type"]).toContain("spreadsheetml");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as Buffer as unknown as ArrayBuffer);
      expect(wb.worksheets.map((w) => w.name)).toEqual(["Summary", "Purchase-Shipment-Received"]);
      const summary = wb.getWorksheet("Summary")!.getSheetValues().flat().filter((v) => typeof v === "string") as string[];
      expect(summary).toContain("Purchase vs Shipment vs Received");
      expect(summary).toContain("MOROZ TOBACCO");
      expect(summary).toContain("only with differences");
      expect(summary.some((v) => v.includes("weighed bales"))).toBe(true); // the standing notes travel with the export
      const sheet = wb.getWorksheet("Purchase-Shipment-Received")!;
      expect(sheet.rowCount).toBe(1 + 2 + 1); // header + A + B + totals
      const a = sheet.getRow(2);
      expect(a.getCell(4).value).toBe(10); // purchased bales as a NUMBER
      expect(a.getCell(5).value).toBe(960);
      expect(a.getCell(13).value).toBe(1);
      expect(sheet.getRow(4).getCell(1).value).toBe("Total");
    });

    it("exports EVERY matching row, not just one page of 100", async () => {
      await h.prisma.bale.createMany({
        data: Array.from({ length: 130 }, (_, i) => ({
          buyerOrganisationId: s.kt.orgId, purchaseId: s.kt.purchase, barcode: `222001${String(i).padStart(4, "0")}`, season: 2026, buyerGrade: "L4OMA", growerNo: "100", lotNo: String(i), massKg: "100.0", uscPerKg: "250.00", usdValue: "250.00", status: "IN_STOCK" as const, receivedAt: new Date(),
        })),
      });
      expect((await report("inventory-position", { pageSize: 100 }, kt)).rows).toHaveLength(100); // a screen page is capped…
      const csv = await download(kt, "inventory-position", { format: "csv" }).expect(200);
      const lines = (csv.body as Buffer).toString("utf8").slice(1).trimEnd().split("\r\n");
      expect(lines).toHaveLength(1 + 130 + 1); // …the export is not

      const xlsx = await download(kt, "inventory-position", { format: "xlsx" }).expect(200);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(xlsx.body as Buffer as unknown as ArrayBuffer);
      expect(wb.getWorksheet("Inventory Position")!.rowCount).toBe(1 + 130 + 1);

      const pdf = await download(kt, "inventory-position", { format: "pdf" }).expect(200);
      const doc = await PDFDocument.load(pdf.body as Buffer);
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
      expect(pdf.headers["content-disposition"]).toMatch(/inventory-position_\d{4}-\d{2}-\d{2}\.pdf/);
    });

    it("PDF: a real A4-landscape document", async () => {
      const res = await download(admin, "stock-by-location", { format: "pdf" }).expect(200);
      const doc = await PDFDocument.load(res.body as Buffer);
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
      expect(Math.round(doc.getPage(0).getWidth())).toBe(842);
      expect(doc.getTitle()).toBe("Stock by Warehouse & Location");
    });

    it("rejects an unknown format and a bad range", async () => {
      await h.http().get(`${API}/buyer/reports/purchase-register/export`).query({ format: "docx" }).set("Authorization", admin).expect(422);
      await h.http().get(`${API}/buyer/reports/purchase-register/export`).set("Authorization", admin).expect(422); // format is required
      await h.http().get(`${API}/buyer/reports/purchase-register/export`).query({ format: "csv", from: "2026-06-02", to: "2026-06-01" }).set("Authorization", admin).expect(422);
    });
  });
});

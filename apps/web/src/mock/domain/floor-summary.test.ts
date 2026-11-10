import { describe, expect, it } from "vitest";
import { buildScenario } from "../scenarios";
import { ctxFor, dbAt } from "../testing";
import { checkFloorSummary, scanTicket, selectFloorSummaries, selectScanScreen } from "./floor-summary";

const clerk = (db: ReturnType<typeof dbAt>) => ctxFor(db, "floor-summary-clerk");

describe("scanTicket — documented sale day (Manual 05)", () => {
  it("scans V100060's three tickets into row 1: Scanned 1 of 3 … 3 of 3 → Laid, sale 4 + batch 4 + floor summary created", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    const ctx = clerk(db);
    const a = scanTicket(ctx, { row: "1", barcode: "1000001013" });
    expect(a.outcome).toBe("SCANNED");
    expect(a.message).toBe("Scanned 1 of 3");
    expect(a).toMatchObject({ growerNo: "V100060", lot: "1", group: 1, row: 1, barcode: "1000001013" });
    expect(scanTicket(ctx, { row: 1, barcode: "1000001024" }).message).toBe("Scanned 2 of 3");
    const c = scanTicket(ctx, { row: 1, barcode: "1000001035" });
    expect(c.outcome).toBe("COMPLETE");
    expect(c.message).toContain("Scanned 3 of 3");

    const note = db.deliveryNotes.find((d) => d.docNo === "GDN0000005")!;
    expect(note.state).toBe("LAID");
    expect(note.row).toBe(1);
    const sale = db.sales.find((s) => s.id === "sale-4")!;
    expect(sale).toMatchObject({ refNo: 4, saleNo: 1, growerNo: "V100060", status: "DRAFT", released: false, priceBatchId: "batch-4", gdnId: note.id });
    expect(db.priceBatches.find((b) => b.id === "batch-4")).toMatchObject({ refNo: 4, status: "DRAFT", saleId: "sale-4" });
    expect(db.floorSummaries.find((f) => f.id === "fs-0004")).toMatchObject({ growerNo: "V100060", row: 1, totalBales: 3, groupFirst: 1, groupLast: 1, unbooked: 0, district: 14 });
    expect(db.bales.filter((b) => b.gdnId === note.id).every((b) => b.saleId === "sale-4" && b.floorRow === 1)).toBe(true);
    expect(db.audit[0]).toMatchObject({ action: "floor-summary.complete" });
  });

  it("completes V100061 into row 2 → sale 5 / batch 5, matching the FLOOR_SUMMARY_DONE preset", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    const ctx = clerk(db);
    for (const b of ["1000001013", "1000001024", "1000001035"]) scanTicket(ctx, { row: 1, barcode: b });
    scanTicket(ctx, { row: 2, barcode: "1000001046" });
    const done = scanTicket(ctx, { row: 2, barcode: "1000001057" });
    expect(done).toMatchObject({ outcome: "COMPLETE", saleId: "sale-5", saleRefNo: 5, batchRefNo: 5 });

    const preset = buildScenario("FLOOR_SUMMARY_DONE");
    const pick = (d: typeof db) =>
      d.sales
        .filter((s) => s.refNo >= 4)
        .map((s) => ({ id: s.id, refNo: s.refNo, saleNo: s.saleNo, growerNo: s.growerNo, gdnId: s.gdnId, batch: s.priceBatchId, status: s.status, released: s.released }));
    expect(pick(db)).toEqual(pick(preset));
    expect(db.deliveryNotes.filter((d) => d.sellingDate === "2026-09-17").map((d) => [d.docNo, d.state, d.row])).toEqual(
      preset.deliveryNotes.filter((d) => d.sellingDate === "2026-09-17").map((d) => [d.docNo, d.state, d.row]),
    );
    expect(db.meta.seq.sale).toBe(preset.meta.seq.sale);
    expect(db.meta.seq.batch).toBe(preset.meta.seq.batch);
  });
});

describe("scanTicket — rejections (verbatim messages)", () => {
  it("floor scanning off", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    db.receivingSaleDates.find((d) => d.isActive)!.canScanFloorSummary = false;
    expect(() => scanTicket(clerk(db), { row: 1, barcode: "1000001013" })).toThrow(/Floor Summary scanning is currently off/);
  });

  it("no active sale date for today", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    for (const d of db.receivingSaleDates) d.isActive = false;
    expect(() => scanTicket(clerk(db), { row: 1, barcode: "1000001013" })).toThrow("Please Add a Current Sale Date,.");
  });

  it("row blank or not an integer", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    expect(() => scanTicket(clerk(db), { row: "", barcode: "1000001013" })).toThrow("Please enter a Row Number");
    expect(() => scanTicket(clerk(db), { row: "A", barcode: "1000001013" })).toThrow("integer for Row Number");
    expect(() => scanTicket(clerk(db), { row: "1.5", barcode: "1000001013" })).toThrow("integer for Row Number");
  });

  it("unknown barcode, and the scale barcode instead of the ticket", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    expect(() => scanTicket(clerk(db), { row: 1, barcode: "9999999999" })).toThrow("Cannot find the bale: 9999999999");
    expect(() => scanTicket(clerk(db), { row: 1, barcode: "2609170001" })).toThrow("Cannot find the bale: 2609170001");
  });

  it("delivery not Checked → 'not supposed to be on the floor'", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    db.deliveryNotes.find((d) => d.id === "gdn-0000005")!.state = "TICKETS_PRINTING";
    expect(() => scanTicket(clerk(db), { row: 1, barcode: "1000001013" })).toThrow("This bale is not supposed to be on the floor. Please check with supervisor");
  });

  it("delivery for another selling point", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    db.sellingPoints.push({ id: "XX", code: "XX", name: "Other Floor", active: true, saleRooms: ["A"], floorRows: 5 });
    db.receivingSaleDates.push({ id: "rsd-xx", sellingPointId: "XX", date: db.settings.demoToday, isActive: true, canScanFloorSummary: true, createdBy: "user-supervisor", createdAt: "2026-09-17T07:00:00" });
    expect(() => scanTicket(clerk(db), { row: 1, barcode: "1000001013", sellingPointId: "XX" })).toThrow("This delivery is for Ethical Sales Floor");
  });

  it("duplicate scan is rejected and changes nothing", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    const ctx = clerk(db);
    scanTicket(ctx, { row: 1, barcode: "1000001013" });
    const before = JSON.stringify(db.floorScans);
    expect(() => scanTicket(ctx, { row: 1, barcode: "1000001013" })).toThrow(/already scanned \(row 1\)/);
    expect(JSON.stringify(db.floorScans)).toBe(before);
  });

  it("a re-scan of a finished delivery still says 'already scanned', not 'not on the floor'", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    expect(() => scanTicket(clerk(db), { row: 1, barcode: "1000001013" })).toThrow(/already scanned/);
  });

  it("requires floor-summary.scan", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    expect(() => scanTicket(ctxFor(db, "receiving-clerk"), { row: 1, barcode: "1000001013" })).toThrow(/floor-summary\.scan/);
  });
});

describe("Check Floor Summary + selectors", () => {
  it("V100060 on 17 Sep: row 1, groups 1, 3 bales", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const r = checkFloorSummary(db, { date: "2026-09-17", growerNo: "v100060" });
    expect(r.found).toBe(true);
    expect(r.summaries[0]).toMatchObject({ rows: [1], groups: "1", totalBales: 3, gdnDocNo: "GDN0000005" });
  });

  it("unknown grower/date → not found", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    expect(checkFloorSummary(db, { date: "2026-09-17", growerNo: "V100043" }).found).toBe(false);
  });

  it("back-office list has the five documented rows for the two days", () => {
    const rows = selectFloorSummaries(dbAt("FLOOR_SUMMARY_DONE"));
    expect(rows).toHaveLength(5);
    expect(rows.filter((r) => r.sellingDate === "2026-09-17").map((r) => [r.growerNo, r.row, r.totalBales]).sort()).toEqual([
      ["V100060", 1, 3],
      ["V100061", 2, 2],
    ]);
  });

  it("scan screen lists waiting tickets in group/lot order and offers decoys", () => {
    const s = selectScanScreen(dbAt("TICKETS_CONFIRMED"), "EL");
    expect(s.saleDateIsToday).toBe(true);
    expect(s.canScan).toBe(true);
    expect(s.waiting.map((w) => w.barcode)).toEqual(["1000001013", "1000001024", "1000001035", "1000001046", "1000001057"]);
    expect(s.scaleDecoy).toBe("2609170001");
  });
});

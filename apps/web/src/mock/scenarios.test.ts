import { describe, expect, it } from "vitest";
import { DOCUMENTED } from "@tobacco/shared/fixtures";
import { checkTicketBarcode, ticketValueCents, sumCents } from "@tobacco/shared";
import { buildScenario } from "./scenarios";

const D = DOCUMENTED;
const g60 = (db: ReturnType<typeof buildScenario>) => db.bales.filter((b) => b.growerNo === "V100060");
const g61 = (db: ReturnType<typeof buildScenario>) => db.bales.filter((b) => b.growerNo === "V100061");

describe("scenario presets mirror the documented 17 Sep 2026 sale day", () => {
  it("FRESH: previous sales are processed, nothing exists for today", () => {
    const db = buildScenario("FRESH");
    expect(db.receivingSaleDates.some((d) => d.date === D.saleDate)).toBe(false);
    expect(db.startOfDays.map((s) => s.sellingDate)).toEqual(D.previousSaleDates);
    expect(db.sales.every((s) => s.status === "PROCESSED" && s.payBatchNo === D.historicalPayBatchNo)).toBe(true);
    expect(db.bookings).toHaveLength(8);
    expect(db.deliveryNotes.map((d) => d.docNo)).toEqual(["GDN0000001", "GDN0000002", "GDN0000003"]);
  });

  it("START_OF_DAY: today's sale date is the only active one; rate posted", () => {
    const db = buildScenario("START_OF_DAY");
    const active = db.receivingSaleDates.filter((d) => d.isActive);
    expect(active.map((d) => d.date)).toEqual([D.saleDate]);
    expect(active[0]!.canScanFloorSummary).toBe(true);
    const sod = db.startOfDays.find((s) => s.sellingDate === D.saleDate)!;
    expect(sod.exchangeRate).toBe(D.exchangeRate);
    expect(sod.status).toBe("POSTED");
  });

  it("BOOKINGS_IMPORTED: two bookings, 5 bales booked", () => {
    const db = buildScenario("BOOKINGS_IMPORTED");
    const today = db.bookings.filter((b) => b.sellDate === D.saleDate);
    expect(today.map((b) => [b.bookedId, b.growerNo, b.balesBooked])).toEqual(
      expect.arrayContaining([
        ["EL2609170001", "V100060", 3],
        ["EL2609170002", "V100061", 2],
      ]),
    );
    expect(db.importJobs[0]!.resultMessage).toBe("Grower Booking Import complete: 2 created, 0 updated, 0 errors.");
  });

  it("RECEIVING_IN_PROGRESS: truck note completed, GDNs Open, V100060 has 2 of 3 bales and the tally is not yet balanced", () => {
    const db = buildScenario("RECEIVING_IN_PROGRESS");
    expect(db.transporterNotes.find((t) => t.docNo === "TDN0000002")?.state).toBe("COMPLETED");
    const gdns = db.deliveryNotes.filter((d) => d.sellingDate === D.saleDate);
    expect(gdns.map((d) => [d.docNo, d.state]).sort()).toEqual([["GDN0000004", "OPEN"], ["GDN0000005", "OPEN"]]);
    expect(g60(db)).toHaveLength(2);
    expect(g61(db)).toHaveLength(0);
    expect(db.meta.seq.bale).toBe(2);
    // the third documented bale can still be captured afterwards (its scale reading exists)
    expect(db.scaleReadings.some((r) => r.scaleBarcode === "2609170003")).toBe(true);
  });

  it("RECEIVED: TDN0000002 → GDN0000005 (V100060×3) and GDN0000004 (V100061×2), weights from the scale", () => {
    const db = buildScenario("RECEIVED");
    const tdn = db.transporterNotes.find((t) => t.docNo === "TDN0000002")!;
    expect(tdn).toMatchObject({ state: "COMPLETED", transporterName: "Tendai Moyo", vehicleReg: "AEX1234", idNumber: "63-123456-A-42", phone: "0772123456" });
    expect(tdn.growers.map((x) => [x.growerNo, x.bales])).toEqual([["V100060", 3], ["V100061", 2]]);
    const gdn5 = db.deliveryNotes.find((d) => d.docNo === "GDN0000005")!;
    const gdn4 = db.deliveryNotes.find((d) => d.docNo === "GDN0000004")!;
    expect(gdn5).toMatchObject({ growerNo: "V100060", balesDeclared: 3, state: "TICKETS_PRINTING" });
    expect(gdn4).toMatchObject({ growerNo: "V100061", balesDeclared: 2, state: "TICKETS_PRINTING" });
    expect(g60(db).map((b) => [b.scaleBarcode, b.mass, b.group, b.lot])).toEqual([
      ["2609170001", 112, 1, "1"],
      ["2609170002", 98, 1, "2"],
      ["2609170003", 105, 1, "3"],
    ]);
    // every captured bale has a matching scale reading with the same mass
    for (const b of db.bales) expect(db.scaleReadings.find((r) => r.scaleBarcode === b.scaleBarcode)?.mass).toBe(b.mass);
  });

  it("TICKETS_CONFIRMED: documented barcodes, all valid, deliveries Checked, next barcode saved per user", () => {
    const db = buildScenario("TICKETS_CONFIRMED");
    expect(g60(db).map((b) => b.ticketBarcode)).toEqual(D.ticketBarcodes.V100060);
    expect(g61(db).map((b) => b.ticketBarcode)).toEqual(D.ticketBarcodes.V100061);
    for (const b of db.bales) expect(checkTicketBarcode(b.ticketBarcode!).valid).toBe(true);
    expect(db.deliveryNotes.filter((d) => d.sellingDate === D.saleDate).every((d) => d.state === "CHECKED")).toBe(true);
    expect(db.userNextBarcode["user-ticket-clerk"]).toBe("1000001068");
    expect(new Set(db.bales.map((b) => b.ticketBarcode)).size).toBe(db.bales.length); // unique across the season
  });

  it("FLOOR_SUMMARY_DONE: rows 1 and 2, deliveries Laid, draft sales 4 and 5 with price batches 4 and 5", () => {
    const db = buildScenario("FLOOR_SUMMARY_DONE");
    expect(db.deliveryNotes.filter((d) => d.sellingDate === D.saleDate).every((d) => d.state === "LAID")).toBe(true);
    const s4 = db.sales.find((s) => s.refNo === 4)!;
    const s5 = db.sales.find((s) => s.refNo === 5)!;
    expect(s4).toMatchObject({ growerNo: "V100060", status: "DRAFT", released: false, priceBatchId: "batch-4" });
    expect(s5).toMatchObject({ growerNo: "V100061", status: "DRAFT", priceBatchId: "batch-5" });
    expect(g60(db).every((b) => b.floorRow === 1 && b.saleId === s4.id)).toBe(true);
    expect(g61(db).every((b) => b.floorRow === 2 && b.saleId === s5.id)).toBe(true);
    expect(db.priceBatches.filter((b) => b.sellingDate === D.saleDate).every((b) => b.status === "DRAFT")).toBe(true);
    const summaries = db.floorSummaries.filter((f) => f.sellingDate === D.saleDate);
    expect(summaries.map((f) => [f.growerNo, f.row, f.totalBales, f.district]).sort()).toEqual([["V100060", 1, 3, 14], ["V100061", 2, 2, 32]]);
  });

  it("READY_TO_BALANCE: documented grades, buyer JM / 11OF and prices; batches posted; gross arithmetic", () => {
    const db = buildScenario("READY_TO_BALANCE");
    expect(g60(db).map((b) => [b.timbGrade, b.buyerCode, b.buyerGrade, b.priceCents, b.batchPriceCents])).toEqual([
      ["A10", "JM", "11OF", 212, 212],
      ["A1E", "JM", "11OF", 198, 198],
      ["A1L", "JM", "11OF", 185, 185],
    ]);
    expect(sumCents(g60(db).map((b) => ticketValueCents(b.priceCents!, b.mass)))).toBe(D.growers[0].grossCents);
    expect(sumCents(g61(db).map((b) => ticketValueCents(b.priceCents!, b.mass)))).toBe(D.growers[1].grossCents);
    expect(db.priceBatches.filter((b) => b.sellingDate === D.saleDate).every((b) => b.status === "POSTED")).toBe(true);
    expect(db.sales.filter((s) => s.saleDate === D.saleDate).every((s) => s.status === "DRAFT")).toBe(true);
  });

  it("BALANCED: both sales balanced, no stop orders yet", () => {
    const db = buildScenario("BALANCED");
    expect(db.sales.filter((s) => s.saleDate === D.saleDate).map((s) => s.status)).toEqual(["BALANCED", "BALANCED"]);
    expect(db.stopOrders).toHaveLength(0);
    expect(db.deductions).toHaveLength(0);
  });

  it("PROCESSED: $173.11 across 11 lines / 6 creditors / 2 growers, pay batch 1001", () => {
    const db = buildScenario("PROCESSED");
    const d = db.deductions;
    expect(d).toHaveLength(D.deductions.lines);
    expect(sumCents(d.map((x) => x.amountCents))).toBe(D.deductions.totalCents);
    expect(sumCents(d.filter((x) => x.source === "GROWER_CHARGE").map((x) => x.amountCents))).toBe(D.deductions.floorChargesCents);
    expect(sumCents(d.filter((x) => x.source === "TIMB_STOP_ORDER").map((x) => x.amountCents))).toBe(D.deductions.timbStopOrderCents);
    expect(new Set(d.map((x) => x.growerNo)).size).toBe(D.deductions.growersAffected);
    expect(new Set(d.map((x) => x.creditorCode)).size).toBe(D.deductions.creditors);
    expect(d.find((x) => x.source === "TIMB_STOP_ORDER")).toMatchObject({ growerNo: "V100060", creditorCode: "00050", amountCents: 5000 });
    const today = db.sales.filter((s) => s.saleDate === D.saleDate);
    expect(today.every((s) => s.status === "PROCESSED" && s.payBatchNo === D.payBatchNo)).toBe(true);
    expect(db.payBatches.find((p) => p.no === D.payBatchNo)?.saleIds).toHaveLength(2);
    // net payouts are cents-exact
    const net = (growerNo: string, gross: number) => gross - sumCents(d.filter((x) => x.growerNo === growerNo).map((x) => x.amountCents));
    expect(net("V100060", D.growers[0].grossCents)).toBe(49943);
    expect(net("V100061", D.growers[1].grossCents)).toBe(34264);
  });

  it("READY_TO_DISPATCH: processed sales are released", () => {
    const db = buildScenario("READY_TO_DISPATCH");
    expect(db.sales.filter((s) => s.saleDate === D.saleDate).every((s) => s.released && s.status === "PROCESSED")).toBe(true);
    expect(db.buyers.find((b) => b.code === "JM")?.packingWarehouseCode).toBe("CURVERID");
  });

  it("VALIDATION_SHOWCASE: V100061 carries three deliberate problems", () => {
    const db = buildScenario("VALIDATION_SHOWCASE");
    const [b1, b2] = g61(db);
    expect(b1!.timbGrade).toBeUndefined(); // missing TIMB grade
    expect(b2!.buyerCode).toBe("KT"); // 11OF does not belong to KT
    expect(db.buyers.find((b) => b.code === "KT")!.grades).not.toContain("11OF");
    expect(b2!.batchPriceCents).not.toBe(b2!.priceCents); // mismatch
  });

  it("builders are deterministic and independent (no shared mutable state between calls)", () => {
    const a = buildScenario("PROCESSED");
    a.sales[0]!.status = "DRAFT";
    expect(buildScenario("PROCESSED").sales[0]!.status).toBe("PROCESSED");
  });
});

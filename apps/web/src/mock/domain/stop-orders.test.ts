import { describe, expect, it } from "vitest";
import { DOCUMENTED, ts } from "@tobacco/shared/fixtures";
import type { MockDb } from "@tobacco/shared";
import { ctxFor, dbAt } from "../testing";
import {
  addInternalInvoice,
  planSaleDeductions,
  runStopOrderProcessing,
  saleFinancials,
  selectDeductionsDashboard,
  selectProcessingChecklist,
} from "./stop-orders";

/** The stop order the importer (slice A) would create from EL_stoporders_20260917.txt. */
function importStopOrder(db: MockDb, fileDate = "2026-09-17", file = "EL_stoporders_20260917.txt", growerNo = "V100060") {
  db.stopOrders.push({
    id: `stoporder-${db.stopOrders.length + 1}`,
    timbFile: file,
    fileDate,
    growerNo,
    creditorCode: "00050",
    amount1Cents: 5000,
    amount2Cents: 0,
    amount3Cents: 0,
    paidAmountCents: 0,
    priority: 1,
    recType: "06",
    stopOrderNo: 1,
    percent: 0,
    season: 2026,
    createdAt: ts("2026-09-17", "12:30:03"),
  });
}

const norm = (db: MockDb) =>
  db.deductions.map((d) => ({
    growerNo: d.growerNo,
    source: d.source,
    sequence: d.sequence,
    creditorCode: d.creditorCode,
    creditorName: d.creditorName,
    description: d.description,
    currency: d.currency,
    amountCents: d.amountCents,
    paidCents: d.paidCents,
    payBatchNo: d.payBatchNo,
    sellingDate: d.sellingDate,
  }));

describe("runStopOrderProcessing", () => {
  it("from BALANCED produces exactly the documented PROCESSED state ($173.11, 11 lines, pay batch 1001)", () => {
    const db = dbAt("BALANCED");
    importStopOrder(db);
    const res = runStopOrderProcessing(ctxFor(db, "data-processing-supervisor"), { sellingPointId: "EL" });
    const expected = dbAt("PROCESSED");

    expect(res.payBatchNo).toBe(DOCUMENTED.payBatchNo);
    expect(norm(db)).toEqual(norm(expected));
    expect(db.deductions).toHaveLength(11);
    expect(db.deductions.reduce((a, d) => a + d.amountCents, 0)).toBe(17311);
    expect(db.deductions.filter((d) => d.source === "GROWER_CHARGE").reduce((a, d) => a + d.amountCents, 0)).toBe(12311);
    expect(db.deductions.filter((d) => d.source === "TIMB_STOP_ORDER").reduce((a, d) => a + d.amountCents, 0)).toBe(5000);
    expect(db.payBatches.at(-1)).toMatchObject({ no: 1001, saleDate: "2026-09-17", saleIds: ["sale-4", "sale-5"] });
    expect(db.stopOrders[0]!.paidAmountCents).toBe(5000);
    for (const s of db.sales.filter((x) => x.saleDate === "2026-09-17")) {
      expect(s.status).toBe("PROCESSED");
      expect(s.payBatchNo).toBe(1001);
    }
    expect(db.sales.map((s) => [s.id, s.status, s.payBatchNo])).toEqual(expected.sales.map((s) => [s.id, s.status, s.payBatchNo]));
  });

  it("computes net payouts cent-exactly (V100060 $499.43, V100061 $342.64)", () => {
    const db = dbAt("BALANCED");
    importStopOrder(db);
    const res = runStopOrderProcessing(ctxFor(db, "data-processing-supervisor"), { sellingPointId: "EL" });
    const v60 = res.sales.find((s) => s.growerNo === "V100060")!;
    const v61 = res.sales.find((s) => s.growerNo === "V100061")!;
    expect([v60.grossCents, v60.totalCents, v60.netCents]).toEqual([62573, 12630, 49943]);
    expect([v61.grossCents, v61.totalCents, v61.netCents]).toEqual([38945, 4681, 34264]);
    // The read model agrees with the run.
    expect(saleFinancials(db, db.sales.find((s) => s.refNo === 4)!).netCents).toBe(49943);
  });

  it("takes deductions in the documented order 1→5 within each sale", () => {
    const db = dbAt("BALANCED");
    importStopOrder(db);
    runStopOrderProcessing(ctxFor(db, "data-processing-supervisor"), { sellingPointId: "EL" });
    for (const growerNo of ["V100060", "V100061"]) {
      const seqs = db.deductions.filter((d) => d.growerNo === growerNo).map((d) => d.sequence);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    }
    expect(db.deductions.filter((d) => d.growerNo === "V100060").at(-1)).toMatchObject({ source: "TIMB_STOP_ORDER", sequence: 5 });
  });

  it("internal invoices (2) and merchant loans (3) come between floor charges and stop orders", () => {
    const db = dbAt("BALANCED");
    importStopOrder(db);
    const ctx = ctxFor(db, "data-processing-supervisor");
    addInternalInvoice(ctx, { growerNo: "V100060", creditorCode: "00061", description: "Inputs", amount: "10.00" });
    db.merchantLoans.push({ id: "loan-x", growerNo: "V100060", creditorCode: "00061", balanceCents: 2000, currency: "USD", status: "OPEN" });
    runStopOrderProcessing(ctx, { sellingPointId: "EL" });
    const seqs = db.deductions.filter((d) => d.growerNo === "V100060").map((d) => d.sequence);
    expect(seqs).toEqual([1, 1, 1, 1, 1, 2, 3, 5]);
    expect(db.internalInvoices[0]!.status).toBe("SETTLED");
    expect(db.merchantLoans[0]!.status).toBe("SETTLED");
  });

  it("processes without the $50 when no stop order file has been imported", () => {
    const db = dbAt("BALANCED");
    const res = runStopOrderProcessing(ctxFor(db, "data-processing-supervisor"), { sellingPointId: "EL" });
    expect(db.deductions).toHaveLength(10);
    expect(db.deductions.reduce((a, d) => a + d.amountCents, 0)).toBe(12311);
    expect(res.sales.find((s) => s.growerNo === "V100060")!.netCents).toBe(62573 - 7630);
  });

  it("does NOT deduct a stop order whose file date differs from the sale date (STOP_NOT_DEDUCTED)", () => {
    const db = dbAt("BALANCED");
    importStopOrder(db, "2026-09-16", "EL_stoporders_20260916.txt");
    const res = runStopOrderProcessing(ctxFor(db, "data-processing-supervisor"), { sellingPointId: "EL" });
    expect(db.deductions.some((d) => d.source === "TIMB_STOP_ORDER")).toBe(false);
    expect(db.stopOrders[0]!.paidAmountCents).toBe(0);
    expect(res.warnings.join(" ")).toContain("Stop order not deducted");
    expect(res.warnings.join(" ")).toContain("EL_stoporders_20260916.txt");
  });

  it("is blocked by pending approvals", () => {
    const db = dbAt("BALANCED");
    db.approvals.push({ id: "apr-1", ref: "APR-0001", entityType: "Sale", entityId: "sale-4", entityRef: "Sale 4", action: "sale.reverse", requestedBy: "user-supervisor", requestReason: "test", requestedAt: ts("2026-09-17"), status: "PENDING" });
    expect(() => runStopOrderProcessing(ctxFor(db, "data-processing-supervisor"), { sellingPointId: "EL" })).toThrow(
      "There are :: 1 :: Pending Approvals",
    );
    expect(db.sales.filter((s) => s.status === "PROCESSED" && s.saleDate === "2026-09-17")).toHaveLength(0);
  });

  it("is blocked when Start of Day is not posted for the sale date", () => {
    const db = dbAt("BALANCED");
    db.startOfDays = db.startOfDays.filter((s) => s.sellingDate !== "2026-09-17");
    expect(() => runStopOrderProcessing(ctxFor(db, "data-processing-supervisor"), { sellingPointId: "EL" })).toThrow(
      "Exchange rate is not set for this sale",
    );
  });

  it("says so when there is nothing balanced, and cannot run twice (no double processing)", () => {
    const early = dbAt("READY_TO_BALANCE");
    expect(() => runStopOrderProcessing(ctxFor(early, "data-processing-supervisor"), { sellingPointId: "EL" })).toThrow(
      "no Balanced sales",
    );
    const db = dbAt("BALANCED");
    runStopOrderProcessing(ctxFor(db, "data-processing-supervisor"), { sellingPointId: "EL" });
    expect(() => runStopOrderProcessing(ctxFor(db, "data-processing-supervisor"), { sellingPointId: "EL" })).toThrow("no Balanced sales");
  });

  it("limits deductions to the sale value and flags it (UQ-22)", () => {
    const db = dbAt("BALANCED");
    const ctx = ctxFor(db, "data-processing-supervisor");
    addInternalInvoice(ctx, { growerNo: "V100061", creditorCode: "00061", description: "Huge invoice", amount: "9999.00" });
    const res = runStopOrderProcessing(ctx, { sellingPointId: "EL" });
    const v61 = res.sales.find((s) => s.growerNo === "V100061")!;
    expect(v61.capped).toBe(true);
    expect(v61.netCents).toBe(0);
    expect(v61.totalCents).toBe(v61.grossCents);
    expect(res.warnings.join(" ")).toContain("UQ-22");
  });

  it("is permission-checked (data clerk and accounts cannot process)", () => {
    const db = dbAt("BALANCED");
    expect(() => runStopOrderProcessing(ctxFor(db, "data-clerk"), { sellingPointId: "EL" })).toThrow(/deductions\.process/);
    expect(() => runStopOrderProcessing(ctxFor(db, "accounts"), { sellingPointId: "EL" })).toThrow(/deductions\.process/);
    expect(() => addInternalInvoice(ctxFor(db, "data-clerk"), { growerNo: "V100060", creditorCode: "00050", description: "x", amount: "1" })).toThrow(/deductions\.process/);
  });
});

describe("planSaleDeductions / checklist", () => {
  it("previews the same numbers the run will post", () => {
    const db = dbAt("BALANCED");
    importStopOrder(db);
    const check = selectProcessingChecklist(db, "EL");
    expect(check.blockers).toEqual([]);
    expect(check.balancedSales).toHaveLength(2);
    expect(check.stopOrderFileImported).toBe(true);
    expect(check.totals).toEqual({ grossCents: 62573 + 38945, deductionsCents: 17311, netCents: 62573 + 38945 - 17311 });
    expect(planSaleDeductions(db, db.sales.find((s) => s.refNo === 4)!).lines.map((l) => l.sequence)).toEqual([1, 1, 1, 1, 1, 5]);
  });

  it("flags a missing stop order file as advisory only", () => {
    const check = selectProcessingChecklist(dbAt("BALANCED"), "EL");
    expect(check.stopOrderFileImported).toBe(false);
    expect(check.blockers).toEqual([]);
  });
});

describe("Deductions Dashboard", () => {
  it("reconciles exactly to the documented figures: $173.11 · 11 lines · 2 growers · 6 creditors", () => {
    const db = dbAt("PROCESSED");
    const d = selectDeductionsDashboard(db, "2026-09-17", "2026-09-17");
    expect(d.totalCents).toBe(17311);
    expect(d.lineCount).toBe(11);
    expect(d.growersAffected).toBe(2);
    expect(d.creditorsAffected).toBe(6);
    expect(d.byCurrency).toEqual([{ currency: "USD", amountCents: 17311, count: 11 }]);
    expect(d.bySource.map((s) => [s.label, s.amountCents])).toEqual([
      ["Internal USD invoices", 12311],
      ["TIMB USD Stop Orders", 5000],
    ]);
    expect(d.topCreditors).toHaveLength(6);
    expect(d.topCreditors[0]).toMatchObject({ code: "00050", amountCents: 5000 });
    // Σ of the top creditors equals the total — nothing is lost or double counted.
    expect(d.topCreditors.reduce((a, c) => a + c.amountCents, 0)).toBe(d.totalCents);
  });

  it("respects the date range", () => {
    const db = dbAt("PROCESSED");
    expect(selectDeductionsDashboard(db, "2026-09-18", "2026-09-30").lineCount).toBe(0);
    expect(selectDeductionsDashboard(db, "2026-09-01", "2026-09-30").totalCents).toBe(17311);
  });
});

import { describe, expect, it } from "vitest";
import type { MockDb } from "@tobacco/shared";
import { dbAt } from "@/mock/testing";
import { REPORTS, exportValue, getReport, displayValue, type ReportFilters, type ReportResult } from "./index";

const TODAY: ReportFilters = { from: "2026-09-17", to: "2026-09-17" };

function run(slug: string, db: MockDb, f: ReportFilters = {}): ReportResult {
  const def = getReport(slug);
  if (!def) throw new Error(`No report ${slug}`);
  return def.run(db, f);
}
const tile = (r: ReportResult, label: string) => r.tiles.find((t) => t.label === label)?.value;

describe("registry", () => {
  it("has the 16 reports from the brief, each with a unique slug", () => {
    expect(REPORTS).toHaveLength(16);
    expect(new Set(REPORTS.map((r) => r.slug)).size).toBe(16);
    expect(REPORTS.map((r) => r.slug)).toEqual(
      expect.arrayContaining([
        "daily-receiving", "grower-delivery", "bale-receiving", "ticket-printing", "floor-summary", "data-capture", "sales",
        "grower-sales-sheet", "batch-processing", "deduction", "creditor", "payment-schedule", "payment-reconciliation",
        "dispatch", "shipment", "user-activity",
      ]),
    );
  });

  it("every report runs against every scenario without throwing and returns consistent shapes", () => {
    for (const scenario of ["FRESH", "RECEIVED", "FLOOR_SUMMARY_DONE", "PROCESSED", "READY_TO_DISPATCH", "VALIDATION_SHOWCASE"] as const) {
      const db = dbAt(scenario);
      for (const def of REPORTS) {
        const r = def.run(db, {});
        for (const row of r.rows) for (const c of r.columns) expect(c.key in row, `${def.slug}.${c.key}`).toBe(true);
      }
    }
  });
});

describe("receiving reports (PROCESSED day)", () => {
  const db = dbAt("PROCESSED");

  it("daily receiving: 2 growers, 1 truck, 5 bales on the sale day", () => {
    const r = run("daily-receiving", db, TODAY);
    expect(r.rows).toHaveLength(2);
    expect(tile(r, "Trucks")).toBe("1");
    expect(tile(r, "Growers")).toBe("2");
    expect(tile(r, "Bales captured")).toBe("5");
    expect(tile(r, "Total mass")).toBe("512 kg");
    expect(r.rows.map((x) => x.gdn).sort()).toEqual(["GDN0000004", "GDN0000005"]);
    expect(r.rows.every((x) => x.tdn === "TDN0000002" && x.vehicle === "AEX1234")).toBe(true);
  });

  it("daily receiving defaults to the demo today and filters by grower and state", () => {
    const def = getReport("daily-receiving")!;
    expect(def.defaultFilters?.(db)).toEqual(TODAY);
    expect(run("daily-receiving", db, { ...TODAY, grower: "V100060" }).rows).toHaveLength(1);
    expect(run("daily-receiving", db, { ...TODAY, status: "OPEN" }).rows).toHaveLength(0);
    // Without a date filter the historical 11 Sep deliveries appear too.
    expect(run("daily-receiving", db, {}).rows.length).toBe(5);
  });

  it("grower delivery: V100060 booked 3 delivered 3, no unbooked", () => {
    const r = run("grower-delivery", db, TODAY);
    const v60 = r.rows.find((x) => x.grower === "V100060")!;
    expect(v60).toMatchObject({ booked: 3, delivered: 3, captured: 3, unbooked: 0, mass: 315 });
    expect(tile(r, "Unbooked bales")).toBe("0");
  });

  it("grower delivery flags unbooked bales", () => {
    const d = dbAt("PROCESSED");
    d.bookings.find((b) => b.bookedId === "EL2609170002")!.balesBooked = 1; // V100061 booked 1, delivered 2
    const r = run("grower-delivery", d, TODAY);
    expect(r.rows.find((x) => x.grower === "V100061")!.unbooked).toBe(1);
    expect(tile(r, "Unbooked bales")).toBe("1");
  });

  it("bale receiving lists all 5 bales; ejected bales are counted separately", () => {
    const d = dbAt("PROCESSED");
    expect(run("bale-receiving", d, TODAY).rows).toHaveLength(5);
    d.bales[0]!.ejected = true;
    const r = run("bale-receiving", d, TODAY);
    expect(tile(r, "Bales captured")).toBe("4");
    expect(tile(r, "Ejected")).toBe("1");
    expect(run("bale-receiving", d, { ...TODAY, status: "EJECTED" }).rows).toHaveLength(1);
  });

  it("ticket printing: documented barcodes, all printed, print events counted", () => {
    const r = run("ticket-printing", db, {});
    expect(r.rows.map((x) => x.ticket)).toEqual(["1000001013", "1000001024", "1000001035", "1000001046", "1000001057"]);
    expect(tile(r, "Printed")).toBe("5");
    expect(tile(r, "Print events")).toBe("6");
    expect(run("ticket-printing", db, { status: "ALLOCATED" }).rows).toHaveLength(0);
  });

  it("floor summary: V100060 row 1 and V100061 row 2", () => {
    const r = run("floor-summary", db, TODAY);
    expect(r.rows.map((x) => [x.grower, x.row, x.bales])).toEqual([
      ["V100060", 1, 3],
      ["V100061", 2, 2],
    ]);
    expect(tile(r, "Bales on the floor")).toBe("5");
  });
});

describe("sales reports (PROCESSED day)", () => {
  const db = dbAt("PROCESSED");

  it("data capture: 5 complete bales with JM / 11OF and the documented prices", () => {
    const r = run("data-capture", db, TODAY);
    expect(r.rows).toHaveLength(5);
    expect(tile(r, "Complete")).toBe("5");
    expect(tile(r, "Awaiting capture")).toBe("0");
    expect(r.rows.find((x) => x.ticket === "1000001013")).toMatchObject({ buyer: "JM", buyerGrade: "11OF", price: 212, timbGrade: "A10" });
  });

  it("data capture shows incomplete bales in the validation showcase", () => {
    const r = run("data-capture", dbAt("VALIDATION_SHOWCASE"), { ...TODAY, status: "INCOMPLETE" });
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.complete === "No")).toBe(true);
  });

  it("sales: gross, deductions and net per grower; deductions total $173.11", () => {
    const r = run("sales", db, TODAY);
    const v60 = r.rows.find((x) => x.grower === "V100060")!;
    const v61 = r.rows.find((x) => x.grower === "V100061")!;
    expect(v60).toMatchObject({ gross: 62573, deductions: 12630, net: 49943, payBatch: 1001, status: "PROCESSED", bales: 3 });
    expect(v61).toMatchObject({ gross: 38945, deductions: 4681, net: 34264, payBatch: 1001 });
    expect(tile(r, "Deductions")).toBe("$173.11");
    expect(tile(r, "Gross value")).toBe("$1,015.18");
  });

  it("sales filters: status, pay batch, buyer", () => {
    expect(run("sales", db, { ...TODAY, status: "DRAFT" }).rows).toHaveLength(0);
    expect(run("sales", db, { batch: "1001" }).rows).toHaveLength(2);
    expect(run("sales", db, { batch: "1000" }).rows).toHaveLength(3);
    expect(run("sales", db, { ...TODAY, buyer: "JM" }).rows).toHaveLength(2);
    expect(run("sales", db, { ...TODAY, buyer: "KT" }).rows).toHaveLength(0);
  });

  it("historical sales keep aggregates (US value 427.20 for sale 1)", () => {
    const r = run("sales", db, { from: "2026-09-11", to: "2026-09-11" });
    expect(r.rows).toHaveLength(3);
    expect(r.rows.find((x) => x.sale === "Sale #1")!.gross).toBe(42720);
  });

  it("batch processing: 2 posted batches without mismatches; mismatch detected in the showcase", () => {
    const r = run("batch-processing", db, TODAY);
    expect(r.rows.map((x) => x.batch)).toEqual(["Batch 4", "Batch 5"]);
    expect(tile(r, "Posted")).toBe("2");
    expect(tile(r, "With price mismatches")).toBe("0");
    const s = run("batch-processing", dbAt("VALIDATION_SHOWCASE"), TODAY);
    expect(tile(s, "With price mismatches")).toBe("1");
    expect(run("batch-processing", db, { batch: "4" }).rows).toHaveLength(1);
  });
});

describe("finance reports (PROCESSED day)", () => {
  const db = dbAt("PROCESSED");

  it("deduction report totals $173.11 in 11 lines across 2 growers and 6 creditors", () => {
    const r = run("deduction", db, TODAY);
    expect(tile(r, "Total deducted")).toBe("$173.11");
    expect(tile(r, "Deductions")).toBe("11");
    expect(tile(r, "Growers affected")).toBe("2");
    expect(tile(r, "Creditors affected")).toBe("6");
    expect(r.rows).toHaveLength(11);
    // documented order: grower charges (1) before the TIMB stop order (5) within a grower
    const v60 = r.rows.filter((x) => x.grower === "V100060").map((x) => x.sequence);
    expect(v60).toEqual([...v60].sort((a, b) => Number(a) - Number(b)));
    expect(v60[v60.length - 1]).toBe(5);
  });

  it("deduction filters: creditor, source and grower", () => {
    expect(run("deduction", db, { creditor: "00050" }).rows).toHaveLength(1);
    expect(tile(run("deduction", db, { status: "TIMB_STOP_ORDER" }), "Total deducted")).toBe("$50.00");
    expect(tile(run("deduction", db, { status: "GROWER_CHARGE" }), "Total deducted")).toBe("$123.11");
    expect(run("deduction", db, { grower: "V100061" }).rows).toHaveLength(5);
  });

  it("creditor report: 6 creditors, stop order counted against 00050", () => {
    const r = run("creditor", db, TODAY);
    expect(r.rows).toHaveLength(6);
    expect(tile(r, "Total deducted")).toBe("$173.11");
    expect(r.rows.find((x) => x.code === "00050")).toMatchObject({ total: 5000, stopOrders: 1, growers: 1 });
    expect(r.rows[0]!.total).toBeGreaterThanOrEqual(r.rows[1]!.total as number);
  });

  it("payment schedule shows the historical demo schedule; filters by batch", () => {
    const r = run("payment-schedule", db, {});
    expect(r.rows).toHaveLength(2);
    expect(tile(r, "Total scheduled")).toBe("$725.40");
    expect(run("payment-schedule", db, { batch: "1001" }).rows).toHaveLength(0);
  });

  it("payment reconciliation: expected vs confirmed for confirmed lines is balanced", () => {
    const r = run("payment-reconciliation", db, {});
    expect(tile(r, "Expected")).toBe("$725.40");
    expect(tile(r, "Confirmed")).toBe("$725.40");
    expect(tile(r, "Outstanding")).toBe("$0.00");
    expect(r.rows.every((x) => x.variance === 0)).toBe(true);
  });

  it("payment reconciliation: unpaid and failed lines are outstanding / counted; CSV download is not payment", () => {
    const d = dbAt("PROCESSED");
    d.paymentSchedules.push({
      id: "psch-1001-usd", ref: "PSCH-1001-USD", payBatchNo: 1001, currency: "USD", invoicesDate: "2026-09-17", sellingPointId: "EL",
      status: "GENERATED", generatedAt: "2026-09-17T14:00:00", generatedBy: "user-accounts", excluded: [{ growerNo: "V100074", name: "Farai Ngapasare", reason: "no bank details" }],
      csvFilename: "payment_schedule_1001_USD.csv", csvDownloads: 1,
    });
    const base = { scheduleId: "psch-1001-usd", currency: "USD", creditAccount: "x", debitAccount: "y", companyName: "c", batchReference: "1001", bankCode: "B", bank: "Bank", branchCode: "1", transactionType: "CREDIT", transactionDate: "2026-09-17" };
    d.paymentLines.push(
      { ...base, id: "pl-a", growerNo: "V100060", beneficiary: "Chengetai Chingoma", amountCents: 49943, transactionId: "1001-1", status: "PENDING" },
      { ...base, id: "pl-b", growerNo: "V100061", beneficiary: "Trust Gwenzi", amountCents: 34264, transactionId: "1001-2", status: "FAILED", failureReason: "Account closed" },
    );
    d.paymentTransactions.push({ id: "ptx-x", scheduleId: "psch-1001-usd", kind: "CSV_DOWNLOADED", at: "2026-09-17T14:01:00", userId: "user-accounts", note: "csv" });
    const r = run("payment-reconciliation", d, { batch: "1001" });
    expect(r.rows).toHaveLength(2);
    expect(tile(r, "Expected")).toBe("$842.07");
    expect(tile(r, "Confirmed")).toBe("$0.00");
    expect(tile(r, "Outstanding")).toBe("$499.43");
    expect(tile(r, "Failed lines")).toBe("1");
    const sched = run("payment-schedule", d, { batch: "1001" });
    expect(tile(sched, "Growers left out")).toBe("1");
    expect(sched.notes?.join(" ")).toContain("V100074");
    // A partial confirmation shows a variance
    d.paymentTransactions.push({ id: "ptx-y", scheduleId: "psch-1001-usd", lineId: "pl-a", kind: "CONFIRMED", at: "2026-09-17T15:00:00", userId: "user-accounts", amountCents: 40000, reference: "R1", note: "partial" });
    const r2 = run("payment-reconciliation", d, { batch: "1001", grower: "V100060" });
    expect(r2.rows[0]).toMatchObject({ confirmed: 40000, variance: -9943 });
  });

  it("non-USD amounts are formatted in their own currency, never as dollars", () => {
    const d = dbAt("PROCESSED");
    d.paymentSchedules.push({
      id: "psch-1001-zwl", ref: "PSCH-1001-ZWL", payBatchNo: 1001, currency: "ZWL", invoicesDate: "2026-09-17", sellingPointId: "EL",
      status: "GENERATED", generatedAt: "2026-09-17T14:00:00", generatedBy: "user-accounts", excluded: [], csvFilename: "z.csv", csvDownloads: 0,
    });
    d.paymentLines.push({
      id: "pl-z", scheduleId: "psch-1001-zwl", growerNo: "V100060", beneficiary: "Chengetai Chingoma", currency: "ZWL", creditAccount: "1", amountCents: 1332710, debitAccount: "d",
      companyName: "c", batchReference: "1001", transactionId: "t", bankCode: "B", bank: "Bank", branchCode: "1", transactionType: "CREDIT", transactionDate: "2026-09-17", status: "PENDING",
    });
    const r = run("payment-schedule", d, { batch: "1001" });
    expect(tile(r, "Total scheduled")).toBe("ZWL 13,327.10");
    const col = r.columns.find((c) => c.key === "amount")!;
    expect(displayValue(col, r.rows[0]!)).toBe("ZWL 13,327.10");
    expect(exportValue(col, r.rows[0]!)).toBe("13327.10");
  });
});

describe("dispatch reports (READY_TO_DISPATCH day)", () => {
  it("are empty before any dispatch, then reflect notes and shipment files", () => {
    const db = dbAt("READY_TO_DISPATCH");
    expect(run("dispatch", db, {}).rows).toHaveLength(0);
    expect(run("shipment", db, {}).rows).toHaveLength(0);

    db.dispatchNotes.push(
      { id: "dn-1", ref: "FLDN/2026/09/0001", state: "POSTED", warehouseCode: "CURVERID", product: "GREEN", noTransportDetails: false, truckReg: "ABC1234", driver: "Driver One",
        baleIds: ["bale-1", "bale-2"], totalBales: 2, totalMass: 210, createdBy: "user-dispatch-clerk", createdAt: "2026-09-17T14:00:00", dispatchDate: "2026-09-17", mobileCreated: false },
      { id: "dn-2", ref: "FLDN/2026/09/0002", state: "CANCELLED", warehouseCode: "CURVERID", product: "GREEN", noTransportDetails: true,
        baleIds: [], totalBales: 0, totalMass: 0, createdBy: "user-dispatch-clerk", createdAt: "2026-09-17T14:30:00", cancelReason: "Wrong truck", mobileCreated: false },
    );
    db.shipmentExports.push({ id: "se-1", dispatchNoteId: "dn-1", filename: "FLDN_2026_09_0001.csv", generatedAt: "2026-09-17T14:10:00", generatedBy: "user-dispatch-supervisor", rowCount: 2, csv: "", isMockFormat: true });

    const d = run("dispatch", db, TODAY);
    expect(d.rows).toHaveLength(2);
    expect(tile(d, "Posted")).toBe("1");
    expect(tile(d, "Bales dispatched")).toBe("2");
    expect(tile(d, "Mass dispatched")).toBe("210 kg");
    expect(run("dispatch", db, { status: "CANCELLED" }).rows[0]!.cancelReason).toBe("Wrong truck");
    const s = run("shipment", db, TODAY);
    expect(s.rows[0]).toMatchObject({ filename: "FLDN_2026_09_0001.csv", lines: 2, destination: "CURVERID" });
    expect(String(s.rows[0]!.format)).toContain("UQ-12");
  });
});

describe("user activity", () => {
  it("groups the audit log per user, busiest first, filterable by user and date", () => {
    const db = dbAt("PROCESSED");
    const r = run("user-activity", db, {});
    expect(r.rows.length).toBeGreaterThan(3);
    const counts = r.rows.map((x) => Number(x.actions));
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(tile(r, "Audit entries")).toBe(String(db.audit.length));
    const dps = r.rows.find((x) => x.user === "Chipo Ndlovu")!;
    expect(dps.roles).toBe("Data Processing Supervisor");
    expect(String(dps.topAction)).toMatch(/×/);
    expect(run("user-activity", db, { user: "user-data-clerk" }).rows).toHaveLength(1);
    expect(run("user-activity", db, { from: "2026-09-12" }).rows.every((x) => String(x.first) >= "2026-09-17")).toBe(true);
  });

  it("requires audit.view on top of reports.view (declared on the definition)", () => {
    expect(getReport("user-activity")?.permission).toBe("audit.view");
  });
});

describe("export values", () => {
  it("amounts export as plain decimals, dates as ISO, nulls as empty", () => {
    const db = dbAt("PROCESSED");
    const r = run("sales", db, TODAY);
    const row = r.rows.find((x) => x.grower === "V100060")!;
    const gross = r.columns.find((c) => c.key === "gross")!;
    expect(exportValue(gross, row)).toBe("625.73");
    expect(displayValue(gross, row)).toBe("$625.73");
    expect(exportValue(r.columns.find((c) => c.key === "date")!, row)).toBe("2026-09-17");
    expect(displayValue(r.columns.find((c) => c.key === "date")!, row)).toMatch(/^17 Sep/); // month abbreviation is locale-dependent
  });
});

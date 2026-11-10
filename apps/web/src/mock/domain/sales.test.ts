import { describe, expect, it } from "vitest";
import { ctxFor, dbAt } from "../testing";
import { balancePreview, balanceSale, releaseSale, saleGrossCents, selectSaleDetail, selectSaleRows } from "./sales";

const dps = (db: ReturnType<typeof dbAt>) => ctxFor(db, "data-processing-supervisor");

describe("balancePreview", () => {
  it("READY_TO_BALANCE: both documented sales pass every check; gross = Σ price × mass", () => {
    const db = dbAt("READY_TO_BALANCE");
    const p4 = balancePreview(db, "sale-4");
    expect(p4).toMatchObject({ canBalance: true, baleCount: 3, purchasedCount: 3, unsoldCount: 0, totalMassKg: 315, grossValueCents: 62573 });
    expect(p4.issues).toEqual([]);
    expect(p4.checks.every((c) => c.passed)).toBe(true);
    expect(balancePreview(db, "sale-5")).toMatchObject({ canBalance: true, grossValueCents: 38945, totalMassKg: 197 });
  });

  it("VALIDATION_SHOWCASE: lists all three problems on V100061 and blocks it; V100060 is fine", () => {
    const db = dbAt("VALIDATION_SHOWCASE");
    const p5 = balancePreview(db, "sale-5");
    expect(p5.canBalance).toBe(false);
    const byCheck = (c: string) => p5.issues.filter((i) => i.check === c);
    expect(byCheck("classification")).toHaveLength(1);
    expect(byCheck("classification")[0]).toMatchObject({ barcode: "1000001046", message: "Ticket 1000001046 is missing TIMB grade" });
    expect(byCheck("buyer-grade")[0]).toMatchObject({ barcode: "1000001057" });
    expect(byCheck("buyer-grade")[0]!.message).toContain("Invalid Buyer Grade: 11OF");
    expect(byCheck("price-match")[0]).toMatchObject({ barcode: "1000001057", key: "BALANCE_PRICE_MISMATCH" });
    expect(byCheck("price-match")[0]!.message).toContain("captured 190, batch 195");
    expect(p5.issues).toHaveLength(3);
    expect(p5.checks.find((c) => c.id === "buyer")?.passed).toBe(true);
    expect(balancePreview(db, "sale-4").canBalance).toBe(true);
  });

  it("a Draft sale with an unposted batch is blocked (flagged assumption)", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const p = balancePreview(db, "sale-4");
    expect(p.canBalance).toBe(false);
    expect(p.issues.some((i) => i.check === "batch-posted" && i.assumption)).toBe(true);
    // every bale is also missing grade, buyer, buyer grade and price — none are silently skipped
    expect(p.issues.filter((i) => i.barcode).length).toBe(12);
  });

  it("unsold bales: sale code with a non-reason grade is refused; with a reason it passes and is left out of the total", () => {
    const db = dbAt("READY_TO_BALANCE");
    const b = db.bales.find((x) => x.ticketBarcode === "1000001035")!;
    b.saleCode = "RO";
    expect(balancePreview(db, "sale-4").issues).toMatchObject([{ check: "unsold-reason", key: "INVALID_REASON_REJECTED" }]);
    b.timbGrade = "X01";
    const p = balancePreview(db, "sale-4");
    expect(p.issues).toEqual([]);
    expect(p).toMatchObject({ purchasedCount: 2, unsoldCount: 1, grossValueCents: 23744 + 19404 });
  });

  it("an unknown buyer code is reported", () => {
    const db = dbAt("READY_TO_BALANCE");
    db.bales.find((x) => x.ticketBarcode === "1000001013")!.buyerCode = "ZZ";
    expect(balancePreview(db, "sale-4").issues.some((i) => i.key === "INVALID_BUYER")).toBe(true);
  });

  it("a pending approval on the sale blocks balancing (assumption)", () => {
    const db = dbAt("READY_TO_BALANCE");
    db.approvals.push({ id: "apr-9", ref: "APR-0009", entityType: "Sale", entityId: "sale-4", entityRef: "Salesmaster 4", action: "sale.reverse", requestedBy: "user-supervisor", requestReason: "test", requestedAt: "2026-09-17T12:00:00", status: "PENDING" });
    const p = balancePreview(db, "sale-4");
    expect(p.pendingApprovals).toBe(1);
    expect(p.canBalance).toBe(false);
  });

  it("historical processed sales use their aggregates", () => {
    const p = balancePreview(dbAt("FRESH"), "sale-1");
    expect(p).toMatchObject({ historical: true, baleCount: 3, grossValueCents: 42720, canBalance: false });
  });
});

describe("balanceSale", () => {
  it("READY_TO_BALANCE: Draft → Balanced with audit; a second balance is refused", () => {
    const db = dbAt("READY_TO_BALANCE");
    const sale = balanceSale(dps(db), { saleId: "sale-4" });
    expect(sale).toMatchObject({ status: "BALANCED", balancedBy: "user-data-processing-supervisor" });
    expect(db.audit[0]).toMatchObject({ action: "sales.balance", entityId: "sale-4", previous: { status: "DRAFT" } });
    expect(() => balanceSale(dps(db), { saleId: "sale-4" })).toThrow(/already processed/);
    balanceSale(dps(db), { saleId: "sale-5" });
    // matches the BALANCED preset
    const preset = dbAt("BALANCED");
    expect(db.sales.filter((s) => s.refNo >= 4).map((s) => s.status)).toEqual(preset.sales.filter((s) => s.refNo >= 4).map((s) => s.status));
  });

  it("refuses with the first failing check's verbatim message and changes nothing", () => {
    const db = dbAt("VALIDATION_SHOWCASE");
    expect(() => balanceSale(dps(db), { saleId: "sale-5" })).toThrow("Ticket 1000001046 is missing TIMB grade");
    expect(db.sales.find((s) => s.id === "sale-5")!.status).toBe("DRAFT");
    const bad = dbAt("READY_TO_BALANCE");
    bad.bales.find((x) => x.ticketBarcode === "1000001024")!.batchPriceCents = 199;
    expect(() => balanceSale(dps(bad), { saleId: "sale-4" })).toThrow("Balancing stops on a price mismatch: ticket 1000001024 captured 198, batch 199");
  });

  it("needs sales.balance", () => {
    expect(() => balanceSale(ctxFor(dbAt("READY_TO_BALANCE"), "floor-summary-clerk"), { saleId: "sale-4" })).toThrow(/sales\.balance/);
    expect(() => balanceSale(ctxFor(dbAt("READY_TO_BALANCE"), "data-clerk"), { saleId: "sale-4" })).toThrow(/sales\.balance/);
  });
});

describe("releaseSale", () => {
  it("a Draft sale cannot be released; a Balanced one can, once", () => {
    const db = dbAt("READY_TO_BALANCE");
    expect(() => releaseSale(dps(db), { saleId: "sale-4" })).toThrow(/Draft sale cannot be released/);
    balanceSale(dps(db), { saleId: "sale-4" });
    expect(releaseSale(dps(db), { saleId: "sale-4" })).toMatchObject({ released: true, releasedBy: "user-data-processing-supervisor" });
    expect(() => releaseSale(dps(db), { saleId: "sale-4" })).toThrow(/already released/);
  });

  it("needs sales.release", () => {
    expect(() => releaseSale(ctxFor(dbAt("BALANCED"), "accounts"), { saleId: "sale-4" })).toThrow(/sales\.release/);
  });
});

describe("selectors", () => {
  it("Draft sales show no value (as in Ticket Processing); processed ones show gross and the SoD rate", () => {
    const draft = selectSaleRows(dbAt("FLOOR_SUMMARY_DONE")).find((r) => r.id === "sale-4")!;
    expect(draft.usdValueCents).toBeUndefined();
    const processed = selectSaleRows(dbAt("PROCESSED")).find((r) => r.id === "sale-4")!;
    expect(processed).toMatchObject({ usdValueCents: 62573, payBatchNo: 1001, status: "PROCESSED", exchangeRate: "26.68450000", gdnDocNo: "GDN0000005" });
  });

  it("detail of a processed sale includes its deductions and net", () => {
    const d = selectSaleDetail(dbAt("PROCESSED"), "sale-4")!;
    expect(d.deductions).toHaveLength(6); // 5 floor charges + the $50 TIMB stop order
    expect(d.deductionsTotalCents).toBe(7630 + 5000);
    expect(saleGrossCents(dbAt("PROCESSED"), d.sale) - d.deductionsTotalCents).toBe(62573 - 12630);
  });
});

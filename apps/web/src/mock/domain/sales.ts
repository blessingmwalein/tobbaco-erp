import {
  AppError,
  formatMessage,
  ticketValueCents,
  type Bale,
  type DeliveryNote,
  type Deduction,
  type MessageKey,
  type MockDb,
  type PriceBatch,
  type Sale,
} from "@tobacco/shared";
import { audit, failText, requirePermission, type Ctx } from "../ctx";
import { sortBales } from "./floor-summary";

/**
 * Sales and balancing (Manual 06, Step 5). `balancePreview` is a PURE function that lists every check for every bale —
 * it never silently ignores an invalid bale. `balanceSale` re-runs it and refuses unless every check passes.
 * (The backend will be authoritative; the frontend never decides that a sale is balanced.)
 */

export type CheckId =
  | "sale-state"
  | "classification"
  | "buyer"
  | "buyer-grade"
  | "price"
  | "batch-posted"
  | "price-match"
  | "unsold-reason"
  | "approvals";

export interface BalanceIssue {
  id: string;
  check: CheckId;
  severity: "error" | "warning";
  barcode?: string;
  message: string;
  key?: MessageKey;
  params?: Record<string, string | number>;
  /** True when the rule is our assumption rather than documented. */
  assumption?: boolean;
}

export interface BalanceCheck {
  id: CheckId;
  label: string;
  passed: boolean;
  count: number;
  assumption?: boolean;
}

export interface BalancePreview {
  saleId: string;
  refNo: number;
  status: Sale["status"];
  baleCount: number;
  purchasedCount: number;
  unsoldCount: number;
  totalMassKg: number;
  grossValueCents: number;
  checks: BalanceCheck[];
  issues: BalanceIssue[];
  pendingApprovals: number;
  canBalance: boolean;
  /** Why the Balance button is disabled (first blocking reason). */
  blockedReason?: string;
  historical: boolean;
}

const CHECK_LABELS: Record<CheckId, { label: string; assumption?: boolean }> = {
  "sale-state": { label: "Sale is Draft (not already balanced or processed)" },
  classification: { label: "Every purchased bale has a TIMB grade" },
  buyer: { label: "Every purchased bale has a buyer" },
  "buyer-grade": { label: "Every purchased bale has a buyer grade that belongs to its buyer" },
  price: { label: "Every purchased bale has a valid price" },
  "batch-posted": { label: "Price batch is posted", assumption: true },
  "price-match": { label: "Captured prices match the batch prices" },
  "unsold-reason": { label: "Unsold bales have a valid sale code and TIMB reason" },
  approvals: { label: "No outstanding approvals for this sale", assumption: true },
};

export function saleBales(db: MockDb, sale: Sale): Bale[] {
  return sortBales(db.bales.filter((b) => !b.ejected && b.saleId === sale.id && b.ticketBarcode));
}

/** Gross sale value in cents: Σ price (US cents/kg) × mass (kg) over purchased bales. Formula and rounding are unverified (UQ-05). */
export function saleGrossCents(db: MockDb, sale: Sale): number {
  if (sale.historical) return sale.historical.usdValueCents;
  return saleBales(db, sale)
    .filter((b) => !b.saleCode && b.priceCents)
    .reduce((a, b) => a + ticketValueCents(b.priceCents!, b.mass), 0);
}

export function balancePreview(db: MockDb, saleId: string): BalancePreview {
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) throw new Error("Sale not found");
  const batch = db.priceBatches.find((b) => b.id === sale.priceBatchId);
  const bales = saleBales(db, sale);
  const issues: BalanceIssue[] = [];
  let seq = 0;
  const add = (i: Omit<BalanceIssue, "id" | "severity"> & { severity?: BalanceIssue["severity"] }) =>
    issues.push({ id: `iss-${++seq}`, severity: "error", ...i });
  const missing = (check: CheckId, barcode: string, field: string) =>
    add({ check, barcode, key: "SALE_MISSING_FIELD", params: { barcode, field }, message: formatMessage("SALE_MISSING_FIELD", { barcode, field }) });

  if (sale.status !== "DRAFT")
    add({ check: "sale-state", key: "BARCODE_ALREADY_PROCESSED", params: { sale: `#${sale.refNo}` }, message: formatMessage("BARCODE_ALREADY_PROCESSED", { sale: `#${sale.refNo}` }) });

  const pendingApprovals = db.approvals.filter((a) => a.status === "PENDING" && a.entityType === "Sale" && a.entityId === sale.id).length;
  if (pendingApprovals > 0)
    add({ check: "approvals", assumption: true, message: `${pendingApprovals} approval(s) for this sale are still pending.` });

  if (!sale.historical) {
    if (bales.length === 0) add({ check: "classification", message: "This sale has no bales." });
    if (batch && batch.status !== "POSTED" && sale.status === "DRAFT")
      add({ check: "batch-posted", assumption: true, message: `Price batch ${batch.refNo} has not been posted. Post the batch before balancing (assumption — the manual lists batch posting before balancing).` });

    for (const b of bales) {
      const barcode = b.ticketBarcode!;
      if (b.saleCode) {
        const grade = db.timbGrades.find((g) => g.code === b.timbGrade);
        if (!grade?.isReason)
          add({ check: "unsold-reason", barcode, key: "INVALID_REASON_REJECTED", message: `${formatMessage("INVALID_REASON_REJECTED")} (ticket ${barcode}, sale code ${b.saleCode})` });
        continue;
      }
      if (!b.timbGrade) missing("classification", barcode, "TIMB grade");
      if (!b.buyerCode) missing("buyer", barcode, "buyer");
      const buyer = b.buyerCode ? db.buyers.find((x) => x.code === b.buyerCode) : undefined;
      if (b.buyerCode && !buyer)
        add({ check: "buyer", barcode, key: "INVALID_BUYER", params: { value: b.buyerCode }, message: `${formatMessage("INVALID_BUYER", { value: b.buyerCode })} (ticket ${barcode})` });
      if (!b.buyerGrade) missing("buyer-grade", barcode, "buyer grade");
      else if (buyer && !buyer.grades.includes(b.buyerGrade))
        add({
          check: "buyer-grade",
          barcode,
          key: "INVALID_BUYER_GRADE",
          params: { value: b.buyerGrade },
          message: `${formatMessage("INVALID_BUYER_GRADE", { value: b.buyerGrade })} — not a grade of buyer ${buyer.code} (ticket ${barcode})`,
        });
      if (!b.priceCents || b.priceCents <= 0) missing("price", barcode, "price");
      else if (batch) {
        if (b.batchPriceCents === undefined) {
          if (batch.status === "POSTED") add({ check: "price-match", barcode, message: `Ticket ${barcode} has no batch price.` });
        } else if (b.batchPriceCents !== b.priceCents)
          add({
            check: "price-match",
            barcode,
            key: "BALANCE_PRICE_MISMATCH",
            params: { barcode, captured: b.priceCents, batch: b.batchPriceCents },
            message: formatMessage("BALANCE_PRICE_MISMATCH", { barcode, captured: b.priceCents, batch: b.batchPriceCents }),
          });
      }
    }
  }

  const checks: BalanceCheck[] = (Object.keys(CHECK_LABELS) as CheckId[]).map((id) => {
    const count = issues.filter((i) => i.check === id).length;
    return { id, label: CHECK_LABELS[id].label, passed: count === 0, count, assumption: CHECK_LABELS[id].assumption };
  });

  const purchased = bales.filter((b) => !b.saleCode);
  const errors = issues.filter((i) => i.severity === "error");
  const historical = Boolean(sale.historical);
  return {
    saleId: sale.id,
    refNo: sale.refNo,
    status: sale.status,
    baleCount: historical ? sale.historical!.baleCount : bales.length,
    purchasedCount: historical ? sale.historical!.baleCount : purchased.length,
    unsoldCount: bales.length - purchased.length,
    totalMassKg: historical ? sale.historical!.massKg : bales.reduce((a, b) => a + b.mass, 0),
    grossValueCents: saleGrossCents(db, sale),
    checks,
    issues,
    pendingApprovals,
    canBalance: sale.status === "DRAFT" && errors.length === 0 && !historical,
    blockedReason:
      sale.status !== "DRAFT"
        ? `Sale is already ${sale.status.toLowerCase()}.`
        : errors.length > 0
          ? `${errors.length} check(s) failed — fix them before balancing.`
          : undefined,
    historical,
  };
}

/** Balance Sale: Draft → Balanced. Refuses with the first failing check's verbatim message. */
export function balanceSale(ctx: Ctx, input: { saleId: string }) {
  requirePermission(ctx, "sales.balance");
  const sale = ctx.db.sales.find((s) => s.id === input.saleId);
  if (!sale) return failText("Sale not found");
  const preview = balancePreview(ctx.db, sale.id);
  const first = preview.issues.find((i) => i.severity === "error");
  if (first) {
    if (first.key) throw new AppError(first.key, first.params ?? {});
    return failText(first.message);
  }
  sale.status = "BALANCED";
  sale.balancedBy = ctx.actor.id;
  sale.balancedAt = ctx.now;
  sale.updatedAt = ctx.now;
  audit(ctx, {
    action: "sales.balance",
    entityType: "Sale",
    entityId: sale.id,
    entityRef: `Salesmaster ${sale.refNo}`,
    previous: { status: "DRAFT" },
    next: { status: "BALANCED", grossValueCents: preview.grossValueCents, bales: preview.baleCount },
  });
  return sale;
}

/**
 * Release a sale for dispatch. Who releases a sale at Ethical, and where, is unknown (UQ-03) — mock: Data Processing
 * Supervisor, on any sale that is no longer Draft.
 */
export function releaseSale(ctx: Ctx, input: { saleId: string }) {
  requirePermission(ctx, "sales.release");
  const sale = ctx.db.sales.find((s) => s.id === input.saleId);
  if (!sale) return failText("Sale not found");
  if (sale.status === "DRAFT") return failText("A Draft sale cannot be released. Balance it first.");
  if (sale.released) return failText("This sale is already released.");
  sale.released = true;
  sale.releasedBy = ctx.actor.id;
  sale.releasedAt = ctx.now;
  sale.updatedAt = ctx.now;
  audit(ctx, { action: "sales.release", entityType: "Sale", entityId: sale.id, entityRef: `Salesmaster ${sale.refNo}`, previous: { released: false }, next: { released: true } });
  return sale;
}

/** Reverse a BALANCED sale back to Draft (executed directly, or after an approved request). Never touches Processed sales. */
export function reverseBalancedSale(ctx: Ctx, saleId: string, reason: string) {
  const sale = ctx.db.sales.find((s) => s.id === saleId);
  if (!sale) return failText("Sale not found");
  if (sale.status === "PROCESSED")
    return failText("A Processed sale needs a financial reversal, which the manuals do not specify (UQ-06). Only Balanced sales can be reversed here.");
  if (sale.status !== "BALANCED") return failText("Only a Balanced sale can be reversed.");
  sale.status = "DRAFT";
  sale.balancedAt = undefined;
  sale.balancedBy = undefined;
  sale.released = false;
  sale.updatedAt = ctx.now;
  audit(ctx, { action: "sales.reverse", entityType: "Sale", entityId: sale.id, entityRef: `Salesmaster ${sale.refNo}`, previous: { status: "BALANCED" }, next: { status: "DRAFT" }, reason });
  return sale;
}

// ── Selectors ────────────────────────────────────────────────────

export interface SaleRow {
  id: string;
  refNo: number;
  saleNo: number;
  growerNo: string;
  firstName: string;
  surname: string;
  floorCode: string;
  saleDate: string;
  status: Sale["status"];
  released: boolean;
  payBatchNo?: number;
  /** Cents; undefined while the sale is Draft (the manual shows 0 until balancing). */
  usdValueCents?: number;
  exchangeRate?: string;
  gdnId: string;
  gdnDocNo: string;
  historical: boolean;
}

export function selectSaleRows(db: MockDb): SaleRow[] {
  return db.sales
    .map((s): SaleRow => {
      const g = db.growers.find((x) => x.growerNo === s.growerNo);
      const sod = db.startOfDays.find((d) => d.sellingPointId === s.sellingPointId && d.sellingDate === s.saleDate && d.status === "POSTED");
      return {
        id: s.id,
        refNo: s.refNo,
        saleNo: s.saleNo,
        growerNo: s.growerNo,
        firstName: g?.firstName ?? "",
        surname: g?.surname ?? "",
        floorCode: s.floorCode,
        saleDate: s.saleDate,
        status: s.status,
        released: s.released,
        payBatchNo: s.payBatchNo,
        usdValueCents: s.status === "DRAFT" ? undefined : saleGrossCents(db, s),
        exchangeRate: sod?.exchangeRate,
        gdnId: s.gdnId,
        gdnDocNo: db.deliveryNotes.find((d) => d.id === s.gdnId)?.docNo ?? s.gdnId,
        historical: Boolean(s.historical),
      };
    })
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate) || b.refNo - a.refNo);
}

export interface SaleDetail {
  sale: Sale;
  growerName: string;
  firstName: string;
  surname: string;
  sellingPointName: string;
  note?: DeliveryNote;
  batch?: PriceBatch;
  bales: Bale[];
  preview: BalancePreview;
  deductions: Deduction[];
  deductionsTotalCents: number;
  pendingApprovalIds: string[];
  exchangeRate?: string;
}

export function selectSaleDetail(db: MockDb, saleId: string): SaleDetail | undefined {
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) return undefined;
  const g = db.growers.find((x) => x.growerNo === sale.growerNo);
  const deductions = db.deductions.filter((d) => d.saleId === sale.id).sort((a, b) => a.sequence - b.sequence);
  return {
    sale,
    growerName: g ? `${g.firstName} ${g.surname}` : sale.growerNo,
    firstName: g?.firstName ?? "",
    surname: g?.surname ?? "",
    sellingPointName: db.sellingPoints.find((s) => s.id === sale.sellingPointId)?.name ?? sale.sellingPointId,
    note: db.deliveryNotes.find((d) => d.id === sale.gdnId),
    batch: db.priceBatches.find((b) => b.id === sale.priceBatchId),
    bales: saleBales(db, sale),
    preview: balancePreview(db, sale.id),
    deductions,
    deductionsTotalCents: deductions.reduce((a, d) => a + d.amountCents, 0),
    pendingApprovalIds: db.approvals.filter((a) => a.status === "PENDING" && a.entityType === "Sale" && a.entityId === sale.id).map((a) => a.id),
    exchangeRate: db.startOfDays.find((d) => d.sellingPointId === sale.sellingPointId && d.sellingDate === sale.saleDate && d.status === "POSTED")?.exchangeRate,
  };
}

import {
  DEDUCTION_DASHBOARD_SOURCE_LABEL,
  Decimal,
  formatMessage,
  parseDecimal,
  ticketValueCents,
  type Deduction,
  type DeductionSource,
  type MockDb,
  type Sale,
} from "@tobacco/shared";
import { audit, fail, failText, genericId, nextSeq, notify, requirePermission, type Ctx } from "../ctx";

/**
 * Stop orders & deductions (Manual 07).
 *
 * Documented order of deductions for every balanced sale:
 *   1 statutory & floor charges (grower charges) · 2 internal invoices · 3 merchant loans ·
 *   4 TIMB invoices · 5 TIMB stop orders.
 * The balance becomes the grower's payout; the sale moves to Processed and gets a pay batch number.
 *
 * NOT DOCUMENTED (no formula is invented): how each charge is computed (UQ-05), what happens when deductions exceed the
 * sale value (UQ-22), how pay batch numbers are assigned (UQ-06), what Amount 1/2/3 of a stop order mean (UQ-07).
 * Phase 1 posts ILLUSTRATIVE fixed floor-charge amounts from `GrowerCharge.demoAmountCentsByGrower`.
 */

export const SOURCE_SEQUENCE: Record<DeductionSource, number> = {
  GROWER_CHARGE: 1,
  INTERNAL_INVOICE: 2,
  MERCHANT_LOAN: 3,
  TIMB_INVOICE: 4,
  TIMB_STOP_ORDER: 5,
};

// ── Pure calculations ───────────────────────────────────────────

/** Gross sale value in cents: Σ price (US cents/kg) × mass over purchased bales. Rounding unverified (UQ-05). */
export function saleGrossCents(db: MockDb, sale: Sale): number {
  if (sale.historical) return sale.historical.usdValueCents;
  return db.bales
    .filter((b) => b.saleId === sale.id && !b.ejected && !b.saleCode && b.priceCents)
    .reduce((sum, b) => sum + ticketValueCents(b.priceCents ?? 0, b.mass), 0);
}

export interface PlannedLine {
  source: DeductionSource;
  sequence: number;
  creditorCode: string;
  creditorName: string;
  description: string;
  currency: string;
  amountCents: number;
  isDemoAmount?: boolean;
  /** What the line settles (so the run can update it). */
  ref?: { kind: "invoice" | "loan" | "stopOrder"; id: string };
}

export interface SalePlan {
  saleId: string;
  refNo: number;
  growerNo: string;
  saleDate: string;
  grossCents: number;
  lines: PlannedLine[];
  totalCents: number;
  netCents: number;
  /** True when deductions would exceed the gross value and were limited (UQ-22). */
  capped: boolean;
  warnings: string[];
}

const creditorName = (db: MockDb, code: string, fallback?: string) =>
  db.creditors.find((c) => c.code === code)?.name ?? fallback ?? `Creditor ${code}`;

/** What Stop Order Processing WOULD deduct for one balanced sale (no mutation). */
export function planSaleDeductions(db: MockDb, sale: Sale): SalePlan {
  const gross = saleGrossCents(db, sale);
  const candidates: PlannedLine[] = [];
  const warnings: string[] = [];

  // 1. Statutory charges and floor charges (grower charges) — illustrative fixed amounts.
  for (const c of [...db.growerCharges].filter((x) => x.active).sort((a, b) => a.order - b.order)) {
    const amount = c.demoAmountCentsByGrower[sale.growerNo];
    if (!amount) continue;
    candidates.push({
      source: "GROWER_CHARGE",
      sequence: 1,
      creditorCode: c.creditorCode,
      creditorName: c.name,
      description: c.name,
      currency: c.currency,
      amountCents: amount,
      isDemoAmount: true,
    });
  }

  // 2. Internal invoices
  for (const inv of db.internalInvoices.filter((i) => i.growerNo === sale.growerNo && i.status === "OPEN")) {
    if (inv.currency !== "USD") {
      warnings.push(`Internal invoice ${inv.id} is in ${inv.currency}; only USD deductions are posted in Phase 1.`);
      continue;
    }
    candidates.push({
      source: "INTERNAL_INVOICE",
      sequence: 2,
      creditorCode: inv.creditorCode,
      creditorName: creditorName(db, inv.creditorCode),
      description: inv.description,
      currency: inv.currency,
      amountCents: inv.amountCents,
      ref: { kind: "invoice", id: inv.id },
    });
  }

  // 3. Merchant loans
  for (const loan of db.merchantLoans.filter((l) => l.growerNo === sale.growerNo && l.status === "OPEN")) {
    if (loan.currency !== "USD") {
      warnings.push(`Merchant loan ${loan.id} is in ${loan.currency}; only USD deductions are posted in Phase 1.`);
      continue;
    }
    candidates.push({
      source: "MERCHANT_LOAN",
      sequence: 3,
      creditorCode: loan.creditorCode,
      creditorName: creditorName(db, loan.creditorCode),
      description: `Merchant loan ${loan.id}`,
      currency: loan.currency,
      amountCents: loan.balanceCents,
      ref: { kind: "loan", id: loan.id },
    });
  }

  // 4. TIMB invoices — not modelled (no documented source/format).

  // 5. TIMB stop orders. The date in the stop-order file name links stop orders to that day's sales (Manual 07).
  const stopOrders = db.stopOrders
    .filter((s) => s.growerNo === sale.growerNo && s.paidAmountCents < s.amount1Cents)
    .sort((a, b) => a.priority - b.priority || a.stopOrderNo - b.stopOrderNo);
  for (const so of stopOrders) {
    if (so.fileDate !== sale.saleDate) {
      warnings.push(
        `${formatMessage("STOP_NOT_DEDUCTED")}: ${so.timbFile} is dated ${so.fileDate} but sale ${sale.refNo} is ${sale.saleDate} — import the file for the correct day, then process again.`,
      );
      continue;
    }
    candidates.push({
      source: "TIMB_STOP_ORDER",
      sequence: 5,
      creditorCode: so.creditorCode,
      creditorName: creditorName(db, so.creditorCode),
      description: `Stop order #${so.stopOrderNo}`,
      currency: "USD",
      // Meaning of Amount 1/2/3 is undocumented (UQ-07): Amount 1 is treated as the amount to deduct.
      amountCents: so.amount1Cents - so.paidAmountCents,
      ref: { kind: "stopOrder", id: so.id },
    });
  }

  // Cap at the gross value (UQ-22: behaviour when deductions exceed the value is undocumented).
  let remaining = gross;
  let capped = false;
  const lines: PlannedLine[] = [];
  for (const c of candidates) {
    const amount = Math.min(c.amountCents, Math.max(remaining, 0));
    if (amount < c.amountCents) {
      capped = true;
      warnings.push(
        `Deduction “${c.description}” for ${sale.growerNo} limited to ${(amount / 100).toFixed(2)} of ${(c.amountCents / 100).toFixed(2)} because deductions cannot exceed the sale value (UQ-22: undocumented).`,
      );
    }
    if (amount <= 0) continue;
    remaining -= amount;
    lines.push({ ...c, amountCents: amount });
  }
  const total = lines.reduce((a, l) => a + l.amountCents, 0);
  return {
    saleId: sale.id,
    refNo: sale.refNo,
    growerNo: sale.growerNo,
    saleDate: sale.saleDate,
    grossCents: gross,
    lines,
    totalCents: total,
    netCents: gross - total,
    capped,
    warnings,
  };
}

/** Financial summary for any sale: processed sales use the posted deduction lines. */
export function saleFinancials(db: MockDb, sale: Sale) {
  const gross = saleGrossCents(db, sale);
  const lines = db.deductions.filter((d) => d.saleId === sale.id).sort((a, b) => a.sequence - b.sequence);
  const deducted = lines.reduce((a, d) => a + d.amountCents, 0);
  return { grossCents: gross, deductionsCents: deducted, netCents: gross - deducted, lines };
}

// ── Checklist for the wizard (read-only) ────────────────────────
export interface ProcessingChecklist {
  sellingPointId: string;
  balancedSales: Sale[];
  saleDates: string[];
  datesWithoutRate: string[];
  pendingApprovals: number;
  stopOrderFileImported: boolean;
  stopOrdersForDates: number;
  plans: SalePlan[];
  warnings: string[];
  blockers: string[];
  totals: { grossCents: number; deductionsCents: number; netCents: number };
}

export function selectProcessingChecklist(db: MockDb, sellingPointId: string): ProcessingChecklist {
  const balancedSales = db.sales
    .filter((s) => s.sellingPointId === sellingPointId && s.status === "BALANCED")
    .sort((a, b) => a.refNo - b.refNo);
  const saleDates = [...new Set(balancedSales.map((s) => s.saleDate))].sort();
  const datesWithoutRate = saleDates.filter((d) => {
    const sod = db.startOfDays.find((s) => s.sellingPointId === sellingPointId && s.sellingDate === d && s.status === "POSTED");
    return !sod || !(Number(sod.exchangeRate) > 0);
  });
  const pendingApprovals = db.approvals.filter((a) => a.status === "PENDING").length;
  const plans = balancedSales.map((s) => planSaleDeductions(db, s));
  const stopOrdersForDates = db.stopOrders.filter((s) => saleDates.includes(s.fileDate)).length;
  const blockers: string[] = [];
  if (pendingApprovals > 0) blockers.push(formatMessage("PENDING_APPROVALS", { count: pendingApprovals }));
  if (datesWithoutRate.length > 0) blockers.push(formatMessage("NO_EXCHANGE_RATE"));
  if (balancedSales.length === 0) blockers.push(formatMessage("NO_BALANCED_SALES"));
  return {
    sellingPointId,
    balancedSales,
    saleDates,
    datesWithoutRate,
    pendingApprovals,
    stopOrderFileImported: stopOrdersForDates > 0,
    stopOrdersForDates,
    plans,
    warnings: plans.flatMap((p) => p.warnings),
    blockers,
    totals: {
      grossCents: plans.reduce((a, p) => a + p.grossCents, 0),
      deductionsCents: plans.reduce((a, p) => a + p.totalCents, 0),
      netCents: plans.reduce((a, p) => a + p.netCents, 0),
    },
  };
}

// ── Operations ──────────────────────────────────────────────────
export interface ProcessedSale {
  saleId: string;
  refNo: number;
  growerNo: string;
  grossCents: number;
  lines: Deduction[];
  totalCents: number;
  netCents: number;
  capped: boolean;
}

export interface StopOrderProcessingResult {
  payBatchNo: number;
  saleDate: string;
  sales: ProcessedSale[];
  warnings: string[];
  message: string;
}

/**
 * "Stop Order Processing" wizard (Manual 07, Step 3). Checks, in order: pending approvals → Start of Day with an exchange
 * rate for every sale date → at least one Balanced sale. Then deducts in the documented order, sets each sale to
 * Processed and assigns ONE new pay batch number for the run.
 */
export function runStopOrderProcessing(ctx: Ctx, input: { sellingPointId: string }): StopOrderProcessingResult {
  requirePermission(ctx, "deductions.process");
  const { db } = ctx;
  const sp = db.sellingPoints.find((s) => s.id === input.sellingPointId);
  if (!sp) failText("Selling point not found");

  const pending = db.approvals.filter((a) => a.status === "PENDING").length;
  if (pending > 0) fail("PENDING_APPROVALS", { count: pending });

  const balanced = db.sales
    .filter((s) => s.sellingPointId === sp.id && s.status === "BALANCED")
    .sort((a, b) => a.refNo - b.refNo);
  for (const date of new Set(balanced.map((s) => s.saleDate))) {
    const sod = db.startOfDays.find((s) => s.sellingPointId === sp.id && s.sellingDate === date && s.status === "POSTED");
    if (!sod || !(Number(sod.exchangeRate) > 0)) fail("NO_EXCHANGE_RATE");
  }
  if (balanced.length === 0) fail("NO_BALANCED_SALES");

  const payBatchNo = nextSeq(db, "payBatch");
  const saleDate = balanced.map((s) => s.saleDate).sort().at(-1)!;
  const warnings: string[] = [];
  const processed: ProcessedSale[] = [];

  for (const sale of balanced) {
    const plan = planSaleDeductions(db, sale);
    warnings.push(...plan.warnings);
    const posted: Deduction[] = plan.lines.map((l) => ({
      id: genericId(db, "ded"),
      saleId: sale.id,
      growerNo: sale.growerNo,
      source: l.source,
      sequence: l.sequence,
      creditorCode: l.creditorCode,
      creditorName: l.creditorName,
      description: l.description,
      currency: l.currency,
      amountCents: l.amountCents,
      paidCents: l.amountCents,
      payBatchNo,
      sellingDate: sale.saleDate,
      createdAt: ctx.now,
      ...(l.isDemoAmount ? { isDemoAmount: true } : {}),
    }));
    db.deductions.push(...posted);

    // Settle what was deducted.
    for (const l of plan.lines) {
      if (!l.ref) continue;
      if (l.ref.kind === "stopOrder") {
        const so = db.stopOrders.find((s) => s.id === l.ref!.id);
        if (so) so.paidAmountCents += l.amountCents;
      } else if (l.ref.kind === "invoice") {
        const inv = db.internalInvoices.find((i) => i.id === l.ref!.id);
        if (inv) {
          inv.amountCents -= l.amountCents;
          if (inv.amountCents <= 0) inv.status = "SETTLED";
        }
      } else {
        const loan = db.merchantLoans.find((m) => m.id === l.ref!.id);
        if (loan) {
          loan.balanceCents -= l.amountCents;
          if (loan.balanceCents <= 0) loan.status = "SETTLED";
        }
      }
    }

    const previous = { status: sale.status };
    sale.status = "PROCESSED";
    sale.payBatchNo = payBatchNo;
    sale.processedBy = ctx.actor.id;
    sale.processedAt = ctx.now;
    sale.updatedAt = ctx.now;
    audit(ctx, {
      action: "sales.process",
      entityType: "Sale",
      entityId: sale.id,
      entityRef: `Salesmaster ${sale.refNo}`,
      previous,
      next: { status: "PROCESSED", payBatchNo, grossCents: plan.grossCents, deductionsCents: plan.totalCents, netCents: plan.netCents },
    });
    processed.push({
      saleId: sale.id,
      refNo: sale.refNo,
      growerNo: sale.growerNo,
      grossCents: plan.grossCents,
      lines: posted,
      totalCents: plan.totalCents,
      netCents: plan.netCents,
      capped: plan.capped,
    });
  }

  db.payBatches.push({
    no: payBatchNo,
    sellingPointId: sp.id,
    saleDate,
    saleIds: balanced.map((s) => s.id),
    createdAt: ctx.now,
    createdBy: ctx.actor.id,
  });
  const message = formatMessage("STOP_PROCESSING_COMPLETE", { sales: processed.length, batch: payBatchNo });
  audit(ctx, {
    action: "deductions.process",
    entityType: "PayBatch",
    entityId: String(payBatchNo),
    entityRef: String(payBatchNo),
    reason: `${processed.length} sale(s) processed`,
  });
  notify(ctx, { level: "success", title: "Stop order processing complete", body: message, href: `/finance/payments/${payBatchNo}` });
  return { payBatchNo, saleDate, sales: processed, warnings, message };
}

// ── Supporting records: internal invoices, merchant loans, charges ─
export interface AddInternalInvoiceInput {
  growerNo: string;
  creditorCode: string;
  description: string;
  /** Decimal USD amount, e.g. "25.50". */
  amount: string;
}

export function addInternalInvoice(ctx: Ctx, input: AddInternalInvoiceInput) {
  requirePermission(ctx, "deductions.process");
  if (!ctx.db.growers.some((g) => g.growerNo === input.growerNo)) fail("GROWER_INVALID");
  if (!ctx.db.creditors.some((c) => c.code === input.creditorCode)) failText(`Creditor ${input.creditorCode} not found`);
  const amount = parseDecimal(input.amount);
  if (!amount || amount.lte(0)) failText("Amount must be a positive decimal like 25.50");
  const inv = {
    id: genericId(ctx.db, "inv"),
    growerNo: input.growerNo,
    creditorCode: input.creditorCode,
    description: input.description.trim() || "Internal invoice",
    amountCents: amount.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    currency: "USD",
    status: "OPEN" as const,
  };
  ctx.db.internalInvoices.push(inv);
  audit(ctx, { action: "internal-invoice.create", entityType: "InternalInvoice", entityId: inv.id, entityRef: input.growerNo, next: inv });
  return inv;
}

export interface AddMerchantLoanInput {
  growerNo: string;
  creditorCode: string;
  /** Decimal USD balance. */
  balance: string;
}

export function addMerchantLoan(ctx: Ctx, input: AddMerchantLoanInput) {
  requirePermission(ctx, "deductions.process");
  if (!ctx.db.growers.some((g) => g.growerNo === input.growerNo)) fail("GROWER_INVALID");
  if (!ctx.db.creditors.some((c) => c.code === input.creditorCode)) failText(`Creditor ${input.creditorCode} not found`);
  const balance = parseDecimal(input.balance);
  if (!balance || balance.lte(0)) failText("Balance must be a positive decimal like 120.00");
  const loan = {
    id: genericId(ctx.db, "loan"),
    growerNo: input.growerNo,
    creditorCode: input.creditorCode,
    balanceCents: balance.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    currency: "USD",
    status: "OPEN" as const,
  };
  ctx.db.merchantLoans.push(loan);
  audit(ctx, { action: "merchant-loan.create", entityType: "MerchantLoan", entityId: loan.id, entityRef: input.growerNo, next: loan });
  return loan;
}

/** Edit a floor charge's name, order and active flag. The charge FORMULA is not configurable yet (UQ-05). */
export function saveGrowerCharge(ctx: Ctx, input: { code: string; name: string; order: number; active: boolean }) {
  requirePermission(ctx, "deductions.process");
  const charge = ctx.db.growerCharges.find((c) => c.code === input.code);
  if (!charge) failText("Grower charge not found");
  if (!input.name.trim()) failText("Charge name is required");
  const previous = { name: charge.name, order: charge.order, active: charge.active };
  charge.name = input.name.trim();
  charge.order = input.order;
  charge.active = input.active;
  const creditor = ctx.db.creditors.find((c) => c.code === charge.creditorCode);
  if (creditor) creditor.name = charge.name;
  audit(ctx, {
    action: "grower-charge.update",
    entityType: "GrowerCharge",
    entityId: charge.code,
    entityRef: charge.name,
    previous,
    next: { name: charge.name, order: charge.order, active: charge.active },
  });
  return charge;
}

// ── Deductions Dashboard (Manual 07, Step 4) ────────────────────
export interface DeductionRow extends Deduction {
  growerName: string;
  saleRefNo?: number;
  remainingCents: number;
  saleNetCents?: number;
}

export interface DeductionsDashboard {
  from: string;
  to: string;
  totalCents: number;
  lineCount: number;
  growersAffected: number;
  creditorsAffected: number;
  topCreditors: Array<{ code: string; name: string; amountCents: number; count: number }>;
  byCurrency: Array<{ currency: string; amountCents: number; count: number }>;
  bySource: Array<{ key: string; label: string; amountCents: number; count: number }>;
  rows: DeductionRow[];
}

export function selectDeductionsDashboard(db: MockDb, from: string, to: string): DeductionsDashboard {
  const lines = db.deductions.filter((d) => d.sellingDate >= from && d.sellingDate <= to);
  const sum = (xs: Deduction[]) => xs.reduce((a, d) => a + d.amountCents, 0);

  const byCreditor = new Map<string, { code: string; name: string; amountCents: number; count: number }>();
  for (const d of lines) {
    const cur = byCreditor.get(d.creditorCode) ?? { code: d.creditorCode, name: d.creditorName, amountCents: 0, count: 0 };
    cur.amountCents += d.amountCents;
    cur.count += 1;
    byCreditor.set(d.creditorCode, cur);
  }
  const byCurrency = new Map<string, { currency: string; amountCents: number; count: number }>();
  for (const d of lines) {
    const cur = byCurrency.get(d.currency) ?? { currency: d.currency, amountCents: 0, count: 0 };
    cur.amountCents += d.amountCents;
    cur.count += 1;
    byCurrency.set(d.currency, cur);
  }
  const bySource = new Map<string, { key: string; label: string; amountCents: number; count: number }>();
  for (const d of lines) {
    const base = DEDUCTION_DASHBOARD_SOURCE_LABEL[d.source];
    const label = d.currency === "USD" ? base : base.replace("USD", d.currency);
    const key = `${label}`;
    const cur = bySource.get(key) ?? { key, label, amountCents: 0, count: 0 };
    cur.amountCents += d.amountCents;
    cur.count += 1;
    bySource.set(key, cur);
  }

  const saleById = new Map(db.sales.map((s) => [s.id, s]));
  const netBySale = new Map<string, number>();
  const rows: DeductionRow[] = lines
    .map((d) => {
      const sale = saleById.get(d.saleId);
      if (sale && !netBySale.has(sale.id)) netBySale.set(sale.id, saleFinancials(db, sale).netCents);
      const g = db.growers.find((x) => x.growerNo === d.growerNo);
      return {
        ...d,
        growerName: g ? `${g.firstName} ${g.surname}` : d.growerNo,
        saleRefNo: sale?.refNo,
        remainingCents: d.amountCents - d.paidCents,
        saleNetCents: sale ? netBySale.get(sale.id) : undefined,
      };
    })
    .sort((a, b) => a.saleRefNo! - b.saleRefNo! || a.sequence - b.sequence);

  return {
    from,
    to,
    totalCents: sum(lines),
    lineCount: lines.length,
    growersAffected: new Set(lines.map((d) => d.growerNo)).size,
    creditorsAffected: new Set(lines.map((d) => d.creditorCode)).size,
    topCreditors: [...byCreditor.values()].sort((a, b) => b.amountCents - a.amountCents).slice(0, 10),
    byCurrency: [...byCurrency.values()].sort((a, b) => b.amountCents - a.amountCents),
    bySource: [...bySource.values()].sort((a, b) => b.amountCents - a.amountCents),
    rows,
  };
}

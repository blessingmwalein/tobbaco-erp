import {
  Decimal,
  centsToDecimalString,
  formatMessage,
  parseDecimal,
  ticketValueCents,
  type DeductionSource,
  type MockDb,
  type PaymentSchedule,
  type PaymentScheduleLine,
  type Sale,
} from "@tobacco/shared";
import { audit, fail, failText, genericId, notify, requirePermission, type Ctx } from "../ctx";
import { saleFinancials } from "./stop-orders";

/**
 * Grower payment (Manual 08).
 *
 * SAFEGUARDS (brief Part 5, Module 10):
 *  - Downloading a CSV NEVER marks growers paid.
 *  - A line becomes PAID only through `recordPaymentConfirmation` (reference + exact amount, audited).
 *  - CloudPay is a MOCK: it records "submitted (mock — nothing sent)" and never marks anything paid.
 *  - Schedules and PaymentTransactions are never edited or deleted — corrections are new transactions.
 *  - Duplicate schedules for the same pay batch + currency are refused.
 *
 * NOT DOCUMENTED: how a grower's net is split between USD and local currency (UQ-04); bank CSV Transaction_Type /
 * Debit_Account / Company_Name values; date format; how payments are confirmed (UQ-23).
 */

/** The 13 documented bank-file columns, in order (Manual 08, Step 2). */
export const BANK_CSV_COLUMNS = [
  "Transaction_Type",
  "Beneficiary",
  "Currency",
  "Credit_Account",
  "transaction_date",
  "Amount",
  "Debit_Account",
  "Company_Name",
  "Batch_Reference",
  "Transaction_Id",
  "Bank_Code",
  "Bank",
  "Branch_Code",
] as const;

const isLocalOrUsd = (db: MockDb, currency: string) => currency === "USD" || currency === db.settings.localCurrencyCode;

const growerName = (db: MockDb, growerNo: string) => {
  const g = db.growers.find((x) => x.growerNo === growerNo);
  return g ? `${g.firstName} ${g.surname}` : growerNo;
};

function recordTx(
  ctx: Ctx,
  tx: { scheduleId: string; lineId?: string; kind: "SCHEDULE_GENERATED" | "CSV_DOWNLOADED" | "CLOUDPAY_SUBMITTED_MOCK" | "CONFIRMED" | "FAILED" | "RECONCILED_NOTE"; reference?: string; amountCents?: number; note: string },
) {
  ctx.db.paymentTransactions.push({ id: genericId(ctx.db, "ptx"), at: ctx.now, userId: ctx.actor.id, ...tx });
}

/** Schedule status derived from its lines. */
export function deriveScheduleStatus(lines: PaymentScheduleLine[]): PaymentSchedule["status"] {
  if (lines.length === 0) return "GENERATED";
  const paid = lines.filter((l) => l.status === "PAID").length;
  if (paid === lines.length) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  if (lines.some((l) => l.status === "SUBMITTED")) return "SUBMITTED";
  if (lines.every((l) => l.status === "FAILED")) return "FAILED";
  return "GENERATED";
}

function recomputeSchedule(db: MockDb, scheduleId: string) {
  const schedule = db.paymentSchedules.find((s) => s.id === scheduleId);
  if (!schedule) return;
  schedule.status = deriveScheduleStatus(db.paymentLines.filter((l) => l.scheduleId === scheduleId));
}

// ── Generate a schedule ─────────────────────────────────────────
export interface GenerateScheduleInput {
  invoicesDate: string;
  sellingPointId: string;
  /** 0 = every unpaid processed sale on that date. */
  batchNo: number;
  currency: string;
}

export interface GenerateScheduleResult {
  schedules: PaymentSchedule[];
  excluded: Array<{ growerNo: string; name: string; reason: string; payBatchNo: number }>;
}

export function generatePaymentSchedule(ctx: Ctx, input: GenerateScheduleInput): GenerateScheduleResult {
  requirePermission(ctx, "payments.generate-schedule");
  const { db } = ctx;
  const currency = input.currency.trim().toUpperCase();
  if (!isLocalOrUsd(db, currency)) failText(`Currency must be USD or ${db.settings.localCurrencyCode}.`);
  const spId = input.sellingPointId;

  // Documented checks, in order.
  if (!db.receivingSaleDates.some((d) => d.sellingPointId === spId && d.date === input.invoicesDate)) fail("PAY_NO_SALE_DATE");
  const sod = db.startOfDays.find((s) => s.sellingPointId === spId && s.sellingDate === input.invoicesDate && s.status === "POSTED");
  if (!sod) fail("PAY_NO_SOD");

  const candidates = db.sales.filter(
    (s) =>
      s.sellingPointId === spId &&
      s.saleDate === input.invoicesDate &&
      s.status === "PROCESSED" &&
      s.payBatchNo !== undefined &&
      (input.batchNo === 0 || s.payBatchNo === input.batchNo),
  );
  const batches = [...new Set(candidates.map((s) => s.payBatchNo!))].sort((a, b) => a - b);
  const open: number[] = [];
  for (const no of batches) {
    const existing = db.paymentSchedules.find((s) => s.payBatchNo === no && s.currency === currency && s.status !== "FAILED");
    if (existing) {
      if (input.batchNo !== 0)
        failText(`A ${currency} payment schedule for pay batch ${no} already exists (${existing.ref}). Open it from Payments — duplicate schedules are not created.`);
      continue;
    }
    open.push(no);
  }
  if (open.length === 0) fail("PAY_NO_UNPAID");

  const schedules: PaymentSchedule[] = [];
  const excludedAll: GenerateScheduleResult["excluded"] = [];
  const rate = sod.exchangeRate;

  for (const batchNo of open) {
    const batchSales = candidates.filter((s) => s.payBatchNo === batchNo);
    const byGrower = new Map<string, Sale[]>();
    for (const s of batchSales) byGrower.set(s.growerNo, [...(byGrower.get(s.growerNo) ?? []), s]);

    const scheduleId = `psch-${batchNo}-${currency.toLowerCase()}`;
    const lines: PaymentScheduleLine[] = [];
    const excluded: PaymentSchedule["excluded"] = [];
    let n = 0;
    for (const [growerNo, sales] of byGrower) {
      const name = growerName(db, growerNo);
      const account = db.growerBankAccounts.find((a) => a.growerNo === growerNo && a.currency === currency);
      if (!account) {
        const reason = `No ${currency} bank account on file`;
        excluded.push({ growerNo, name, reason });
        excludedAll.push({ growerNo, name, reason, payBatchNo: batchNo });
        continue;
      }
      const netUsdCents = sales.reduce((a, s) => a + saleFinancials(db, s).netCents, 0);
      // UQ-04: split between USD and local currency undocumented. USD schedule = USD net; local schedule = net converted
      // at the Start-of-Day rate (decimal, half-up) — shown as UNVERIFIED in the UI.
      const amountCents =
        currency === "USD" ? netUsdCents : new Decimal(netUsdCents).mul(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
      if (amountCents <= 0) {
        const reason = "Net payout is zero or negative";
        excluded.push({ growerNo, name, reason });
        excludedAll.push({ growerNo, name, reason, payBatchNo: batchNo });
        continue;
      }
      n += 1;
      lines.push({
        id: `pline-${batchNo}-${currency.toLowerCase()}-${n}`,
        scheduleId,
        growerNo,
        beneficiary: account.accountName,
        currency,
        creditAccount: account.accountNo,
        amountCents,
        debitAccount: db.settings.debitAccount,
        companyName: db.settings.companyName,
        batchReference: String(batchNo),
        transactionId: `${batchNo}-${currency}-${n}`,
        bankCode: account.bankCode,
        bank: account.bankName,
        branchCode: account.branchCode,
        transactionType: db.settings.bankCsvTransactionType,
        transactionDate: input.invoicesDate,
        status: "PENDING",
      });
    }
    if (lines.length === 0)
      failText(
        `No growers in pay batch ${batchNo} have a ${currency} bank account, so the schedule would only contain the header row (Manual 08 open item 2). Load grower banking details first.`,
      );

    const schedule: PaymentSchedule = {
      id: scheduleId,
      ref: `PSCH-${batchNo}-${currency}`,
      payBatchNo: batchNo,
      currency,
      invoicesDate: input.invoicesDate,
      sellingPointId: spId,
      status: "GENERATED",
      generatedAt: ctx.now,
      generatedBy: ctx.actor.id,
      excluded,
      csvFilename: `payment_schedule_${batchNo}_${currency}.csv`,
      csvDownloads: 0,
    };
    db.paymentSchedules.push(schedule);
    db.paymentLines.push(...lines);
    recordTx(ctx, {
      scheduleId,
      kind: "SCHEDULE_GENERATED",
      note: `Schedule generated: ${lines.length} payment line(s), ${excluded.length} grower(s) left out`,
    });
    audit(ctx, {
      action: "payments.generate-schedule",
      entityType: "PaymentSchedule",
      entityId: scheduleId,
      entityRef: schedule.ref,
      next: { lines: lines.length, excluded: excluded.length, totalCents: lines.reduce((a, l) => a + l.amountCents, 0) },
    });
    schedules.push(schedule);
  }
  return { schedules, excluded: excludedAll };
}

// ── CSV / CloudPay / confirmation ───────────────────────────────
export function scheduleCsv(db: MockDb, scheduleId: string): { filename: string; headers: string[]; rows: string[][] } {
  const schedule = db.paymentSchedules.find((s) => s.id === scheduleId);
  if (!schedule) failText("Payment schedule not found");
  const lines = db.paymentLines.filter((l) => l.scheduleId === scheduleId);
  return {
    filename: schedule.csvFilename,
    headers: [...BANK_CSV_COLUMNS],
    rows: lines.map((l) => [
      l.transactionType,
      l.beneficiary,
      l.currency,
      l.creditAccount,
      l.transactionDate,
      centsToDecimalString(l.amountCents),
      l.debitAccount,
      l.companyName,
      l.batchReference,
      l.transactionId,
      l.bankCode,
      l.bank,
      l.branchCode,
    ]),
  };
}

/** Records that the bank CSV was downloaded. Deliberately does NOT change any payment status (Manual 08). */
export function recordCsvDownload(ctx: Ctx, input: { scheduleId: string }) {
  requirePermission(ctx, "payments.export");
  const schedule = ctx.db.paymentSchedules.find((s) => s.id === input.scheduleId);
  if (!schedule) failText("Payment schedule not found");
  schedule.csvDownloads += 1;
  recordTx(ctx, { scheduleId: schedule.id, kind: "CSV_DOWNLOADED", note: `Bank CSV ${schedule.csvFilename} downloaded. Growers are NOT marked paid.` });
  audit(ctx, { action: "payments.export", entityType: "PaymentSchedule", entityId: schedule.id, entityRef: schedule.ref, meta: { downloads: schedule.csvDownloads } });
  return { ...scheduleCsv(ctx.db, schedule.id), message: formatMessage("PAY_CSV_NOT_PAID") };
}

/**
 * MOCK of the CloudPay submission. Nothing is sent anywhere. Lines move to SUBMITTED (never PAID); they become PAID only
 * when a verified confirmation is recorded.
 */
export function payWithCloudPayMock(ctx: Ctx, input: { scheduleId: string }) {
  requirePermission(ctx, "payments.export");
  const schedule = ctx.db.paymentSchedules.find((s) => s.id === input.scheduleId);
  if (!schedule) failText("Payment schedule not found");
  const lines = ctx.db.paymentLines.filter((l) => l.scheduleId === schedule.id && (l.status === "PENDING" || l.status === "FAILED"));
  if (lines.length === 0) failText("There are no unpaid lines on this schedule to submit.");
  for (const l of lines) {
    l.status = "SUBMITTED";
    l.failureReason = undefined;
    recordTx(ctx, {
      scheduleId: schedule.id,
      lineId: l.id,
      kind: "CLOUDPAY_SUBMITTED_MOCK",
      amountCents: l.amountCents,
      note: "MOCK — no payment instruction was sent to CloudPay or any bank. Awaiting a recorded confirmation.",
    });
  }
  recomputeSchedule(ctx.db, schedule.id);
  audit(ctx, { action: "payments.cloudpay-mock", entityType: "PaymentSchedule", entityId: schedule.id, entityRef: schedule.ref, meta: { lines: lines.length, mock: true } });
  return { submitted: lines.length, message: formatMessage("PAY_CLOUDPAY_MOCK") };
}

export interface ConfirmationInput {
  lineId: string;
  reference: string;
  /** Decimal amount in the line's currency, e.g. "499.43". Must equal the scheduled amount exactly. */
  amount: string;
}

/** The ONLY way a line becomes PAID: an explicit, audited, verified confirmation. */
export function recordPaymentConfirmation(ctx: Ctx, input: ConfirmationInput) {
  requirePermission(ctx, "payments.confirm-payment");
  const { db } = ctx;
  const line = db.paymentLines.find((l) => l.id === input.lineId);
  if (!line) failText("Payment line not found");
  if (line.status === "PAID") failText("This payment is already confirmed.");
  const reference = input.reference.trim();
  if (reference.length < 3) failText("Bank/CloudPay confirmation reference is required (at least 3 characters).");
  const amount = parseDecimal(input.amount);
  if (!amount) failText("Amount must be a decimal like 499.43.");
  const cents = amount.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  if (cents !== line.amountCents)
    failText(`Confirmed amount ${amount.toFixed(2)} does not match the scheduled amount ${centsToDecimalString(line.amountCents)} ${line.currency}. Record a failure or check the bank confirmation.`);
  if (db.paymentLines.some((l) => l.id !== line.id && l.confirmationRef === reference))
    failText(`Confirmation reference ${reference} has already been used for another payment.`);

  const previous = { status: line.status };
  line.status = "PAID";
  line.confirmationRef = reference;
  line.confirmedAt = ctx.now;
  line.confirmedBy = ctx.actor.id;
  line.failureReason = undefined;
  const schedule = db.paymentSchedules.find((s) => s.id === line.scheduleId)!;
  // Link the payment reference to the grower's sales in that pay batch (Salesmaster USD / local payment refs).
  for (const s of db.sales.filter((x) => x.payBatchNo === schedule.payBatchNo && x.growerNo === line.growerNo)) {
    if (line.currency === "USD") s.usdPaymentRef = reference;
    else s.zwgPaymentRef = reference;
  }
  recordTx(ctx, { scheduleId: schedule.id, lineId: line.id, kind: "CONFIRMED", reference, amountCents: cents, note: "Bank confirmation recorded" });
  recomputeSchedule(db, schedule.id);
  audit(ctx, {
    action: "payments.confirm-payment",
    entityType: "PaymentScheduleLine",
    entityId: line.id,
    entityRef: `${line.growerNo} · ${line.transactionId}`,
    previous,
    next: { status: "PAID", reference, amountCents: cents },
  });
  return line;
}

export function recordPaymentFailure(ctx: Ctx, input: { lineId: string; reason: string }) {
  requirePermission(ctx, "payments.confirm-payment");
  const { db } = ctx;
  const line = db.paymentLines.find((l) => l.id === input.lineId);
  if (!line) failText("Payment line not found");
  if (line.status === "PAID") failText("A confirmed payment cannot be marked failed. Record a correction instead.");
  const reason = input.reason.trim();
  if (reason.length < 3) failText("A failure reason is required (at least 3 characters).");
  const previous = { status: line.status };
  line.status = "FAILED";
  line.failureReason = reason;
  recordTx(ctx, { scheduleId: line.scheduleId, lineId: line.id, kind: "FAILED", amountCents: line.amountCents, note: reason });
  recomputeSchedule(db, line.scheduleId);
  audit(ctx, { action: "payments.record-failure", entityType: "PaymentScheduleLine", entityId: line.id, entityRef: `${line.growerNo} · ${line.transactionId}`, previous, next: { status: "FAILED" }, reason });
  notify(ctx, { level: "warning", title: "Payment failed", body: `${line.growerNo}: ${reason}`, href: `/finance/payments/${db.paymentSchedules.find((s) => s.id === line.scheduleId)?.payBatchNo ?? ""}` });
  return line;
}

// ── Read models ─────────────────────────────────────────────────
export interface PayBatchSummary {
  no: number;
  saleDate: string;
  sellingPointId: string;
  salesCount: number;
  growers: number;
  netUsdCents: number;
  schedules: PaymentSchedule[];
}

export function selectPayBatches(db: MockDb): PayBatchSummary[] {
  return [...db.payBatches]
    .sort((a, b) => b.no - a.no)
    .map((p) => {
      const sales = db.sales.filter((s) => s.payBatchNo === p.no);
      return {
        no: p.no,
        saleDate: p.saleDate,
        sellingPointId: p.sellingPointId,
        salesCount: sales.length,
        growers: new Set(sales.map((s) => s.growerNo)).size,
        netUsdCents: sales.reduce((a, s) => a + saleFinancials(db, s).netCents, 0),
        schedules: db.paymentSchedules.filter((s) => s.payBatchNo === p.no),
      };
    });
}

/** Processed sales that have no non-failed schedule yet in a given currency. */
export function selectUnscheduled(db: MockDb, currency: string) {
  return db.payBatches
    .filter((p) => !db.paymentSchedules.some((s) => s.payBatchNo === p.no && s.currency === currency && s.status !== "FAILED"))
    .map((p) => p.no);
}

export interface SalesSheet {
  sale: Sale;
  growerName: string;
  district?: number;
  delivery?: string;
  gross: number;
  deductions: Array<{ sequence: number; source: DeductionSource; creditorName: string; description: string; amountCents: number; currency: string }>;
  deductionsCents: number;
  netCents: number;
  tickets: Array<{ barcode: string; group: number; lot: string; buyer: string; grade: string; timbGrade: string; priceCents: number; mass: number; valueCents: number; saleCode?: string }>;
  paymentStatus: string;
  paymentRefs: string[];
}

export function selectSalesSheets(
  db: MockDb,
  filter: { saleDate: string; sellingPointId: string; refNo: number; batchNo: number },
): SalesSheet[] {
  return db.sales
    .filter(
      (s) =>
        s.sellingPointId === filter.sellingPointId &&
        s.saleDate === filter.saleDate &&
        s.status === "PROCESSED" &&
        (filter.refNo === 0 || s.refNo === filter.refNo) &&
        (filter.batchNo === 0 || s.payBatchNo === filter.batchNo),
    )
    .sort((a, b) => a.refNo - b.refNo)
    .map((sale) => {
      const fin = saleFinancials(db, sale);
      const note = db.deliveryNotes.find((d) => d.id === sale.gdnId);
      const grower = db.growers.find((g) => g.growerNo === sale.growerNo);
      const tickets = db.bales
        .filter((b) => b.saleId === sale.id && !b.ejected)
        .sort((a, b) => a.group - b.group || a.lot.localeCompare(b.lot, undefined, { numeric: true }))
        .map((b) => ({
          barcode: b.ticketBarcode ?? b.scaleBarcode,
          group: b.group,
          lot: b.lot,
          buyer: b.buyerCode ?? "—",
          grade: b.buyerGrade ?? "—",
          timbGrade: b.timbGrade ?? "—",
          priceCents: b.priceCents ?? 0,
          mass: b.mass,
          valueCents: b.saleCode || !b.priceCents ? 0 : ticketValueCents(b.priceCents, b.mass),
          saleCode: b.saleCode,
        }));
      const lines = db.paymentLines.filter((l) => {
        const sch = db.paymentSchedules.find((s) => s.id === l.scheduleId);
        return l.growerNo === sale.growerNo && sch?.payBatchNo === sale.payBatchNo;
      });
      const paymentStatus =
        lines.length === 0 ? "No payment schedule yet" : lines.every((l) => l.status === "PAID") ? "Paid" : lines.some((l) => l.status === "PAID") ? "Partly paid" : "Unpaid";
      return {
        sale,
        growerName: grower ? `${grower.firstName} ${grower.surname}` : sale.growerNo,
        district: grower?.district,
        delivery: note?.docNo,
        gross: fin.grossCents,
        deductions: fin.lines.map((d) => ({ sequence: d.sequence, source: d.source, creditorName: d.creditorName, description: d.description, amountCents: d.amountCents, currency: d.currency })),
        deductionsCents: fin.deductionsCents,
        netCents: fin.netCents,
        tickets,
        paymentStatus,
        paymentRefs: lines.map((l) => l.confirmationRef).filter((r): r is string => Boolean(r)),
      };
    });
}

import { DEDUCTION_SOURCES, DEDUCTION_SOURCE_LABEL, PAYMENT_LINE_STATUSES, formatInt, formatUsd, type MockDb } from "@tobacco/shared";
import { formatAmount, growerName, growerOk, humanise, inRange, sumByCurrency, userNameOf } from "./helpers";
import type { ReportDef, ReportFilters, ReportResult } from "./types";

function deductionsFor(db: MockDb, f: ReportFilters) {
  return db.deductions.filter(
    (d) =>
      inRange(d.sellingDate, f) &&
      growerOk(d.growerNo, f) &&
      (!f.creditor || d.creditorCode === f.creditor) &&
      (!f.batch || String(d.payBatchNo) === f.batch) &&
      (!f.status || d.source === f.status),
  );
}

export const deductionReport: ReportDef = {
  slug: "deduction",
  title: "Deduction report",
  description: "Every deduction line taken at stop order processing, in the documented order, with paid and remaining amounts.",
  area: "Finance",
  filters: ["date", "grower", "creditor", "batch", "status"],
  statusLabel: "Source",
  statusOptions: DEDUCTION_SOURCES.map((s) => ({ value: s, label: DEDUCTION_SOURCE_LABEL[s] })),
  batchKind: "pay",
  run(db, f): ReportResult {
    const lines = deductionsFor(db, f).sort(
      (a, b) => b.sellingDate.localeCompare(a.sellingDate) || a.growerNo.localeCompare(b.growerNo) || a.sequence - b.sequence || a.creditorCode.localeCompare(b.creditorCode),
    );
    const rows = lines.map((d) => ({
      date: d.sellingDate,
      grower: d.growerNo,
      name: growerName(db, d.growerNo),
      sale: `Sale #${db.sales.find((s) => s.id === d.saleId)?.refNo ?? "?"}`,
      source: DEDUCTION_SOURCE_LABEL[d.source],
      sequence: d.sequence,
      creditorCode: d.creditorCode,
      creditor: d.creditorName,
      description: d.description,
      currency: d.currency,
      amount: d.amountCents,
      paid: d.paidCents,
      remaining: d.amountCents - d.paidCents,
      payBatch: d.payBatchNo,
    }));
    return {
      columns: [
        { key: "date", header: "Date", format: "date" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "name", header: "Name" },
        { key: "sale", header: "Sale", format: "mono" },
        { key: "sequence", header: "Order", format: "int", align: "right" },
        { key: "source", header: "Source" },
        { key: "creditorCode", header: "Creditor", format: "mono" },
        { key: "creditor", header: "Creditor name" },
        { key: "description", header: "Description" },
        { key: "currency", header: "Cur." },
        { key: "amount", header: "Amount", format: "amount", currencyKey: "currency", align: "right" },
        { key: "paid", header: "Paid", format: "amount", currencyKey: "currency", align: "right" },
        { key: "remaining", header: "Remaining", format: "amount", currencyKey: "currency", align: "right" },
        { key: "payBatch", header: "Pay batch", format: "mono" },
      ],
      rows,
      tiles: [
        { label: "Total deducted", value: sumByCurrency(lines.map((d) => ({ currency: d.currency, cents: d.amountCents }))) },
        { label: "Deductions", value: formatInt(lines.length), hint: "lines" },
        { label: "Growers affected", value: formatInt(new Set(lines.map((d) => d.growerNo)).size) },
        { label: "Creditors affected", value: formatInt(new Set(lines.map((d) => d.creditorCode)).size) },
      ],
      notes: [
        "Order: statutory & floor charges → internal invoices → merchant loans → TIMB invoices → TIMB stop orders (Manual 07).",
        "Per-line floor-charge amounts in the demo are illustrative; only the totals are documented (UQ-05).",
      ],
    };
  },
};

export const creditorReport: ReportDef = {
  slug: "creditor",
  title: "Creditor report",
  description: "Deductions grouped by creditor: lines, growers affected, total, paid and remaining, plus stop orders received.",
  area: "Finance",
  filters: ["date", "creditor"],
  run(db, f): ReportResult {
    const lines = deductionsFor(db, { ...f, grower: undefined, batch: undefined, status: undefined });
    const stop = db.stopOrders.filter((s) => inRange(s.fileDate, f) && (!f.creditor || s.creditorCode === f.creditor));
    const codes = [...new Set([...lines.map((l) => l.creditorCode), ...stop.map((s) => s.creditorCode)])];
    const rows = codes
      .map((code) => {
        const mine = lines.filter((l) => l.creditorCode === code);
        const cred = db.creditors.find((c) => c.code === code);
        const total = mine.reduce((a, l) => a + l.amountCents, 0);
        const paid = mine.reduce((a, l) => a + l.paidCents, 0);
        return {
          code,
          name: cred?.name ?? mine[0]?.creditorName ?? code,
          kind: cred?.kind === "FLOOR_CHARGE" ? "Floor charge" : "TIMB creditor",
          lines: mine.length,
          growers: new Set(mine.map((l) => l.growerNo)).size,
          total,
          paid,
          remaining: total - paid,
          stopOrders: stop.filter((s) => s.creditorCode === code).length,
        };
      })
      .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
    return {
      columns: [
        { key: "code", header: "Creditor", format: "mono" },
        { key: "name", header: "Name" },
        { key: "kind", header: "Type" },
        { key: "lines", header: "Lines", format: "int", align: "right" },
        { key: "growers", header: "Growers", format: "int", align: "right" },
        { key: "total", header: "Total deducted", format: "amount", align: "right" },
        { key: "paid", header: "Paid", format: "amount", align: "right" },
        { key: "remaining", header: "Remaining", format: "amount", align: "right" },
        { key: "stopOrders", header: "Stop orders", format: "int", align: "right" },
      ],
      rows,
      tiles: [
        { label: "Creditors", value: formatInt(rows.length) },
        { label: "Total deducted", value: formatUsd(rows.reduce((a, r) => a + r.total, 0)) },
        { label: "Paid", value: formatUsd(rows.reduce((a, r) => a + r.paid, 0)) },
        { label: "Remaining", value: formatUsd(rows.reduce((a, r) => a + r.remaining, 0)) },
      ],
      notes: ["Amounts are USD. “Paid” is the amount recorded as deducted against the creditor line; creditor settlement is outside the documented scope."],
    };
  },
};

const lineStatusOptions = PAYMENT_LINE_STATUSES.map((s) => ({ value: s, label: s === "PENDING" ? "Unpaid" : humanise(s) }));

function paymentLinesFor(db: MockDb, f: ReportFilters) {
  return db.paymentLines
    .map((l) => ({ l, s: db.paymentSchedules.find((x) => x.id === l.scheduleId) }))
    .filter(
      ({ l, s }) =>
        s &&
        inRange(s.invoicesDate, f) &&
        growerOk(l.growerNo, f) &&
        (!f.batch || String(s.payBatchNo) === f.batch) &&
        (!f.status || l.status === f.status),
    )
    .map(({ l, s }) => ({ l, s: s! }))
    .sort((a, b) => b.s.invoicesDate.localeCompare(a.s.invoicesDate) || a.s.ref.localeCompare(b.s.ref) || a.l.growerNo.localeCompare(b.l.growerNo));
}

export const paymentScheduleReport: ReportDef = {
  slug: "payment-schedule",
  title: "Payment schedule report",
  description: "Lines of every generated payment schedule (USD and local currency) with beneficiary bank details and status.",
  area: "Finance",
  filters: ["date", "grower", "batch", "status"],
  statusLabel: "Payment status",
  statusOptions: lineStatusOptions,
  batchKind: "pay",
  run(db, f): ReportResult {
    const items = paymentLinesFor(db, f);
    const schedules = [...new Map(items.map(({ s }) => [s.id, s])).values()];
    const rows = items.map(({ l, s }) => ({
      schedule: s.ref,
      payBatch: s.payBatchNo,
      date: s.invoicesDate,
      currency: l.currency,
      grower: l.growerNo,
      beneficiary: l.beneficiary,
      bank: l.bank,
      branch: l.branchCode,
      account: l.creditAccount,
      amount: l.amountCents,
      status: l.status,
      transactionId: l.transactionId,
    }));
    const excluded = schedules.flatMap((s) => s.excluded.map((e) => `${s.ref}: ${e.growerNo} (${e.name}) left out — ${e.reason}`));
    return {
      columns: [
        { key: "schedule", header: "Schedule", format: "mono" },
        { key: "payBatch", header: "Pay batch", format: "mono" },
        { key: "date", header: "Invoices date", format: "date" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "beneficiary", header: "Beneficiary" },
        { key: "currency", header: "Cur." },
        { key: "bank", header: "Bank" },
        { key: "branch", header: "Branch", format: "mono" },
        { key: "account", header: "Credit account", format: "mono" },
        { key: "amount", header: "Amount", format: "amount", currencyKey: "currency", align: "right" },
        { key: "status", header: "Status", format: "status", statusKind: "paymentLine" },
        { key: "transactionId", header: "Transaction id", format: "mono" },
      ],
      rows,
      tiles: [
        { label: "Schedules", value: formatInt(schedules.length) },
        { label: "Payment lines", value: formatInt(rows.length) },
        { label: "Total scheduled", value: sumByCurrency(items.map(({ l }) => ({ currency: l.currency, cents: l.amountCents }))) },
        { label: "Growers left out", value: formatInt(schedules.reduce((a, s) => a + s.excluded.length, 0)), hint: "no bank details" },
      ],
      notes: [...excluded, "Downloading the bank CSV never marks a grower as paid (Manual 08)."],
    };
  },
};

export const paymentReconciliationReport: ReportDef = {
  slug: "payment-reconciliation",
  title: "Payment reconciliation",
  description: "Expected payment against confirmed payment per line. Only a recorded bank/CloudPay confirmation counts as paid.",
  area: "Finance",
  filters: ["date", "grower", "batch", "status"],
  statusLabel: "Payment status",
  statusOptions: lineStatusOptions,
  batchKind: "pay",
  run(db, f): ReportResult {
    const items = paymentLinesFor(db, f);
    const rows = items.map(({ l, s }) => {
      const confirmed = db.paymentTransactions
        .filter((t) => t.lineId === l.id && t.kind === "CONFIRMED")
        .reduce((a, t) => a + (t.amountCents ?? 0), 0);
      return {
        schedule: s.ref,
        payBatch: s.payBatchNo,
        grower: l.growerNo,
        beneficiary: l.beneficiary,
        currency: l.currency,
        expected: l.amountCents,
        confirmed,
        variance: confirmed - l.amountCents,
        status: l.status,
        reference: l.confirmationRef ?? null,
        confirmedAt: l.confirmedAt ?? null,
        confirmedBy: l.confirmedBy ? userNameOf(db, l.confirmedBy) : null,
        failure: l.failureReason ?? null,
      };
    });
    const cents = (k: "expected" | "confirmed") => rows.map((r) => ({ currency: r.currency, cents: r[k] }));
    const outstanding = rows.filter((r) => r.status !== "FAILED").map((r) => ({ currency: r.currency, cents: r.expected - r.confirmed }));
    return {
      columns: [
        { key: "schedule", header: "Schedule", format: "mono" },
        { key: "payBatch", header: "Pay batch", format: "mono" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "beneficiary", header: "Beneficiary" },
        { key: "currency", header: "Cur." },
        { key: "expected", header: "Expected", format: "amount", currencyKey: "currency", align: "right" },
        { key: "confirmed", header: "Confirmed", format: "amount", currencyKey: "currency", align: "right" },
        { key: "variance", header: "Variance", format: "amount", currencyKey: "currency", align: "right" },
        { key: "status", header: "Status", format: "status", statusKind: "paymentLine" },
        { key: "reference", header: "Confirmation ref", format: "mono" },
        { key: "confirmedAt", header: "Confirmed at", format: "datetime" },
        { key: "confirmedBy", header: "Confirmed by" },
        { key: "failure", header: "Failure reason" },
      ],
      rows,
      tiles: [
        { label: "Expected", value: sumByCurrency(cents("expected")) },
        { label: "Confirmed", value: sumByCurrency(cents("confirmed")) },
        { label: "Outstanding", value: sumByCurrency(outstanding), hint: "excludes failed lines" },
        { label: "Failed lines", value: formatInt(rows.filter((r) => r.status === "FAILED").length) },
      ],
      notes: ["Confirmed = sum of recorded CONFIRMED payment transactions for the line (immutable history). Variance ≠ 0 needs investigation."],
    };
  },
};

export { formatAmount };

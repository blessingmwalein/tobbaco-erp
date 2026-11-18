import { Prisma, type FlowDiskImportStatus, type PurchaseReceivingStatus, type PurchaseReconciliationStatus } from "@prisma/client";
import type { ReportRow } from "@tobacco/shared";
import { dateColumnRange, timestampRange } from "../../../common/date-range";
import { contains, dayOf, dbOrder, fx, instant, limits, mass, money, pageOf, sortRows, sumDec, tInt, tMass, tUsd, tZig, ZERO } from "../reports.helpers";
import type { ReportRunner } from "../reports.types";

// ── Purchase Register ────────────────────────────────────────────────────────
export const purchaseRegister: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const saleDate = dateColumnRange(f.from, f.to);
  const where: Prisma.PurchaseWhereInput = {
    ...(saleDate ? { saleDate } : {}),
    ...(f.floor ? { floorName: contains(f.floor) } : {}),
    ...(f.status ? { receivingStatus: f.status as PurchaseReceivingStatus } : {}),
    ...(f.kind ? { reconciliation: { is: { status: f.kind as PurchaseReconciliationStatus } } } : {}),
    ...(f.search
      ? { OR: [{ reference: contains(f.search) }, { invoice: { is: { OR: [{ invoiceNumber: contains(f.search) }, { reference: contains(f.search) }] } } }] }
      : {}),
  };

  const [total, agg, payable] = await Promise.all([
    db.purchase.count({ where }),
    db.purchase.aggregate({ where, _sum: { totalBales: true, totalMassKg: true, totalUsdValue: true } }),
    db.buyerInvoice.aggregate({ where: { purchase: { is: where } }, _sum: { payableUsd: true, payableZig: true } }),
  ]);

  const rows = await db.purchase.findMany({
    where,
    orderBy: dbOrder<Prisma.PurchaseOrderByWithRelationInput>(
      sort,
      {
        saleDate: (d) => ({ saleDate: d }),
        reference: (d) => ({ reference: d }),
        floorName: (d) => ({ floorName: d }),
        bales: (d) => ({ totalBales: d }),
        massKg: (d) => ({ totalMassKg: d }),
        usd: (d) => ({ totalUsdValue: d }),
      },
      { key: "saleDate", dir: "desc" },
    ),
    ...limits(paging, total),
    include: {
      invoice: { select: { invoiceNumber: true, reference: true, avgUscPerKg: true, payableUsd: true, payableZig: true } },
      reconciliation: { select: { status: true } },
      _count: { select: { shipments: true } },
    },
  });

  const out: ReportRow[] = rows.map((p) => ({
    reference: p.reference,
    saleDate: dayOf(p.saleDate),
    floorName: p.floorName,
    invoiceNo: p.invoice.invoiceNumber ?? p.invoice.reference,
    bales: p.totalBales,
    massKg: mass(p.totalMassKg),
    avgUsc: money(p.invoice.avgUscPerKg),
    usd: money(p.totalUsdValue),
    payableUsd: p.invoice.payableUsd === null ? null : money(p.invoice.payableUsd),
    payableZig: p.invoice.payableZig === null ? null : money(p.invoice.payableZig),
    shipments: p._count.shipments,
    receivingStatus: p.receivingStatus,
    reconciliationStatus: p.reconciliation?.status ?? null,
  }));

  return {
    rows: out,
    total,
    totals: {
      bales: agg._sum.totalBales ?? 0,
      massKg: mass(agg._sum.totalMassKg),
      usd: money(agg._sum.totalUsdValue),
      payableUsd: money(payable._sum.payableUsd),
      payableZig: money(payable._sum.payableZig),
    },
    tiles: [
      { label: "Purchases", value: tInt(total) },
      { label: "Bales bought", value: tInt(agg._sum.totalBales ?? 0) },
      { label: "Mass", value: tMass(agg._sum.totalMassKg) },
      { label: "Spend (tobacco value)", value: tUsd(agg._sum.totalUsdValue) },
      { label: "Payable US$", value: tUsd(payable._sum.payableUsd) },
      { label: "Payable ZiG", value: tZig(payable._sum.payableZig) },
    ],
  };
};

// ── Invoices & Charges ───────────────────────────────────────────────────────
const sumCharge = (charges: Array<{ code: string; amountUsd: Prisma.Decimal; amountZig: Prisma.Decimal }>, code: string, field: "amountUsd" | "amountZig") =>
  sumDec(charges.filter((c) => c.code === code).map((c) => c[field]));

export const invoiceCharges: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const saleDateTo = dateColumnRange(f.from, f.to);
  const where: Prisma.BuyerInvoiceWhereInput = {
    ...(saleDateTo ? { saleDateTo } : {}),
    ...(f.floor ? { floorName: contains(f.floor) } : {}),
    ...(f.search ? { OR: [{ reference: contains(f.search) }, { invoiceNumber: contains(f.search) }] } : {}),
  };
  const total = await db.buyerInvoice.count({ where });

  // Whole-set totals come from the charge rows themselves (one aggregate per code), not from the visible page.
  const chargeWhere = (code: string): Prisma.InvoiceChargeWhereInput => ({ code, invoice: { is: where } });
  const [pay, tobacco, gov, tta, clearing, rows] = await Promise.all([
    db.buyerInvoice.aggregate({ where, _sum: { payableUsd: true, payableZig: true } }),
    db.invoiceCharge.aggregate({ where: chargeWhere("TOBACCO_VALUE"), _sum: { amountUsd: true, amountZig: true } }),
    db.invoiceCharge.aggregate({ where: chargeWhere("BUYER_GOVERNMENT_LEVY"), _sum: { amountUsd: true, amountZig: true } }),
    db.invoiceCharge.aggregate({ where: chargeWhere("TTA_LEVY"), _sum: { amountUsd: true, amountZig: true } }),
    db.invoiceCharge.aggregate({ where: chargeWhere("FLOOR_CLEARING"), _sum: { amountUsd: true, amountZig: true } }),
    db.buyerInvoice.findMany({
      where,
      orderBy: dbOrder<Prisma.BuyerInvoiceOrderByWithRelationInput>(
        sort,
        {
          reference: (d) => ({ reference: d }),
          saleDate: (d) => ({ saleDateTo: d }),
          floorName: (d) => ({ floorName: d }),
          payableUsd: (d) => ({ payableUsd: d }),
          payableZig: (d) => ({ payableZig: d }),
        },
        { key: "saleDate", dir: "desc" },
      ),
      ...limits(paging, total),
      include: { charges: { select: { code: true, amountUsd: true, amountZig: true } } },
    }),
  ]);

  const out: ReportRow[] = rows.map((i) => ({
    reference: i.reference,
    invoiceNo: i.invoiceNumber ?? i.reference,
    saleDate: dayOf(i.saleDateTo),
    floorName: i.floorName,
    tobaccoUsd: money(sumCharge(i.charges, "TOBACCO_VALUE", "amountUsd")),
    tobaccoZig: money(sumCharge(i.charges, "TOBACCO_VALUE", "amountZig")),
    govLevyUsd: money(sumCharge(i.charges, "BUYER_GOVERNMENT_LEVY", "amountUsd")),
    govLevyZig: money(sumCharge(i.charges, "BUYER_GOVERNMENT_LEVY", "amountZig")),
    ttaUsd: money(sumCharge(i.charges, "TTA_LEVY", "amountUsd")),
    ttaZig: money(sumCharge(i.charges, "TTA_LEVY", "amountZig")),
    clearingUsd: money(sumCharge(i.charges, "FLOOR_CLEARING", "amountUsd")),
    clearingZig: money(sumCharge(i.charges, "FLOOR_CLEARING", "amountZig")),
    payableUsd: i.payableUsd === null ? null : money(i.payableUsd),
    payableZig: i.payableZig === null ? null : money(i.payableZig),
  }));

  const leviesUsd = sumDec([gov._sum.amountUsd, tta._sum.amountUsd, clearing._sum.amountUsd]);
  const leviesZig = sumDec([gov._sum.amountZig, tta._sum.amountZig, clearing._sum.amountZig]);
  return {
    rows: out,
    total,
    totals: {
      tobaccoUsd: money(tobacco._sum.amountUsd),
      tobaccoZig: money(tobacco._sum.amountZig),
      govLevyUsd: money(gov._sum.amountUsd),
      govLevyZig: money(gov._sum.amountZig),
      ttaUsd: money(tta._sum.amountUsd),
      ttaZig: money(tta._sum.amountZig),
      clearingUsd: money(clearing._sum.amountUsd),
      clearingZig: money(clearing._sum.amountZig),
      payableUsd: money(pay._sum.payableUsd),
      payableZig: money(pay._sum.payableZig),
    },
    tiles: [
      { label: "Invoices", value: tInt(total) },
      { label: "Tobacco value", value: tUsd(tobacco._sum.amountUsd), detail: tZig(tobacco._sum.amountZig) },
      { label: "Levies & clearing US$", value: tUsd(leviesUsd) },
      { label: "Levies & clearing ZiG", value: tZig(leviesZig) },
      { label: "Payable US$", value: tUsd(pay._sum.payableUsd), tone: "warn" },
      { label: "Payable ZiG", value: tZig(pay._sum.payableZig), tone: "warn" },
    ],
  };
};

// ── Purchases by Grade ───────────────────────────────────────────────────────
export const purchasesByGrade: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const saleDate = dateColumnRange(f.from, f.to);
  const where: Prisma.BaleWhereInput = {
    isProcessed: false, // processing re-baling creates new records; "purchased" means what the invoice listed
    ...(f.purchaseId ? { purchaseId: f.purchaseId } : {}),
    ...(f.grade ? { buyerGrade: contains(f.grade) } : {}),
    ...(saleDate || f.floor ? { purchase: { is: { ...(saleDate ? { saleDate } : {}), ...(f.floor ? { floorName: contains(f.floor) } : {}) } } } : {}),
  };
  const groups = await db.bale.groupBy({ by: ["buyerGrade"], where, _count: { _all: true }, _sum: { massKg: true, usdValue: true } });
  const totalBales = groups.reduce((s, g) => s + g._count._all, 0);
  const totalMass = sumDec(groups.map((g) => g._sum.massKg));
  const totalUsd = sumDec(groups.map((g) => g._sum.usdValue));

  const avgUsc = (usd: Prisma.Decimal, kg: Prisma.Decimal) => (kg.isZero() ? ZERO : usd.div(kg).times(100));
  const rows: ReportRow[] = groups.map((g) => ({
    grade: g.buyerGrade,
    bales: g._count._all,
    massKg: mass(g._sum.massKg),
    usd: money(g._sum.usdValue),
    avgUsc: money(avgUsc(g._sum.usdValue ?? ZERO, g._sum.massKg ?? ZERO)),
    share: totalBales ? fx(new Prisma.Decimal(g._count._all).div(totalBales).times(100), 1) : "0.0",
  }));
  const sorted = sortRows(rows, sort ?? { key: "bales", dir: "desc" });
  return {
    rows: pageOf(sorted, paging),
    total: rows.length,
    totals: { bales: totalBales, massKg: mass(totalMass), usd: money(totalUsd), avgUsc: money(avgUsc(totalUsd, totalMass)), share: totalBales ? "100.0" : "0.0" },
    tiles: [
      { label: "Grades", value: tInt(rows.length) },
      { label: "Bales", value: tInt(totalBales) },
      { label: "Mass", value: tMass(totalMass) },
      { label: "Value", value: tUsd(totalUsd) },
      { label: "Average price", value: `${money(avgUsc(totalUsd, totalMass))} USc/kg` },
    ],
  };
};

// ── Flow Disk Import Register ────────────────────────────────────────────────
export const flowDiskImports: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const createdAt = timestampRange(f.from, f.to);
  const where: Prisma.FlowDiskImportWhereInput = {
    ...(createdAt ? { createdAt } : {}),
    ...(f.status ? { status: f.status as FlowDiskImportStatus } : {}),
    ...(f.search ? { OR: [{ reference: contains(f.search) }, { filename: contains(f.search) }] } : {}),
  };
  const [total, agg, byStatus] = await Promise.all([
    db.flowDiskImport.count({ where }),
    db.flowDiskImport.aggregate({ where, _sum: { recordCount: true, validCount: true, invalidCount: true } }),
    db.flowDiskImport.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  const rows = await db.flowDiskImport.findMany({
    where,
    orderBy: dbOrder<Prisma.FlowDiskImportOrderByWithRelationInput>(
      sort,
      { reference: (d) => ({ reference: d }), createdAt: (d) => ({ createdAt: d }), status: (d) => ({ status: d }) },
      { key: "createdAt", dir: "desc" },
    ),
    ...limits(paging, total),
    select: {
      reference: true,
      filename: true,
      createdAt: true,
      status: true,
      recordCount: true,
      validCount: true,
      invalidCount: true,
      expectedMassKg: true,
      expectedUsdValue: true,
      parserId: true,
      formatVerified: true,
      purchase: { select: { reference: true } },
    },
  });
  const count = (s: string) => byStatus.find((x) => x.status === s)?._count._all ?? 0;
  return {
    rows: rows.map((r) => ({
      reference: r.reference,
      filename: r.filename,
      createdAt: instant(r.createdAt),
      status: r.status,
      records: r.recordCount,
      valid: r.validCount,
      invalid: r.invalidCount,
      massKg: mass(r.expectedMassKg),
      usd: money(r.expectedUsdValue),
      purchase: r.purchase?.reference ?? null,
      format: `${r.parserId}${r.formatVerified ? "" : " (unverified format)"}`,
    })),
    total,
    totals: { records: agg._sum.recordCount ?? 0, valid: agg._sum.validCount ?? 0, invalid: agg._sum.invalidCount ?? 0 },
    tiles: [
      { label: "Imports", value: tInt(total) },
      { label: "Completed", value: tInt(count("COMPLETED")), tone: "good" },
      { label: "Staged (not confirmed)", value: tInt(count("STAGED")), tone: count("STAGED") ? "warn" : "neutral" },
      { label: "Rejected / failed", value: tInt(count("REJECTED_DUPLICATE") + count("FAILED")), tone: count("REJECTED_DUPLICATE") + count("FAILED") ? "bad" : "neutral" },
      { label: "Rows imported", value: tInt(agg._sum.recordCount ?? 0), detail: `${tInt(agg._sum.invalidCount ?? 0)} invalid` },
    ],
  };
};

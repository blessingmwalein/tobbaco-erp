import { Prisma, type BaleStatus, type MovementType, type WarehouseKind } from "@prisma/client";
import type { ReportRow } from "@tobacco/shared";
import { businessDayStart, businessDaysBetween, timestampRange } from "../../../common/date-range";
import { formatDecimal, harareParts } from "../../../common/export";
import { contains, dbOrder, fx, inChunks, instant, limits, mass, money, pageOf, sortRows, sumDec, tInt, tMass, tUsd, ZERO } from "../reports.helpers";
import type { ReportRunner } from "../reports.types";

/** Bales that physically sit in the buyer's hands: in stock, back from processing, or held as an exception. */
const ON_HAND: BaleStatus[] = ["IN_STOCK", "RETURNED", "EXCEPTION"];
const NOT_STORED = "Received, not yet stored";

const pct = (part: number, whole: number): string | null => (whole > 0 ? fx(new Prisma.Decimal(part).div(whole).times(100), 1) : null);
const avgUsc = (usd: Prisma.Decimal, kg: Prisma.Decimal) => (kg.isZero() ? ZERO : usd.div(kg).times(100));

// ── Stock by Warehouse & Location ────────────────────────────────────────────
export const stockByLocation: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const [warehouses, groups, notStored] = await Promise.all([
    db.warehouse.findMany({
      where: { ...(f.warehouseId ? { id: f.warehouseId } : {}), ...(f.kind ? { kind: f.kind as WarehouseKind } : {}) },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { bays: { where: f.bayId ? { id: f.bayId } : {}, orderBy: { code: "asc" }, include: { rows: { orderBy: { code: "asc" } } } } },
    }),
    db.bale.groupBy({
      by: ["currentWarehouseId", "currentBayId", "currentRowId"],
      where: { status: { in: ON_HAND }, currentWarehouseId: f.warehouseId ?? { not: null }, ...(f.bayId ? { currentBayId: f.bayId } : {}) },
      _count: { _all: true },
      _sum: { massKg: true, usdValue: true },
    }),
    db.bale.count({ where: { status: "IN_STOCK", currentWarehouseId: null } }),
  ]);
  const key = (w: string | null, b: string | null, r: string | null) => `${w}|${b}|${r}`;
  const byKey = new Map(groups.map((g) => [key(g.currentWarehouseId, g.currentBayId, g.currentRowId), g]));
  const used = new Set<string>();

  type Line = { row: ReportRow; bales: number; kg: Prisma.Decimal; usd: Prisma.Decimal; inUse: boolean };
  const lines: Line[] = [];
  const add = (wh: (typeof warehouses)[number], bay: string, row: string, capacity: number | null, g: (typeof groups)[number] | undefined) => {
    const bales = g?._count._all ?? 0;
    const kg = g?._sum.massKg ?? ZERO;
    const usd = g?._sum.usdValue ?? ZERO;
    lines.push({
      inUse: bales > 0,
      bales,
      kg,
      usd,
      row: {
        warehouse: `${wh.code} · ${wh.name}`,
        kind: wh.kind === "PROCESSING" ? "Processing" : "Buyer warehouse",
        bay,
        row,
        bales,
        massKg: mass(kg),
        usd: money(usd),
        capacity,
        occupancy: capacity ? pct(bales, capacity) : null,
      },
    });
  };
  for (const wh of warehouses) {
    for (const bay of wh.bays) {
      for (const row of bay.rows) {
        const k = key(wh.id, bay.id, row.id);
        used.add(k);
        add(wh, bay.code, row.code, row.capacityBales, byKey.get(k));
      }
      // bales placed in the bay but not on a specific row
      const bayLevel = key(wh.id, bay.id, null);
      if (byKey.has(bayLevel)) {
        used.add(bayLevel);
        add(wh, bay.code, "(bay level)", null, byKey.get(bayLevel));
      }
    }
    const whLevel = key(wh.id, null, null);
    if (byKey.has(whLevel)) {
      used.add(whLevel);
      add(wh, "(warehouse level)", "—", null, byKey.get(whLevel));
    }
  }

  const shown = f.includeEmpty ? lines : lines.filter((l) => l.inUse);
  const rows = shown.map((l) => l.row);
  const sorted = sort ? sortRows(rows, sort) : rows;
  const totalBales = shown.reduce((s, l) => s + l.bales, 0);
  const totalKg = sumDec(shown.map((l) => l.kg));
  const totalUsd = sumDec(shown.map((l) => l.usd));
  const totalCapacity = shown.reduce((s, l) => s + ((l.row.capacity as number | null) ?? 0), 0);
  const rowsInUse = lines.filter((l) => l.inUse).length;
  return {
    rows: pageOf(sorted, paging),
    total: rows.length,
    totals: { bales: totalBales, massKg: mass(totalKg), usd: money(totalUsd), capacity: totalCapacity || null, occupancy: totalCapacity ? pct(totalBales, totalCapacity) : null },
    tiles: [
      { label: "Bales in warehouses", value: tInt(totalBales) },
      { label: "Mass", value: tMass(totalKg) },
      { label: "Value", value: tUsd(totalUsd) },
      { label: "Rows in use", value: `${tInt(rowsInUse)} of ${tInt(lines.length)}` },
      { label: "Received, not yet stored", value: tInt(notStored), detail: "scanned in, no location yet", tone: notStored ? "warn" : "good" },
    ],
  };
};

// ── Stock by Grade ───────────────────────────────────────────────────────────
export const stockByGrade: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const receivedAt = timestampRange(f.from, f.to);
  const where: Prisma.BaleWhereInput = {
    status: { in: ON_HAND },
    ...(f.warehouseId ? { currentWarehouseId: f.warehouseId } : {}),
    ...(f.grade ? { buyerGrade: contains(f.grade) } : {}),
    ...(f.purchaseId ? { purchaseId: f.purchaseId } : {}),
    ...(receivedAt ? { receivedAt } : {}),
  };
  const [groups, warehouses] = await Promise.all([
    db.bale.groupBy({ by: ["buyerGrade", "currentWarehouseId"], where, _count: { _all: true }, _sum: { massKg: true, usdValue: true } }),
    db.warehouse.findMany({ select: { id: true, code: true, name: true } }),
  ]);
  const nameOf = new Map(warehouses.map((w) => [w.id, `${w.code} · ${w.name}`]));
  const rows: ReportRow[] = groups.map((g) => ({
    grade: g.buyerGrade,
    warehouse: g.currentWarehouseId ? (nameOf.get(g.currentWarehouseId) ?? "Unknown warehouse") : NOT_STORED,
    bales: g._count._all,
    massKg: mass(g._sum.massKg),
    usd: money(g._sum.usdValue),
    avgUsc: money(avgUsc(g._sum.usdValue ?? ZERO, g._sum.massKg ?? ZERO)),
  }));
  const sorted = sortRows(sortRows(rows, { key: "warehouse", dir: "asc" }), sort ?? { key: "grade", dir: "asc" });
  const bales = groups.reduce((s, g) => s + g._count._all, 0);
  const kg = sumDec(groups.map((g) => g._sum.massKg));
  const usd = sumDec(groups.map((g) => g._sum.usdValue));
  const grades = new Set(groups.map((g) => g.buyerGrade)).size;
  return {
    rows: pageOf(sorted, paging),
    total: rows.length,
    totals: { bales, massKg: mass(kg), usd: money(usd), avgUsc: money(avgUsc(usd, kg)) },
    tiles: [
      { label: "Grades on hand", value: tInt(grades) },
      { label: "Bales", value: tInt(bales) },
      { label: "Mass", value: tMass(kg) },
      { label: "Value", value: tUsd(usd) },
      { label: "Average price", value: `${money(avgUsc(usd, kg))} USc/kg` },
    ],
  };
};

// ── Inventory Position (one row per bale) ────────────────────────────────────
/** The instant the Harare day `daysAgo` days before today starts. */
function dayStartAgo(now: Date, daysAgo: number): Date {
  const [y, m, d] = harareParts(now).day.split("-").map(Number) as [number, number, number];
  return businessDayStart(new Date(Date.UTC(y, m - 1, d - daysAgo)).toISOString().slice(0, 10));
}

export const inventoryPosition: ReportRunner = async ({ db, filters: f, paging, sort, now }) => {
  const receivedAt = timestampRange(f.from, f.to);
  const where: Prisma.BaleWhereInput = {
    status: f.status ? (f.status as BaleStatus) : { in: ON_HAND },
    ...(f.warehouseId ? { currentWarehouseId: f.warehouseId } : {}),
    ...(f.bayId ? { currentBayId: f.bayId } : {}),
    ...(f.grade ? { buyerGrade: contains(f.grade) } : {}),
    ...(f.purchaseId ? { purchaseId: f.purchaseId } : {}),
    ...(receivedAt ? { receivedAt } : {}),
    // barcode: plain contains — never trimmed, so "…477 " (blank check character) finds exactly that bale
    ...(f.search ? { OR: [{ barcode: { contains: f.search } }, { growerNo: contains(f.search.trim()) }, { lotNo: contains(f.search.trim()) }, { purchase: { is: { reference: contains(f.search.trim()) } } }] } : {}),
  };

  const t7 = dayStartAgo(now, 7);
  const t30 = dayStartAgo(now, 30);
  const t60 = dayStartAgo(now, 60);
  const t90 = dayStartAgo(now, 90);
  const [total, agg, b0, b8, b31, b61, b90] = await Promise.all([
    db.bale.count({ where }),
    db.bale.aggregate({ where, _sum: { massKg: true, usdValue: true } }),
    db.bale.count({ where: { AND: [where, { receivedAt: { gte: t7 } }] } }),
    db.bale.count({ where: { AND: [where, { receivedAt: { gte: t30, lt: t7 } }] } }),
    db.bale.count({ where: { AND: [where, { receivedAt: { gte: t60, lt: t30 } }] } }),
    db.bale.count({ where: { AND: [where, { receivedAt: { gte: t90, lt: t60 } }] } }),
    db.bale.count({ where: { AND: [where, { receivedAt: { lt: t90 } }] } }),
  ]);

  const bales = await db.bale.findMany({
    where,
    orderBy: dbOrder<Prisma.BaleOrderByWithRelationInput>(
      sort,
      {
        barcode: (d) => ({ barcode: d }),
        grade: (d) => ({ buyerGrade: d }),
        massKg: (d) => ({ massKg: d }),
        usd: (d) => ({ usdValue: d }),
        status: (d) => ({ status: d }),
        receivedAt: (d) => ({ receivedAt: { sort: d, nulls: "last" } }),
        ageDays: (d) => ({ receivedAt: { sort: d === "asc" ? "desc" : "asc", nulls: "last" } }), // older = larger age
      },
      { key: "receivedAt", dir: "desc" },
    ),
    ...limits(paging, total),
    include: {
      purchase: { select: { reference: true } },
      warehouse: { select: { code: true } },
      bay: { select: { code: true } },
      row: { select: { code: true } },
    },
  });

  const rows: ReportRow[] = bales.map((b) => ({
    barcode: b.barcode, // exactly as stored: the 10th character may be a blank
    grade: b.buyerGrade,
    grower: b.growerNo,
    lot: b.lotNo,
    massKg: mass(b.massKg),
    usd: money(b.usdValue),
    status: b.status,
    location: b.warehouse ? [b.warehouse.code, b.bay?.code, b.row?.code].filter(Boolean).join(" › ") : b.status === "IN_STOCK" ? NOT_STORED : null,
    purchase: b.purchase.reference,
    receivedAt: instant(b.receivedAt),
    ageDays: b.receivedAt ? businessDaysBetween(b.receivedAt, now) : null,
  }));
  return {
    rows,
    total,
    totals: { bales: total, massKg: mass(agg._sum.massKg), usd: money(agg._sum.usdValue) },
    tiles: [
      { label: "Bales", value: tInt(total) },
      { label: "Mass", value: tMass(agg._sum.massKg) },
      { label: "Value", value: tUsd(agg._sum.usdValue) },
      { label: "In stock 0–7 days", value: tInt(b0), tone: "good" },
      { label: "8–30 days", value: tInt(b8) },
      { label: "31–90 days", value: tInt(b31 + b61), tone: b31 + b61 ? "warn" : "neutral" },
      { label: "Over 90 days", value: tInt(b90), tone: b90 ? "bad" : "neutral" },
    ],
    notes: ["Age buckets count bales that have a received date; bales not yet received are in the totals but in no bucket."],
  };
};

// ── Warehouse Movements ──────────────────────────────────────────────────────
const REF_LABEL: Record<string, string> = { RECEIVING_SESSION: "Receiving", DISPATCH: "Processing dispatch", RETURN: "Processing return", MANUAL: "Manual" };

export const warehouseMovements: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const performedAt = timestampRange(f.from, f.to);
  const where: Prisma.BaleMovementWhereInput = {
    ...(performedAt ? { performedAt } : {}),
    ...(f.kind ? { type: f.kind as MovementType } : {}),
    ...(f.warehouseId ? { OR: [{ fromWarehouseId: f.warehouseId }, { toWarehouseId: f.warehouseId }] } : {}),
    ...(f.search ? { bale: { is: { barcode: { contains: f.search } } } } : {}),
  };
  const [total, byType] = await Promise.all([db.baleMovement.count({ where }), db.baleMovement.groupBy({ by: ["type"], where, _count: { _all: true } })]);
  const movements = await db.baleMovement.findMany({
    where,
    orderBy: dbOrder<Prisma.BaleMovementOrderByWithRelationInput>(sort, { performedAt: (d) => ({ performedAt: d }), type: (d) => ({ type: d }) }, { key: "performedAt", dir: "desc" }),
    ...limits(paging, total),
    include: { bale: { select: { barcode: true } } },
  });

  const [warehouses, users] = await Promise.all([
    db.warehouse.findMany({ select: { id: true, code: true, bays: { select: { id: true, code: true, rows: { select: { id: true, code: true } } } } } }),
    inChunks([...new Set(movements.map((m) => m.performedById))], 2000, (chunk) => db.buyerUser.findMany({ where: { id: { in: chunk } }, select: { id: true, name: true } })),
  ]);
  const wh = new Map(warehouses.map((w) => [w.id, w]));
  const label = (w: string | null, b: string | null, r: string | null): string | null => {
    if (!w) return null;
    const warehouse = wh.get(w);
    const bay = warehouse?.bays.find((x) => x.id === b);
    const row = bay?.rows.find((x) => x.id === r);
    return [warehouse?.code ?? "?", bay?.code, row?.code].filter(Boolean).join(" › ");
  };
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const n = (t: string) => byType.find((g) => g.type === t)?._count._all ?? 0;

  return {
    rows: movements.map((m) => ({
      performedAt: instant(m.performedAt),
      barcode: m.bale.barcode,
      type: m.type,
      from: label(m.fromWarehouseId, m.fromBayId, m.fromRowId),
      to: label(m.toWarehouseId, m.toBayId, m.toRowId),
      reason: m.note ? `${m.reason} — ${m.note}` : m.reason,
      performedBy: nameOf.get(m.performedById) ?? null,
      reference: REF_LABEL[m.refType] ?? m.refType,
    })),
    total,
    totals: null,
    tiles: [
      { label: "Movements", value: formatDecimal(total, 0) },
      { label: "Stored", value: tInt(n("STORE")) },
      { label: "Moved", value: tInt(n("MOVE")) },
      { label: "Transferred", value: tInt(n("TRANSFER")) },
      { label: "Out to / back from processors", value: `${tInt(n("DISPATCH_OUT"))} / ${tInt(n("RETURN_IN"))}` },
    ],
  };
};

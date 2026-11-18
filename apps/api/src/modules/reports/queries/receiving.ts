import { Prisma, type BuyerShipmentStatus, type PurchaseReconciliationStatus, type ReceivingSessionStatus, type ScanResult } from "@prisma/client";
import type { ReportRow } from "@tobacco/shared";
import { AppError } from "../../../common/app-error";
import { businessDayStart, businessDaysBetween, dateColumnRange, timestampRange } from "../../../common/date-range";
import { formatDecimal, formatDocDate } from "../../../common/export";
import { contains, dayOf, dbOrder, humanDuration, inChunks, instant, limits, mass, money, pageOf, sortRows, sumDec, tInt, tMass, ZERO } from "../reports.helpers";
import type { ReportRunner } from "../reports.types";

const RECEIVED_LINE = ["RECEIVED", "ALLOCATED"] as const;
const SOURCE_CAP = 20_000;
const narrow = (what: string) => AppError.unprocessable("REPORT_TOO_LARGE", `Too many ${what} to build this report. Narrow the date range or filters and try again.`);

// ── Purchase vs Shipment vs Received (three-way) ─────────────────────────────
const PURCHASE_CAP = 2_000;

export const purchaseShipmentReceived: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const saleDate = dateColumnRange(f.from, f.to);
  const where: Prisma.PurchaseWhereInput = {
    ...(saleDate ? { saleDate } : {}),
    ...(f.floor ? { floorName: contains(f.floor) } : {}),
    ...(f.kind ? { reconciliation: { is: { status: f.kind as PurchaseReconciliationStatus } } } : {}),
    ...(f.search
      ? { OR: [{ reference: contains(f.search) }, { invoice: { is: { OR: [{ invoiceNumber: contains(f.search) }, { reference: contains(f.search) }] } } }] }
      : {}),
  };
  const found = await db.purchase.findMany({
    where,
    orderBy: [{ saleDate: "desc" }, { id: "asc" }],
    take: PURCHASE_CAP + 1,
    select: { id: true, reference: true, saleDate: true, floorName: true, totalBales: true, totalMassKg: true, reconciliation: { select: { status: true } } },
  });
  const truncated = found.length > PURCHASE_CAP;
  const purchases = truncated ? found.slice(0, PURCHASE_CAP) : found;
  const ids = purchases.map((p) => p.id);

  // Dispatched: the shipment manifests the floor sent (cancelled ones excluded).
  const shipments = await inChunks(ids, 2000, (chunk) =>
    db.buyerShipment.findMany({ where: { purchaseId: { in: chunk }, status: { not: "CANCELLED" } }, select: { id: true, purchaseId: true, expectedBales: true, expectedMassKg: true } }),
  );
  const purchaseOfShipment = new Map(shipments.map((s) => [s.id, s.purchaseId]));

  // Received: manifest lines that have been received (scanned in).
  const receivedLines = await inChunks(
    shipments.map((s) => s.id),
    2000,
    (chunk) => db.buyerShipmentBale.groupBy({ by: ["shipmentId"], where: { shipmentId: { in: chunk }, status: { in: [...RECEIVED_LINE] } }, _count: { _all: true } }),
  );

  // Weighed at receiving: scans that captured a weight, compared with the manifest weight of the SAME bales.
  const sessions = await inChunks(ids, 2000, (chunk) => db.receivingSession.findMany({ where: { purchaseId: { in: chunk } }, select: { id: true, purchaseId: true } }));
  const purchaseOfSession = new Map(sessions.map((s) => [s.id, s.purchaseId]));
  const weighedScans = await inChunks(
    sessions.map((s) => s.id),
    2000,
    (chunk) =>
      db.receivingScan.findMany({
        where: { sessionId: { in: chunk }, result: "RECEIVED", voidedAt: null, massKg: { not: null }, baleId: { not: null } },
        select: { sessionId: true, baleId: true, massKg: true },
      }),
  );
  const manifestKg = new Map(
    (
      await inChunks(
        weighedScans.map((w) => w.baleId!),
        5000,
        (chunk) => db.buyerShipmentBale.findMany({ where: { baleId: { in: chunk } }, select: { baleId: true, massKgAtDispatch: true } }),
      )
    ).map((l) => [l.baleId, l.massKgAtDispatch]),
  );

  type Acc = { dispatchedBales: number; dispatchedKg: Prisma.Decimal; receivedBales: number; weighed: number; weighedKg: Prisma.Decimal; weighedManifestKg: Prisma.Decimal };
  const acc = new Map<string, Acc>(ids.map((id) => [id, { dispatchedBales: 0, dispatchedKg: ZERO, receivedBales: 0, weighed: 0, weighedKg: ZERO, weighedManifestKg: ZERO }]));
  for (const s of shipments) {
    const a = acc.get(s.purchaseId)!;
    a.dispatchedBales += s.expectedBales;
    a.dispatchedKg = a.dispatchedKg.plus(s.expectedMassKg);
  }
  for (const g of receivedLines) {
    const pid = purchaseOfShipment.get(g.shipmentId);
    if (pid) acc.get(pid)!.receivedBales += g._count._all;
  }
  for (const w of weighedScans) {
    const manifest = manifestKg.get(w.baleId!);
    const pid = purchaseOfSession.get(w.sessionId);
    if (!pid || !manifest || !w.massKg) continue; // a scan with no manifest line has nothing to compare against
    const a = acc.get(pid)!;
    a.weighed += 1;
    a.weighedKg = a.weighedKg.plus(w.massKg);
    a.weighedManifestKg = a.weighedManifestKg.plus(manifest);
  }

  /** The visible row plus the raw numbers the totals and filters need (kept apart so the row stays plain report data). */
  type Item = { row: ReportRow; notDispatched: number; outstanding: number; variance: Prisma.Decimal; weighed: number; purchasedKg: Prisma.Decimal; dispatchedKg: Prisma.Decimal; receivedKg: Prisma.Decimal; purchased: number; dispatched: number; received: number };
  let items: Item[] = purchases.map((p) => {
    const a = acc.get(p.id)!;
    const notDispatched = Math.max(0, p.totalBales - a.dispatchedBales);
    const outstanding = Math.max(0, a.dispatchedBales - a.receivedBales);
    const variance = a.weighedKg.minus(a.weighedManifestKg);
    return {
      notDispatched,
      outstanding,
      variance,
      weighed: a.weighed,
      purchased: p.totalBales,
      dispatched: a.dispatchedBales,
      received: a.receivedBales,
      purchasedKg: p.totalMassKg,
      dispatchedKg: a.dispatchedKg,
      receivedKg: a.weighedKg,
      row: {
        reference: p.reference,
        saleDate: dayOf(p.saleDate),
        floorName: p.floorName,
        purchasedBales: p.totalBales,
        purchasedKg: mass(p.totalMassKg),
        dispatchedBales: a.dispatchedBales,
        dispatchedKg: mass(a.dispatchedKg),
        receivedBales: a.receivedBales,
        receivedKg: mass(a.weighedKg),
        weighed: a.receivedBales ? `${a.weighed} / ${a.receivedBales}` : "—",
        notDispatched,
        outstanding,
        massVarianceKg: a.weighed ? mass(variance) : null,
        reconciliationStatus: p.reconciliation?.status ?? null,
      },
    };
  });
  if (f.onlyVariances) items = items.filter((i) => i.notDispatched > 0 || i.outstanding > 0 || !i.variance.isZero());

  const sorted = sortRows(
    items.map((i) => i.row),
    sort ?? { key: "saleDate", dir: "desc" },
  );

  const totalReceived = items.reduce((s, i) => s + i.received, 0);
  const totalWeighed = items.reduce((s, i) => s + i.weighed, 0);
  const totals = {
    purchasedBales: items.reduce((s, i) => s + i.purchased, 0),
    purchasedKg: mass(sumDec(items.map((i) => i.purchasedKg))),
    dispatchedBales: items.reduce((s, i) => s + i.dispatched, 0),
    dispatchedKg: mass(sumDec(items.map((i) => i.dispatchedKg))),
    receivedBales: totalReceived,
    receivedKg: mass(sumDec(items.map((i) => i.receivedKg))),
    notDispatched: items.reduce((s, i) => s + i.notDispatched, 0),
    outstanding: items.reduce((s, i) => s + i.outstanding, 0),
    massVarianceKg: mass(sumDec(items.map((i) => i.variance))),
  };

  return {
    rows: pageOf(sorted, paging),
    total: items.length,
    totals,
    tiles: [
      { label: "Purchases", value: tInt(items.length) },
      { label: "Purchased bales", value: tInt(totals.purchasedBales), detail: `${formatDecimal(totals.purchasedKg, 1)} kg` },
      { label: "Dispatched bales", value: tInt(totals.dispatchedBales), detail: `${tInt(totals.notDispatched)} not yet dispatched`, tone: totals.notDispatched ? "warn" : "neutral" },
      { label: "Received bales", value: tInt(totalReceived), tone: "good" },
      { label: "Outstanding bales", value: tInt(totals.outstanding), detail: "dispatched, not yet received", tone: totals.outstanding ? "warn" : "good" },
      { label: "Mass variance", value: `${formatDecimal(totals.massVarianceKg, 1)} kg`, detail: "received vs dispatched, weighed bales", tone: Number(totals.massVarianceKg) === 0 ? "good" : "bad" },
      { label: "Weighed at receiving", value: `${tInt(totalWeighed)} of ${tInt(totalReceived)}`, detail: "received bales with a scanned weight" },
    ],
    notes: truncated ? [`Only the ${tInt(PURCHASE_CAP)} most recent matching purchases are compared. Narrow the date range to see the rest.`] : [],
  };
};

// ── Shipment Register ────────────────────────────────────────────────────────
export const shipmentRegister: ReportRunner = async ({ db, filters: f, paging, sort, now }) => {
  const dispatchDate = dateColumnRange(f.from, f.to);
  const where: Prisma.BuyerShipmentWhereInput = {
    ...(dispatchDate ? { dispatchDate } : {}),
    ...(f.status ? { status: f.status as BuyerShipmentStatus } : {}),
    ...(f.warehouseId ? { destinationWarehouseId: f.warehouseId } : {}),
    ...(f.purchaseId ? { purchaseId: f.purchaseId } : {}),
    ...(f.search
      ? { OR: [{ reference: contains(f.search) }, { truckRegistration: contains(f.search) }, { driverName: contains(f.search) }, { purchase: { is: { reference: contains(f.search) } } }] }
      : {}),
  };
  const [total, byStatus, agg] = await Promise.all([
    db.buyerShipment.count({ where }),
    db.buyerShipment.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { expectedBales: true } }),
    db.buyerShipment.aggregate({ where, _sum: { expectedBales: true, expectedMassKg: true } }),
  ]);
  const shipments = await db.buyerShipment.findMany({
    where,
    orderBy: dbOrder<Prisma.BuyerShipmentOrderByWithRelationInput>(
      sort,
      {
        reference: (d) => ({ reference: d }),
        dispatchDate: (d) => ({ dispatchDate: d }),
        expectedBales: (d) => ({ expectedBales: d }),
        arrivedAt: (d) => ({ arrivedAt: d }),
        daysInTransit: (d) => ({ dispatchDate: d === "asc" ? "desc" : "asc" }), // the earlier the dispatch, the longer in transit
        status: (d) => ({ status: d }),
      },
      { key: "dispatchDate", dir: "desc" },
    ),
    ...limits(paging, total),
    include: { purchase: { select: { reference: true } }, destinationWarehouse: { select: { code: true, name: true } } },
  });

  const receivedByShipment = new Map<string, { bales: number; kg: Prisma.Decimal }>();
  const lines = await inChunks(
    shipments.map((s) => s.id),
    2000,
    (chunk) => db.buyerShipmentBale.groupBy({ by: ["shipmentId"], where: { shipmentId: { in: chunk }, status: { in: [...RECEIVED_LINE] } }, _count: { _all: true }, _sum: { massKgAtDispatch: true } }),
  );
  for (const l of lines) receivedByShipment.set(l.shipmentId, { bales: l._count._all, kg: l._sum.massKgAtDispatch ?? ZERO });

  const rows: ReportRow[] = shipments.map((s) => {
    const recv = receivedByShipment.get(s.id);
    const start = businessDayStart(dayOf(s.dispatchDate));
    const days = s.arrivedAt ? businessDaysBetween(start, s.arrivedAt) : s.status === "IN_TRANSIT" ? businessDaysBetween(start, now) : null;
    return {
      reference: s.reference,
      purchase: s.purchase.reference,
      dispatchDate: dayOf(s.dispatchDate),
      truck: [s.truckRegistration, s.trailerRegistration].filter(Boolean).join(" / "),
      driver: [s.driverName, s.transporter ? `(${s.transporter})` : null].filter(Boolean).join(" "),
      destination: `${s.destinationWarehouse.name}`,
      expectedBales: s.expectedBales,
      receivedBales: recv?.bales ?? 0,
      expectedKg: mass(s.expectedMassKg),
      receivedKg: mass(recv?.kg),
      arrivedAt: instant(s.arrivedAt),
      daysInTransit: days,
      status: s.status,
    };
  });

  const n = (...statuses: string[]) => byStatus.filter((g) => statuses.includes(g.status)).reduce((s, g) => s + g._count._all, 0);
  const bales = (...statuses: string[]) => byStatus.filter((g) => statuses.includes(g.status)).reduce((s, g) => s + (g._sum.expectedBales ?? 0), 0);
  return {
    rows,
    total,
    totals: { expectedBales: agg._sum.expectedBales ?? 0, expectedKg: mass(agg._sum.expectedMassKg) },
    tiles: [
      { label: "In transit", value: tInt(n("IN_TRANSIT")), detail: `${tInt(bales("IN_TRANSIT"))} bales`, tone: n("IN_TRANSIT") ? "warn" : "neutral" },
      { label: "Arrived, awaiting receiving", value: tInt(n("ARRIVED")), detail: `${tInt(bales("ARRIVED"))} bales`, tone: n("ARRIVED") ? "warn" : "neutral" },
      { label: "Being received", value: tInt(n("RECEIVING", "RECONCILIATION_REQUIRED")), detail: `${tInt(bales("RECEIVING", "RECONCILIATION_REQUIRED"))} bales` },
      { label: "Awaiting storage", value: tInt(n("CONFIRMED", "STORAGE_IN_PROGRESS")), detail: `${tInt(bales("CONFIRMED", "STORAGE_IN_PROGRESS"))} bales` },
      { label: "Received and stored", value: tInt(n("ALLOCATED")), detail: `${tInt(bales("ALLOCATED"))} bales`, tone: "good" },
      { label: "Shipments", value: tInt(total), detail: `${tInt(agg._sum.expectedBales ?? 0)} bales · ${tMass(agg._sum.expectedMassKg)}` },
    ],
  };
};

// ── Receiving Sessions ───────────────────────────────────────────────────────
export const receivingSessions: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const startedAt = timestampRange(f.from, f.to);
  const where: Prisma.ReceivingSessionWhereInput = {
    ...(startedAt ? { startedAt } : {}),
    ...(f.status ? { status: f.status as ReceivingSessionStatus } : {}),
    ...(f.purchaseId ? { purchaseId: f.purchaseId } : {}),
    ...(f.search
      ? { OR: [{ reference: contains(f.search) }, { purchase: { is: { reference: contains(f.search) } } }, { shipment: { is: { reference: contains(f.search) } } }] }
      : {}),
  };
  const [total, byStatus, scannedTotal, openExceptions] = await Promise.all([
    db.receivingSession.count({ where }),
    db.receivingSession.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.receivingScan.count({ where: { result: "RECEIVED", voidedAt: null, session: { is: where } } }),
    db.receivingException.count({ where: { status: "OPEN", session: { is: where } } }),
  ]);
  const sessions = await db.receivingSession.findMany({
    where,
    orderBy: dbOrder<Prisma.ReceivingSessionOrderByWithRelationInput>(
      sort,
      { reference: (d) => ({ reference: d }), startedAt: (d) => ({ startedAt: d }), confirmedAt: (d) => ({ confirmedAt: d }), status: (d) => ({ status: d }) },
      { key: "startedAt", dir: "desc" },
    ),
    ...limits(paging, total),
    include: {
      purchase: { select: { reference: true, totalBales: true } },
      shipment: { select: { reference: true, expectedBales: true } },
      exceptions: { select: { status: true } },
      _count: { select: { scans: { where: { result: "RECEIVED", voidedAt: null } } } },
    },
  });
  const userIds = [...new Set(sessions.map((s) => s.startedById))];
  const users = userIds.length ? await db.buyerUser.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  const rows: ReportRow[] = sessions.map((s) => ({
    reference: s.reference,
    shipment: s.shipment?.reference ?? null,
    purchase: s.purchase.reference,
    startedAt: instant(s.startedAt),
    startedBy: nameOf.get(s.startedById) ?? null,
    confirmedAt: instant(s.confirmedAt),
    duration: s.confirmedAt ? humanDuration(s.confirmedAt.getTime() - s.startedAt.getTime()) : null,
    expectedBales: s.shipment?.expectedBales ?? s.purchase.totalBales,
    scannedBales: s._count.scans,
    exceptions: `${s.exceptions.filter((e) => e.status === "OPEN").length} / ${s.exceptions.length}`,
    status: s.status,
  }));
  const n = (s: string) => byStatus.find((g) => g.status === s)?._count._all ?? 0;
  return {
    rows,
    total,
    totals: null,
    tiles: [
      { label: "Sessions", value: tInt(total) },
      { label: "Open", value: tInt(n("OPEN")), tone: n("OPEN") ? "warn" : "neutral" },
      { label: "Confirmed / stored", value: tInt(n("CONFIRMED") + n("ALLOCATED")), tone: "good" },
      { label: "Bales scanned in", value: tInt(scannedTotal) },
      { label: "Open exceptions", value: tInt(openExceptions), tone: openExceptions ? "bad" : "good" },
    ],
  };
};

// ── Bale Discrepancies ───────────────────────────────────────────────────────
const LINE_KINDS = new Set(["OUTSTANDING", "MISSING"]);
const FINISHED_SHIPMENT = new Set(["CONFIRMED", "STORAGE_IN_PROGRESS", "ALLOCATED"]);

export const baleDiscrepancies: ReportRunner = async ({ db, filters: f, paging, sort }) => {
  const wantLines = !f.kind || LINE_KINDS.has(f.kind);
  const wantExceptions = !f.kind || !LINE_KINDS.has(f.kind);
  const dispatchDay = dateColumnRange(f.from, f.to);
  const raised = timestampRange(f.from, f.to);

  const lines = wantLines
    ? await db.buyerShipmentBale.findMany({
        where: {
          status: { in: ["EXPECTED", "MISSING"] },
          shipment: { is: { status: { not: "CANCELLED" }, ...(dispatchDay ? { dispatchDate: dispatchDay } : {}), ...(f.purchaseId ? { purchaseId: f.purchaseId } : {}) } },
          ...(f.search ? { OR: [{ bale: { is: { barcode: { contains: f.search } } } }, { shipment: { is: { reference: contains(f.search) } } }] } : {}),
        },
        select: {
          status: true,
          massKgAtDispatch: true,
          bale: { select: { barcode: true, purchase: { select: { reference: true, reconciliation: { select: { status: true } } } } } },
          shipment: { select: { reference: true, status: true, dispatchDate: true } },
        },
        take: SOURCE_CAP + 1,
      })
    : [];
  if (lines.length > SOURCE_CAP) throw narrow("outstanding bales");

  const exceptions = wantExceptions
    ? await db.receivingException.findMany({
        where: {
          ...(raised ? { raisedAt: raised } : {}),
          ...(f.kind ? { kind: f.kind as ScanResult } : {}),
          ...(f.purchaseId ? { session: { is: { purchaseId: f.purchaseId } } } : {}),
          ...(f.search ? { OR: [{ barcode: { contains: f.search } }, { session: { is: { reference: contains(f.search) } } }] } : {}),
        },
        select: {
          barcode: true,
          kind: true,
          explanation: true,
          status: true,
          resolution: true,
          raisedAt: true,
          session: { select: { reference: true, purchase: { select: { reference: true } }, shipment: { select: { reference: true } } } },
        },
        take: SOURCE_CAP + 1,
      })
    : [];
  if (exceptions.length > SOURCE_CAP) throw narrow("exceptions");

  const allRows: ReportRow[] = [
    ...lines.map((l): ReportRow => {
      const missing = l.status === "MISSING" || FINISHED_SHIPMENT.has(l.shipment.status) || l.bale.purchase.reconciliation?.status === "CLOSED";
      return {
        kind: missing ? "MISSING" : "OUTSTANDING",
        barcode: l.bale.barcode, // never trimmed: the check character may be a blank
        purchase: l.bale.purchase.reference,
        shipment: l.shipment.reference,
        since: dayOf(l.shipment.dispatchDate),
        detail: `Dispatched ${formatDocDate(dayOf(l.shipment.dispatchDate))} (manifest ${formatDecimal(mass(l.massKgAtDispatch), 1)} kg) and not received`,
        state: l.shipment.status,
      };
    }),
    ...exceptions.map(
      (e): ReportRow => ({
        kind: e.kind,
        barcode: e.barcode,
        purchase: e.session?.purchase.reference ?? null,
        shipment: e.session?.shipment?.reference ?? null,
        since: instant(e.raisedAt),
        detail: e.resolution ? `${e.explanation} — Resolved: ${e.resolution}` : e.explanation,
        state: e.status,
      }),
    ),
  ];
  // OUTSTANDING and MISSING come from the same manifest lines, so the kind filter is applied to the finished rows
  const rows = f.kind ? allRows.filter((r) => r.kind === f.kind) : allRows;
  const sorted = sortRows(rows, sort ?? { key: "since", dir: "desc" });
  const count = (pred: (r: ReportRow) => boolean) => rows.filter(pred).length;
  const open = count((r) => r.state === "OPEN");
  return {
    rows: pageOf(sorted, paging),
    total: rows.length,
    totals: null,
    tiles: [
      { label: "Outstanding bales", value: tInt(count((r) => r.kind === "OUTSTANDING")), detail: "dispatched, not yet received", tone: count((r) => r.kind === "OUTSTANDING") ? "warn" : "good" },
      { label: "Missing bales", value: tInt(count((r) => r.kind === "MISSING")), tone: count((r) => r.kind === "MISSING") ? "bad" : "good" },
      { label: "Open exceptions", value: tInt(open), tone: open ? "bad" : "good" },
      { label: "Resolved exceptions", value: tInt(count((r) => r.state === "RESOLVED")) },
      { label: "Discrepancies", value: tInt(rows.length) },
    ],
  };
};

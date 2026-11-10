import { formatMessage, type Bale, type DeliveryNote, type FloorSummary, type MockDb, type Sale, type PriceBatch } from "@tobacco/shared";
import { audit, fail, nextSeq, notify, padNum, requirePermission, type Ctx } from "../ctx";

/**
 * Floor summary (Manual 05): scan every ticket with the row it lies in. When the last bale of a delivery is scanned the
 * delivery becomes Laid and the grower's floor summary, draft sale and price batch are created.
 */

export interface ScanTicketInput {
  row: string | number;
  barcode: string;
  sellingPointId?: string;
  saleRoom?: string;
}

export interface ScanTicketResult {
  outcome: "SCANNED" | "COMPLETE";
  message: string;
  barcode: string;
  growerNo: string;
  growerName: string;
  gdnId: string;
  gdnDocNo: string;
  row: number;
  lot: string;
  group: number;
  scanned: number;
  total: number;
  saleId?: string;
  saleRefNo?: number;
  batchRefNo?: number;
}

function parseRow(row: string | number | undefined): number {
  const s = String(row ?? "").trim();
  if (s === "") return fail("FLOOR_ROW_REQUIRED");
  if (!/^\d+$/.test(s) || Number(s) < 1) return fail("FLOOR_ROW_INTEGER");
  return Number(s);
}

export function sortBales(bales: Bale[]): Bale[] {
  return [...bales].sort((a, b) => a.group - b.group || a.lot.localeCompare(b.lot, undefined, { numeric: true }));
}

/**
 * Scan one ticket barcode (NOT the scale barcode) into a row.
 * Check order (Manual 05 messages): active sale date → scanning on → row → known ticket → [duplicate: our flagged
 * addition, checked before the delivery state so a re-scan of a finished delivery says "already scanned"] →
 * delivery Checked → selling point.
 */
export function scanTicket(ctx: Ctx, input: ScanTicketInput): ScanTicketResult {
  requirePermission(ctx, "floor-summary.scan");
  const { db } = ctx;
  const spId = input.sellingPointId ?? db.settings.sellingPointId;
  const sellingPoint = db.sellingPoints.find((s) => s.id === spId);

  const active = db.receivingSaleDates.find((d) => d.sellingPointId === spId && d.isActive);
  if (!active || active.date !== ctx.today) fail("FLOOR_ADD_SALE_DATE");
  if (!active.canScanFloorSummary) fail("FLOOR_SCANNING_OFF");
  const row = parseRow(input.row);

  const barcode = input.barcode.trim();
  const bale = db.bales.find((b) => !b.ejected && b.ticketBarcode === barcode);
  if (!bale) return fail("FLOOR_BALE_NOT_FOUND", { barcode });
  const note = db.deliveryNotes.find((d) => d.id === bale.gdnId);
  if (!note) return fail("FLOOR_BALE_NOT_FOUND", { barcode });

  if (bale.scannedAt) return fail("FLOOR_DUPLICATE_SCAN", { barcode, row: bale.floorRow ?? "?" });
  if (note.state !== "CHECKED") return fail("FLOOR_NOT_ON_FLOOR");
  if (note.sellingPointId !== spId) return fail("FLOOR_OTHER_SELLING_POINT", { sellingPoint: db.sellingPoints.find((s) => s.id === note.sellingPointId)?.name ?? note.sellingPointId });

  bale.floorRow = row;
  bale.scannedAt = ctx.now;
  const scanId = nextSeq(db, "generic");
  const grower = db.growers.find((g) => g.growerNo === note.growerNo);
  const growerName = grower ? `${grower.firstName} ${grower.surname}` : note.growerNo;

  const deliveryBales = db.bales.filter((b) => b.gdnId === note.id && !b.ejected);
  const scanned = deliveryBales.filter((b) => b.scannedAt).length;
  const total = deliveryBales.length;
  const progress = formatMessage("FLOOR_SCANNED_PROGRESS", { scanned, total });

  db.floorScans.unshift({
    id: `scan-${scanId}`,
    barcode,
    row,
    saleRoom: input.saleRoom ?? sellingPoint?.saleRooms[0] ?? "A",
    at: ctx.now,
    userId: ctx.actor.id,
    result: "OK",
    message: progress,
  });

  const base = {
    barcode,
    growerNo: note.growerNo,
    growerName,
    gdnId: note.id,
    gdnDocNo: note.docNo,
    row,
    lot: bale.lot,
    group: bale.group,
    scanned,
    total,
  };

  if (scanned < total) {
    return { outcome: "SCANNED", message: progress, ...base };
  }

  // ── Last bale scanned: the grower's floor summary is complete ────
  const rows = deliveryBales.map((b) => b.floorRow ?? row);
  const lowestRow = Math.min(...rows);
  note.state = "LAID";
  note.row = lowestRow;
  note.updatedAt = ctx.now;

  const refNo = nextSeq(db, "sale");
  const batchRef = nextSeq(db, "batch");
  const saleId = `sale-${refNo}`;
  const batchId = `batch-${batchRef}`;
  const booked = db.bookings
    .filter((b) => b.growerNo === note.growerNo && b.sellDate === note.sellingDate)
    .reduce((a, b) => a + b.balesBooked, 0);
  const groups = deliveryBales.map((b) => b.group);

  const summary: FloorSummary = {
    id: `fs-${padNum(refNo, 4)}`,
    gdnId: note.id,
    growerNo: note.growerNo,
    sellingPointId: note.sellingPointId,
    sellingDate: note.sellingDate,
    season: note.season,
    district: grower?.district ?? 0,
    row: lowestRow,
    groupFirst: Math.min(...groups),
    groupLast: Math.max(...groups),
    totalBales: total,
    unbooked: Math.max(0, total - booked),
  };
  db.floorSummaries.unshift(summary);

  const sale: Sale = {
    id: saleId,
    refNo,
    saleNo: note.floorSale,
    growerNo: note.growerNo,
    sellingPointId: note.sellingPointId,
    floorCode: sellingPoint?.code ?? "EL",
    saleDate: note.sellingDate,
    gdnId: note.id,
    priceBatchId: batchId,
    status: "DRAFT",
    released: false,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    isDemo: note.isDemo,
  };
  db.sales.push(sale);
  const batch: PriceBatch = {
    id: batchId,
    refNo: batchRef,
    saleId,
    growerNo: note.growerNo,
    saleNo: note.floorSale,
    sellingDate: note.sellingDate,
    sellingPointId: note.sellingPointId,
    status: "DRAFT",
    lastUpdatedBy: ctx.actor.id,
    createdAt: ctx.now,
  };
  db.priceBatches.push(batch);
  for (const b of deliveryBales) b.saleId = saleId;

  audit(ctx, {
    action: "floor-summary.complete",
    entityType: "FloorSummary",
    entityId: summary.id,
    entityRef: note.docNo,
    next: { saleId, batchId, row: lowestRow, totalBales: total },
    reason: `Scanned ${scanned} of ${total}`,
  });
  notify(ctx, {
    level: "success",
    title: `Floor summary complete — ${note.growerNo}`,
    body: `${note.docNo} is Laid. Draft sale #${refNo} and price batch ${batchRef} created.`,
    href: `/sales/${saleId}`,
  });

  return {
    outcome: "COMPLETE",
    message: `${progress} — floor summary complete for ${note.growerNo}: ${note.docNo} is Laid, draft sale #${refNo} created`,
    ...base,
    saleId,
    saleRefNo: refNo,
    batchRefNo: batchRef,
  };
}

// ── Selectors ────────────────────────────────────────────────────

export interface CheckFloorSummaryRow {
  rows: number[];
  groups: string;
  totalBales: number;
  sellingTime?: string;
  gdnDocNo: string;
}

export interface CheckFloorSummaryResult {
  growerNo: string;
  growerName?: string;
  date: string;
  found: boolean;
  summaries: CheckFloorSummaryRow[];
}

/** "Check Floor Summary" (Manual 05, Step 3): selling date + grower number → rows, groups, total bales. */
export function checkFloorSummary(db: MockDb, input: { date: string; growerNo: string }): CheckFloorSummaryResult {
  const growerNo = input.growerNo.trim().toUpperCase();
  const grower = db.growers.find((g) => g.growerNo === growerNo);
  const summaries = db.floorSummaries
    .filter((f) => f.growerNo === growerNo && f.sellingDate === input.date)
    .map((f): CheckFloorSummaryRow => {
      const note = db.deliveryNotes.find((d) => d.id === f.gdnId);
      const bales = db.bales.filter((b) => b.gdnId === f.gdnId && !b.ejected && b.floorRow !== undefined);
      const rows = bales.length > 0 ? [...new Set(bales.map((b) => b.floorRow!))].sort((a, b) => a - b) : [f.row];
      return {
        rows,
        groups: f.groupFirst === f.groupLast ? String(f.groupFirst) : `${f.groupFirst}-${f.groupLast}`,
        totalBales: f.totalBales,
        sellingTime: f.sellingTime,
        gdnDocNo: note?.docNo ?? f.gdnId,
      };
    });
  return { growerNo, growerName: grower ? `${grower.surname} ${grower.firstName}` : undefined, date: input.date, found: summaries.length > 0, summaries };
}

export interface FloorSummaryRow extends FloorSummary {
  firstName: string;
  surname: string;
  sellingPointName: string;
  gdnDocNo: string;
}

/** Back-office list: every grower's floor summary. */
export function selectFloorSummaries(db: MockDb): FloorSummaryRow[] {
  return db.floorSummaries
    .map((f) => {
      const g = db.growers.find((x) => x.growerNo === f.growerNo);
      return {
        ...f,
        firstName: g?.firstName ?? "",
        surname: g?.surname ?? "",
        sellingPointName: db.sellingPoints.find((s) => s.id === f.sellingPointId)?.name ?? f.sellingPointId,
        gdnDocNo: db.deliveryNotes.find((d) => d.id === f.gdnId)?.docNo ?? f.gdnId,
      };
    })
    .sort((a, b) => b.sellingDate.localeCompare(a.sellingDate) || b.id.localeCompare(a.id));
}

export interface ScanScreenState {
  activeDate?: string;
  saleDateIsToday: boolean;
  canScan: boolean;
  /** Deliveries that are Checked (ready to scan) or partly scanned. */
  deliveries: Array<{ gdnId: string; docNo: string; growerNo: string; growerName: string; total: number; scanned: number; state: DeliveryNote["state"] }>;
  perRow: Array<{ row: number; bales: number; growers: string[] }>;
  /** Ticket barcodes waiting to be scanned, in group/lot order. */
  waiting: Array<{ barcode: string; growerNo: string; gdnDocNo: string; lot: string; group: number }>;
  /** A scale barcode (should be rejected: scan the ticket, not the scale label). */
  scaleDecoy?: string;
  /** An already-scanned ticket (should be rejected as a duplicate). */
  duplicateDecoy?: string;
}

export function selectScanScreen(db: MockDb, sellingPointId: string): ScanScreenState {
  const active = db.receivingSaleDates.find((d) => d.sellingPointId === sellingPointId && d.isActive);
  const notes = db.deliveryNotes.filter(
    (d) => d.sellingPointId === sellingPointId && d.sellingDate === db.settings.demoToday && (d.state === "CHECKED" || d.state === "LAID") && !d.historicalBaleCount,
  );
  const deliveries = notes.map((n) => {
    const bales = db.bales.filter((b) => b.gdnId === n.id && !b.ejected);
    const g = db.growers.find((x) => x.growerNo === n.growerNo);
    return {
      gdnId: n.id,
      docNo: n.docNo,
      growerNo: n.growerNo,
      growerName: g ? `${g.firstName} ${g.surname}` : n.growerNo,
      total: bales.length,
      scanned: bales.filter((b) => b.scannedAt).length,
      state: n.state,
    };
  });
  const waiting = notes
    .filter((n) => n.state === "CHECKED")
    .flatMap((n) =>
      sortBales(db.bales.filter((b) => b.gdnId === n.id && !b.ejected && !b.scannedAt && b.ticketBarcode)).map((b) => ({
        barcode: b.ticketBarcode!,
        growerNo: n.growerNo,
        gdnDocNo: n.docNo,
        lot: b.lot,
        group: b.group,
      })),
    );
  const scannedToday = db.bales.filter((b) => b.scannedAt && notes.some((n) => n.id === b.gdnId));
  const perRowMap = new Map<number, { bales: number; growers: Set<string> }>();
  for (const b of scannedToday) {
    const r = perRowMap.get(b.floorRow!) ?? { bales: 0, growers: new Set<string>() };
    r.bales += 1;
    r.growers.add(b.growerNo);
    perRowMap.set(b.floorRow!, r);
  }
  const checkedBale = db.bales.find((b) => !b.scannedAt && b.ticketBarcode && notes.some((n) => n.id === b.gdnId && n.state === "CHECKED"));
  return {
    activeDate: active?.date,
    saleDateIsToday: active?.date === db.settings.demoToday,
    canScan: Boolean(active?.canScanFloorSummary),
    deliveries,
    perRow: [...perRowMap.entries()].map(([row, v]) => ({ row, bales: v.bales, growers: [...v.growers] })).sort((a, b) => a.row - b.row),
    waiting,
    scaleDecoy: checkedBale?.scaleBarcode,
    duplicateDecoy: scannedToday[0]?.ticketBarcode,
  };
}

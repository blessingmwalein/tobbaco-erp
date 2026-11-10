import {
  AppError,
  formatMessage,
  type AuditEntry,
  type Bale,
  type Buyer,
  type DispatchNote,
  type MessageKey,
  type MockDb,
  type Sale,
  type ShipmentExport,
  type Warehouse,
} from "@tobacco/shared";
import { dispatchInitiateFormSchema, reasonSchema, type DispatchInitiateForm } from "@tobacco/validation";
import { toCsv } from "@/lib/csv";
import { audit, fail, failText, nextSeq, notify, padNum, requirePermission, userName, type Ctx } from "../ctx";

/**
 * Floor Dispatch (Manual 09) — mock "server" operations + pure read selectors.
 *
 * Documented: Initiate Dispatch → scan bales (Save Bale / Remove Bale / Done) → Post → Generate Shipment File.
 * A bale is refused if its sale isn't released, its buyer packs at a different warehouse, it has a rejected sale code
 * (RO, RH, CO) or it is already on another dispatch note. A draft note can be cancelled with a reason. Notes are never
 * deleted. Not documented (UQ-12 / UQ-24): shipment-file columns, whether a posted note can be reset after the file was
 * generated, the mobile dispatch app. Those are built configurable/flagged.
 */

export const PRODUCT_LABEL: Record<DispatchNote["product"], string> = { GREEN: "Green (unprocessed)" };

/** Demo-format shipment file columns (the real warehouse format is undocumented — UQ-12). */
export const SHIPMENT_FILE_COLUMNS = [
  "Dispatch_Reference",
  "Dispatch_Date",
  "Destination_Warehouse",
  "Buyer",
  "Ticket_Barcode",
  "Scale_Barcode",
  "Grower_No",
  "Lot",
  "Group",
  "Mass_Kg",
  "TIMB_Grade",
  "Buyer_Grade",
  "Price_USc_per_kg",
] as const;

// ── Internal helpers ─────────────────────────────────────────────
function getNote(ctx: Ctx, id: string): DispatchNote {
  const note = ctx.db.dispatchNotes.find((d) => d.id === id);
  if (!note) failText("Dispatch note not found");
  return note;
}

function balesOnNote(db: MockDb, note: DispatchNote): Bale[] {
  return note.baleIds.map((id) => db.bales.find((b) => b.id === id)).filter((b): b is Bale => Boolean(b));
}

function refreshTotals(db: MockDb, note: DispatchNote): void {
  const bales = balesOnNote(db, note);
  note.totalBales = bales.length;
  note.totalMass = bales.reduce((a, b) => a + b.mass, 0);
}

const slash = (ref: string) => ref.replaceAll("/", "_");

type Refusal = { ok: false; key: MessageKey; params: Record<string, string | number> };
export type BaleCheck = { ok: true; bale: Bale; sale: Sale } | Refusal;

/**
 * Every refusal rule in one place, used by scanning, by post-time re-validation and by the "simulate scan" chips.
 * Order: not found → already on a note → sale not released → rejected sale code → wrong warehouse.
 */
export function checkBaleForDispatch(db: MockDb, note: DispatchNote, barcode: string, opts: { allowOnThisNote?: boolean } = {}): BaleCheck {
  const code = barcode.trim();
  const bale = db.bales.find((b) => !b.ejected && b.ticketBarcode === code);
  if (!bale) return { ok: false, key: "DISPATCH_NOT_FOUND_BALE", params: { barcode: code } };
  return checkBale(db, note, bale, opts);
}

function checkBale(db: MockDb, note: DispatchNote, bale: Bale, opts: { allowOnThisNote?: boolean } = {}): BaleCheck {
  const code = bale.ticketBarcode ?? bale.scaleBarcode;
  if (bale.dispatchNoteId && !(opts.allowOnThisNote && bale.dispatchNoteId === note.id)) {
    const other = db.dispatchNotes.find((d) => d.id === bale.dispatchNoteId);
    return { ok: false, key: "DISPATCH_ALREADY_ON_NOTE", params: { barcode: code, ref: other?.ref ?? "another dispatch note" } };
  }
  const sale = db.sales.find((s) => s.id === bale.saleId);
  if (!sale || !sale.released) return { ok: false, key: "DISPATCH_NOT_RELEASED", params: { barcode: code } };
  const saleCode = (bale.saleCode ?? "").trim().toUpperCase();
  if (saleCode && db.settings.rejectedSaleCodes.includes(saleCode))
    return { ok: false, key: "DISPATCH_REJECTED_CODE", params: { barcode: code, code: saleCode } };
  const buyer = db.buyers.find((b) => b.code === bale.buyerCode);
  const packsAt = buyer?.packingWarehouseCode;
  if (packsAt !== note.warehouseCode)
    return { ok: false, key: "DISPATCH_WRONG_WAREHOUSE", params: { barcode: code, warehouse: packsAt ?? "no warehouse set" } };
  return { ok: true, bale, sale };
}

// ── Operations ───────────────────────────────────────────────────
export function initiateDispatch(ctx: Ctx, input: DispatchInitiateForm) {
  requirePermission(ctx, "dispatch.create");
  const parsed = dispatchInitiateFormSchema.safeParse(input);
  if (!parsed.success) failText(parsed.error.issues[0]?.message ?? "Check the dispatch details");
  const v = parsed.data;
  const warehouse = ctx.db.warehouses.find((w) => w.code === v.warehouseCode && w.active);
  if (!warehouse) failText("Destination warehouse not found or inactive. Destination warehouses are set up in Floor Dispatch → Configurations.");

  const n = nextSeq(ctx.db, "dispatch");
  const year = ctx.today.slice(0, 4);
  const month = ctx.today.slice(5, 7);
  const note: DispatchNote = {
    id: `dispatch-${n}`,
    ref: `FLDN/${year}/${month}/${padNum(n, 4)}`,
    state: "DRAFT",
    warehouseCode: warehouse.code,
    product: v.product,
    noTransportDetails: v.noTransportDetails,
    transportName: v.noTransportDetails ? undefined : v.transportName?.trim(),
    truckReg: v.noTransportDetails ? undefined : v.truckReg?.trim(),
    driver: v.noTransportDetails ? undefined : v.driver?.trim(),
    driverNationalId: v.driverNationalId?.trim() || undefined,
    driverCell: v.driverCell?.trim() || undefined,
    baleIds: [],
    totalBales: 0,
    totalMass: 0,
    createdBy: ctx.actor.id,
    createdAt: ctx.now,
    mobileCreated: false,
  };
  ctx.db.dispatchNotes.unshift(note);
  audit(ctx, { action: "dispatch.create", entityType: "DispatchNote", entityId: note.id, entityRef: note.ref, next: { state: note.state, warehouse: note.warehouseCode } });
  return note;
}

export function scanDispatchBale(ctx: Ctx, input: { dispatchId: string; barcode: string }) {
  requirePermission(ctx, "dispatch.scan");
  const note = getNote(ctx, input.dispatchId);
  if (note.state !== "DRAFT") failText("Bales can only be scanned onto a draft dispatch note.");
  const check = checkBaleForDispatch(ctx.db, note, input.barcode);
  if (!check.ok) throw new AppError(check.key, check.params);
  const { bale } = check;
  bale.dispatchNoteId = note.id;
  note.baleIds.push(bale.id);
  note.loadingDoneAt = undefined; // the load changed — "Done" must be confirmed again
  refreshTotals(ctx.db, note);
  audit(ctx, { action: "dispatch.scan", entityType: "DispatchNote", entityId: note.id, entityRef: note.ref, next: { barcode: bale.ticketBarcode, mass: bale.mass } });
  return { note, bale, totalBales: note.totalBales, totalMass: note.totalMass };
}

export function removeDispatchBale(ctx: Ctx, input: { dispatchId: string; baleId: string }) {
  requirePermission(ctx, "dispatch.scan");
  const note = getNote(ctx, input.dispatchId);
  if (note.state !== "DRAFT") fail("DISPATCH_REMOVE_ONLY_DRAFT");
  const bale = ctx.db.bales.find((b) => b.id === input.baleId);
  if (!bale || !note.baleIds.includes(bale.id)) failText("That bale is not on this dispatch note.");
  note.baleIds = note.baleIds.filter((id) => id !== bale.id);
  bale.dispatchNoteId = undefined;
  note.loadingDoneAt = undefined;
  refreshTotals(ctx.db, note);
  audit(ctx, { action: "dispatch.remove-bale", entityType: "DispatchNote", entityId: note.id, entityRef: note.ref, previous: { barcode: bale.ticketBarcode }, next: { totalBales: note.totalBales } });
  return { note, totalBales: note.totalBales, totalMass: note.totalMass };
}

/** "Done" — the truck is loaded. The note stays Draft until it is posted. */
export function finishLoading(ctx: Ctx, input: { dispatchId: string }) {
  requirePermission(ctx, "dispatch.scan");
  const note = getNote(ctx, input.dispatchId);
  if (note.state !== "DRAFT") failText("Only a draft dispatch note can be marked as loaded.");
  if (note.baleIds.length === 0) failText("Scan at least one bale before marking the load as done.");
  note.loadingDoneAt = ctx.now;
  audit(ctx, { action: "dispatch.loading-done", entityType: "DispatchNote", entityId: note.id, entityRef: note.ref, next: { totalBales: note.totalBales, totalMass: note.totalMass } });
  return note;
}

export function postDispatch(ctx: Ctx, input: { dispatchId: string; confirmWithoutDone?: boolean }) {
  requirePermission(ctx, "dispatch.post");
  const note = getNote(ctx, input.dispatchId);
  if (note.state !== "DRAFT") failText("Only a draft dispatch note can be posted.");
  if (note.baleIds.length === 0) failText("Add at least one bale before posting the dispatch note.");
  if (!note.loadingDoneAt && !input.confirmWithoutDone) failText("Click Done when the truck is loaded, then post the dispatch note.");

  // The dispatch note must be valid: every bale must still pass the rules at the moment of posting.
  const problems: string[] = [];
  for (const bale of balesOnNote(ctx.db, note)) {
    const check = checkBale(ctx.db, note, bale, { allowOnThisNote: true });
    if (!check.ok) problems.push(formatMessage(check.key, check.params));
  }
  if (problems.length > 0) failText(`The dispatch note is not valid: ${problems[0]}${problems.length > 1 ? ` (+${problems.length - 1} more)` : ""}`);

  note.state = "POSTED";
  note.dispatchDate = ctx.today;
  note.postedBy = ctx.actor.id;
  note.postedAt = ctx.now;
  audit(ctx, { action: "dispatch.post", entityType: "DispatchNote", entityId: note.id, entityRef: note.ref, previous: { state: "DRAFT" }, next: { state: "POSTED", totalBales: note.totalBales, totalMass: note.totalMass } });
  notify(ctx, { level: "success", title: `Dispatch note ${note.ref} posted`, body: `${note.totalBales} bales · ${note.totalMass} kg to ${note.warehouseCode}`, href: `/dispatch/${note.id}` });
  return note;
}

/** Draft notes can be cancelled with a reason; the note is kept (never deleted) and its bales are released. */
export function cancelDispatch(ctx: Ctx, input: { dispatchId: string; reason: string }) {
  requirePermission(ctx, "dispatch.cancel");
  const note = getNote(ctx, input.dispatchId);
  if (note.state !== "DRAFT") failText("Only a draft dispatch note can be cancelled. Posted notes are kept; a supervisor can reset a posted note to draft first.");
  const reason = reasonSchema.safeParse({ reason: input.reason });
  if (!reason.success) failText(reason.error.issues[0]?.message ?? "A reason is required");
  for (const bale of balesOnNote(ctx.db, note)) bale.dispatchNoteId = undefined;
  note.state = "CANCELLED";
  note.cancelReason = reason.data.reason;
  note.cancelledBy = ctx.actor.id;
  note.cancelledAt = ctx.now;
  note.loadingDoneAt = undefined;
  audit(ctx, { action: "dispatch.cancel", entityType: "DispatchNote", entityId: note.id, entityRef: note.ref, previous: { state: "DRAFT" }, next: { state: "CANCELLED" }, reason: reason.data.reason });
  return note;
}

/** Documented message: "You cannot delete dispatch notes. Please cancel them instead." Always refuses. */
export function deleteDispatch(_ctx: Ctx, _input: { dispatchId: string }): never {
  return fail("DISPATCH_CANNOT_DELETE");
}

/**
 * "Reset the note to draft (supervisor)" — the documented way to remove bales from a posted note.
 * Blocking it once a shipment file exists is OUR assumption (UQ-12 / UQ-24).
 */
export function resetDispatchToDraft(ctx: Ctx, input: { dispatchId: string; reason: string }) {
  requirePermission(ctx, "dispatch.reset");
  const note = getNote(ctx, input.dispatchId);
  if (note.state !== "POSTED") failText("Only a posted dispatch note can be reset to draft.");
  const reason = reasonSchema.safeParse({ reason: input.reason });
  if (!reason.success) failText(reason.error.issues[0]?.message ?? "A reason is required");
  if (ctx.db.shipmentExports.some((s) => s.dispatchNoteId === note.id))
    failText("A shipment file was already generated for this note, so it cannot be reset to draft (assumption — UQ-12).");
  note.state = "DRAFT";
  note.dispatchDate = undefined;
  note.postedBy = undefined;
  note.postedAt = undefined;
  note.loadingDoneAt = undefined;
  audit(ctx, { action: "dispatch.reset", entityType: "DispatchNote", entityId: note.id, entityRef: note.ref, previous: { state: "POSTED" }, next: { state: "DRAFT" }, reason: reason.data.reason });
  return note;
}

export function generateShipmentFile(ctx: Ctx, input: { dispatchId: string }) {
  requirePermission(ctx, "dispatch.generate-shipment-file");
  const note = getNote(ctx, input.dispatchId);
  if (note.state !== "POSTED") fail("DISPATCH_POST_FIRST");
  const rows = balesOnNote(ctx.db, note).map((b) => [
    note.ref,
    note.dispatchDate ?? "",
    note.warehouseCode,
    b.buyerCode ?? "",
    b.ticketBarcode ?? "",
    b.scaleBarcode,
    b.growerNo,
    b.lot,
    b.group,
    b.mass,
    b.timbGrade ?? "",
    b.buyerGrade ?? "",
    b.priceCents ?? "",
  ]);
  const previous = ctx.db.shipmentExports.filter((s) => s.dispatchNoteId === note.id).length;
  const base = slash(note.ref);
  const record: ShipmentExport = {
    id: `ship-${nextSeq(ctx.db, "generic")}`,
    dispatchNoteId: note.id,
    filename: previous === 0 ? `${base}.csv` : `${base}_v${previous + 1}.csv`,
    generatedAt: ctx.now,
    generatedBy: ctx.actor.id,
    rowCount: rows.length,
    csv: toCsv([...SHIPMENT_FILE_COLUMNS], rows),
    isMockFormat: true,
  };
  ctx.db.shipmentExports.unshift(record); // history is never overwritten
  audit(ctx, { action: "dispatch.generate-shipment-file", entityType: "DispatchNote", entityId: note.id, entityRef: note.ref, next: { filename: record.filename, rows: record.rowCount } });
  return record;
}

// ── Read selectors (pure) ────────────────────────────────────────
export interface DispatchRow {
  note: DispatchNote;
  warehouseName: string;
  createdByName: string;
  /** "Mobile User" column — the mobile dispatch app is unexplained (UQ-24). */
  mobileUser: string;
}

export function selectDispatchRows(db: MockDb): DispatchRow[] {
  return db.dispatchNotes
    .map((note) => ({
      note,
      warehouseName: db.warehouses.find((w) => w.code === note.warehouseCode)?.name ?? note.warehouseCode,
      createdByName: userName(db, note.createdBy),
      mobileUser: note.mobileCreated ? userName(db, note.createdBy) : "—",
    }))
    .sort((a, b) => b.note.createdAt.localeCompare(a.note.createdAt));
}

export interface DispatchBaleRow {
  bale: Bale;
  growerName: string;
  saleId?: string;
  saleRef?: number;
  buyerName?: string;
}

export function selectDispatchBales(db: MockDb, note: DispatchNote): DispatchBaleRow[] {
  return balesOnNote(db, note).map((bale) => {
    const grower = db.growers.find((g) => g.growerNo === bale.growerNo);
    const sale = db.sales.find((s) => s.id === bale.saleId);
    return {
      bale,
      growerName: grower ? `${grower.firstName} ${grower.surname}` : bale.growerNo,
      saleId: sale?.id,
      saleRef: sale?.refNo,
      buyerName: db.buyers.find((b) => b.code === bale.buyerCode)?.name,
    };
  });
}

export interface DispatchDetail {
  note: DispatchNote;
  warehouse?: Warehouse;
  buyers: Buyer[];
  bales: DispatchBaleRow[];
  audit: AuditEntry[];
  exports: ShipmentExport[];
  createdByName: string;
  postedByName?: string;
  cancelledByName?: string;
  /** Releasable bales for this destination not yet on any note (the "target" for the tally). */
  readyForDestination: number;
}

export function selectDispatchDetail(db: MockDb, id: string): DispatchDetail | null {
  const note = db.dispatchNotes.find((d) => d.id === id);
  if (!note) return null;
  const warehouse = db.warehouses.find((w) => w.code === note.warehouseCode);
  return {
    note,
    warehouse,
    buyers: db.buyers.filter((b) => b.packingWarehouseCode === note.warehouseCode),
    bales: selectDispatchBales(db, note),
    audit: db.audit.filter((a) => a.entityType === "DispatchNote" && a.entityId === note.id),
    exports: db.shipmentExports.filter((s) => s.dispatchNoteId === note.id),
    createdByName: userName(db, note.createdBy),
    postedByName: note.postedBy ? userName(db, note.postedBy) : undefined,
    cancelledByName: note.cancelledBy ? userName(db, note.cancelledBy) : undefined,
    readyForDestination: readyBales(db, note.warehouseCode).length,
  };
}

/** Bales that could be loaded for a destination right now: released, not rejected, buyer packs there, not on a note. */
export function readyBales(db: MockDb, warehouseCode: string): Bale[] {
  const probe = { warehouseCode } as DispatchNote;
  return db.bales.filter((b) => {
    if (b.ejected || !b.ticketBarcode || b.dispatchNoteId) return false;
    return checkBale(db, probe, b).ok;
  });
}

export interface DispatchCandidate {
  barcode: string;
  growerNo: string;
  ok: boolean;
  /** Why it would be refused (verbatim catalogue message). */
  reason?: string;
}

/** For the "simulate scan" chips: every ticket, with whether THIS note would accept it. */
export function selectDispatchCandidates(db: MockDb, note: DispatchNote): DispatchCandidate[] {
  return db.bales
    .filter((b) => !b.ejected && b.ticketBarcode)
    .map((b) => {
      const check = checkBale(db, note, b);
      return {
        barcode: b.ticketBarcode!,
        growerNo: b.growerNo,
        ok: check.ok,
        reason: check.ok ? undefined : formatMessage(check.key, check.params),
      };
    });
}

export interface WarehouseOverview {
  warehouse: Warehouse;
  buyers: Buyer[];
  readyBales: number;
  readyMassKg: number;
  dispatchedBales: number;
}

export function selectWarehouseOverview(db: MockDb): WarehouseOverview[] {
  return db.warehouses.map((warehouse) => {
    const ready = readyBales(db, warehouse.code);
    const dispatched = db.dispatchNotes
      .filter((n) => n.warehouseCode === warehouse.code && n.state === "POSTED")
      .reduce((a, n) => a + n.totalBales, 0);
    return {
      warehouse,
      buyers: db.buyers.filter((b) => b.packingWarehouseCode === warehouse.code),
      readyBales: ready.length,
      readyMassKg: ready.reduce((a, b) => a + b.mass, 0),
      dispatchedBales: dispatched,
    };
  });
}

export interface DispatchHub {
  drafts: DispatchRow[];
  recentPosted: DispatchRow[];
  overview: WarehouseOverview[];
  /** Bales in sales that are not released yet (dispatch will refuse them). */
  unreleasedBales: number;
}

export function selectDispatchHub(db: MockDb): DispatchHub {
  const rows = selectDispatchRows(db);
  const unreleasedSaleIds = new Set(db.sales.filter((s) => !s.released && !s.historical).map((s) => s.id));
  return {
    drafts: rows.filter((r) => r.note.state === "DRAFT"),
    recentPosted: rows.filter((r) => r.note.state === "POSTED").slice(0, 5),
    overview: selectWarehouseOverview(db),
    unreleasedBales: db.bales.filter((b) => !b.ejected && b.saleId && unreleasedSaleIds.has(b.saleId) && !b.dispatchNoteId).length,
  };
}

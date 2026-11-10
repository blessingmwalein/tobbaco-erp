import {
  AppError,
  formatMessage,
  isValidGrowerNo,
  isValidScaleBarcode,
  normaliseGrowerNo,
  yymmdd,
  type Bale,
  type DeliveryNote,
  type MockDb,
  type TransporterNote,
} from "@tobacco/shared";
import {
  findRepeatedGroupLot,
  reasonSchema,
  transporterNoteFormSchema,
  validateGroup,
  validateLot,
} from "@tobacco/validation";
import { audit, docNo, fail, failText, nextSeq, padNum, requirePermission, type Ctx } from "../ctx";

/**
 * Receiving (Manual 03): transporter delivery note → growers → completing the note creates a grower delivery note
 * (GDN) per grower → bale capture → completing each grower's delivery (Open → Tickets Printing).
 * Mock "server" operations: permission first, validate, mutate the draft, audit every transition.
 */

// ── Pure helpers (also used by pages) ───────────────────────────
export const gdnIdFor = (n: number) => `gdn-${padNum(n, 7)}`;
export const tdnIdFor = (n: number) => `tdn-${padNum(n, 7)}`;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** The active receiving sale date for the selling point, or undefined. */
export function activeSaleDate(db: MockDb) {
  return db.receivingSaleDates.find((d) => d.sellingPointId === db.settings.sellingPointId && d.isActive);
}

/** Ticket printing and receiving need an active sale date that is not in the past (Manual 01/04). */
export function requireActiveSaleDate(ctx: Ctx) {
  const d = activeSaleDate(ctx.db);
  if (!d) fail("SALE_DATE_MISSING");
  if (d.date < ctx.today) fail("SALE_DATE_EXPIRED");
  return d;
}

/** Non-ejected bales on a delivery, in capture order. */
export function activeBales(db: MockDb, gdnId: string): Bale[] {
  return db.bales.filter((b) => b.gdnId === gdnId && !b.ejected);
}

export function deliveryTally(db: MockDb, note: DeliveryNote): { captured: number; declared: number; balanced: boolean } {
  const captured = note.historicalBaleCount ?? activeBales(db, note.id).length;
  return { captured, declared: note.balesDeclared, balanced: captured === note.balesDeclared };
}

/** The grower's pending (Open) delivery note; prefers one that still needs bales. */
export function pendingNoteForGrower(db: MockDb, growerNo: string): DeliveryNote | undefined {
  const open = db.deliveryNotes.filter((d) => d.growerNo === growerNo && d.state === "OPEN");
  return open.find((d) => activeBales(db, d.id).length < d.balesDeclared) ?? open[0];
}

/** A scale reading is "consumed" once a non-ejected bale carries its barcode. */
export function scaleReadingBale(db: MockDb, scaleBarcode: string): Bale | undefined {
  return db.bales.find((b) => b.scaleBarcode === scaleBarcode && !b.ejected);
}

/** Numeric sort key for lots like "3" or "12/3". */
export function lotKey(lot: string): number[] {
  return lot.split("/").map((p) => Number(p));
}

export function compareGroupLot(a: { group: number; lot: string }, b: { group: number; lot: string }): number {
  if (a.group !== b.group) return a.group - b.group;
  const ka = lotKey(a.lot);
  const kb = lotKey(b.lot);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const d = (ka[i] ?? -1) - (kb[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

const noteOrFail = (db: MockDb, id: string): TransporterNote =>
  db.transporterNotes.find((t) => t.id === id) ?? failText("Transporter delivery note not found");

// ── Transporter delivery note ───────────────────────────────────
export interface TransporterNoteInput {
  transporterName: string;
  idNumber: string;
  vehicleReg: string;
  phone: string;
  permitNo?: string;
}

function parseTransporter(input: TransporterNoteInput) {
  const parsed = transporterNoteFormSchema.safeParse(input);
  if (!parsed.success) failText(parsed.error.issues[0]?.message ?? "Invalid transporter details");
  return parsed.data;
}

export function createTransporterNote(ctx: Ctx, input: TransporterNoteInput): TransporterNote {
  requirePermission(ctx, "receiving.create-delivery");
  const v = parseTransporter(input);
  const n = nextSeq(ctx.db, "tdn");
  const note: TransporterNote = {
    id: tdnIdFor(n),
    docNo: docNo("TDN", n),
    state: "OPEN",
    sellingPointId: ctx.db.settings.sellingPointId,
    transporterName: v.transporterName,
    idNumber: v.idNumber,
    vehicleReg: v.vehicleReg,
    phone: v.phone,
    permitNo: v.permitNo || undefined,
    growers: [],
    createdBy: ctx.actor.id,
    createdAt: ctx.now,
  };
  ctx.db.transporterNotes.push(note);
  audit(ctx, { action: "receiving.create-transporter-note", entityType: "TransporterNote", entityId: note.id, entityRef: note.docNo, next: { transporterName: note.transporterName, vehicleReg: note.vehicleReg } });
  return note;
}

/** Edit Transporter Details. Whether a COMPLETED note may be edited is not documented (UQ-18) → refused. */
export function updateTransporterDetails(ctx: Ctx, input: TransporterNoteInput & { noteId: string }): TransporterNote {
  requirePermission(ctx, "receiving.create-delivery");
  const note = noteOrFail(ctx.db, input.noteId);
  if (note.state !== "OPEN") failText("Only an Open transporter delivery note can be edited (editing a completed note is not documented — UQ-18).");
  const v = parseTransporter(input);
  const previous = { transporterName: note.transporterName, idNumber: note.idNumber, vehicleReg: note.vehicleReg, phone: note.phone, permitNo: note.permitNo };
  note.transporterName = v.transporterName;
  note.idNumber = v.idNumber;
  note.vehicleReg = v.vehicleReg;
  note.phone = v.phone;
  note.permitNo = v.permitNo || undefined;
  audit(ctx, { action: "receiving.update-transporter-note", entityType: "TransporterNote", entityId: note.id, entityRef: note.docNo, previous, next: { ...v } });
  return note;
}

export interface AddGrowerInput {
  noteId: string;
  growerNo: string;
  location: string;
  bales: number;
  /** Prefilled from the active sale date; "change them only if you are told to". */
  saleDay?: number;
  saleMonth?: number;
}

export function addGrowerToNote(ctx: Ctx, input: AddGrowerInput) {
  requirePermission(ctx, "receiving.add-grower");
  const note = noteOrFail(ctx.db, input.noteId);
  if (note.state !== "OPEN") failText("Growers can only be added to an Open transporter delivery note.");
  const saleDate = requireActiveSaleDate(ctx);

  const growerNo = normaliseGrowerNo(input.growerNo);
  const grower = isValidGrowerNo(growerNo) ? ctx.db.growers.find((g) => g.growerNo === growerNo) : undefined;
  if (!grower) fail("GROWER_INVALID", {}, "growerNo");

  const location = input.location.trim().toUpperCase();
  if (!ctx.db.baleLocations.some((l) => l.code === location)) failText(`Unknown receiving location “${location}”.`);
  if (!Number.isInteger(input.bales) || input.bales < 1) failText("Number of bales must be a whole number of 1 or more.");

  const saleYear = Number(saleDate.date.slice(0, 4));
  const saleDay = input.saleDay ?? Number(saleDate.date.slice(8, 10));
  const saleMonth = input.saleMonth ?? Number(saleDate.date.slice(5, 7));
  const sellDate = `${saleYear}-${pad2(saleMonth)}-${pad2(saleDay)}`;

  // Booking check: "receiving and balancing check the bales delivered against these bookings" (Manual 02).
  // Whether a shortfall blocks is not documented (UQ-09) → configurable via settings.unbookedPolicy.
  const booked = ctx.db.bookings.filter((b) => b.growerNo === growerNo && b.sellDate === sellDate).reduce((a, b) => a + b.balesBooked, 0);
  const alreadyDeclared = ctx.db.transporterNotes
    .flatMap((t) => t.growers)
    .filter((g) => g.growerNo === growerNo && g.saleDay === saleDay && g.saleMonth === saleMonth)
    .reduce((a, g) => a + g.bales, 0);
  const declared = alreadyDeclared + input.bales;
  let warning: string | undefined;
  if (declared > booked) {
    const params = { grower: growerNo, declared, booked, unbooked: declared - booked };
    if (ctx.db.settings.unbookedPolicy === "BLOCK") fail("BOOKING_MISMATCH", params, "bales");
    warning = formatMessage("BOOKING_MISMATCH", params);
  }

  const line = { growerNo, location, bales: input.bales, saleDay, saleMonth };
  note.growers.push(line);
  audit(ctx, { action: "receiving.add-grower", entityType: "TransporterNote", entityId: note.id, entityRef: note.docNo, next: line, reason: warning });
  return { note, line, warning };
}

export function removeGrowerFromNote(ctx: Ctx, input: { noteId: string; index: number }) {
  requirePermission(ctx, "receiving.add-grower");
  const note = noteOrFail(ctx.db, input.noteId);
  if (note.state !== "OPEN") failText("Growers can only be removed from an Open transporter delivery note.");
  const line = note.growers[input.index];
  if (!line) failText("That grower line no longer exists.");
  note.growers.splice(input.index, 1);
  audit(ctx, { action: "receiving.remove-grower", entityType: "TransporterNote", entityId: note.id, entityRef: note.docNo, previous: line });
  return note;
}

/**
 * Complete Delivery → Confirm Delivery Complete: closes the transporter note and creates one grower delivery note per grower.
 * Numbering: GDNs are created in REVERSE of the order the growers were added — the documented run gave V100061 (added second)
 * GDN0000004 and V100060 (added first) GDN0000005. The reason is not documented (UQ-26).
 */
export function completeTransporterNote(ctx: Ctx, input: { noteId: string }) {
  requirePermission(ctx, "receiving.complete-delivery");
  const note = noteOrFail(ctx.db, input.noteId);
  if (note.state !== "OPEN") failText("This transporter delivery note is already completed.");
  if (note.growers.length === 0) failText("Add at least one grower before completing the delivery.");
  const saleDate = requireActiveSaleDate(ctx);
  const saleYear = Number(saleDate.date.slice(0, 4));

  const gdns: DeliveryNote[] = [];
  for (const line of [...note.growers].reverse()) {
    const n = nextSeq(ctx.db, "gdn");
    const gdn: DeliveryNote = {
      id: gdnIdFor(n),
      docNo: docNo("GDN", n),
      transporterNoteId: note.id,
      growerNo: line.growerNo,
      location: line.location,
      balesDeclared: line.bales,
      state: "OPEN",
      sellingPointId: note.sellingPointId,
      sellingDate: `${saleYear}-${pad2(line.saleMonth)}-${pad2(line.saleDay)}`,
      season: ctx.db.settings.seasonYear,
      floorSale: 1,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    };
    ctx.db.deliveryNotes.push(gdn);
    line.gdnId = gdn.id;
    gdns.push(gdn);
  }
  note.state = "COMPLETED";
  note.completedAt = ctx.now;
  const totalBales = note.growers.reduce((a, g) => a + g.bales, 0);
  audit(ctx, {
    action: "receiving.complete-transporter-note",
    entityType: "TransporterNote",
    entityId: note.id,
    entityRef: note.docNo,
    previous: { state: "OPEN" },
    next: { state: "COMPLETED", gdns: note.growers.map((g) => ({ growerNo: g.growerNo, gdnId: g.gdnId })) },
    reason: `${note.growers.length} growers, ${totalBales} bales`,
  });
  return { note, gdns };
}

// ── Bale capture ────────────────────────────────────────────────
export interface CaptureBaleInput {
  scaleBarcode: string;
  growerNo: string;
  group: number | string;
  lot: string;
}

/** Validation order follows Manual 03's message list. */
export function captureBale(ctx: Ctx, input: CaptureBaleInput) {
  requirePermission(ctx, "receiving.capture-bale");
  const db = ctx.db;
  const scaleBarcode = input.scaleBarcode.trim();
  if (!isValidScaleBarcode(scaleBarcode)) fail("BARCODE_CHECK", {}, "scaleBarcode");

  const growerNo = normaliseGrowerNo(input.growerNo);
  if (!isValidGrowerNo(growerNo) || !db.growers.some((g) => g.growerNo === growerNo)) fail("GROWER_INVALID", {}, "growerNo");

  const note = pendingNoteForGrower(db, growerNo);
  if (!note) fail("NO_PENDING_DELIVERY", {}, "growerNo");

  const existing = scaleReadingBale(db, scaleBarcode);
  if (existing) {
    const where = db.deliveryNotes.find((d) => d.id === existing.gdnId);
    if (where && where.state !== "OPEN") fail("BALE_IN_CLOSED_DOCUMENT", {}, "scaleBarcode");
    fail("BALE_ALREADY_CAPTURED", { barcode: scaleBarcode }, "scaleBarcode");
  }

  const reading = db.scaleReadings.find((r) => r.scaleBarcode === scaleBarcode);
  if (!reading) fail("SCALE_READING_MISSING", { barcode: scaleBarcode }, "scaleBarcode");

  const g = validateGroup(input.group);
  if (!g.ok && g.key) fail(g.key, {}, "group");
  const group = Number(input.group);
  const l = validateLot(input.lot);
  if (!l.ok && l.key) fail(l.key, {}, "lot");

  const bale: Bale = {
    id: `bale-${nextSeq(db, "bale")}`,
    scaleBarcode,
    growerNo,
    gdnId: note.id,
    group,
    lot: input.lot.trim(),
    mass: reading.mass,
    ejected: false,
    printed: false,
    capturedBy: ctx.actor.id,
    capturedAt: ctx.now,
    isDemo: reading.isDemo,
  };
  db.bales.push(bale);
  const t = deliveryTally(db, note);
  audit(ctx, {
    action: "receiving.capture-bale",
    entityType: "Bale",
    entityId: bale.id,
    entityRef: scaleBarcode,
    next: { gdn: note.docNo, group, lot: bale.lot, mass: bale.mass },
    meta: { tally: `${t.captured} of ${t.declared}` },
  });
  return {
    bale,
    gdnId: note.id,
    gdnDocNo: note.docNo,
    captured: t.captured,
    declared: t.declared,
    balanced: t.balanced,
    message: formatMessage("BALE_ADDED"),
  };
}

/** Complete Delivery (Manual 03 Step 5): tally, groups, lots, repeated group+lot → Open → Tickets Printing. */
export function completeGrowerDelivery(ctx: Ctx, input: { growerNo: string; gdnId?: string }) {
  requirePermission(ctx, "receiving.complete-delivery");
  const db = ctx.db;
  const growerNo = normaliseGrowerNo(input.growerNo);
  if (!isValidGrowerNo(growerNo) || !db.growers.some((g) => g.growerNo === growerNo)) fail("GROWER_INVALID", {}, "growerNo");
  const note = input.gdnId ? db.deliveryNotes.find((d) => d.id === input.gdnId && d.growerNo === growerNo && d.state === "OPEN") : pendingNoteForGrower(db, growerNo);
  if (!note) fail("NO_PENDING_DELIVERY", {}, "growerNo");

  const bales = activeBales(db, note.id);
  if (bales.length < note.balesDeclared) fail("TALLY_LESS");
  if (bales.length > note.balesDeclared) fail("TALLY_GREATER");
  for (const b of bales) {
    const g = validateGroup(b.group);
    if (!g.ok && g.key) fail(g.key);
  }
  for (const b of bales) {
    const l = validateLot(b.lot);
    if (!l.ok && l.key) fail(l.key);
  }
  const repeat = findRepeatedGroupLot(bales);
  if (repeat !== null) fail("GROUP_LOT_REPEATED", { line: repeat });

  const lots = bales.map((b) => lotKey(b.lot)[0] ?? 0);
  note.lotHighest = Math.max(...lots);
  note.lotLowest = Math.min(...lots);
  note.state = "TICKETS_PRINTING";
  note.deliveryClosedAt = ctx.now;
  note.updatedAt = ctx.now;
  audit(ctx, {
    action: "receiving.complete-delivery",
    entityType: "DeliveryNote",
    entityId: note.id,
    entityRef: note.docNo,
    previous: { state: "OPEN" },
    next: { state: "TICKETS_PRINTING" },
    reason: `${bales.length} of ${note.balesDeclared} bales`,
  });
  return { note, message: formatMessage("DELIVERY_CLOSED", { gdn: note.docNo, grower: growerNo }) };
}

/**
 * Eject Bale using Scale Barcode (supervisor): removes a bale captured by mistake so it can be captured again.
 * Whether ejecting needs approval, and whether a CLOSED delivery may be reopened, is not documented (UQ-17). Rule used:
 * allowed on an Open delivery; on a Tickets Printing delivery only if no ticket barcodes are allocated yet (the delivery
 * reopens, because its tally no longer matches); never once barcodes are allocated/confirmed — reverse printing first.
 */
export function ejectBale(ctx: Ctx, input: { scaleBarcode: string; reason: string }) {
  requirePermission(ctx, "receiving.eject-bale");
  const r = reasonSchema.safeParse({ reason: input.reason });
  if (!r.success) failText(r.error.issues[0]?.message ?? "A reason is required");
  const scaleBarcode = input.scaleBarcode.trim();
  const bale = scaleReadingBale(ctx.db, scaleBarcode);
  if (!bale) fail("BARCODE_CHECK", {}, "scaleBarcode");
  const note = ctx.db.deliveryNotes.find((d) => d.id === bale.gdnId);
  if (!note) failText("The bale's delivery note was not found.");

  let reopened = false;
  if (note.state === "TICKETS_PRINTING") {
    if (activeBales(ctx.db, note.id).some((b) => b.ticketBarcode)) failText("Ticket barcodes are already allocated for this delivery. Reverse/re-allocate them before ejecting a bale (UQ-17).");
    note.state = "OPEN";
    note.deliveryClosedAt = undefined;
    note.updatedAt = ctx.now;
    reopened = true;
  } else if (note.state !== "OPEN") {
    failText(`Delivery ${note.docNo} is ${note.state === "CHECKED" ? "Checked" : "Laid"}; its tickets are confirmed. Reverse printing status first (UQ-17).`);
  }
  const previous = { id: bale.id, gdn: note.docNo, growerNo: bale.growerNo, group: bale.group, lot: bale.lot, mass: bale.mass };
  bale.ejected = true;
  audit(ctx, {
    action: "receiving.eject-bale",
    entityType: "Bale",
    entityId: bale.id,
    entityRef: scaleBarcode,
    previous,
    next: { ejected: true, deliveryReopened: reopened },
    reason: r.data.reason,
  });
  return { bale, note, reopened, message: formatMessage("BALE_EJECTED") };
}

/** Simulated scale: creates the next weigh event so the demo can capture more bales. No scale is connected. */
export function weighNextBale(ctx: Ctx, input: { mass?: number } = {}) {
  requirePermission(ctx, "receiving.capture-bale");
  const n = nextSeq(ctx.db, "scaleBarcode");
  const scaleBarcode = `${yymmdd(ctx.today)}${padNum(n, 4)}`;
  const mass = input.mass ?? 80 + ((n * 37) % 50);
  const reading = { scaleBarcode, mass, weighedAt: ctx.now, scaleId: "SCALE-1", isDemo: true as const };
  ctx.db.scaleReadings.push(reading);
  return reading;
}

// Re-export for pages
export { AppError };

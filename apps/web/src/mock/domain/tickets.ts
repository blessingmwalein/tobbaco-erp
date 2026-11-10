import {
  checkTicketBarcode,
  formatMessage,
  nextTicketBarcode,
  type Bale,
  type DeliveryNote,
  type MockDb,
  type TicketEvent,
} from "@tobacco/shared";
import { reasonSchema } from "@tobacco/validation";
import { audit, fail, failText, genericId, requirePermission, type Ctx } from "../ctx";
import { activeBales, compareGroupLot, requireActiveSaleDate } from "./receiving";

/**
 * Ticket printing (Manual 04): start barcode → allocate barcodes (group, then lot order) → print → confirm.
 * Confirming locks the barcodes for the season. Start barcodes belong to each user (db.userNextBarcode).
 * No printer is connected: "print" records an audited event only.
 */

/** Bales of a delivery in the order barcodes are allocated: group, then lot. */
export function balesInTicketOrder(db: MockDb, gdnId: string): Bale[] {
  return activeBales(db, gdnId).sort(compareGroupLot);
}

function noteOrFail(db: MockDb, gdnId: string): DeliveryNote {
  return db.deliveryNotes.find((d) => d.id === gdnId) ?? failText("Delivery note not found");
}

function requirePrinting(ctx: Ctx, gdnId: string): DeliveryNote {
  const note = noteOrFail(ctx.db, gdnId);
  if (note.state !== "TICKETS_PRINTING") {
    failText(`Delivery ${note.docNo} is ${note.state === "OPEN" ? "still Open (complete the delivery at receiving first)" : note.state === "CHECKED" ? "already Checked (tickets confirmed)" : "Laid"} — it is not waiting for tickets.`);
  }
  return note;
}

function pushEvent(ctx: Ctx, gdnId: string, kind: TicketEvent["kind"], detail: string) {
  ctx.db.ticketEvents.push({ id: genericId(ctx.db, "tev"), gdnId, kind, at: ctx.now, userId: ctx.actor.id, detail });
}

/** Ticket barcodes already used by OTHER deliveries (season-wide uniqueness). */
function usedByOthers(db: MockDb, gdnId: string): Set<string> {
  const s = new Set<string>();
  for (const b of db.bales) if (!b.ejected && b.ticketBarcode && b.gdnId !== gdnId) s.add(b.ticketBarcode);
  return s;
}

/** Allocate `bales` consecutive barcodes starting at `start`; fails on any overlap. Returns first/last/next. */
function allocateRun(db: MockDb, bales: Bale[], start: string, gdnId: string) {
  const used = usedByOthers(db, gdnId);
  const out: string[] = [];
  let cur = start;
  for (let i = 0; i < bales.length; i++) {
    if (used.has(cur)) fail("BARCODES_ALREADY_USED");
    out.push(cur);
    cur = nextTicketBarcode(cur);
  }
  bales.forEach((b, i) => {
    b.ticketBarcode = out[i];
  });
  return { first: out[0]!, last: out[out.length - 1]!, next: cur, count: out.length };
}

function assertValidBarcode(barcode: string, field: string): string {
  const v = barcode.trim();
  if (!checkTicketBarcode(v).valid) fail("BARCODE_INVALID_TICKET", {}, field);
  return v;
}

function allocationResult(first: string, last: string, count: number) {
  return { first, last, count, message: formatMessage("TICKETS_ALLOCATED", { count, first, last }) };
}

/** Set Starting Barcode: the full 10-character barcode on the first ticket of the roll (9 digits + check character). */
export function setStartBarcode(ctx: Ctx, input: { gdnId: string; startBarcode: string }) {
  requirePermission(ctx, "tickets.allocate");
  const note = requirePrinting(ctx, input.gdnId);
  requireActiveSaleDate(ctx);
  const start = assertValidBarcode(input.startBarcode, "startBarcode");
  const bales = balesInTicketOrder(ctx.db, note.id);
  if (bales.length === 0) failText("This delivery has no bales to allocate barcodes to.");
  const run = allocateRun(ctx.db, bales, start, note.id);
  note.startBarcode = start;
  note.updatedAt = ctx.now;
  ctx.db.userNextBarcode[ctx.actor.id] = run.next;
  pushEvent(ctx, note.id, "ALLOCATE", `Start barcode ${start}: allocated ${run.count} barcodes (${run.first} – ${run.last})`);
  audit(ctx, { action: "tickets.set-start-barcode", entityType: "DeliveryNote", entityId: note.id, entityRef: note.docNo, next: { startBarcode: start, first: run.first, last: run.last, count: run.count } });
  return allocationResult(run.first, run.last, run.count);
}

/** "Use Next Barcode": allocate from the current user's roll. (Named `allocate…` so React's hooks lint rule doesn't mistake it for a hook.) */
export function allocateNextBarcode(ctx: Ctx, input: { gdnId: string }) {
  requirePermission(ctx, "tickets.allocate");
  const note = requirePrinting(ctx, input.gdnId);
  requireActiveSaleDate(ctx);
  const cursor = ctx.db.userNextBarcode[ctx.actor.id];
  if (!cursor) fail("NO_PREVIOUS_BARCODE");
  const bales = balesInTicketOrder(ctx.db, note.id);
  if (bales.length === 0) failText("This delivery has no bales to allocate barcodes to.");
  if (bales.some((b) => b.ticketBarcode)) failText("Barcodes are already allocated for this delivery. Use Set Starting Barcode to allocate again.");
  const run = allocateRun(ctx.db, bales, cursor, note.id);
  note.startBarcode = cursor;
  note.updatedAt = ctx.now;
  ctx.db.userNextBarcode[ctx.actor.id] = run.next;
  pushEvent(ctx, note.id, "ALLOCATE", `Next barcode: allocated ${run.count} barcodes (${run.first} – ${run.last})`);
  audit(ctx, { action: "tickets.use-next-barcode", entityType: "DeliveryNote", entityId: note.id, entityRef: note.docNo, next: { first: run.first, last: run.last, count: run.count } });
  return allocationResult(run.first, run.last, run.count);
}

/** Alias matching the manual's button label. */
export { allocateNextBarcode as useNextBarcode };

/** Print Bale Tickets. No printer is connected — this records the print event. After confirmation a reason is required (reprint). */
export function printTickets(ctx: Ctx, input: { gdnId: string; reason?: string }) {
  requirePermission(ctx, "tickets.print");
  const note = noteOrFail(ctx.db, input.gdnId);
  if (note.state === "OPEN") failText("Complete the delivery at receiving before printing tickets.");
  requireActiveSaleDate(ctx);
  const bales = balesInTicketOrder(ctx.db, note.id);
  const missing = bales.findIndex((b) => !b.ticketBarcode);
  if (missing >= 0) fail("BALE_NO_BARCODE", { line: missing + 1 });
  const reprint = note.state !== "TICKETS_PRINTING";
  if (reprint) {
    const r = reasonSchema.safeParse({ reason: input.reason ?? "" });
    if (!r.success) failText("A reason is required to reprint tickets that were already confirmed.");
  }
  pushEvent(ctx, note.id, reprint ? "REPRINT" : "PRINT", reprint ? `Reprinted ${bales.length} tickets — ${input.reason}` : `Printed ${bales.length} bale tickets`);
  audit(ctx, { action: reprint ? "tickets.reprint" : "tickets.print", entityType: "DeliveryNote", entityId: note.id, entityRef: note.docNo, reason: input.reason, meta: { count: bales.length } });
  return { count: bales.length, reprint };
}

/** Confirm Ticket Printing: bales marked printed, delivery → Checked, next barcode saved, barcodes locked for the season. */
export function confirmTicketPrinting(ctx: Ctx, input: { gdnId: string }) {
  requirePermission(ctx, "tickets.confirm");
  const note = requirePrinting(ctx, input.gdnId);
  requireActiveSaleDate(ctx);
  const bales = balesInTicketOrder(ctx.db, note.id);
  const missing = bales.findIndex((b) => !b.ticketBarcode);
  if (missing >= 0) fail("BALE_NO_BARCODE", { line: missing + 1 });
  for (const b of bales) {
    b.printed = true;
    b.ticketDate = ctx.today;
  }
  note.state = "CHECKED";
  note.ticketsConfirmedAt = ctx.now;
  note.updatedAt = ctx.now;
  // "After you confirm a delivery, your next barcode is saved automatically."
  const last = bales[bales.length - 1]!.ticketBarcode!;
  const next = nextTicketBarcode(last);
  const cur = ctx.db.userNextBarcode[ctx.actor.id];
  const curCheck = cur ? checkTicketBarcode(cur) : undefined;
  const nextCheck = checkTicketBarcode(next);
  if (!curCheck || !curCheck.valid || (nextCheck.valid && nextCheck.base > curCheck.base)) ctx.db.userNextBarcode[ctx.actor.id] = next;
  pushEvent(ctx, note.id, "CONFIRM", "Ticket printing confirmed — barcodes locked for the season");
  audit(ctx, { action: "tickets.confirm", entityType: "DeliveryNote", entityId: note.id, entityRef: note.docNo, previous: { state: "TICKETS_PRINTING" }, next: { state: "CHECKED", first: bales[0]!.ticketBarcode, last } });
  return { note, message: formatMessage("TICKETS_CONFIRMED", { gdn: note.docNo }) };
}

/**
 * Reverse Printing Status (supervisor only): Checked → Tickets Printing.
 * What it does to the allocated barcodes is not documented (UQ-19): barcodes stay allocated to the delivery, tickets are marked unprinted.
 */
export function reverseTicketPrinting(ctx: Ctx, input: { gdnId: string; reason: string }) {
  requirePermission(ctx, "tickets.reverse-printing");
  const r = reasonSchema.safeParse({ reason: input.reason });
  if (!r.success) failText(r.error.issues[0]?.message ?? "A reason is required");
  const note = noteOrFail(ctx.db, input.gdnId);
  if (note.state === "LAID") failText(`Delivery ${note.docNo} is already Laid (floor summary complete); printing status can no longer be reversed.`);
  if (note.state !== "CHECKED") failText(`Only a Checked delivery can be reversed (${note.docNo} is not Checked).`);
  for (const b of activeBales(ctx.db, note.id)) {
    b.printed = false;
    b.ticketDate = undefined;
  }
  note.state = "TICKETS_PRINTING";
  note.ticketsConfirmedAt = undefined;
  note.updatedAt = ctx.now;
  pushEvent(ctx, note.id, "REVERSE", `Printing status reversed — ${r.data.reason}`);
  audit(ctx, { action: "tickets.reverse-printing", entityType: "DeliveryNote", entityId: note.id, entityRef: note.docNo, previous: { state: "CHECKED" }, next: { state: "TICKETS_PRINTING" }, reason: r.data.reason });
  return { note, message: formatMessage("PRINTING_REVERSED", { gdn: note.docNo }) };
}

/**
 * Interrupted Ticket: "the printer jammed or stock ran out part-way. Record the last barcode printed and the new starting barcode."
 * Interpretation (details undocumented, UQ-11): bales after the last printed barcode are re-allocated from the new start barcode.
 */
export function recordInterruptedTicket(ctx: Ctx, input: { gdnId: string; lastPrintedBarcode: string; newStartBarcode: string }) {
  requirePermission(ctx, "tickets.interrupt");
  const note = requirePrinting(ctx, input.gdnId);
  const last = assertValidBarcode(input.lastPrintedBarcode, "lastPrintedBarcode");
  const start = assertValidBarcode(input.newStartBarcode, "newStartBarcode");
  const bales = balesInTicketOrder(ctx.db, note.id);
  const idx = bales.findIndex((b) => b.ticketBarcode === last);
  if (idx < 0) failText(`Barcode ${last} is not one of this delivery's allocated barcodes.`);
  const remaining = bales.slice(idx + 1);
  if (remaining.length === 0) failText("Every ticket on this delivery was already printed — nothing to re-allocate. Confirm ticket printing instead.");
  for (const b of remaining) b.ticketBarcode = undefined;
  const run = allocateRun(ctx.db, remaining, start, note.id);
  ctx.db.userNextBarcode[ctx.actor.id] = run.next;
  note.updatedAt = ctx.now;
  pushEvent(ctx, note.id, "INTERRUPT", `Interrupted after ${last}; ${remaining.length} tickets re-allocated from ${start} (${run.first} – ${run.last})`);
  audit(ctx, { action: "tickets.interrupted", entityType: "DeliveryNote", entityId: note.id, entityRef: note.docNo, next: { lastPrinted: last, newStart: start, reallocated: remaining.length } });
  return { ...allocationResult(run.first, run.last, run.count), lastPrinted: last };
}

/**
 * Split this Sale: the manual lists the button ("the grower's bales are going to more than one sale") but not what it does (UQ-11).
 * Simulated: records an audited note only; no sale is actually split.
 */
export function splitSaleNote(ctx: Ctx, input: { gdnId: string; note: string }) {
  requirePermission(ctx, "tickets.allocate");
  const note = noteOrFail(ctx.db, input.gdnId);
  const text = input.note.trim();
  if (text.length < 3) failText("Describe how the bales are split (at least 3 characters).");
  pushEvent(ctx, note.id, "ALLOCATE", `Split-sale note (simulated, no effect): ${text}`);
  audit(ctx, { action: "tickets.split-sale-note", entityType: "DeliveryNote", entityId: note.id, entityRef: note.docNo, reason: text, meta: { simulated: true } });
  return { recorded: true };
}

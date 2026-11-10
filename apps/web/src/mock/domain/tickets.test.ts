import { describe, expect, it } from "vitest";
import { AppError, buildTicketBarcode } from "@tobacco/shared";
import { ctxFor, dbAt } from "../testing";
import {
  balesInTicketOrder,
  confirmTicketPrinting,
  printTickets,
  recordInterruptedTicket,
  reverseTicketPrinting,
  setStartBarcode,
  splitSaleNote,
  allocateNextBarcode,
} from "./tickets";

function appError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error("Expected an AppError but nothing was thrown");
}

const G60 = "gdn-0000005"; // V100060, 3 bales
const G61 = "gdn-0000004"; // V100061, 2 bales

describe("allocating ticket barcodes", () => {
  it("allocates 1000001013 / 1000001024 / 1000001035 from start 1000001013 in group, lot order", () => {
    const db = dbAt("RECEIVED");
    const ctx = ctxFor(db, "ticket-clerk");
    const r = setStartBarcode(ctx, { gdnId: G60, startBarcode: "1000001013" });
    expect(r).toMatchObject({ first: "1000001013", last: "1000001035", count: 3 });
    expect(r.message).toBe("3 barcodes allocated (1000001013 – 1000001035)");
    expect(balesInTicketOrder(db, G60).map((b) => [b.lot, b.ticketBarcode])).toEqual([
      ["1", "1000001013"],
      ["2", "1000001024"],
      ["3", "1000001035"],
    ]);
    expect(db.deliveryNotes.find((d) => d.id === G60)!.startBarcode).toBe("1000001013");
  });

  it("Use Next Barcode continues the roll: V100061 gets 1000001046 and 1000001057", () => {
    const db = dbAt("RECEIVED");
    const ctx = ctxFor(db, "ticket-clerk");
    setStartBarcode(ctx, { gdnId: G60, startBarcode: "1000001013" });
    const r = allocateNextBarcode(ctx, { gdnId: G61 });
    expect(r).toMatchObject({ first: "1000001046", last: "1000001057", count: 2 });
    expect(db.userNextBarcode["user-ticket-clerk"]).toBe("1000001068");
  });

  it("counts 3 tickets, not 23: the numeric range is not the bale count", () => {
    const db = dbAt("RECEIVED");
    setStartBarcode(ctxFor(db, "ticket-clerk"), { gdnId: G60, startBarcode: "1000001013" });
    const barcodes = balesInTicketOrder(db, G60).map((b) => b.ticketBarcode);
    expect(barcodes).toHaveLength(3);
    expect(Number(barcodes[2]) - Number(barcodes[0])).toBe(22);
  });

  it("rejects invalid barcodes (length, check character) with the verbatim message", () => {
    const db = dbAt("RECEIVED");
    const ctx = ctxFor(db, "ticket-clerk");
    for (const bad of ["100000101", "1000001014", "10000010AB", ""]) {
      const e = appError(() => setStartBarcode(ctx, { gdnId: G60, startBarcode: bad }));
      expect(e.message).toBe("Please enter a valid barcode");
    }
  });

  it("rejects a start barcode that overlaps tickets already allocated this season", () => {
    const db = dbAt("RECEIVED");
    const ctx = ctxFor(db, "ticket-clerk");
    setStartBarcode(ctx, { gdnId: G60, startBarcode: "1000001013" });
    const e = appError(() => setStartBarcode(ctx, { gdnId: G61, startBarcode: "1000001024" }));
    expect(e.message).toBe("Barcodes already used in Tickets");
    // the failed attempt did not allocate anything to V100061
    expect(balesInTicketOrder(db, G61).every((b) => !b.ticketBarcode)).toBe(true);
  });

  it("Use Next Barcode with no previous start barcode", () => {
    const db = dbAt("RECEIVED");
    expect(appError(() => allocateNextBarcode(ctxFor(db, "ticket-clerk"), { gdnId: G60 })).message).toBe("There is no previously set barcode");
  });

  it("start barcodes belong to each user", () => {
    const db = dbAt("RECEIVED");
    setStartBarcode(ctxFor(db, "ticket-clerk"), { gdnId: G60, startBarcode: "1000001013" });
    expect(db.userNextBarcode["user-demo-operator"]).toBeUndefined();
    expect(appError(() => allocateNextBarcode(ctxFor(db, "demo-operator"), { gdnId: G61 })).key).toBe("NO_PREVIOUS_BARCODE");
  });

  it("needs an active, current sale date (Date has expired)", () => {
    const db = dbAt("RECEIVED");
    db.receivingSaleDates.find((d) => d.isActive)!.date = "2026-09-11";
    expect(appError(() => setStartBarcode(ctxFor(db, "ticket-clerk"), { gdnId: G60, startBarcode: "1000001013" })).message).toBe("Date has expired. Please set a valid sale date");
    db.receivingSaleDates.forEach((d) => (d.isActive = false));
    expect(appError(() => setStartBarcode(ctxFor(db, "ticket-clerk"), { gdnId: G60, startBarcode: "1000001013" })).message).toBe("Please set a sale date");
  });
});

describe("confirming ticket printing", () => {
  it("produces the TICKETS_CONFIRMED scenario state for both documented deliveries", () => {
    const db = dbAt("RECEIVED");
    const ctx = ctxFor(db, "ticket-clerk");
    setStartBarcode(ctx, { gdnId: G60, startBarcode: "1000001013" });
    printTickets(ctx, { gdnId: G60 });
    confirmTicketPrinting(ctx, { gdnId: G60 });
    allocateNextBarcode(ctx, { gdnId: G61 });
    printTickets(ctx, { gdnId: G61 });
    const r = confirmTicketPrinting(ctx, { gdnId: G61 });
    expect(r.message).toBe("Ticket printing confirmed — delivery GDN0000004 is now Checked");

    const scenario = dbAt("TICKETS_CONFIRMED");
    for (const id of [G60, G61]) {
      const mine = db.deliveryNotes.find((d) => d.id === id)!;
      const theirs = scenario.deliveryNotes.find((d) => d.id === id)!;
      expect(mine).toMatchObject({ state: "CHECKED", startBarcode: theirs.startBarcode });
      expect(mine.ticketsConfirmedAt).toBeTruthy();
    }
    expect(db.bales.map((b) => [b.scaleBarcode, b.ticketBarcode, b.printed, b.ticketDate])).toEqual(
      scenario.bales.map((b) => [b.scaleBarcode, b.ticketBarcode, b.printed, b.ticketDate]),
    );
    expect(db.userNextBarcode).toEqual(scenario.userNextBarcode);
    expect(db.ticketEvents.filter((e) => e.kind === "CONFIRM")).toHaveLength(2);
  });

  it("refuses to confirm while a bale has no barcode, naming the line", () => {
    const db = dbAt("RECEIVED");
    const e = appError(() => confirmTicketPrinting(ctxFor(db, "ticket-clerk"), { gdnId: G60 }));
    expect(e.message).toBe("Bale has no barcode in line 1");
    expect(db.deliveryNotes.find((d) => d.id === G60)!.state).toBe("TICKETS_PRINTING");
  });

  it("requires tickets.confirm", () => {
    const db = dbAt("RECEIVED");
    setStartBarcode(ctxFor(db, "ticket-clerk"), { gdnId: G60, startBarcode: "1000001013" });
    expect(appError(() => confirmTicketPrinting(ctxFor(db, "floor-summary-clerk"), { gdnId: G60 })).key).toBe("PERMISSION_DENIED");
  });

  it("once confirmed the allocation is locked: re-setting the start barcode is refused", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    expect(() => setStartBarcode(ctxFor(db, "ticket-clerk"), { gdnId: G60, startBarcode: "1000001013" })).toThrow(/already Checked/);
  });
});

describe("reprint, reverse, interrupted ticket, split sale", () => {
  it("reprinting a confirmed delivery needs a reason and is audited as a reprint", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    const ctx = ctxFor(db, "ticket-clerk");
    expect(() => printTickets(ctx, { gdnId: G60 })).toThrow(/reason/);
    const r = printTickets(ctx, { gdnId: G60, reason: "Tickets damaged on the floor" });
    expect(r.reprint).toBe(true);
    expect(db.ticketEvents.at(-1)).toMatchObject({ kind: "REPRINT", gdnId: G60 });
  });

  it("only a supervisor can reverse; barcodes stay allocated (UQ-19)", () => {
    const db = dbAt("TICKETS_CONFIRMED");
    expect(appError(() => reverseTicketPrinting(ctxFor(db, "ticket-clerk"), { gdnId: G60, reason: "Wrong roll used" })).key).toBe("PERMISSION_DENIED");
    expect(() => reverseTicketPrinting(ctxFor(db, "receiving-supervisor"), { gdnId: G60, reason: "x" })).toThrow(/reason/i);
    const r = reverseTicketPrinting(ctxFor(db, "receiving-supervisor"), { gdnId: G60, reason: "Wrong roll used" });
    expect(r.note.state).toBe("TICKETS_PRINTING");
    const bales = balesInTicketOrder(db, G60);
    expect(bales.map((b) => b.ticketBarcode)).toEqual(["1000001013", "1000001024", "1000001035"]);
    expect(bales.every((b) => !b.printed)).toBe(true);
    expect(db.audit[0]).toMatchObject({ action: "tickets.reverse-printing", reason: "Wrong roll used" });
  });

  it("cannot reverse a delivery that is already Laid", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    expect(() => reverseTicketPrinting(ctxFor(db, "receiving-supervisor"), { gdnId: G60, reason: "Too late now" })).toThrow(/already Laid/);
  });

  it("interrupted ticket: re-allocates the bales after the last printed barcode from the new start", () => {
    const db = dbAt("RECEIVED");
    const ctx = ctxFor(db, "ticket-clerk");
    setStartBarcode(ctx, { gdnId: G60, startBarcode: "1000001013" });
    const newStart = buildTicketBarcode(100000110);
    const r = recordInterruptedTicket(ctx, { gdnId: G60, lastPrintedBarcode: "1000001024", newStartBarcode: newStart });
    expect(r.count).toBe(1);
    expect(balesInTicketOrder(db, G60).map((b) => b.ticketBarcode)).toEqual(["1000001013", "1000001024", newStart]);
    expect(db.userNextBarcode["user-ticket-clerk"]).toBe(buildTicketBarcode(100000111));
    expect(() => recordInterruptedTicket(ctx, { gdnId: G60, lastPrintedBarcode: "1000009999", newStartBarcode: newStart })).toThrow();
  });

  it("split this sale only records a simulated note", () => {
    const db = dbAt("RECEIVED");
    const before = structuredClone(db.bales);
    expect(splitSaleNote(ctxFor(db, "ticket-clerk"), { gdnId: G60, note: "Two bales to a second sale" })).toEqual({ recorded: true });
    expect(db.bales).toEqual(before);
    expect(db.audit[0]).toMatchObject({ action: "tickets.split-sale-note", meta: { simulated: true } });
  });
});

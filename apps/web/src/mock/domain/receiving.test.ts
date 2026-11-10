import { describe, expect, it } from "vitest";
import { AppError, type MockDb } from "@tobacco/shared";
import { ctxFor, dbAt } from "../testing";
import {
  addGrowerToNote,
  captureBale,
  completeGrowerDelivery,
  completeTransporterNote,
  createTransporterNote,
  deliveryTally,
  ejectBale,
  removeGrowerFromNote,
  updateTransporterDetails,
  weighNextBale,
} from "./receiving";

function appError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error("Expected an AppError but nothing was thrown");
}

/** The documented truck: Tendai Moyo, AEX 1234, V100060 ×3 and V100061 ×2 at location A. */
function documentedTruck(db: MockDb) {
  const ctx = ctxFor(db, "receiving-clerk");
  const note = createTransporterNote(ctx, { transporterName: "Tendai Moyo", idNumber: "63-123456-A-42", vehicleReg: "AEX 1234", phone: "0772123456" });
  addGrowerToNote(ctx, { noteId: note.id, growerNo: "V100060", location: "A", bales: 3 });
  addGrowerToNote(ctx, { noteId: note.id, growerNo: "V100061", location: "A", bales: 2 });
  return { ctx, note };
}

describe("transporter delivery note", () => {
  it("creates TDN0000002 with the vehicle registration's spaces removed", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const { note } = documentedTruck(db);
    expect(note.docNo).toBe("TDN0000002");
    expect(note.vehicleReg).toBe("AEX1234");
    expect(note.state).toBe("OPEN");
    expect(note.growers.map((g) => [g.growerNo, g.bales, g.saleDay, g.saleMonth])).toEqual([
      ["V100060", 3, 17, 9],
      ["V100061", 2, 17, 9],
    ]);
  });

  it("numbers the grower delivery notes in reverse order of adding (V100061 → GDN0000004, V100060 → GDN0000005)", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const { ctx, note } = documentedTruck(db);
    const { gdns } = completeTransporterNote(ctx, { noteId: note.id });
    expect(note.state).toBe("COMPLETED");
    expect(gdns.map((g) => g.docNo)).toEqual(["GDN0000004", "GDN0000005"]);
    expect(note.growers.find((g) => g.growerNo === "V100060")?.gdnId).toBe("gdn-0000005");
    expect(note.growers.find((g) => g.growerNo === "V100061")?.gdnId).toBe("gdn-0000004");
    expect(db.deliveryNotes.find((d) => d.docNo === "GDN0000005")).toMatchObject({ growerNo: "V100060", balesDeclared: 3, state: "OPEN", sellingDate: "2026-09-17" });
  });

  it("matches the RECEIVED scenario for ids and growers", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const { ctx, note } = documentedTruck(db);
    completeTransporterNote(ctx, { noteId: note.id });
    const scenario = dbAt("RECEIVED");
    for (const id of ["gdn-0000004", "gdn-0000005"]) {
      const mine = db.deliveryNotes.find((d) => d.id === id)!;
      const theirs = scenario.deliveryNotes.find((d) => d.id === id)!;
      expect(mine).toMatchObject({ docNo: theirs.docNo, growerNo: theirs.growerNo, balesDeclared: theirs.balesDeclared, state: "OPEN", sellingDate: theirs.sellingDate });
    }
    expect(db.meta.seq.gdn).toBe(scenario.meta.seq.gdn);
    expect(db.meta.seq.tdn).toBe(scenario.meta.seq.tdn);
  });

  it("rejects an unknown grower with the verbatim message", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = ctxFor(db, "receiving-clerk");
    const note = createTransporterNote(ctx, { transporterName: "Tendai Moyo", idNumber: "63-123456-A-42", vehicleReg: "AEX1234", phone: "0772123456" });
    const e = appError(() => addGrowerToNote(ctx, { noteId: note.id, growerNo: "V999999", location: "A", bales: 2 }));
    expect(e.key).toBe("GROWER_INVALID");
    expect(e.message).toBe("Please check format and validity of grower number");
  });

  it("needs an active receiving sale date", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "receiving-clerk");
    const note = createTransporterNote(ctx, { transporterName: "T", idNumber: "63-1", vehicleReg: "AEX1234", phone: "0772123456" });
    expect(appError(() => addGrowerToNote(ctx, { noteId: note.id, growerNo: "V100060", location: "A", bales: 3 })).key).toBe("SALE_DATE_MISSING");
    db.receivingSaleDates[0]!.isActive = true; // 11 Sep, in the past
    expect(appError(() => addGrowerToNote(ctx, { noteId: note.id, growerNo: "V100060", location: "A", bales: 3 })).key).toBe("SALE_DATE_EXPIRED");
  });

  it("warns (or blocks, per setting) when declared bales exceed the booking", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = ctxFor(db, "receiving-clerk");
    const note = createTransporterNote(ctx, { transporterName: "T", idNumber: "63-1", vehicleReg: "AEX1234", phone: "0772123456" });
    const r = addGrowerToNote(ctx, { noteId: note.id, growerNo: "V100060", location: "A", bales: 5 });
    expect(r.warning).toContain("declared 5 bales but booked 3");
    db.settings.unbookedPolicy = "BLOCK";
    expect(appError(() => addGrowerToNote(ctx, { noteId: note.id, growerNo: "V100061", location: "A", bales: 9 })).key).toBe("BOOKING_MISMATCH");
  });

  it("removes a grower line, edits details while Open, refuses to edit once completed", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const { ctx, note } = documentedTruck(db);
    removeGrowerFromNote(ctx, { noteId: note.id, index: 1 });
    expect(note.growers).toHaveLength(1);
    updateTransporterDetails(ctx, { noteId: note.id, transporterName: "Tendai Moyo", idNumber: "63-123456-A-42", vehicleReg: "aex 9999", phone: "0772123456" });
    expect(note.vehicleReg).toBe("AEX9999");
    completeTransporterNote(ctx, { noteId: note.id });
    expect(() => updateTransporterDetails(ctx, { noteId: note.id, transporterName: "X", idNumber: "1", vehicleReg: "A", phone: "0772123456" })).toThrow(/Open transporter/);
  });

  it("will not complete an empty note and respects permissions", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = ctxFor(db, "receiving-clerk");
    const note = createTransporterNote(ctx, { transporterName: "T", idNumber: "63-1", vehicleReg: "AEX1234", phone: "0772123456" });
    expect(() => completeTransporterNote(ctx, { noteId: note.id })).toThrow(/at least one grower/);
    expect(appError(() => createTransporterNote(ctxFor(db, "ticket-clerk"), { transporterName: "T", idNumber: "63-1", vehicleReg: "AEX1234", phone: "0772123456" })).key).toBe("PERMISSION_DENIED");
  });
});

function openDeliveries(db: MockDb) {
  const { ctx, note } = documentedTruck(db);
  completeTransporterNote(ctx, { noteId: note.id });
  return ctx;
}

describe("bale capture", () => {
  it("captures the three documented scale barcodes: tally 3 of 3, Delivery Balanced", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = openDeliveries(db);
    const lots = ["1", "2", "3"];
    const results = ["2609170001", "2609170002", "2609170003"].map((scaleBarcode, i) => captureBale(ctx, { scaleBarcode, growerNo: "V100060", group: 1, lot: lots[i]! }));
    expect(results.map((r) => [r.captured, r.declared, r.balanced])).toEqual([[1, 3, false], [2, 3, false], [3, 3, true]]);
    expect(results[0]!.message).toBe("Bale added");
    expect(results.map((r) => r.bale.mass)).toEqual([112, 98, 105]); // mass comes from the scale readings
    expect(db.bales).toHaveLength(3);
  });

  it("accepts the grower number typed as digits after the fixed V", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = openDeliveries(db);
    const r = captureBale(ctx, { scaleBarcode: "2609170001", growerNo: "100060", group: 1, lot: "1" });
    expect(r.bale.growerNo).toBe("V100060");
  });

  it("applies the manual's validations in order with verbatim messages", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = openDeliveries(db);
    const cap = (over: Partial<Parameters<typeof captureBale>[1]>) => captureBale(ctx, { scaleBarcode: "2609170001", growerNo: "V100060", group: 1, lot: "1", ...over });
    expect(appError(() => cap({ scaleBarcode: "123" })).message).toBe("Please check barcode");
    expect(appError(() => cap({ growerNo: "V999999" })).message).toBe("Please check format and validity of grower number");
    expect(appError(() => cap({ growerNo: "V100043" })).message).toBe("The grower number does not have any pending delivery note");
    expect(appError(() => cap({ scaleBarcode: "2609179999" })).key).toBe("SCALE_READING_MISSING");
    expect(appError(() => cap({ group: 0 })).key).toBe("GROUP_INVALID");
    expect(appError(() => cap({ lot: "/3" })).message).toBe("Please enter a valid lot number");
    expect(appError(() => cap({ lot: "3a" })).message).toBe("Please enter a valid lot number");
    expect(db.bales).toHaveLength(0); // nothing was saved by any failed attempt
    expect(() => cap({ lot: "12/3" })).not.toThrow();
  });

  it("refuses a duplicate scale barcode, and a barcode already on a closed delivery", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = openDeliveries(db);
    captureBale(ctx, { scaleBarcode: "2609170001", growerNo: "V100060", group: 1, lot: "1" });
    expect(appError(() => captureBale(ctx, { scaleBarcode: "2609170001", growerNo: "V100061", group: 1, lot: "1" })).key).toBe("BALE_ALREADY_CAPTURED");
    captureBale(ctx, { scaleBarcode: "2609170002", growerNo: "V100060", group: 1, lot: "2" });
    captureBale(ctx, { scaleBarcode: "2609170003", growerNo: "V100060", group: 1, lot: "3" });
    completeGrowerDelivery(ctx, { growerNo: "V100060" });
    const e = appError(() => captureBale(ctx, { scaleBarcode: "2609170001", growerNo: "V100061", group: 1, lot: "1" }));
    expect(e.message).toBe("Bale is already associated with a Closed Document");
    // and V100060 no longer has a pending delivery
    expect(appError(() => captureBale(ctx, { scaleBarcode: "2609170004", growerNo: "V100060", group: 1, lot: "4" })).key).toBe("NO_PENDING_DELIVERY");
  });
});

describe("completing a grower's delivery", () => {
  it("closes GDN0000005 once the tally balances and moves it to Tickets Printing", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = openDeliveries(db);
    ["2609170001", "2609170002", "2609170003"].forEach((s, i) => captureBale(ctx, { scaleBarcode: s, growerNo: "V100060", group: 1, lot: String(i + 1) }));
    const r = completeGrowerDelivery(ctx, { growerNo: "V100060" });
    expect(r.message).toBe("Delivery Document #GDN0000005 for grower V100060 is closed");
    expect(r.note).toMatchObject({ state: "TICKETS_PRINTING", lotHighest: 3, lotLowest: 1 });
    expect(r.note.deliveryClosedAt).toBeTruthy();
    // same shape as the RECEIVED scenario
    const scenario = dbAt("RECEIVED").deliveryNotes.find((d) => d.id === "gdn-0000005")!;
    expect(r.note).toMatchObject({ state: scenario.state, lotHighest: scenario.lotHighest, lotLowest: scenario.lotLowest });
  });

  it("rejects a short or over-captured tally", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = openDeliveries(db);
    captureBale(ctx, { scaleBarcode: "2609170001", growerNo: "V100060", group: 1, lot: "1" });
    captureBale(ctx, { scaleBarcode: "2609170002", growerNo: "V100060", group: 1, lot: "2" });
    expect(appError(() => completeGrowerDelivery(ctx, { growerNo: "V100060" })).key).toBe("TALLY_LESS");
    captureBale(ctx, { scaleBarcode: "2609170003", growerNo: "V100060", group: 1, lot: "3" });
    const extra = weighNextBale(ctx);
    expect(extra.scaleBarcode).toBe("2609170006");
    captureBale(ctx, { scaleBarcode: extra.scaleBarcode, growerNo: "V100060", group: 1, lot: "4" });
    expect(appError(() => completeGrowerDelivery(ctx, { growerNo: "V100060" })).key).toBe("TALLY_GREATER");
  });

  it("rejects a repeated group and lot, naming the line", () => {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = openDeliveries(db);
    captureBale(ctx, { scaleBarcode: "2609170001", growerNo: "V100060", group: 1, lot: "1" });
    captureBale(ctx, { scaleBarcode: "2609170002", growerNo: "V100060", group: 1, lot: "1" });
    captureBale(ctx, { scaleBarcode: "2609170003", growerNo: "V100060", group: 1, lot: "3" });
    const e = appError(() => completeGrowerDelivery(ctx, { growerNo: "V100060" }));
    expect(e.message).toBe("Repeated Group & Lot Number Combination in line 2");
    expect(db.deliveryNotes.find((d) => d.id === "gdn-0000005")!.state).toBe("OPEN");
  });
});

describe("eject bale (supervisor)", () => {
  function withCapturedBale() {
    const db = dbAt("BOOKINGS_IMPORTED");
    const ctx = openDeliveries(db);
    captureBale(ctx, { scaleBarcode: "2609170001", growerNo: "V100060", group: 1, lot: "1" });
    return db;
  }

  it("needs the permission and a reason; audits; lets the bale be captured again", () => {
    const db = withCapturedBale();
    expect(appError(() => ejectBale(ctxFor(db, "ticket-clerk"), { scaleBarcode: "2609170001", reason: "Captured on the wrong grower" })).key).toBe("PERMISSION_DENIED");
    expect(appError(() => ejectBale(ctxFor(db, "receiving-clerk"), { scaleBarcode: "2609170001", reason: "Captured on the wrong grower" })).key).toBe("PERMISSION_DENIED");
    const sup = ctxFor(db, "receiving-supervisor");
    expect(() => ejectBale(sup, { scaleBarcode: "2609170001", reason: "x" })).toThrow(/reason/i);
    const r = ejectBale(sup, { scaleBarcode: "2609170001", reason: "Captured on the wrong grower" });
    expect(r.bale.ejected).toBe(true);
    const entry = db.audit[0]!;
    expect(entry).toMatchObject({ action: "receiving.eject-bale", entityRef: "2609170001", reason: "Captured on the wrong grower", userName: "Tariro Mutasa" });
    // recapture on the right grower now works (new bale row, ejected row kept as history)
    const again = captureBale(ctxFor(db, "receiving-clerk"), { scaleBarcode: "2609170001", growerNo: "V100061", group: 1, lot: "1" });
    expect(again.gdnDocNo).toBe("GDN0000004");
    expect(db.bales.filter((b) => b.scaleBarcode === "2609170001")).toHaveLength(2);
    expect(deliveryTally(db, db.deliveryNotes.find((d) => d.id === "gdn-0000005")!).captured).toBe(0);
  });

  it("reopens a closed (Tickets Printing) delivery that has no barcodes yet, but not one with barcodes", () => {
    const db = dbAt("RECEIVED");
    const sup = ctxFor(db, "receiving-supervisor");
    const r = ejectBale(sup, { scaleBarcode: "2609170001", reason: "Wrong bale" });
    expect(r.reopened).toBe(true);
    expect(db.deliveryNotes.find((d) => d.id === "gdn-0000005")!.state).toBe("OPEN");
    const checked = dbAt("TICKETS_CONFIRMED");
    expect(() => ejectBale(ctxFor(checked, "receiving-supervisor"), { scaleBarcode: "2609170001", reason: "Wrong bale" })).toThrow(/Reverse printing/);
  });
});

describe("simulated scale", () => {
  it("creates the next weigh event with a YYMMDD+4 barcode and a plausible mass", () => {
    const db = dbAt("FRESH");
    const r = weighNextBale(ctxFor(db, "receiving-clerk"));
    expect(r.scaleBarcode).toBe("2609170006");
    expect(r.mass).toBeGreaterThanOrEqual(80);
    expect(r.mass).toBeLessThan(130);
    expect(db.scaleReadings.some((x) => x.scaleBarcode === r.scaleBarcode)).toBe(true);
  });
});

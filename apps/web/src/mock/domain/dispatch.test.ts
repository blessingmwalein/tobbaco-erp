import { describe, expect, it } from "vitest";
import { DOCUMENTED } from "@tobacco/shared/fixtures";
import type { MockDb } from "@tobacco/shared";
import { attempt, ctxFor, dbAt } from "../testing";
import {
  SHIPMENT_FILE_COLUMNS,
  cancelDispatch,
  deleteDispatch,
  finishLoading,
  generateShipmentFile,
  initiateDispatch,
  postDispatch,
  removeDispatchBale,
  resetDispatchToDraft,
  scanDispatchBale,
  selectDispatchCandidates,
  selectDispatchHub,
  selectWarehouseOverview,
} from "./dispatch";

const TICKETS = [...DOCUMENTED.ticketBarcodes.V100060, ...DOCUMENTED.ticketBarcodes.V100061];
const base = { product: "GREEN" as const, noTransportDetails: false, transportName: "Zim Haulage", truckReg: "ZAB 1234", driver: "Moses Phiri", driverNationalId: "63-111111-A-11", driverCell: "0771111111" };

function newNote(db: MockDb, warehouseCode = "CURVERID", roleId = "dispatch-clerk") {
  return initiateDispatch(ctxFor(db, roleId), { ...base, warehouseCode });
}

describe("initiateDispatch", () => {
  it("creates a draft note with an FLDN reference", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    expect(note.ref).toBe("FLDN/2026/09/0001");
    expect(note.state).toBe("DRAFT");
    expect(note.warehouseCode).toBe("CURVERID");
    expect(note.totalBales).toBe(0);
    expect(newNote(db).ref).toBe("FLDN/2026/09/0002");
    expect(db.audit[0]?.action).toBe("dispatch.create");
  });

  it("requires transport details unless 'No Transportation Details' is ticked", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const ctx = ctxFor(db, "dispatch-clerk");
    expect(() => initiateDispatch(ctx, { ...base, warehouseCode: "CURVERID", transportName: "", truckReg: "" })).toThrow(/required/);
    const ok = initiateDispatch(ctx, { warehouseCode: "CURVERID", product: "GREEN", noTransportDetails: true });
    expect(ok.noTransportDetails).toBe(true);
    expect(ok.truckReg).toBeUndefined();
  });

  it("rejects an unknown destination warehouse and users without dispatch.create", () => {
    const db = dbAt("READY_TO_DISPATCH");
    expect(() => initiateDispatch(ctxFor(db, "dispatch-clerk"), { ...base, warehouseCode: "NOPE" })).toThrow(/Destination warehouse/);
    expect(() => initiateDispatch(ctxFor(db, "receiving-clerk"), { ...base, warehouseCode: "CURVERID" })).toThrow(/permission/i);
  });
});

describe("scanDispatchBale", () => {
  it("accepts the five released JM tickets for CURVERID and totals bales and mass", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    const ctx = ctxFor(db, "dispatch-clerk");
    for (const t of TICKETS) scanDispatchBale(ctx, { dispatchId: note.id, barcode: t });
    expect(note.totalBales).toBe(5);
    expect(note.totalMass).toBe(112 + 98 + 105 + 101 + 96);
    expect(db.bales.filter((b) => b.dispatchNoteId === note.id)).toHaveLength(5);
  });

  it("refuses an unknown barcode", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    expect(() => scanDispatchBale(ctxFor(db, "dispatch-clerk"), { dispatchId: note.id, barcode: "1000009999" })).toThrow("Cannot find the bale: 1000009999");
  });

  it("refuses a bale whose sale has not been released", () => {
    const db = dbAt("PROCESSED"); // processed but not released
    const note = newNote(db);
    expect(() => scanDispatchBale(ctxFor(db, "dispatch-clerk"), { dispatchId: note.id, barcode: "1000001013" })).toThrow(
      "Bale '1000001013' cannot be dispatched: its sale has not been released yet.",
    );
  });

  it("refuses a bale whose buyer packs at a different warehouse", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db, "DEMOWH2");
    expect(() => scanDispatchBale(ctxFor(db, "dispatch-clerk"), { dispatchId: note.id, barcode: "1000001013" })).toThrow(/wrong warehouse — its buyer packs at CURVERID/);
  });

  it("refuses rejected sale codes RO, RH and CO", () => {
    for (const code of DOCUMENTED.rejectedSaleCodes) {
      const db = dbAt("READY_TO_DISPATCH");
      db.bales.find((b) => b.ticketBarcode === "1000001013")!.saleCode = code;
      const note = newNote(db);
      expect(() => scanDispatchBale(ctxFor(db, "dispatch-clerk"), { dispatchId: note.id, barcode: "1000001013" })).toThrow(new RegExp(`rejected sale code \\(${code}\\)`));
    }
  });

  it("never dispatches a bale twice — not on another note and not on the same note", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const a = newNote(db);
    const b = newNote(db);
    const ctx = ctxFor(db, "dispatch-clerk");
    scanDispatchBale(ctx, { dispatchId: a.id, barcode: "1000001013" });
    expect(() => scanDispatchBale(ctx, { dispatchId: b.id, barcode: "1000001013" })).toThrow(/already on dispatch note FLDN\/2026\/09\/0001/);
    expect(() => scanDispatchBale(ctx, { dispatchId: a.id, barcode: "1000001013" })).toThrow(/already on dispatch note/);
    expect(a.totalBales).toBe(1);
  });

  it("needs dispatch.scan and a draft note", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    expect(() => scanDispatchBale(ctxFor(db, "accounts"), { dispatchId: note.id, barcode: "1000001013" })).toThrow(/permission/i);
    const ctx = ctxFor(db, "dispatch-clerk");
    scanDispatchBale(ctx, { dispatchId: note.id, barcode: "1000001013" });
    postDispatch(ctx, { dispatchId: note.id, confirmWithoutDone: true });
    expect(() => scanDispatchBale(ctx, { dispatchId: note.id, barcode: "1000001024" })).toThrow(/draft dispatch note/);
  });

  it("is atomic: a refused scan changes nothing", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    const before = structuredClone(db);
    expect(() => attempt(db, "dispatch-clerk", (ctx) => scanDispatchBale(ctx, { dispatchId: note.id, barcode: "1000009999" }))).toThrow();
    expect(db).toEqual(before);
  });
});

describe("removeDispatchBale / finishLoading / postDispatch", () => {
  function loaded() {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    const ctx = ctxFor(db, "dispatch-clerk");
    for (const t of TICKETS) scanDispatchBale(ctx, { dispatchId: note.id, barcode: t });
    return { db, note, ctx };
  }

  it("removes a bale on a draft note and frees it", () => {
    const { db, note, ctx } = loaded();
    const bale = db.bales.find((b) => b.ticketBarcode === "1000001013")!;
    removeDispatchBale(ctx, { dispatchId: note.id, baleId: bale.id });
    expect(note.totalBales).toBe(4);
    expect(note.totalMass).toBe(400);
    expect(bale.dispatchNoteId).toBeUndefined();
    // …and it can be scanned again
    scanDispatchBale(ctx, { dispatchId: note.id, barcode: "1000001013" });
    expect(note.totalBales).toBe(5);
  });

  it("refuses removal on a posted note with the documented message", () => {
    const { db, note, ctx } = loaded();
    finishLoading(ctx, { dispatchId: note.id });
    postDispatch(ctx, { dispatchId: note.id });
    const bale = db.bales.find((b) => b.ticketBarcode === "1000001013")!;
    expect(() => removeDispatchBale(ctx, { dispatchId: note.id, baleId: bale.id })).toThrow("You can only remove bales from a draft dispatch note.");
  });

  it("needs bales and 'Done' (or explicit confirmation) to post", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const empty = newNote(db);
    const ctx = ctxFor(db, "dispatch-clerk");
    expect(() => postDispatch(ctx, { dispatchId: empty.id })).toThrow(/at least one bale/);
    expect(() => finishLoading(ctx, { dispatchId: empty.id })).toThrow(/at least one bale/);
    const { db: db2, note, ctx: ctx2 } = loaded();
    expect(() => postDispatch(ctx2, { dispatchId: note.id })).toThrow(/Click Done/);
    finishLoading(ctx2, { dispatchId: note.id });
    const posted = postDispatch(ctx2, { dispatchId: note.id });
    expect(posted.state).toBe("POSTED");
    expect(posted.dispatchDate).toBe("2026-09-17");
    expect(posted.postedBy).toBe("user-dispatch-clerk");
    expect(db2.audit.some((a) => a.action === "dispatch.post" && a.entityId === note.id)).toBe(true);
  });

  it("changing the load after 'Done' requires Done again", () => {
    const { db, note, ctx } = loaded();
    finishLoading(ctx, { dispatchId: note.id });
    expect(note.loadingDoneAt).toBeTruthy();
    const bale = db.bales.find((b) => b.ticketBarcode === "1000001057")!;
    removeDispatchBale(ctx, { dispatchId: note.id, baleId: bale.id });
    expect(note.loadingDoneAt).toBeUndefined();
    expect(() => postDispatch(ctx, { dispatchId: note.id })).toThrow(/Click Done/);
  });

  it("re-validates at post time (a sale un-released after scanning blocks posting)", () => {
    const { db, note, ctx } = loaded();
    finishLoading(ctx, { dispatchId: note.id });
    db.sales.find((s) => s.refNo === 4)!.released = false;
    expect(() => postDispatch(ctx, { dispatchId: note.id })).toThrow(/not valid.*not been released/);
  });
});

describe("cancelDispatch / deleteDispatch / resetDispatchToDraft", () => {
  it("cancels a draft with a reason, frees the bales and keeps the note", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    const clerk = ctxFor(db, "dispatch-clerk");
    scanDispatchBale(clerk, { dispatchId: note.id, barcode: "1000001013" });
    expect(() => cancelDispatch(clerk, { dispatchId: note.id, reason: "Wrong truck" })).toThrow(/permission/i);
    const sup = ctxFor(db, "dispatch-supervisor");
    expect(() => cancelDispatch(sup, { dispatchId: note.id, reason: "" })).toThrow(/reason/i);
    cancelDispatch(sup, { dispatchId: note.id, reason: "Wrong truck" });
    expect(note.state).toBe("CANCELLED");
    expect(note.cancelReason).toBe("Wrong truck");
    expect(db.bales.find((b) => b.ticketBarcode === "1000001013")!.dispatchNoteId).toBeUndefined();
    expect(db.dispatchNotes).toContain(note);
    expect(db.audit[0]).toMatchObject({ action: "dispatch.cancel", reason: "Wrong truck" });
    // freed bales can go on another note
    const next = newNote(db);
    scanDispatchBale(clerk, { dispatchId: next.id, barcode: "1000001013" });
    expect(next.totalBales).toBe(1);
  });

  it("cannot cancel a posted note", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    const clerk = ctxFor(db, "dispatch-clerk");
    scanDispatchBale(clerk, { dispatchId: note.id, barcode: "1000001013" });
    postDispatch(clerk, { dispatchId: note.id, confirmWithoutDone: true });
    expect(() => cancelDispatch(ctxFor(db, "dispatch-supervisor"), { dispatchId: note.id, reason: "Changed mind" })).toThrow(/draft dispatch note/);
  });

  it("never deletes: the verbatim documented message", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    expect(() => deleteDispatch(ctxFor(db, "dispatch-supervisor"), { dispatchId: note.id })).toThrow("You cannot delete dispatch notes. Please cancel them instead.");
    expect(db.dispatchNotes).toContain(note);
  });

  it("supervisor resets a posted note to draft (with a reason) unless a shipment file exists", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    const clerk = ctxFor(db, "dispatch-clerk");
    scanDispatchBale(clerk, { dispatchId: note.id, barcode: "1000001013" });
    expect(() => resetDispatchToDraft(ctxFor(db, "dispatch-supervisor"), { dispatchId: note.id, reason: "x ok" })).toThrow(/posted/);
    postDispatch(clerk, { dispatchId: note.id, confirmWithoutDone: true });
    expect(() => resetDispatchToDraft(clerk, { dispatchId: note.id, reason: "Load error" })).toThrow(/permission/i);
    const sup = ctxFor(db, "dispatch-supervisor");
    expect(() => resetDispatchToDraft(sup, { dispatchId: note.id, reason: "" })).toThrow(/reason/i);
    resetDispatchToDraft(sup, { dispatchId: note.id, reason: "Load error" });
    expect(note.state).toBe("DRAFT");
    expect(note.postedAt).toBeUndefined();
    // post again, generate the file, now reset is blocked
    postDispatch(clerk, { dispatchId: note.id, confirmWithoutDone: true });
    generateShipmentFile(sup, { dispatchId: note.id });
    expect(() => resetDispatchToDraft(sup, { dispatchId: note.id, reason: "Too late" })).toThrow(/shipment file was already generated/);
  });
});

describe("generateShipmentFile", () => {
  it("requires a Posted note (documented message)", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    expect(() => generateShipmentFile(ctxFor(db, "dispatch-supervisor"), { dispatchId: note.id })).toThrow(
      "The dispatch note must be in Posted state to generate a shipment file.",
    );
  });

  it("produces a flagged demo-format CSV and keeps history on regeneration", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const note = newNote(db);
    const clerk = ctxFor(db, "dispatch-clerk");
    for (const t of TICKETS) scanDispatchBale(clerk, { dispatchId: note.id, barcode: t });
    postDispatch(clerk, { dispatchId: note.id, confirmWithoutDone: true });
    expect(() => generateShipmentFile(clerk, { dispatchId: note.id })).toThrow(/permission/i); // clerk lacks dispatch.generate-shipment-file
    const sup = ctxFor(db, "dispatch-supervisor");
    const first = generateShipmentFile(sup, { dispatchId: note.id });
    expect(first.filename).toBe("FLDN_2026_09_0001.csv");
    expect(first.isMockFormat).toBe(true);
    expect(first.rowCount).toBe(5);
    const lines = first.csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe(SHIPMENT_FILE_COLUMNS.join(","));
    expect(lines).toHaveLength(6);
    expect(lines[1]).toContain("1000001013");
    expect(lines[1]).toContain("CURVERID");
    const second = generateShipmentFile(sup, { dispatchId: note.id });
    expect(second.filename).toBe("FLDN_2026_09_0001_v2.csv");
    expect(db.shipmentExports.filter((s) => s.dispatchNoteId === note.id)).toHaveLength(2);
  });
});

describe("selectors", () => {
  it("classifies candidates per destination", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const good = newNote(db, "CURVERID");
    const bad = newNote(db, "DEMOWH2");
    expect(selectDispatchCandidates(db, good).filter((c) => c.ok)).toHaveLength(5);
    const refused = selectDispatchCandidates(db, bad);
    expect(refused.every((c) => !c.ok)).toBe(true);
    expect(refused[0]?.reason).toMatch(/wrong warehouse/);
  });

  it("summarises warehouses and the hub", () => {
    const db = dbAt("READY_TO_DISPATCH");
    const overview = selectWarehouseOverview(db);
    expect(overview.find((o) => o.warehouse.code === "CURVERID")).toMatchObject({ readyBales: 5, readyMassKg: 512 });
    expect(selectDispatchHub(db).unreleasedBales).toBe(0);
    expect(selectDispatchHub(dbAt("PROCESSED")).unreleasedBales).toBe(5);
  });
});

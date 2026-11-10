import { describe, expect, it } from "vitest";
import { ctxFor, dbAt } from "../testing";
import { lookupBale, saveAllDetails, saveBuying, saveClassification, selectCaptureQueue } from "./data-capture";

const clerk = (db: ReturnType<typeof dbAt>) => ctxFor(db, "data-clerk");
const bale = (db: ReturnType<typeof dbAt>, ticket: string) => db.bales.find((b) => b.ticketBarcode === ticket)!;

describe("lookupBale", () => {
  it("identifies the bale: grower, mass, SEQ, group, lot, sale date, bales in sale", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const v = lookupBale(clerk(db), { barcode: "1000001024" });
    expect(v).toMatchObject({ growerNo: "V100060", mass: 98, seq: 2, group: 1, lot: "2", saleDate: "2026-09-17", balesInSale: 3, saleRefNo: 4 });
  });

  it("unknown barcode", () => {
    expect(() => lookupBale(clerk(dbAt("FLOOR_SUMMARY_DONE")), { barcode: "1234567890" })).toThrow("Cannot find the bale: 1234567890");
  });

  it("no draft sale yet (floor summary incomplete)", () => {
    expect(() => lookupBale(clerk(dbAt("TICKETS_CONFIRMED")), { barcode: "1000001013" })).toThrow("The state of this barcode does not allow Data Capturing: 1000001013");
  });

  it("sale already balanced or processed", () => {
    expect(() => lookupBale(clerk(dbAt("BALANCED")), { barcode: "1000001013" })).toThrow("Barcode already processed for Sales Sheet: #4");
    expect(() => lookupBale(clerk(dbAt("PROCESSED")), { barcode: "1000001013" })).toThrow(/already processed/);
  });
});

describe("saveBuying — per-field validation with partial save (Manual 06)", () => {
  it("documented capture: buyer JM, grade 11OF, price 212 (codes uppercased)", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const r = saveBuying(clerk(db), { barcode: "1000001013", buyer: "jm", buyerGrade: "11of", price: "212" });
    expect(r.rejectedAny).toBe(false);
    expect(r.savedAny).toBe(true);
    expect(bale(db, "1000001013")).toMatchObject({ buyerCode: "JM", buyerGrade: "11OF", priceCents: 212 });
    expect(r.view).toMatchObject({ buyerCode: "JM", buyerGrade: "11OF", priceCents: 212 });
    expect(db.audit[0]).toMatchObject({ action: "data-capture.buyer", entityType: "Bale" });
  });

  it("an invalid buyer grade isn't saved, but a valid price on the same form is", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const r = saveBuying(clerk(db), { barcode: "1000001013", buyer: "JM", buyerGrade: "ZZ9", price: "212" });
    expect(r.savedAny).toBe(true);
    expect(r.rejectedAny).toBe(true);
    expect(r.fields.find((f) => f.field === "buyerGrade")).toMatchObject({ ok: false, message: "Invalid Buyer Grade: ZZ9" });
    expect(r.fields.find((f) => f.field === "price")?.ok).toBe(true);
    const b = bale(db, "1000001013");
    expect(b.priceCents).toBe(212);
    expect(b.buyerCode).toBe("JM");
    expect(b.buyerGrade).toBeUndefined();
  });

  it("a buyer grade must belong to the buyer", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const r = saveBuying(clerk(db), { barcode: "1000001013", buyer: "KT", buyerGrade: "11OF" });
    expect(r.fields.find((f) => f.field === "buyer")?.ok).toBe(true);
    expect(r.fields.find((f) => f.field === "buyerGrade")?.message).toBe("Invalid Buyer Grade: 11OF");
  });

  it("unknown buyer → Invalid Buyer: X (and the grade can't be validated against it)", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const r = saveBuying(clerk(db), { barcode: "1000001013", buyer: "xx", buyerGrade: "11OF" });
    expect(r.fields.find((f) => f.field === "buyer")?.message).toBe("Invalid Buyer: XX");
    expect(r.fields.find((f) => f.field === "buyerGrade")?.ok).toBe(false);
    expect(bale(db, "1000001013").buyerCode).toBeUndefined();
  });

  it("price must be a whole number of US cents per kg", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    for (const bad of ["21.5", "abc", "0", "-5"]) {
      const r = saveBuying(clerk(db), { barcode: "1000001013", price: bad });
      expect(r.fields[0]).toMatchObject({ field: "price", ok: false });
    }
    expect(bale(db, "1000001013").priceCents).toBeUndefined();
  });

  it("sale code is uppercased and can be cleared", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    saveBuying(clerk(db), { barcode: "1000001013", saleCode: "ro" });
    expect(bale(db, "1000001013").saleCode).toBe("RO");
    saveBuying(clerk(db), { barcode: "1000001013", clearSaleCode: true });
    expect(bale(db, "1000001013").saleCode).toBeUndefined();
  });

  it("an empty submission is refused", () => {
    expect(() => saveBuying(clerk(dbAt("FLOOR_SUMMARY_DONE")), { barcode: "1000001013" })).toThrow(/missing/);
  });

  it("needs data-capture.capture-buyer (floor-summary-clerk cannot)", () => {
    expect(() => saveBuying(ctxFor(dbAt("FLOOR_SUMMARY_DONE"), "floor-summary-clerk"), { barcode: "1000001013", buyer: "JM" })).toThrow(/capture-buyer/);
  });

  it("price field is rejected (not thrown) without data-capture.capture-price", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const ctx = ctxFor(db, "data-clerk");
    ctx.actor.permissionOverrides.deny.push("data-capture.capture-price");
    const r = saveBuying(ctx, { barcode: "1000001013", buyer: "JM", price: "212" });
    expect(r.fields.find((f) => f.field === "price")?.ok).toBe(false);
    expect(r.fields.find((f) => f.field === "buyer")?.ok).toBe(true);
  });
});

describe("saveClassification / saveAllDetails", () => {
  it("TIMB grade A10 (uppercased) and hessian owner", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const r = saveClassification(clerk(db), { barcode: "1000001013", timbGrade: "a10", hessianOwner: "Grower" });
    expect(r.rejectedAny).toBe(false);
    expect(bale(db, "1000001013")).toMatchObject({ timbGrade: "A10", hessianOwner: "Grower" });
  });

  it("invalid TIMB grade → Invalid TIMB Grade / Reason: X", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const r = saveClassification(clerk(db), { barcode: "1000001013", timbGrade: "zzz" });
    expect(r.fields[0]?.message).toBe("Invalid TIMB Grade / Reason: ZZZ");
    expect(r.savedAny).toBe(false);
    expect(bale(db, "1000001013").timbGrade).toBeUndefined();
  });

  it("all details: the documented first bale in one go", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const r = saveAllDetails(clerk(db), { barcode: "1000001013", timbGrade: "A10", buyer: "JM", buyerGrade: "11OF", price: 212 });
    expect(r.rejectedAny).toBe(false);
    expect(bale(db, "1000001013")).toMatchObject({ timbGrade: "A10", buyerCode: "JM", buyerGrade: "11OF", priceCents: 212 });
  });

  it("classification needs data-capture.classify", () => {
    expect(() => saveClassification(ctxFor(dbAt("FLOOR_SUMMARY_DONE"), "timb-clerk"), { barcode: "1000001013", timbGrade: "A10" })).toThrow(/classify/);
  });
});

describe("selectCaptureQueue", () => {
  it("lists what each bale still needs", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    saveAllDetails(clerk(db), { barcode: "1000001013", timbGrade: "A10", buyer: "JM", buyerGrade: "11OF", price: 212 });
    const q = selectCaptureQueue(db);
    expect(q).toHaveLength(5);
    expect(q.find((x) => x.barcode === "1000001013")?.complete).toBe(true);
    expect(q.find((x) => x.barcode === "1000001024")?.missing).toEqual(["TIMB grade", "buyer", "buyer grade", "price"]);
  });
});

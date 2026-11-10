import { describe, expect, it } from "vitest";
import { ctxFor, dbAt } from "../testing";
import { saveBuying } from "./data-capture";
import { postBatch, selectBatchDetail, selectBatchRows, setBatchPrice } from "./batches";

const clerk = (db: ReturnType<typeof dbAt>) => ctxFor(db, "data-clerk");
const dps = (db: ReturnType<typeof dbAt>) => ctxFor(db, "data-processing-supervisor");

describe("batch processing (Manual 06, Step 4)", () => {
  it("lists the draft batches of 17 Sep next to the posted historical ones", () => {
    const rows = selectBatchRows(dbAt("FLOOR_SUMMARY_DONE"));
    expect(rows.filter((r) => r.status === "DRAFT").map((r) => r.refNo).sort()).toEqual([4, 5]);
    expect(rows.filter((r) => r.status === "POSTED")).toHaveLength(3);
    expect(rows.find((r) => r.refNo === 4)).toMatchObject({ growerNo: "V100060", pricesEntered: 0, pricesNeeded: 3 });
  });

  it("sets a batch price (chatter: 0 → 185) and records who changed it", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    const r = setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001035", price: "185" });
    expect(r.batchPriceCents).toBe(185);
    expect(db.bales.find((b) => b.ticketBarcode === "1000001035")!.batchPriceCents).toBe(185);
    expect(db.priceBatches.find((b) => b.id === "batch-4")!.lastUpdatedBy).toBe("user-data-clerk");
    const history = selectBatchDetail(db, "batch-4")!.history;
    expect(history[0]!.text).toBe("Ticket 1000001035 Batch Price: 0 → 185");
  });

  it("rejects non-whole prices and unknown tickets; clearing is allowed", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    expect(() => setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001035", price: "18.5" })).toThrow(/whole number/);
    expect(() => setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001046", price: "205" })).toThrow(/not part of batch 4/);
    setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001035", price: "185" });
    setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001035", price: "" });
    expect(db.bales.find((b) => b.ticketBarcode === "1000001035")!.batchPriceCents).toBeUndefined();
  });

  it("an unsold bale needs no batch price", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    saveBuying(clerk(db), { barcode: "1000001035", saleCode: "RO" });
    expect(() => setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001035", price: "185" })).toThrow(/was not bought/);
    // …and it is not counted when posting
    setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001013", price: "212" });
    setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001024", price: "198" });
    expect(postBatch(dps(db), { batchId: "batch-4" }).status).toBe("POSTED");
  });

  it("Post Batch refuses while purchased tickets lack a batch price", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001013", price: "212" });
    expect(() => postBatch(dps(db), { batchId: "batch-4" })).toThrow("Enter a batch price for every purchased ticket before posting (2 missing).");
  });

  it("posts the documented batch 4 (212 / 198 / 185): Draft → Posted, then it is locked", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    for (const [barcode, price] of [["1000001013", "212"], ["1000001024", "198"], ["1000001035", "185"]] as const)
      setBatchPrice(clerk(db), { batchId: "batch-4", barcode, price });
    const posted = postBatch(dps(db), { batchId: "batch-4" });
    expect(posted).toMatchObject({ status: "POSTED", postedBy: "user-data-processing-supervisor" });
    expect(db.audit[0]).toMatchObject({ action: "batch.post", entityId: "batch-4" });
    expect(() => postBatch(dps(db), { batchId: "batch-4" })).toThrow(/already posted/);
    expect(() => setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001013", price: "1" })).toThrow(/already been posted/);
  });

  it("permissions: a data clerk can capture batch prices but not post; a supervisor cannot capture", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    expect(() => postBatch(clerk(db), { batchId: "batch-4" })).toThrow(/batch\.post/);
    expect(() => setBatchPrice(dps(db), { batchId: "batch-4", barcode: "1000001013", price: "212" })).toThrow(/batch\.capture-price/);
  });

  it("setting requireDifferentBatchUser: the clerk who captured the price cannot enter the batch price (unverified UQ-21)", () => {
    const db = dbAt("FLOOR_SUMMARY_DONE");
    db.settings.requireDifferentBatchUser = true;
    saveBuying(clerk(db), { barcode: "1000001013", buyer: "JM", buyerGrade: "11OF", price: "212" });
    expect(() => setBatchPrice(clerk(db), { batchId: "batch-4", barcode: "1000001013", price: "212" })).toThrow(/different clerk/);
    expect(setBatchPrice(ctxFor(db, "demo-operator"), { batchId: "batch-4", barcode: "1000001013", price: "212" }).batchPriceCents).toBe(212);
  });

  it("detail exposes captured prices (the UI hides them until the batch is posted)", () => {
    const d = selectBatchDetail(dbAt("READY_TO_BALANCE"), "batch-4")!;
    expect(d.batch.status).toBe("POSTED");
    expect(d.bales.map((b) => [b.batchPriceCents, b.priceCents])).toEqual([[212, 212], [198, 198], [185, 185]]);
  });
});

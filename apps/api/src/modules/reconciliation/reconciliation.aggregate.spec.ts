import { buildBales, computeSummary } from "./reconciliation.aggregate";

const mass = (n: number) => ({ toString: () => n.toFixed(1) });
const bale = (id: string, barcode: string) => ({ id, barcode, buyerGrade: "L3OK", timbGrade: null, growerNo: "V100008", lotNo: "4", massKg: mass(122), uscPerKg: { toString: () => "300" }, usdValue: { toString: () => "366.00" }, receivedAt: null });

describe("reconciliation aggregation", () => {
  it("separates undispatched bales from dispatched-not-received (brief §6)", () => {
    // 500 purchased; 300 dispatched & received; 200 not yet dispatched.
    const purchase = {
      totalBales: 500, totalMassKg: mass(61000),
      bales: Array.from({ length: 500 }, (_, i) => bale(`b${i}`, `B${String(i).padStart(3, "0")}`)),
      shipments: [
        { id: "s1", reference: "SHIPMENT-1", status: "CONFIRMED", bales: Array.from({ length: 300 }, (_, i) => ({ baleId: `b${i}`, status: "RECEIVED", receivedAt: new Date("2026-10-01"), allocatedAt: null, bale: {} })) },
      ],
    };
    const { bales } = buildBales(purchase);
    const summary = computeSummary({ totalBales: 500, totalMassKg: mass(61000) }, bales, [], []);
    expect(summary.totalPurchasedBales).toBe(500);
    expect(summary.totalDispatchedBales).toBe(300);
    expect(summary.totalReceivedBales).toBe(300);
    // Outstanding = dispatched but not received (0 here); not-yet-dispatched = 200 — never mixed up.
    expect(summary.outstandingBales).toBe(0);
    expect(summary.notYetDispatchedBales).toBe(200);
    expect(summary.missingBales).toBe(0);
  });

  it("counts outstanding = dispatched but not received, not undispatched", () => {
    // 500 purchased; 500 dispatched; 495 received; 5 still in transit (dispatched, not received).
    const purchase = {
      totalBales: 500, totalMassKg: mass(61000),
      bales: Array.from({ length: 500 }, (_, i) => bale(`b${i}`, `B${String(i).padStart(3, "0")}`)),
      shipments: [
        { id: "s1", reference: "SHIPMENT-1", status: "CONFIRMED", bales: Array.from({ length: 200 }, (_, i) => ({ baleId: `b${i}`, status: "RECEIVED", receivedAt: new Date("2026-10-01"), allocatedAt: null, bale: {} })) },
        { id: "s2", reference: "SHIPMENT-2", status: "CONFIRMED", bales: Array.from({ length: 150 }, (_, i) => ({ baleId: `b${200 + i}`, status: "RECEIVED", receivedAt: new Date("2026-10-02"), allocatedAt: null, bale: {} })) },
        { id: "s3", reference: "SHIPMENT-3", status: "IN_TRANSIT", bales: Array.from({ length: 150 }, (_, i) => ({ baleId: `b${350 + i}`, status: "EXPECTED", receivedAt: null, allocatedAt: null, bale: {} })) },
      ],
    };
    const { bales } = buildBales(purchase);
    const summary = computeSummary(purchase, bales, [], []);
    expect(summary.totalDispatchedBales).toBe(500);
    expect(summary.totalReceivedBales).toBe(350);
    expect(summary.outstandingBales).toBe(150); // the 150 in-transit (dispatched, not received)
    expect(summary.notYetDispatchedBales).toBe(0);
    expect(summary.missingBales).toBe(0);
  });

  it("flags missing bales distinctly from outstanding", () => {
    const purchase = {
      totalBales: 10, totalMassKg: mass(1220),
      bales: Array.from({ length: 10 }, (_, i) => bale(`b${i}`, `B${i}`)),
      shipments: [{ id: "s1", reference: "S1", status: "RECONCILIATION_REQUIRED", bales: Array.from({ length: 10 }, (_, i) => ({ baleId: `b${i}`, status: i < 8 ? "RECEIVED" : "MISSING", receivedAt: i < 8 ? new Date("2026-10-01") : null, allocatedAt: null, bale: {} })) }],
    };
    const { bales } = buildBales(purchase);
    const summary = computeSummary(purchase, bales, [], []);
    expect(summary.totalReceivedBales).toBe(8);
    expect(summary.outstandingBales).toBe(2); // dispatched but not received (the 2 missing)
    expect(summary.missingBales).toBe(2); // and they are explicitly flagged missing
    expect(summary.notYetDispatchedBales).toBe(0);
  });

  it("classifies lifecycle buckets correctly", () => {
    const purchase = {
      totalBales: 4, totalMassKg: mass(488),
      bales: [bale("b0", "A"), bale("b1", "B"), bale("b2", "C"), bale("b3", "D")],
      shipments: [{ id: "s1", reference: "S1", status: "IN_TRANSIT", bales: [{ baleId: "b1", status: "EXPECTED", receivedAt: null, allocatedAt: null, bale: {} }] },
        { id: "s2", reference: "S2", status: "ARRIVED", bales: [{ baleId: "b2", status: "EXPECTED", receivedAt: null, allocatedAt: null, bale: {} }] },
        { id: "s3", reference: "S3", status: "CONFIRMED", bales: [{ baleId: "b3", status: "ALLOCATED", receivedAt: new Date("2026-10-01"), allocatedAt: new Date("2026-10-02"), bale: {} }] }],
    };
    const { bales } = buildBales(purchase);
    expect(bales.find((b) => b.barcode === "A")!.lifecycle).toBe("NOT_DISPATCHED");
    expect(bales.find((b) => b.barcode === "B")!.lifecycle).toBe("IN_TRANSIT");
    expect(bales.find((b) => b.barcode === "C")!.lifecycle).toBe("ARRIVED_NOT_RECEIVED");
    expect(bales.find((b) => b.barcode === "D")!.lifecycle).toBe("ALLOCATED");
    expect(bales.find((b) => b.barcode === "D")!.received).toBe(true);
    expect(bales.find((b) => b.barcode === "D")!.allocated).toBe(true);
  });
});

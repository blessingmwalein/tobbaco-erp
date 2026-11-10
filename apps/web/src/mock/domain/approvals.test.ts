import { describe, expect, it } from "vitest";
import { ctxFor, dbAt } from "../testing";
import { cancelApproval, countPendingApprovals, decideApproval, requestApproval, requestSaleReversal, selectApprovalRows } from "./approvals";

const dps = (db: ReturnType<typeof dbAt>) => ctxFor(db, "data-processing-supervisor");
const sup = (db: ReturnType<typeof dbAt>) => ctxFor(db, "supervisor");

describe("approvals", () => {
  it("a sale reversal request creates a pending approval (setting: sale.reverse needs approval)", () => {
    const db = dbAt("BALANCED");
    const r = requestSaleReversal(dps(db), { saleId: "sale-4", reason: "Wrong buyer grade captured" });
    expect(r.mode).toBe("REQUESTED");
    expect(r.approval).toMatchObject({ ref: "APR-0001", status: "PENDING", entityType: "Sale", entityId: "sale-4", entityRef: "Salesmaster 4", action: "sale.reverse", requestedBy: "user-data-processing-supervisor" });
    expect(countPendingApprovals(db)).toBe(1);
    expect(db.sales.find((s) => s.id === "sale-4")!.status).toBe("BALANCED");
    expect(db.audit.some((a) => a.action === "approvals.request")).toBe(true);
  });

  it("cannot request a second pending approval for the same action", () => {
    const db = dbAt("BALANCED");
    requestSaleReversal(dps(db), { saleId: "sale-4", reason: "first" });
    expect(() => requestSaleReversal(dps(db), { saleId: "sale-4", reason: "again" })).toThrow(/already a pending approval/);
  });

  it("only Balanced sales can be reversed: Draft refused, Processed needs a financial reversal (UQ-06)", () => {
    expect(() => requestSaleReversal(dps(dbAt("READY_TO_BALANCE")), { saleId: "sale-4", reason: "no" })).toThrow(/Only a Balanced sale/);
    expect(() => requestSaleReversal(dps(dbAt("PROCESSED")), { saleId: "sale-4", reason: "no" })).toThrow(/financial reversal/);
  });

  it("the requester cannot approve their own request", () => {
    const db = dbAt("BALANCED");
    const { approval } = requestSaleReversal(dps(db), { saleId: "sale-4", reason: "Wrong buyer grade captured" });
    expect(() => decideApproval(dps(db), { id: approval!.id, decision: "APPROVED" })).toThrow("You cannot approve your own request");
    expect(db.approvals[0]!.status).toBe("PENDING");
  });

  it("another approver approves: the sale returns to Draft, the decision is recorded and audited", () => {
    const db = dbAt("BALANCED");
    const { approval } = requestSaleReversal(dps(db), { saleId: "sale-4", reason: "Wrong buyer grade captured" });
    const done = decideApproval(sup(db), { id: approval!.id, decision: "APPROVED", reason: "Agreed" });
    expect(done).toMatchObject({ status: "APPROVED", decidedBy: "user-supervisor", decisionReason: "Agreed" });
    const sale = db.sales.find((s) => s.id === "sale-4")!;
    expect(sale.status).toBe("DRAFT");
    expect(sale.balancedAt).toBeUndefined();
    expect(db.audit.map((a) => a.action)).toEqual(expect.arrayContaining(["approvals.approve", "sales.reverse"]));
    expect(countPendingApprovals(db)).toBe(0);
    expect(() => decideApproval(sup(db), { id: approval!.id, decision: "REJECTED", reason: "too late" })).toThrow(/already approved/);
  });

  it("rejecting needs a reason and leaves the sale untouched", () => {
    const db = dbAt("BALANCED");
    const { approval } = requestSaleReversal(dps(db), { saleId: "sale-4", reason: "Wrong buyer grade captured" });
    expect(() => decideApproval(sup(db), { id: approval!.id, decision: "REJECTED" })).toThrow(/reason is required to reject/);
    const done = decideApproval(sup(db), { id: approval!.id, decision: "REJECTED", reason: "Prices are correct" });
    expect(done.status).toBe("REJECTED");
    expect(db.sales.find((s) => s.id === "sale-4")!.status).toBe("BALANCED");
  });

  it("when the setting does not require approval the reversal is immediate (and still needs a reason)", () => {
    const db = dbAt("BALANCED");
    db.settings.approvalRequiredFor = [];
    expect(() => requestSaleReversal(dps(db), { saleId: "sale-4", reason: "" })).toThrow(/reason is required/);
    expect(requestSaleReversal(dps(db), { saleId: "sale-4", reason: "Wrong buyer grade captured" }).mode).toBe("REVERSED");
    expect(db.sales.find((s) => s.id === "sale-4")!.status).toBe("DRAFT");
    expect(db.approvals).toHaveLength(0);
  });

  it("permissions: deciding needs approvals.decide; reversing needs sales.reverse; generic requests need approvals.request", () => {
    const db = dbAt("BALANCED");
    const { approval } = requestSaleReversal(dps(db), { saleId: "sale-4", reason: "Wrong buyer grade captured" });
    expect(() => decideApproval(ctxFor(db, "data-clerk"), { id: approval!.id, decision: "APPROVED" })).toThrow(/approvals\.decide/);
    expect(() => requestSaleReversal(ctxFor(db, "receiving-supervisor"), { saleId: "sale-5", reason: "nope" })).toThrow(/sales\.reverse/);
    expect(() => requestApproval(ctxFor(db, "data-clerk"), { entityType: "Bale", entityId: "bale-1", entityRef: "x", action: "bale.correct", reason: "test" })).toThrow(/approvals\.request/);
  });

  it("generic requests work and the requester may withdraw them", () => {
    const db = dbAt("BALANCED");
    const a = requestApproval(ctxFor(db, "receiving-supervisor"), { entityType: "Bale", entityId: "bale-1", entityRef: "2609170001", action: "bale.correct", reason: "Wrong group number" });
    expect(a.status).toBe("PENDING");
    expect(cancelApproval(ctxFor(db, "receiving-supervisor"), { id: a.id }).status).toBe("CANCELLED");
    expect(selectApprovalRows(db)[0]).toMatchObject({ actionLabel: "Correct a bale", requestedByName: "Tariro Mutasa" });
  });
});

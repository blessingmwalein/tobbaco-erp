import type { Approval, MockDb } from "@tobacco/shared";
import { audit, failText, nextSeq, notify, padNum, requirePermission, can, type Ctx } from "../ctx";
import { reverseBalancedSale } from "./sales";

/**
 * Reusable approvals (brief Module 8). A request names an entity and an action; an approver (never the requester)
 * decides with a reason. Approving an action the system knows how to execute (currently `sale.reverse`) performs it.
 * What creates approvals at Ethical, and who approves, is not documented (UQ-06) — the trigger list is a setting.
 */

export const APPROVAL_ACTION_LABEL: Record<string, string> = {
  "sale.reverse": "Reverse a balanced sale",
  "bale.correct": "Correct a bale",
  "dispatch.cancel": "Cancel a dispatch note",
  "payment.override": "Payment override",
  "financial.adjust": "Financial adjustment",
};

export function countPendingApprovals(db: MockDb): number {
  return db.approvals.filter((a) => a.status === "PENDING").length;
}

export interface RequestApprovalInput {
  entityType: string;
  entityId: string;
  entityRef: string;
  action: string;
  reason: string;
}

export function requestApproval(ctx: Ctx, input: RequestApprovalInput): Approval {
  requirePermission(ctx, "approvals.request");
  return createApproval(ctx, input);
}

function createApproval(ctx: Ctx, input: RequestApprovalInput): Approval {
  const reason = input.reason.trim();
  if (reason.length < 3) return failText("A reason is required (at least 3 characters).");
  if (ctx.db.approvals.some((a) => a.status === "PENDING" && a.entityId === input.entityId && a.action === input.action))
    return failText("There is already a pending approval for this action.");
  const n = nextSeq(ctx.db, "approval");
  const approval: Approval = {
    id: `apr-${padNum(n, 4)}`,
    ref: `APR-${padNum(n, 4)}`,
    entityType: input.entityType,
    entityId: input.entityId,
    entityRef: input.entityRef,
    action: input.action,
    requestedBy: ctx.actor.id,
    requestReason: reason,
    requestedAt: ctx.now,
    status: "PENDING",
  };
  ctx.db.approvals.unshift(approval);
  audit(ctx, { action: "approvals.request", entityType: "Approval", entityId: approval.id, entityRef: approval.ref, next: { action: input.action, entityRef: input.entityRef }, reason });
  notify(ctx, { level: "warning", title: `Approval requested — ${APPROVAL_ACTION_LABEL[input.action] ?? input.action}`, body: `${approval.ref}: ${input.entityRef}. ${reason}`, href: "/approvals" });
  return approval;
}

/**
 * Reverse a balanced sale. If `sale.reverse` is in settings.approvalRequiredFor (default) this raises an approval;
 * otherwise the reversal is applied immediately. Processed sales are refused (financial reversal unspecified — UQ-06).
 */
export function requestSaleReversal(ctx: Ctx, input: { saleId: string; reason: string }): { mode: "REQUESTED" | "REVERSED"; approval?: Approval } {
  requirePermission(ctx, "sales.reverse");
  const sale = ctx.db.sales.find((s) => s.id === input.saleId);
  if (!sale) return failText("Sale not found");
  if (sale.status === "PROCESSED")
    return failText("A Processed sale needs a financial reversal, which the manuals do not specify (UQ-06). Only Balanced sales can be reversed.");
  if (sale.status !== "BALANCED") return failText("Only a Balanced sale can be reversed.");
  if (!ctx.db.settings.approvalRequiredFor.includes("sale.reverse")) {
    if (input.reason.trim().length < 3) return failText("A reason is required (at least 3 characters).");
    reverseBalancedSale(ctx, sale.id, input.reason.trim());
    return { mode: "REVERSED" };
  }
  const approval = createApproval(ctx, { entityType: "Sale", entityId: sale.id, entityRef: `Salesmaster ${sale.refNo}`, action: "sale.reverse", reason: input.reason });
  return { mode: "REQUESTED", approval };
}

export interface DecideApprovalInput {
  id: string;
  decision: "APPROVED" | "REJECTED";
  reason?: string;
}

/** Approvers never decide their own requests (the explicit-setting exception from the brief is not offered). */
export function decideApproval(ctx: Ctx, input: DecideApprovalInput): Approval {
  requirePermission(ctx, "approvals.decide");
  const approval = ctx.db.approvals.find((a) => a.id === input.id);
  if (!approval) return failText("Approval not found");
  if (approval.status !== "PENDING") return failText(`This request was already ${approval.status.toLowerCase()}.`);
  if (approval.requestedBy === ctx.actor.id) return failText("You cannot approve your own request. Another approver must decide it.");
  const reason = (input.reason ?? "").trim();
  if (input.decision === "REJECTED" && reason.length < 3) return failText("A reason is required to reject a request.");

  if (input.decision === "APPROVED") executeApproved(ctx, approval, reason || "Approved");

  approval.status = input.decision;
  approval.decidedBy = ctx.actor.id;
  approval.decisionReason = reason || undefined;
  approval.decidedAt = ctx.now;
  audit(ctx, {
    action: input.decision === "APPROVED" ? "approvals.approve" : "approvals.reject",
    entityType: "Approval",
    entityId: approval.id,
    entityRef: approval.ref,
    previous: { status: "PENDING" },
    next: { status: input.decision },
    reason: reason || undefined,
  });
  return approval;
}

function executeApproved(ctx: Ctx, approval: Approval, reason: string) {
  switch (approval.action) {
    case "sale.reverse":
      reverseBalancedSale(ctx, approval.entityId, `Approved ${approval.ref}: ${reason}`);
      return;
    default:
      // Other actions are recorded only; their owning modules execute them (not built in this slice).
      return;
  }
}

/** The requester may withdraw a pending request. */
export function cancelApproval(ctx: Ctx, input: { id: string }): Approval {
  const approval = ctx.db.approvals.find((a) => a.id === input.id);
  if (!approval) return failText("Approval not found");
  if (approval.status !== "PENDING") return failText(`This request was already ${approval.status.toLowerCase()}.`);
  if (approval.requestedBy !== ctx.actor.id && !can(ctx, "approvals.decide")) return failText("Only the requester or an approver can cancel this request.");
  approval.status = "CANCELLED";
  approval.decidedBy = ctx.actor.id;
  approval.decidedAt = ctx.now;
  audit(ctx, { action: "approvals.cancel", entityType: "Approval", entityId: approval.id, entityRef: approval.ref, previous: { status: "PENDING" }, next: { status: "CANCELLED" } });
  return approval;
}

export interface ApprovalRow extends Approval {
  requestedByName: string;
  decidedByName?: string;
  actionLabel: string;
  href?: string;
}

export function selectApprovalRows(db: MockDb): ApprovalRow[] {
  const name = (id?: string) => (id ? db.users.find((u) => u.id === id)?.name ?? id : undefined);
  return db.approvals.map((a) => ({
    ...a,
    requestedByName: name(a.requestedBy) ?? a.requestedBy,
    decidedByName: name(a.decidedBy),
    actionLabel: APPROVAL_ACTION_LABEL[a.action] ?? a.action,
    href: a.entityType === "Sale" ? `/sales/${a.entityId}` : undefined,
  }));
}

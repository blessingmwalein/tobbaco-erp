"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCheck, ListChecks, X } from "lucide-react";
import {
  Button,
  Callout,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  KeyValue,
  NativeSelect,
  PageHeader,
  Textarea,
  UnverifiedBadge,
  type ColumnDef,
} from "@tobacco/ui";
import { formatDateTime } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { PermissionButton, useCurrentUser } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import { cancelApproval, decideApproval, selectApprovalRows, type ApprovalRow } from "@/mock/domain/approvals";

export default function ApprovalsPage() {
  const user = useCurrentUser();
  const [status, setStatus] = useState("PENDING");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useDbQuery(["approvals"], selectApprovalRows);
  const rows = (data ?? []).filter((r) => status === "ALL" || r.status === status);
  const open = (data ?? []).find((r) => r.id === openId) ?? null;

  const columns: ColumnDef<ApprovalRow, unknown>[] = [
    { accessorKey: "ref", header: "Reference", cell: ({ getValue }) => <span className="font-mono text-[13px] font-medium">{getValue<string>()}</span> },
    { accessorKey: "actionLabel", header: "Action requested" },
    { accessorKey: "entityRef", header: "Entity", cell: ({ row }) => <span>{row.original.entityType} · {row.original.entityRef}</span> },
    { accessorKey: "requestedByName", header: "Requested by" },
    { accessorKey: "requestedAt", header: "Requested", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge kind="approval" value={getValue<string>()} /> },
    { accessorKey: "decidedByName", header: "Decided by", cell: ({ getValue }) => getValue<string | undefined>() ?? "—" },
  ];

  return (
    <RequirePermission permission="approvals.view">
      <PageHeader
        title="Approvals"
        description="Sensitive actions wait here for a second person. Nobody approves their own request."
        badges={<UnverifiedBadge uq="UQ-06" />}
      />
      <div className="mb-4">
        <Callout tone="info" title="What creates an approval?">
          The manuals mention “Pending Approvals” (they block stop-order processing) but do not say what raises them. For now a request to reverse a Balanced sale creates one; the list of
          actions that need approval is a setting (Administration → Settings).
        </Callout>
      </div>
      <DataTable
        aria-label="Approvals"
        data-testid="approvals-table"
        columns={columns}
        data={rows}
        loading={isLoading}
        searchPlaceholder="Search reference, entity, requester…"
        emptyIcon={ListChecks}
        emptyTitle={status === "PENDING" ? "No pending approvals" : "No approvals"}
        emptyDescription="Requests appear here, for example when a sale reversal is requested from a Balanced sale."
        onRowClick={(r) => setOpenId(r.id)}
        enableColumnVisibility={false}
        toolbar={
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" wrapperClassName="w-40" size="sm" className="h-9">
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ALL">All</option>
          </NativeSelect>
        }
      />
      {open ? <ApprovalDialog key={open.id} row={open} currentUserId={user?.id} onClose={() => setOpenId(null)} /> : null}
    </RequirePermission>
  );
}

function ApprovalDialog({ row, currentUserId, onClose }: { row: ApprovalRow; currentUserId?: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const decide = useAction(decideApproval, { success: (a) => `${a.ref} ${a.status.toLowerCase()}` });
  const cancel = useAction(cancelApproval, { success: "Request cancelled" });
  const own = row.requestedBy === currentUserId;
  const pending = row.status === "PENDING";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {row.ref} <StatusBadge kind="approval" value={row.status} />
          </DialogTitle>
          <DialogDescription>{row.actionLabel}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          <KeyValue
            columns={2}
            items={[
              { label: "Entity", value: row.href ? <Link href={row.href} className="font-medium text-primary hover:underline">{row.entityType} · {row.entityRef}</Link> : `${row.entityType} · ${row.entityRef}` },
              { label: "Requested by", value: row.requestedByName },
              { label: "Requested", value: formatDateTime(row.requestedAt) },
              { label: "Decided by", value: row.decidedByName ?? "—" },
            ]}
          />
          <div className="rounded-xl bg-surface-secondary p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Request reason</p>
            <p>{row.requestReason}</p>
          </div>
          {row.decisionReason ? (
            <div className="rounded-xl bg-surface-secondary p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Decision reason</p>
              <p>{row.decisionReason}</p>
            </div>
          ) : null}
          {pending ? (
            <>
              {own ? <Callout tone="warning">You requested this, so you cannot approve it. Another approver must decide.</Callout> : null}
              <Field label="Decision reason" htmlFor="decision-reason" hint="Required to reject; optional when approving.">
                <Textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="decision-reason" />
              </Field>
            </>
          ) : null}
        </DialogBody>
        {pending ? (
          <DialogFooter>
            {own ? (
              <Button variant="secondary" loading={cancel.isPending} onClick={async () => { const r = await cancel.run({ id: row.id }); if (r.ok) onClose(); }}>
                Cancel request
              </Button>
            ) : null}
            <PermissionButton
              permission="approvals.decide"
              variant="secondary"
              disabled={own}
              disabledReason={own ? "You cannot decide your own request." : undefined}
              loading={decide.isPending}
              onClick={async () => { const r = await decide.run({ id: row.id, decision: "REJECTED", reason }); if (r.ok) onClose(); }}
              data-testid="reject-approval"
            >
              <X /> Reject
            </PermissionButton>
            <PermissionButton
              permission="approvals.decide"
              disabled={own}
              disabledReason={own ? "You cannot decide your own request." : undefined}
              loading={decide.isPending}
              onClick={async () => { const r = await decide.run({ id: row.id, decision: "APPROVED", reason }); if (r.ok) onClose(); }}
              data-testid="approve-approval"
            >
              <CheckCheck /> Approve
            </PermissionButton>
          </DialogFooter>
        ) : (
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

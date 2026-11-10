"use client";

import { useMemo, useState } from "react";
import { FileDown, FilterX, History, Lock } from "lucide-react";
import { Button, Callout, DataTable, DateInput, Input, NativeSelect, PageHeader, type ColumnDef } from "@tobacco/ui";
import { formatDateTime, type AuditEntry } from "@tobacco/shared";
import { AuditDetailDialog } from "@/components/admin/audit-detail-dialog";
import { RequirePermission } from "@/components/page-guard";
import { downloadCsv } from "@/lib/csv";
import { PermissionButton } from "@/lib/permissions";
import { useDbQuery } from "@/mock/hooks";

interface Filters {
  user: string;
  action: string;
  entityType: string;
  entityRef: string;
  from: string;
  to: string;
}
const EMPTY: Filters = { user: "", action: "", entityType: "", entityRef: "", from: "", to: "" };

export default function AuditPage() {
  const { data, isLoading } = useDbQuery(["admin", "audit"], (db) => db.audit);
  const [f, setF] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState<AuditEntry | null>(null);

  const entries = useMemo(() => [...(data ?? [])].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)), [data]);
  const users = useMemo(() => [...new Map(entries.map((e) => [e.userId, e.userName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [entries]);
  const actions = useMemo(() => [...new Set(entries.map((e) => e.action))].sort(), [entries]);
  const types = useMemo(() => [...new Set(entries.map((e) => e.entityType))].sort(), [entries]);

  const rows = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!f.user || e.userId === f.user) &&
          (!f.action || e.action === f.action) &&
          (!f.entityType || e.entityType === f.entityType) &&
          (!f.entityRef || `${e.entityRef ?? ""} ${e.entityId}`.toLowerCase().includes(f.entityRef.toLowerCase())) &&
          (!f.from || e.at.slice(0, 10) >= f.from) &&
          (!f.to || e.at.slice(0, 10) <= f.to),
      ),
    [entries, f],
  );
  const set = (patch: Partial<Filters>) => setF((s) => ({ ...s, ...patch }));
  const filtered = Object.values(f).some(Boolean);

  const columns: ColumnDef<AuditEntry, unknown>[] = [
    { accessorKey: "at", header: "When", cell: ({ getValue }) => <span className="tabular whitespace-nowrap">{formatDateTime(getValue<string>())}</span> },
    { accessorKey: "userName", header: "User" },
    { accessorKey: "action", header: "Action", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue<string>()}</span> },
    { accessorKey: "entityType", header: "Entity type" },
    { id: "ref", header: "Entity", accessorFn: (e) => e.entityRef ?? e.entityId, cell: ({ row }) => <span className="font-mono text-[13px]">{row.original.entityRef ?? row.original.entityId}</span> },
    { accessorKey: "reason", header: "Reason", cell: ({ getValue }) => <span className="block max-w-xs truncate text-muted-foreground">{getValue<string>() ?? "—"}</span> },
  ];

  const exportCsv = () =>
    downloadCsv(
      `audit-log_${new Date().toISOString().slice(0, 10)}.csv`,
      ["id", "at", "user", "action", "entity_type", "entity_id", "entity_ref", "reason", "previous", "next"],
      rows.map((e) => [e.id, e.at, e.userName, e.action, e.entityType, e.entityId, e.entityRef ?? "", e.reason ?? "", e.previous === undefined ? "" : JSON.stringify(e.previous), e.next === undefined ? "" : JSON.stringify(e.next)]),
    );

  return (
    <RequirePermission permission="audit.view">
      <PageHeader
        title="Audit log"
        description="Who did what, to which record, with the before and after values. Append-only — entries cannot be edited or deleted."
        actions={
          <PermissionButton permission="audit.view" variant="secondary" onClick={exportCsv} disabled={rows.length === 0} data-testid="export-audit">
            <FileDown /> Export CSV
          </PermissionButton>
        }
      />
      <div className="flex flex-col gap-4">
        <Callout tone="info">
          <span className="flex items-center gap-2">
            <Lock className="size-3.5" aria-hidden /> Read-only. Every transition, privileged action and configuration change in the demo writes an entry here.
          </span>
        </Callout>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card" data-testid="audit-filters">
          <label className="flex w-48 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            User
            <NativeSelect value={f.user} onChange={(e) => set({ user: e.target.value })} data-testid="audit-user">
              <option value="">All users</option>
              {users.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex w-52 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            Action
            <NativeSelect value={f.action} onChange={(e) => set({ action: e.target.value })} data-testid="audit-action">
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex w-44 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            Entity type
            <NativeSelect value={f.entityType} onChange={(e) => set({ entityType: e.target.value })} data-testid="audit-entity-type">
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex w-48 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            Entity reference
            <Input value={f.entityRef} onChange={(e) => set({ entityRef: e.target.value })} placeholder="e.g. GDN0000005" data-testid="audit-entity-ref" />
          </label>
          <label className="flex w-40 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            From
            <DateInput value={f.from} onChange={(e) => set({ from: e.target.value })} />
          </label>
          <label className="flex w-40 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            To
            <DateInput value={f.to} onChange={(e) => set({ to: e.target.value })} />
          </label>
          <Button variant="ghost" className="ml-auto" disabled={!filtered} onClick={() => setF(EMPTY)}>
            <FilterX /> Clear filters
          </Button>
        </div>

        <DataTable
          data-testid="audit-table"
          aria-label="Audit log"
          columns={columns}
          data={rows}
          loading={isLoading}
          pageSize={25}
          searchPlaceholder="Search the log…"
          emptyIcon={History}
          emptyTitle="No audit entries match"
          emptyDescription="Widen the filters."
          onRowClick={setOpen}
        />
      </div>
      <AuditDetailDialog entry={open} onClose={() => setOpen(null)} />
    </RequirePermission>
  );
}

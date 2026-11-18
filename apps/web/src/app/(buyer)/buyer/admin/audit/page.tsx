"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button, Card, CardContent, EmptyState, ErrorState, PageHeader, Skeleton } from "@tobacco/ui";
import type { AuditLogDto } from "@tobacco/shared";
import { describeError, useBuyerQuery } from "@/lib/api";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";

type AuditPage = { items: AuditLogDto[]; total: number };
export default function BuyerAuditPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [applied, setApplied] = useState({ action: "", entityType: "" });
  const audit = useBuyerQuery<AuditPage>("/buyer/audit", { action: applied.action || undefined, entityType: applied.entityType || undefined, page: 1, pageSize: 50 }, { key: ["audit", applied.action, applied.entityType] });
  return <RequireBuyerPermission permission="buyer.audit.view"><PageHeader title="Audit history" description="A read-only record of changes made in your company account." />
    <Card><CardContent className="space-y-4 pt-6"><form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setApplied({ action, entityType }); }} aria-label="Audit filters"><label className="text-sm"><span className="mb-1 block font-medium">Action</span><input className="h-9 rounded-lg border border-border bg-background px-3" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. CREATE" /></label><label className="text-sm"><span className="mb-1 block font-medium">Entity type</span><input className="h-9 rounded-lg border border-border bg-background px-3" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="e.g. User" /></label><Button type="submit" variant="secondary">Apply filters</Button></form>
      {audit.isLoading ? <Skeleton className="h-72" /> : audit.isError ? <ErrorState title="Could not load audit history" description={describeError(audit.error)} action={<Button variant="secondary" onClick={() => void audit.refetch()}>Try again</Button>} /> : !audit.data?.items.length ? <EmptyState icon={History} title="No audit entries" description="Changes will appear here as your company uses the portal." /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase text-muted-foreground"><th className="px-3 py-2">When</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">By</th><th className="px-3 py-2">Reason</th></tr></thead><tbody>{audit.data.items.map((entry) => <tr key={entry.id} className="border-b border-border last:border-0"><td className="px-3 py-3 whitespace-nowrap">{new Date(entry.occurredAt).toLocaleString()}</td><td className="px-3 py-3 font-medium">{entry.action}</td><td className="px-3 py-3">{entry.entityType}</td><td className="px-3 py-3">{entry.entityRef ?? entry.entityId ?? "—"}</td><td className="px-3 py-3">{entry.principalName ?? "System"}</td><td className="px-3 py-3">{entry.reason ?? "—"}</td></tr>)}</tbody></table><p className="pt-3 text-xs text-muted-foreground" aria-live="polite">{audit.data.total} entr{audit.data.total === 1 ? "y" : "ies"}</p></div>}
    </CardContent></Card>
  </RequireBuyerPermission>;
}

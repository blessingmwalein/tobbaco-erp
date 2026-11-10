"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileBarChart, Lock, Search } from "lucide-react";
import { Badge, EmptyState, Input, PageHeader } from "@tobacco/ui";
import { RequirePermission } from "@/components/page-guard";
import { usePermissions } from "@/lib/permissions";
import { REPORTS, REPORT_AREAS, type ReportDef } from "@/lib/reports";

const FILTER_LABEL: Record<string, string> = {
  date: "Date range",
  season: "Season",
  sellingPoint: "Selling point",
  grower: "Grower",
  buyer: "Buyer",
  creditor: "Creditor",
  batch: "Batch",
  status: "Status",
  user: "User",
};

function ReportCard({ def, allowed }: { def: ReportDef; allowed: boolean }) {
  const href = def.externalHref ?? `/reports/${def.slug}`;
  const body = (
    <div
      className={`flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card transition-colors ${allowed ? "hover:border-primary" : "bg-surface-secondary"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <FileBarChart className="size-5" aria-hidden />
        </span>
        {allowed ? <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden /> : <Lock className="size-4 text-muted-foreground" aria-label="Restricted" />}
      </div>
      <div>
        <p className="text-sm font-semibold">{def.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{def.description}</p>
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {def.externalHref ? <Badge tone="primary">Opens in Finance</Badge> : null}
        {!allowed && def.permission ? <Badge tone="outline">Needs {def.permission}</Badge> : null}
        {def.filters.map((f) => (
          <Badge key={f} tone="outline">
            {FILTER_LABEL[f]}
          </Badge>
        ))}
      </div>
    </div>
  );
  return allowed ? (
    <Link href={href} className="block h-full rounded-2xl" data-testid={`report-card-${def.slug}`}>
      {body}
    </Link>
  ) : (
    <div data-testid={`report-card-${def.slug}`}>{body}</div>
  );
}

export default function ReportsPage() {
  const perms = usePermissions();
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return REPORTS.filter((r) => !t || `${r.title} ${r.description} ${r.area}`.toLowerCase().includes(t));
  }, [q]);

  return (
    <RequirePermission permission="reports.view">
      <PageHeader
        title="Reports"
        description="Sixteen operational and financial reports over the sale-day data. Filter, export to CSV, or print to PDF."
        actions={
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports…" aria-label="Search reports" className="pl-9" />
          </div>
        }
      />
      {matches.length === 0 ? (
        <EmptyState icon={FileBarChart} title="No reports match your search" description="Try a different word, e.g. “payment” or “bale”." className="rounded-2xl border border-border bg-surface" />
      ) : (
        <div className="flex flex-col gap-8">
          {REPORT_AREAS.map((area) => {
            const list = matches.filter((r) => r.area === area);
            if (list.length === 0) return null;
            return (
              <section key={area} aria-labelledby={`area-${area}`}>
                <h2 id={`area-${area}`} className="mb-3 text-sm font-semibold text-muted-foreground">
                  {area}
                </h2>
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((r) => (
                    <li key={r.slug}>
                      <ReportCard def={r} allowed={!r.permission || perms.has(r.permission)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </RequirePermission>
  );
}

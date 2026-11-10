"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileQuestion } from "lucide-react";
import { Button, Callout, EmptyState, PageHeader, Skeleton } from "@tobacco/ui";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportView } from "@/components/reports/report-view";
import { RequirePermission } from "@/components/page-guard";
import { useGuard } from "@/lib/permissions";
import { getReport, type ReportFilters } from "@/lib/reports";
import { useDb, useDbQuery } from "@/mock/hooks";

const KEYS = ["from", "to", "season", "sellingPoint", "grower", "buyer", "creditor", "batch", "status", "user"] as const;

/**
 * Filters live in the query string so every view is deep-linkable. When the URL carries no filter state at all
 * the report's own defaults apply (e.g. daily receiving = today). Once a user changes a filter, `r=1` marks the
 * state as explicit, so clearing a filter does not snap back to the default.
 */
function ReportScreen() {
  const { slug } = useParams<{ slug: string }>();
  const def = getReport(slug);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const defaults = useDb((db) => def?.defaultFilters?.(db) ?? {});
  const defaultsKey = JSON.stringify(defaults);
  const extra = useGuard(def?.permission);

  const explicit = sp.get("r") === "1" || KEYS.some((k) => sp.has(k));
  const filters = useMemo<ReportFilters>(() => {
    if (!def) return {};
    if (!explicit) return JSON.parse(defaultsKey) as ReportFilters;
    return Object.fromEntries(KEYS.filter((k) => sp.get(k)).map((k) => [k, sp.get(k) as string])) as ReportFilters;
  }, [def, explicit, sp, defaultsKey]);

  const write = useCallback(
    (next: ReportFilters) => {
      const qs = new URLSearchParams({ r: "1" });
      for (const k of KEYS) if (next[k]) qs.set(k, String(next[k]));
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const { data, isLoading } = useDbQuery(["report", slug, JSON.stringify(filters)], (db) => (def ? def.run(db, filters) : undefined), {
    enabled: Boolean(def) && !def?.externalHref,
  });

  if (!def) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Unknown report"
        description={`There is no report called “${slug}”.`}
        action={
          <Button asChild variant="secondary">
            <Link href="/reports">All reports</Link>
          </Button>
        }
        className="rounded-2xl border border-border bg-surface"
      />
    );
  }

  const back = (
    <Button asChild variant="ghost" size="sm" className="print:hidden">
      <Link href="/reports">
        <ArrowLeft /> All reports
      </Link>
    </Button>
  );

  if (def.externalHref) {
    return (
      <>
        <PageHeader title={def.title} description={def.description} actions={back} />
        <Callout
          tone="info"
          title="This report lives in Finance"
          action={
            <Button asChild>
              <Link href={def.externalHref}>
                Open sales sheets <ArrowUpRight />
              </Link>
            </Button>
          }
        >
          Grower sales sheets are generated per grower from processed sales and are printable. Use the Sales sheet report in Finance.
        </Callout>
      </>
    );
  }

  if (!extra.allowed) {
    return (
      <>
        <PageHeader title={def.title} description={def.description} actions={back} />
        <EmptyState title="You don't have access to this report" description={extra.reason} className="rounded-2xl border border-border bg-surface" />
      </>
    );
  }

  return (
    <>
      <PageHeader title={def.title} description={def.description} actions={back} className="print:hidden" />
      <div className="flex flex-col gap-4">
        <ReportFilterBar def={def} filters={filters} onChange={(patch) => write({ ...filters, ...patch })} onClear={() => write({})} />
        <ReportView def={def} filters={filters} result={data} loading={isLoading} />
      </div>
    </>
  );
}

export default function ReportPage() {
  return (
    <RequirePermission permission="reports.view">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <ReportScreen />
      </Suspense>
    </RequirePermission>
  );
}

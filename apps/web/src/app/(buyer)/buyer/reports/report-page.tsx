"use client";

import { useMemo, useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { Button, Card, CardContent, DataTable, EmptyState, ErrorState, PageHeader, Skeleton, type ColumnDef } from "@tobacco/ui";
import type { ReportDto, ReportType } from "@tobacco/shared";
import { buyerApi, describeError, saveBlob, useBuyerQuery } from "@/lib/api";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";

const labels: Record<ReportType, string> = {
  purchases: "Purchase reports",
  receiving: "Receiving reports",
  inventory: "Inventory reports",
  dispatches: "Processing reports",
  reconciliation: "Reconciliation reports",
};

const columns: Record<ReportType, string[]> = {
  purchases: ["reference", "saleDate", "totalBales", "totalMassKg", "totalUsdValue", "receivingStatus"],
  receiving: ["reference", "status", "startedAt", "confirmedAt", "reconciliation"],
  inventory: ["barcode", "season", "buyerGrade", "massKg", "usdValue", "status"],
  dispatches: ["reference", "dispatchDate", "status", "totalBales", "totalMassKg", "reason"],
  reconciliation: ["reference", "status", "startedAt", "confirmedAt", "reconciliation"],
};

export function BuyerReportPage({ type }: { type: ReportType }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useBuyerQuery<ReportDto>("/reports", { type, from: from || undefined, to: to || undefined, page: 1, pageSize: 50 }, { key: ["reports", type, from, to] });
  const fields = columns[type];
  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => fields.map((field) => ({
    id: field,
    header: field,
    accessorFn: (row) => {
      const value = row[field];
      return value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "—");
    },
  })), [fields]);

  async function exportReport(format: "pdf" | "xlsx" | "csv") {
    const params = new URLSearchParams({ type, format, page: "1", pageSize: "100" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const file = await buyerApi.download(`/reports/export?${params.toString()}`);
    saveBlob(file.blob, file.filename);
  }

  return (
    <RequireBuyerPermission permission="buyer.reports.view">
      <PageHeader title={labels[type]} description="Review company-wide records with an optional date range." />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); query.refetch(); }} aria-label="Report filters">
            <label className="text-sm"><span className="mb-1 block font-medium">From</span><input className="h-9 rounded-lg border border-border bg-background px-3" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">To</span><input className="h-9 rounded-lg border border-border bg-background px-3" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <Button type="submit" variant="secondary">Apply filters</Button>
            <Button type="button" variant="ghost" onClick={() => void exportReport("xlsx")} disabled={query.isPending}><Download aria-hidden /> Excel</Button>
            <Button type="button" variant="ghost" onClick={() => void exportReport("csv")} disabled={query.isPending}><Download aria-hidden /> CSV</Button>
            <Button type="button" variant="ghost" onClick={() => void exportReport("pdf")} disabled={query.isPending}><Download aria-hidden /> PDF</Button>
          </form>
          {query.isLoading ? <Skeleton className="h-72" /> : query.isError ? <ErrorState title="Could not load report" description={describeError(query.error)} action={<Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>} /> : !query.data?.items.length ? <EmptyState icon={FileBarChart} title="No records found" description="Try a different date range." /> : (
            <div>
              <DataTable
                data={query.data.items as Record<string, unknown>[]}
                columns={tableColumns}
                getRowId={(row, index) => String(row.id ?? row.reference ?? index)}
                searchPlaceholder="Search report rows"
                initialSorting={[{ id: fields[0], desc: false }]}
                aria-label={`${labels[type]} results`}
              />
              <p className="pt-3 text-xs text-muted-foreground" aria-live="polite">{query.data.total} record{query.data.total === 1 ? "" : "s"} · Generated {new Date(query.data.generatedAt).toLocaleString()}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </RequireBuyerPermission>
  );
}

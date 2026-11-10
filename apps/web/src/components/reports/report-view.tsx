"use client";

import { useMemo } from "react";
import { FileDown, Info, Printer, SearchX } from "lucide-react";
import { Callout, DataTable, EmptyState, Skeleton, StatCard, cn, type ColumnDef } from "@tobacco/ui";
import { formatDateTime } from "@tobacco/shared";
import { PermissionButton } from "@/lib/permissions";
import { downloadCsv } from "@/lib/csv";
import { displayValue, exportValue, type ReportDef, type ReportFilters, type ReportResult, type ReportRow } from "@/lib/reports";
import { ReportCell } from "./report-cell";

function filtersSummary(f: ReportFilters): string {
  const parts = Object.entries(f)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(" · ") : "no filters (all records)";
}

export function exportFilename(def: ReportDef, f: ReportFilters): string {
  const stamp = f.from && f.from === f.to ? f.from : [f.from, f.to].filter(Boolean).join("_to_") || "all";
  return `${def.slug}_${stamp}.csv`;
}

export function ReportView({
  def,
  filters,
  result,
  loading,
}: {
  def: ReportDef;
  filters: ReportFilters;
  result: ReportResult | undefined;
  loading: boolean;
}) {
  const columns = useMemo<ColumnDef<ReportRow, unknown>[]>(
    () =>
      (result?.columns ?? []).map((col) => ({
        id: col.key,
        header: col.header,
        accessorFn: (row) => row[col.key],
        cell: ({ row }) => <ReportCell col={col} row={row.original} />,
        sortUndefined: "last",
      })),
    [result?.columns],
  );

  if (loading || !result) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading report">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const exportCsv = () =>
    downloadCsv(
      exportFilename(def, filters),
      result.columns.map((c) => c.header),
      result.rows.map((r) => result.columns.map((c) => exportValue(c, r))),
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Interactive view (hidden when printing) */}
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" data-testid="report-summary">
            {result.rows.length} row{result.rows.length === 1 ? "" : "s"} · {filtersSummary(filters)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PermissionButton permission="reports.export" variant="secondary" onClick={exportCsv} disabled={result.rows.length === 0} data-testid="export-csv">
              <FileDown /> Export CSV
            </PermissionButton>
            <PermissionButton permission="reports.export" variant="secondary" onClick={() => window.print()} data-testid="export-pdf" title="Opens the print dialog — choose “Save as PDF”">
              <Printer /> Export PDF (print)
            </PermissionButton>
          </div>
        </div>

        <section aria-label="Summary" className={cn("grid grid-cols-2 gap-3", result.tiles.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
          {result.tiles.map((t) => (
            <StatCard key={t.label} label={t.label} value={t.value} hint={t.hint} data-testid={`tile-${t.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} />
          ))}
        </section>

        <DataTable
          data-testid="report-table"
          aria-label={`${def.title} results`}
          columns={columns}
          data={result.rows}
          pageSize={25}
          pageSizeOptions={[10, 25, 50, 100]}
          searchPlaceholder="Search this report…"
          emptyIcon={SearchX}
          emptyTitle="No records match these filters"
          emptyDescription="Widen the date range or clear a filter. Reports read the local demo data."
          hidePagerWhenSinglePage
        />

        <Callout tone="info" title="PDF export">
          “Export PDF” opens your browser's print dialog — choose <strong>Save as PDF</strong>. Server-generated PDFs arrive with the backend.
        </Callout>
        {result.notes && result.notes.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {result.notes.map((n) => (
              <li key={n} className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {n}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Print layout: every row, no chrome */}
      <div className="hidden print:block" data-testid="report-print">
        <h1 className="text-xl font-semibold">{def.title}</h1>
        <p className="mb-1 text-xs">
          {filtersSummary(filters)} · generated {formatDateTime(new Date().toISOString())} · demo data (not an official record)
        </p>
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {result.tiles.map((t) => (
            <span key={t.label}>
              <strong>{t.label}:</strong> {t.value}
            </span>
          ))}
        </div>
        {result.rows.length === 0 ? (
          <EmptyState title="No records match these filters" />
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {result.columns.map((c) => (
                  <th key={c.key} className={cn("border-b border-black px-1.5 py-1 text-left font-semibold", c.align === "right" && "text-right")}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={i} className="break-inside-avoid">
                  {result.columns.map((c) => (
                    <td key={c.key} className={cn("border-b border-neutral-300 px-1.5 py-1", c.align === "right" && "text-right")}>
                      {displayValue(c, r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {result.notes?.map((n) => (
          <p key={n} className="mt-2 text-[10px]">
            {n}
          </p>
        ))}
      </div>
    </div>
  );
}

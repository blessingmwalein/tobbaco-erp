"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, FileDown, FilterX, Lock, RefreshCw, Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  DateRangePicker,
  EmptyState,
  ErrorState,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  StatCard,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  toast,
} from "@tobacco/ui";
import { REPORT_AREAS, formatDecimal, reportsFor, type ReportArea, type ReportDefinition, type ReportExportFormat, type ReportResultDto, type ReportTone } from "@tobacco/shared";
import { buyerApi, describeError, saveBlob, useBuyerGuard, useBuyerQuery, useBuyerSession } from "@/lib/api";
import { PAGE_SIZES, freshState, hasActiveFilters, parseReportState, stateToParams, toFilterQuery, toPageQuery, withoutFilters, type ReportUiState } from "@/lib/report-url";
import { BuyerSelect } from "../buyer-resource";
import { ReportCellView } from "./report-cell";

const ALL = "__all";
const TONE: Record<ReportTone, "neutral" | "success" | "warning" | "danger"> = { neutral: "neutral", good: "success", warn: "warning", bad: "danger" };

type Warehouse = { id: string; code: string; name: string; bays: Array<{ id: string; code: string }> };
type PurchaseOption = { id: string; reference: string; saleDate: string; floorName: string };

/** Text box that updates the URL only after you pause typing. */
function DebouncedInput({ value, onCommit, label, placeholder, icon, testId }: { value: string; onCommit: (v: string) => void; label: string; placeholder: string; icon?: boolean; testId?: string }) {
  const [text, setText] = useState(value);
  const [committed, setCommitted] = useState(value);
  const [seen, setSeen] = useState(value);
  // An EXTERNAL change of the URL value (e.g. "Clear filters") replaces what is typed; the echo of our own commit does not.
  if (value !== seen) {
    setSeen(value);
    if (value !== committed) {
      setText(value);
      setCommitted(value);
    }
  }
  const latest = useRef(onCommit);
  useEffect(() => {
    latest.current = onCommit;
  });
  useEffect(() => {
    if (text === committed) return;
    const t = setTimeout(() => {
      setCommitted(text);
      latest.current(text);
    }, 350);
    return () => clearTimeout(t);
  }, [text, committed]);
  return (
    <div className="relative">
      {icon ? <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /> : null}
      <Input aria-label={label} data-testid={testId} className={icon ? "pl-9" : undefined} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function ReportWorkbench({ area }: { area: ReportArea }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const permissions = useBuyerSession((s) => s.principal?.permissions);
  const available = useMemo(() => reportsFor(permissions, area), [permissions, area]);
  const areaInfo = REPORT_AREAS.find((a) => a.id === area)!;
  const exportGuard = useBuyerGuard("buyer.reports.export");

  const first = available[0]?.id ?? "";
  const state = useMemo(() => parseReportState(new URLSearchParams(params.toString()), first), [params, first]);
  // a URL naming a report this role may not run (or one from another area) falls back to the first allowed report
  const def: ReportDefinition | undefined = available.find((r) => r.id === state.report) ?? available[0];

  const navigate = useCallback(
    (next: ReportUiState) => {
      const qs = stateToParams(next, first).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, first],
  );
  /** Change filters: always back to page 1. */
  const patch = useCallback((change: Partial<ReportUiState>) => navigate({ ...state, ...change, page: 1 }), [navigate, state]);

  // ── option lists (only fetched when the report has the filter) ─────────────
  const needsWarehouses = Boolean(def?.filters.includes("warehouseId") || def?.filters.includes("bayId"));
  const warehouses = useBuyerQuery<Warehouse[]>("/warehouses", undefined, { enabled: needsWarehouses, key: ["reports", "warehouse-options"] });
  const purchases = useBuyerQuery<{ items: PurchaseOption[] }>("/buyer/purchases", { page: 1, pageSize: 100 }, { enabled: Boolean(def?.filters.includes("purchaseId")), key: ["reports", "purchase-options"] });
  const selectedWarehouse = warehouses.data?.find((w) => w.id === state.warehouseId);

  // ── data ───────────────────────────────────────────────────────────────────
  const query = useBuyerQuery<ReportResultDto>(`/buyer/reports/${def?.id ?? "none"}`, def ? toPageQuery(state, def) : undefined, { enabled: Boolean(def), key: ["reports", def?.id ?? "none"] });
  const result = query.data && query.data.reportId === def?.id ? query.data : undefined;

  // ── export ─────────────────────────────────────────────────────────────────
  const [busy, setBusy] = useState<ReportExportFormat | null>(null);
  const exportAs = async (format: ReportExportFormat) => {
    if (!def) return;
    setBusy(format);
    try {
      const file = await buyerApi.download(`/buyer/reports/${def.id}/export`, { query: { ...toFilterQuery(state, def), format } });
      saveBlob(file.blob, file.filename);
      toast.success(`${file.filename} downloaded`);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  if (available.length === 0) {
    return (
      <>
        <PageHeader title={areaInfo.title} description={areaInfo.description} />
        <EmptyState icon={Lock} title="No reports available for your role" description="Ask your company's Buyer Administrator for access to the data these reports cover." className="rounded-2xl border border-border bg-surface" />
      </>
    );
  }
  if (!def) return null;

  const sortKey = state.sort && def.columns.some((c) => c.key === state.sort && c.sortable) ? state.sort : state.onlyVariances && def.varianceSort ? def.varianceSort.key : def.defaultSort.key;
  const sortDir = state.sort ? (state.dir ?? "asc") : state.onlyVariances && def.varianceSort ? def.varianceSort.dir : def.defaultSort.dir;
  const toggleSort = (key: string) => navigate({ ...state, sort: key, dir: sortKey === key && sortDir === "asc" ? "desc" : "asc", page: 1 });

  const filters = new Set(def.filters);
  const active = hasActiveFilters(state);
  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  const from = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const to = Math.min(total, state.page * state.pageSize);
  const exportReason = !exportGuard.allowed ? exportGuard.reason : total === 0 ? "There is nothing to export for these filters" : undefined;

  return (
    <>
      <PageHeader title={areaInfo.title} description={areaInfo.description} />

      <nav aria-label={`${areaInfo.title} — choose a report`} className="mb-4 -mx-1 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-2">
          {available.map((r) => {
            const current = r.id === def.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  data-testid={`report-tab-${r.id}`}
                  aria-current={current ? "page" : undefined}
                  onClick={() => !current && navigate(freshState(r.id, state.pageSize))}
                  className={cn(
                    "rounded-xl border px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                    current ? "border-primary bg-primary-soft font-medium text-primary-soft-foreground" : "border-border bg-surface text-muted-foreground hover:bg-surface-tertiary hover:text-foreground",
                  )}
                >
                  {r.title}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{def.title}</h2>
        <p className="max-w-4xl text-sm text-muted-foreground">{def.description}</p>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-5">
          <form role="search" aria-label="Report filters" onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="report-filters">
            {filters.has("dateRange") ? (
              <FilterField label={def.dateLabel ?? "Date"}>
                <DateRangePicker aria-label={def.dateLabel ?? "Date range"} data-testid="report-date-range" value={{ from: state.from, to: state.to }} onChange={(r) => patch({ from: r.from, to: r.to })} />
              </FilterField>
            ) : null}
            {filters.has("search") ? (
              <FilterField label="Search">
                <DebouncedInput icon testId="report-search" label="Search this report" placeholder="Reference, barcode, grower…" value={state.search ?? ""} onCommit={(v) => patch({ search: v || undefined })} />
              </FilterField>
            ) : null}
            {filters.has("floor") ? (
              <FilterField label="Floor">
                <DebouncedInput label="Floor" placeholder="e.g. ETHICAL SALES FLOOR" value={state.floor ?? ""} onCommit={(v) => patch({ floor: v || undefined })} />
              </FilterField>
            ) : null}
            {filters.has("grade") ? (
              <FilterField label="Buyer grade">
                <DebouncedInput label="Buyer grade" placeholder="e.g. L4OMA" value={state.grade ?? ""} onCommit={(v) => patch({ grade: v || undefined })} />
              </FilterField>
            ) : null}
            {filters.has("status") && def.statusOptions ? (
              <FilterField label={def.statusLabel ?? "Status"}>
                <BuyerSelect label={def.statusLabel ?? "Status"} value={state.status ?? ALL} placeholder="All" onValueChange={(v) => patch({ status: v === ALL ? undefined : v })} options={[{ value: ALL, label: "All" }, ...def.statusOptions]} />
              </FilterField>
            ) : null}
            {filters.has("kind") && def.kindOptions ? (
              <FilterField label={def.kindLabel ?? "Type"}>
                <BuyerSelect label={def.kindLabel ?? "Type"} value={state.kind ?? ALL} placeholder="All" onValueChange={(v) => patch({ kind: v === ALL ? undefined : v })} options={[{ value: ALL, label: "All" }, ...def.kindOptions]} />
              </FilterField>
            ) : null}
            {filters.has("purchaseId") ? (
              <FilterField label="Purchase">
                <BuyerSelect
                  label="Purchase"
                  value={state.purchaseId ?? ALL}
                  placeholder="All purchases"
                  onValueChange={(v) => patch({ purchaseId: v === ALL ? undefined : v })}
                  options={[{ value: ALL, label: "All purchases" }, ...(purchases.data?.items ?? []).map((p) => ({ value: p.id, label: `${p.reference} · ${p.saleDate}` }))]}
                />
              </FilterField>
            ) : null}
            {filters.has("warehouseId") ? (
              <FilterField label="Warehouse">
                <BuyerSelect
                  label="Warehouse"
                  value={state.warehouseId ?? ALL}
                  placeholder="All warehouses"
                  onValueChange={(v) => patch({ warehouseId: v === ALL ? undefined : v, bayId: undefined })}
                  options={[{ value: ALL, label: "All warehouses" }, ...(warehouses.data ?? []).map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))]}
                />
              </FilterField>
            ) : null}
            {filters.has("bayId") ? (
              <FilterField label="Bay">
                <BuyerSelect
                  label="Bay"
                  value={state.bayId ?? ALL}
                  placeholder={selectedWarehouse ? "All bays" : "Choose a warehouse first"}
                  onValueChange={(v) => patch({ bayId: v === ALL ? undefined : v })}
                  options={[{ value: ALL, label: "All bays" }, ...(selectedWarehouse?.bays ?? []).map((b) => ({ value: b.id, label: b.code }))]}
                />
              </FilterField>
            ) : null}
            {filters.has("onlyVariances") ? (
              <div className="flex items-end pb-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch checked={state.onlyVariances} onCheckedChange={(v) => patch({ onlyVariances: v })} aria-label="Only with differences" data-testid="report-only-variances" />
                  Only with differences
                </label>
              </div>
            ) : null}
            {filters.has("includeEmpty") ? (
              <div className="flex items-end pb-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch checked={state.includeEmpty} onCheckedChange={(v) => patch({ includeEmpty: v })} aria-label="Include empty rows" />
                  Include empty rows
                </label>
              </div>
            ) : null}
            {active ? (
              <div className="flex items-end">
                <Button type="button" variant="ghost" onClick={() => navigate(withoutFilters(state))} data-testid="report-clear-filters">
                  <FilterX /> Clear filters
                </Button>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {query.isError && !result ? (
        <Card>
          <CardContent className="pt-6">
            <ErrorState title="Could not load this report" description={describeError(query.error)} action={<Button variant="secondary" onClick={() => void query.refetch()}><RefreshCw /> Try again</Button>} />
          </CardContent>
        </Card>
      ) : !result ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading report">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          {result.tiles.length ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="report-tiles" aria-label="Key figures">
              {result.tiles.map((t) => (
                <StatCard key={t.label} label={t.label} value={t.value} hint={t.detail} tone={TONE[t.tone ?? "neutral"]} data-testid="report-tile" />
              ))}
            </div>
          ) : null}

          <Card>
            <CardContent className="space-y-4 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="report-row-count">
                  {total === 0 ? "No rows" : `Showing ${formatDecimal(from, 0)}–${formatDecimal(to, 0)} of ${formatDecimal(total, 0)} row${total === 1 ? "" : "s"}`}
                  {query.isFetching ? " · refreshing…" : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Export this report">
                  <span className="hidden text-xs text-muted-foreground sm:inline">Exports all {formatDecimal(total, 0)} matching rows</span>
                  <Button type="button" variant="secondary" size="sm" data-testid="report-export-pdf" loading={busy === "pdf"} disabled={Boolean(exportReason) || busy !== null} disabledReason={exportReason} onClick={() => void exportAs("pdf")}>
                    <FileText /> PDF
                  </Button>
                  <Button type="button" variant="secondary" size="sm" data-testid="report-export-xlsx" loading={busy === "xlsx"} disabled={Boolean(exportReason) || busy !== null} disabledReason={exportReason} onClick={() => void exportAs("xlsx")}>
                    <FileSpreadsheet /> Excel
                  </Button>
                  <Button type="button" variant="secondary" size="sm" data-testid="report-export-csv" loading={busy === "csv"} disabled={Boolean(exportReason) || busy !== null} disabledReason={exportReason} onClick={() => void exportAs("csv")}>
                    <FileDown /> CSV
                  </Button>
                </div>
              </div>

              {total === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No rows match these filters"
                  description={active ? "Try a wider date range or clear some filters." : "There is nothing to report yet."}
                  action={active ? <Button variant="secondary" onClick={() => navigate(withoutFilters(state))}><FilterX /> Clear filters</Button> : undefined}
                />
              ) : (
                <Table aria-label={def.title} data-testid="report-table">
                  <TableHeader>
                    <TableRow>
                      {def.columns.map((c, ci) => {
                        const right = (c.align ?? (["int", "mass", "money", "percent"].includes(c.format) ? "right" : "left")) === "right";
                        const sorted = sortKey === c.key;
                        return (
                          <TableHead key={c.key} aria-sort={c.sortable ? (sorted ? (sortDir === "asc" ? "ascending" : "descending") : "none") : undefined} className={cn("whitespace-nowrap", right && "text-right", ci === 0 && "sticky left-0 z-20 bg-surface-secondary")}>
                            {c.sortable ? (
                              <button type="button" onClick={() => toggleSort(c.key)} aria-label={`Sort by ${c.header}`} className={cn("inline-flex items-center gap-1 rounded-md hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary", right && "flex-row-reverse")}>
                                {c.header}
                                {sorted ? sortDir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                              </button>
                            ) : (
                              c.header
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row, i) => (
                      <TableRow key={i} data-testid="report-row">
                        {def.columns.map((c, ci) => {
                          const right = (c.align ?? (["int", "mass", "money", "percent"].includes(c.format) ? "right" : "left")) === "right";
                          const wide = c.format === "text" && c.width !== undefined && c.width >= 2;
                          return (
                            <TableCell key={c.key} className={cn("tabular", right && "text-right", wide ? "min-w-72 whitespace-normal" : "whitespace-nowrap", ci === 0 && "sticky left-0 z-10 bg-surface")}>
                              <ReportCellView value={row[c.key]} column={c} />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                    {result.totals ? (
                      <TableRow className="border-t-2 border-border-strong bg-surface-secondary font-semibold" data-testid="report-totals">
                        {def.columns.map((c, i) => {
                          const right = (c.align ?? (["int", "mass", "money", "percent"].includes(c.format) ? "right" : "left")) === "right";
                          const v = result.totals?.[c.key];
                          return (
                            <TableCell key={c.key} className={cn("tabular whitespace-nowrap", right && "text-right", i === 0 && "sticky left-0 z-10 bg-surface-secondary")}>
                              {i === 0 && (v === undefined || v === null) ? `Total · all ${formatDecimal(total, 0)} rows` : v === undefined || v === null ? "" : <ReportCellView value={v} column={c} />}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              )}

              {total > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Rows per page
                    <NativeSelect size="sm" wrapperClassName="w-20" aria-label="Rows per page" value={String(state.pageSize)} onChange={(e) => navigate({ ...state, pageSize: Number(e.target.value), page: 1 })}>
                      {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </NativeSelect>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="tabular text-xs text-muted-foreground">Page {state.page} of {pages}</span>
                    <Button type="button" variant="secondary" size="icon-sm" aria-label="Previous page" disabled={state.page <= 1} onClick={() => navigate({ ...state, page: state.page - 1 })}><ChevronLeft /></Button>
                    <Button type="button" variant="secondary" size="icon-sm" aria-label="Next page" disabled={state.page >= pages} onClick={() => navigate({ ...state, page: state.page + 1 })}><ChevronRight /></Button>
                  </div>
                </div>
              ) : null}

              {result.notes.length ? (
                <ul className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground" aria-label="About this report">
                  {result.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              ) : null}
              <p className="text-xs text-muted-foreground">Generated {new Date(result.generatedAt).toLocaleString("en-GB", { timeZone: "Africa/Harare" })} (Harare time)</p>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}


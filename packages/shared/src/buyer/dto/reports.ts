/** Wire types for the Buyer Portal reports (shared by the API, the exports and the web workbench). */

export type ReportArea = "purchases" | "receiving" | "inventory";

/** How a column's raw value is shown (web cell, PDF text) and typed (Excel cell). */
export type ReportColumnFormat = "text" | "mono" | "int" | "mass" | "money" | "percent" | "date" | "datetime" | "status";

export interface ReportColumnDto {
  key: string;
  header: string;
  format: ReportColumnFormat;
  align?: "left" | "right" | "center";
  /** For `money` columns. */
  currency?: "USD" | "ZiG";
  /** May be used as `sort` (server-side, whitelisted). */
  sortable?: boolean;
  /** Relative width hint for PDF/Excel (default depends on the format). */
  width?: number;
}

export type ReportTone = "neutral" | "good" | "warn" | "bad";

export interface ReportTileDto {
  label: string;
  value: string;
  detail?: string;
  tone?: ReportTone;
}

/** Filters a report can declare; the workbench renders exactly the ones listed. */
export type ReportFilterKey =
  | "dateRange"
  | "floor"
  | "search"
  | "status"
  | "kind"
  | "purchaseId"
  | "warehouseId"
  | "bayId"
  | "grade"
  | "onlyVariances"
  | "includeEmpty";

export type ReportCell = string | number | boolean | null;
/** Raw values: money/mass as decimal strings, counts as numbers, dates as ISO strings. */
export type ReportRow = Record<string, ReportCell>;

export interface ReportAppliedFilter {
  label: string;
  value: string;
}

export interface ReportResultDto {
  reportId: string;
  area: ReportArea;
  title: string;
  description: string;
  generatedAt: string;
  /** Human-readable filters that were applied (for the page, the PDF header and the Excel summary). */
  filters: ReportAppliedFilter[];
  columns: ReportColumnDto[];
  /** One page of rows. */
  rows: ReportRow[];
  /** Totals over the WHOLE filtered set (not just this page), where the report has additive columns. */
  totals: ReportRow | null;
  tiles: ReportTileDto[];
  /** Rows matching the filters across all pages. */
  total: number;
  page: number;
  pageSize: number;
  notes: string[];
}

export type ReportExportFormat = "pdf" | "xlsx" | "csv";

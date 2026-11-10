import type { MockDb, Permission } from "@tobacco/shared";

/**
 * Reports are PURE selectors over the DB (brief Part 11). In Phase 2 the same shapes are served by read models/views.
 * Rows hold RAW values (cents as integers, ISO dates); `format` says how to display and export them.
 */
export type FilterKey = "date" | "season" | "sellingPoint" | "grower" | "buyer" | "creditor" | "batch" | "status" | "user";

export interface ReportFilters {
  from?: string;
  to?: string;
  season?: string;
  sellingPoint?: string;
  grower?: string;
  buyer?: string;
  creditor?: string;
  batch?: string;
  status?: string;
  user?: string;
}

export type CellFormat = "text" | "mono" | "int" | "mass" | "date" | "datetime" | "amount" | "status";
export type StatusKindName = "deliveryNote" | "sale" | "priceBatch" | "dispatch" | "paymentLine";

export interface ReportColumn {
  key: string;
  header: string;
  format?: CellFormat;
  /** For `amount`: the row key holding the currency code (default USD). Cell value = integer cents. */
  currencyKey?: string;
  /** For `status`: which status vocabulary to render. */
  statusKind?: StatusKindName;
  align?: "right";
}

export type Cell = string | number | null;
export type ReportRow = Record<string, Cell>;

export interface ReportTile {
  label: string;
  value: string;
  hint?: string;
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: ReportRow[];
  tiles: ReportTile[];
  /** Caveats shown under the table (unverified formulas, demo-only data…). */
  notes?: string[];
}

export type ReportArea = "Receiving & tickets" | "Floor & sales" | "Finance" | "Dispatch" | "Administration";

export interface ReportDef {
  slug: string;
  title: string;
  description: string;
  area: ReportArea;
  filters: FilterKey[];
  /** Label for the `status` filter (e.g. "Delivery state", "Source"). */
  statusLabel?: string;
  statusOptions?: Array<{ value: string; label: string }>;
  /** Which batch the `batch` filter means. */
  batchKind?: "pay" | "price";
  /** Permission needed in addition to reports.view (default none). */
  permission?: Permission;
  /** Report lives elsewhere (e.g. grower sales sheets). */
  externalHref?: string;
  defaultFilters?: (db: MockDb) => ReportFilters;
  run: (db: MockDb, filters: ReportFilters) => ReportResult;
}

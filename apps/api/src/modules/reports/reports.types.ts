import type { ReportRow, ReportTileDto } from "@tobacco/shared";
import type { ReportFilters } from "@tobacco/validation";
import type { TenantClient } from "../../database/prisma.service";

export type Paging = { page: number; pageSize: number } | "all";

export interface ReportRunContext {
  db: TenantClient;
  orgId: string;
  filters: ReportFilters;
  paging: Paging;
  sort?: { key: string; dir: "asc" | "desc" };
  now: Date;
}

export interface ReportData {
  /** The requested page of rows (or every row for an export). */
  rows: ReportRow[];
  /** Rows matching the filters across all pages. */
  total: number;
  tiles: ReportTileDto[];
  /** Totals over the whole filtered set, keyed like the columns. */
  totals: ReportRow | null;
  /** Extra notes for this run (e.g. a cap that was applied), appended to the report's standing notes. */
  notes?: string[];
}

export type ReportRunner = (ctx: ReportRunContext) => Promise<ReportData>;

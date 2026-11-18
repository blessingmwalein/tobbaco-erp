import type { ReportDefinition } from "@tobacco/shared";

/**
 * Report page state <-> URL query string. The URL is the single source of truth, so every view of a report
 * (report, filters, page, sort) can be bookmarked, shared and survives a reload.
 */
export interface ReportUiState {
  report: string;
  from?: string;
  to?: string;
  floor?: string;
  search?: string;
  status?: string;
  kind?: string;
  purchaseId?: string;
  warehouseId?: string;
  bayId?: string;
  grade?: string;
  onlyVariances: boolean;
  includeEmpty: boolean;
  page: number;
  pageSize: number;
  sort?: string;
  dir?: "asc" | "desc";
}

export const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

/** URL parameter name for each state key (short, readable). */
const PARAM = {
  report: "report",
  from: "from",
  to: "to",
  floor: "floor",
  search: "q",
  status: "status",
  kind: "kind",
  purchaseId: "purchase",
  warehouseId: "warehouse",
  bayId: "bay",
  grade: "grade",
  onlyVariances: "diff",
  includeEmpty: "empty",
  page: "page",
  pageSize: "size",
  sort: "sort",
  dir: "dir",
} as const;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: string | null): string | undefined => (v && v.length > 0 ? v : undefined);
const day = (v: string | null): string | undefined => (v && ISO_DAY.test(v) ? v : undefined);
const int = (v: string | null, fallback: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
};

export function parseReportState(params: URLSearchParams, fallbackReport: string): ReportUiState {
  const size = int(params.get(PARAM.pageSize), DEFAULT_PAGE_SIZE);
  const dir = params.get(PARAM.dir);
  return {
    report: text(params.get(PARAM.report)) ?? fallbackReport,
    from: day(params.get(PARAM.from)),
    to: day(params.get(PARAM.to)),
    floor: text(params.get(PARAM.floor)),
    search: text(params.get(PARAM.search)),
    status: text(params.get(PARAM.status)),
    kind: text(params.get(PARAM.kind)),
    purchaseId: text(params.get(PARAM.purchaseId)),
    warehouseId: text(params.get(PARAM.warehouseId)),
    bayId: text(params.get(PARAM.bayId)),
    grade: text(params.get(PARAM.grade)),
    onlyVariances: params.get(PARAM.onlyVariances) === "1",
    includeEmpty: params.get(PARAM.includeEmpty) === "1",
    page: int(params.get(PARAM.page), 1),
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
    sort: text(params.get(PARAM.sort)),
    dir: dir === "asc" || dir === "desc" ? dir : undefined,
  };
}

/** Serialise, leaving out anything that equals its default so URLs stay short. */
export function stateToParams(state: ReportUiState, firstReport: string): URLSearchParams {
  const p = new URLSearchParams();
  const set = (key: keyof typeof PARAM, value: string | undefined) => value && p.set(PARAM[key], value);
  if (state.report !== firstReport) set("report", state.report);
  set("from", state.from);
  set("to", state.to);
  set("floor", state.floor);
  set("search", state.search);
  set("status", state.status);
  set("kind", state.kind);
  set("purchaseId", state.purchaseId);
  set("warehouseId", state.warehouseId);
  set("bayId", state.bayId);
  set("grade", state.grade);
  if (state.onlyVariances) p.set(PARAM.onlyVariances, "1");
  if (state.includeEmpty) p.set(PARAM.includeEmpty, "1");
  if (state.page > 1) p.set(PARAM.page, String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) p.set(PARAM.pageSize, String(state.pageSize));
  set("sort", state.sort);
  if (state.sort && state.dir) p.set(PARAM.dir, state.dir);
  return p;
}

const FILTER_KEYS = ["from", "to", "floor", "search", "status", "kind", "purchaseId", "warehouseId", "bayId", "grade"] as const;

/** A fresh state for another report: nothing carries over (what a filter means differs per report). */
export const freshState = (report: string, pageSize = DEFAULT_PAGE_SIZE): ReportUiState => ({ report, onlyVariances: false, includeEmpty: false, page: 1, pageSize });

export function hasActiveFilters(state: ReportUiState): boolean {
  return FILTER_KEYS.some((k) => state[k] !== undefined) || state.onlyVariances || state.includeEmpty;
}

export function withoutFilters(state: ReportUiState): ReportUiState {
  return { ...freshState(state.report, state.pageSize), sort: state.sort, dir: state.dir };
}

type Query = Record<string, string | number | boolean | undefined>;

/** Query string for the API: only the filters this report declares (so a stale URL can never send a meaningless filter). */
export function toFilterQuery(state: ReportUiState, def: ReportDefinition): Query {
  const has = (k: ReportDefinition["filters"][number]) => def.filters.includes(k);
  return {
    from: has("dateRange") ? state.from : undefined,
    to: has("dateRange") ? state.to : undefined,
    floor: has("floor") ? state.floor : undefined,
    search: has("search") ? state.search : undefined,
    status: has("status") ? state.status : undefined,
    kind: has("kind") ? state.kind : undefined,
    purchaseId: has("purchaseId") ? state.purchaseId : undefined,
    warehouseId: has("warehouseId") ? state.warehouseId : undefined,
    bayId: has("bayId") ? state.bayId : undefined,
    grade: has("grade") ? state.grade : undefined,
    onlyVariances: has("onlyVariances") && state.onlyVariances ? true : undefined,
    includeEmpty: has("includeEmpty") && state.includeEmpty ? true : undefined,
    sort: state.sort,
    dir: state.sort ? state.dir : undefined,
  };
}

export const toPageQuery = (state: ReportUiState, def: ReportDefinition): Query => ({ ...toFilterQuery(state, def), page: state.page, pageSize: state.pageSize });

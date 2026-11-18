import { z } from "zod";
import { REPORT_IDS } from "@tobacco/shared";
import { isoDateSchema, uuidSchema } from "./common";

/** "" / null from a cleared URL parameter means "not set". */
const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const text = (max = 100) => z.preprocess(blank, z.string().trim().max(max).optional());
const flag = z.preprocess((v) => (v === "true" || v === "1" || v === true ? true : v === "false" || v === "0" || v === false || v === undefined || v === "" ? false : v), z.boolean());

export const reportIdSchema = z.enum(REPORT_IDS);

export const MAX_REPORT_PAGE_SIZE = 100;
/** Export hard cap: more rows than this is refused with a hint to narrow the filters (Excel's own limit is ~1,048,576). */
export const MAX_EXPORT_ROWS = 50_000;

/** Filters shared by every report; each report uses only the ones it declares in the catalogue. */
export const reportFiltersSchema = z.object({
  from: z.preprocess(blank, isoDateSchema.optional()),
  to: z.preprocess(blank, isoDateSchema.optional()),
  floor: text(),
  /** Barcode, reference, grower, lot … — NOT trimmed beyond the edges of the query string (a barcode may end in a space). */
  search: z.preprocess(blank, z.string().max(100).optional()),
  status: text(40),
  kind: text(40),
  purchaseId: z.preprocess(blank, uuidSchema.optional()),
  warehouseId: z.preprocess(blank, uuidSchema.optional()),
  bayId: z.preprocess(blank, uuidSchema.optional()),
  grade: text(40),
  onlyVariances: flag,
  includeEmpty: flag,
});
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

const refineRange = <T extends { from?: string; to?: string }>(v: T) => !v.from || !v.to || v.from <= v.to;
const rangeMessage = { path: ["to"], message: "The end date must not be before the start date" };

export const reportQuerySchema = reportFiltersSchema
  .extend({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_REPORT_PAGE_SIZE).default(25),
    sort: text(40),
    dir: z.enum(["asc", "desc"]).optional(),
  })
  .refine(refineRange, rangeMessage);
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const reportExportQuerySchema = reportFiltersSchema
  .extend({
    format: z.enum(["pdf", "xlsx", "csv"]),
    sort: text(40),
    dir: z.enum(["asc", "desc"]).optional(),
  })
  .refine(refineRange, rangeMessage);
export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;

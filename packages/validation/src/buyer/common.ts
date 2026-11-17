import { z } from "zod";

export const MAX_PAGE_SIZE = 100;

/** Query-string pagination shared by every list endpoint. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  search: z.string().trim().max(100).optional(),
  sort: z.string().trim().max(40).optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export const uuidSchema = z.string().uuid("Invalid id");
export const idParamSchema = z.object({ id: uuidSchema });

/** yyyy-mm-dd calendar date. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format yyyy-mm-dd");

export const invoiceQuerySchema = pageQuerySchema.extend({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  floor: z.string().trim().max(120).optional(),
});
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;

export const purchaseReceivingStatusSchema = z.enum([
  "NOT_STARTED",
  "PARTIALLY_DISPATCHED",
  "IN_PROGRESS",
  "PARTIALLY_RECEIVED",
  "PARTIAL",
  "COMPLETE",
]);

export const purchaseQuerySchema = pageQuerySchema.extend({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  floor: z.string().trim().max(120).optional(),
  /** Filter by the buyer name printed on the source invoice. */
  buyer: z.string().trim().max(160).optional(),
  /** Filter by the source invoice number/reference. */
  invoiceNumber: z.string().trim().max(120).optional(),
  status: purchaseReceivingStatusSchema.optional(),
  /** Filter by the purchase-level reconciliation status. */
  reconciliationStatus: z.enum(["AWAITING_SHIPMENTS", "IN_PROGRESS", "CLOSED"]).optional(),
});
export type PurchaseQuery = z.infer<typeof purchaseQuerySchema>;

export const dateRangeQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

/** Decimal in a string with at most `scale` fraction digits (money / weights are never JS floats). */
export const decimalString = (scale = 2) =>
  z.string().trim().regex(new RegExp(`^-?\d+(\.\d{1,${scale}})?$`), `Enter a number with at most ${scale} decimal places`);

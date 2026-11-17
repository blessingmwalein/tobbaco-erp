import { z } from "zod";
import { uuidSchema } from "./common";

/** Query for the purchase-level reconciliation register. */
export const reconciliationQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["AWAITING_SHIPMENTS", "IN_PROGRESS", "CLOSED"]).optional(),
  floor: z.string().trim().max(120).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format yyyy-mm-dd").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format yyyy-mm-dd").optional(),
});
export type ReconciliationQuery = z.infer<typeof reconciliationQuerySchema>;

/** Reason captured when an authorised user closes a purchase-level reconciliation. */
export const reconciliationCloseSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type ReconciliationCloseInput = z.infer<typeof reconciliationCloseSchema>;

/** Allocate all received-and-reconciled bales for a closed purchase to a warehouse/bay/row sequence. */
export const reconciliationAllocateSchema = z.object({
  warehouseId: uuidSchema,
  bayId: uuidSchema,
  startingRowId: uuidSchema,
});
export type ReconciliationAllocateInput = z.infer<typeof reconciliationAllocateSchema>;

/** Reconciliation report format selector. */
export const reconciliationReportFormatSchema = z.enum(["pdf", "csv", "json"]);
export type ReconciliationReportFormat = z.infer<typeof reconciliationReportFormatSchema>;

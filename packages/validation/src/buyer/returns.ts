import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./common";
import { decimal } from "./processing";

export const returnOutcomeSchema = z.enum(["RETURNED", "DAMAGED", "REGRADED", "REIDENTIFIED", "UNEXPECTED", "MISSING"]);
export const returnBaleSchema = z.object({
  dispatchBaleId: uuidSchema.nullable().optional(),
  scannedBarcode: z.string().min(1).max(32),
  outcome: returnOutcomeSchema,
  returnedMassKg: decimal.nullable().optional(),
  newBarcode: z.string().min(9).max(10).optional(),
  newBuyerGrade: z.string().trim().max(40).nullable().optional(),
  newTimbGrade: z.string().trim().max(40).nullable().optional(),
  condition: z.string().trim().max(200).nullable().optional(),
  explanation: z.string().trim().max(1000).nullable().optional(),
  warehouseId: uuidSchema.nullable().optional(),
  bayId: uuidSchema.nullable().optional(),
  rowId: uuidSchema.nullable().optional(),
});
export const createProcessingReturnSchema = z.object({ dispatchId: uuidSchema, notes: z.string().trim().max(1000).nullable().optional() });
export const confirmProcessingReturnSchema = z.object({
  bales: z.array(returnBaleSchema).min(1),
  explanation: z.string().trim().max(1000).nullable().optional(),
});
export type ReturnOutcomeInput = z.infer<typeof returnOutcomeSchema>;
export type ReturnBaleInput = z.infer<typeof returnBaleSchema>;
export type CreateProcessingReturnInput = z.infer<typeof createProcessingReturnSchema>;
export type ConfirmProcessingReturnInput = z.infer<typeof confirmProcessingReturnSchema>;

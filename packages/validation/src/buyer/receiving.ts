import { z } from "zod";
import { decimalString, uuidSchema } from "./common";
export const receivingSessionSchema = z.object({ purchaseId: uuidSchema, reference: z.string().trim().min(1).max(80), defaultWarehouseId: uuidSchema.optional(), defaultBayId: uuidSchema.optional(), defaultRowId: uuidSchema.optional(), notes: z.string().trim().max(500).optional() });
export const receivingScanSchema = z.object({ barcode: z.string().min(1).max(32), massKg: decimalString(1).optional(), warehouseId: uuidSchema.optional(), bayId: uuidSchema.optional(), rowId: uuidSchema.optional(), note: z.string().trim().max(500).optional() });
export const receivingConfirmSchema = z.object({ warehouseId: uuidSchema, bayId: uuidSchema, startingRowId: uuidSchema });
export const receivingExceptionResolveSchema = z.object({ resolution: z.string().trim().min(1).max(500) });

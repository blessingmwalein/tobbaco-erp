import { z } from "zod";
import { uuidSchema } from "./common";
export const movementSchema = z.object({ baleId: uuidSchema.optional(), barcode: z.string().max(32).optional(), warehouseId: uuidSchema, bayId: uuidSchema.optional(), rowId: uuidSchema.optional(), reason: z.string().trim().min(1).max(300), note: z.string().trim().max(500).optional() }).refine((v) => Boolean(v.baleId || v.barcode), { message: "baleId or barcode is required" });

import { z } from "zod";
import { uuidSchema } from "./common";
export const warehouseSchema = z.object({ code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120), kind: z.enum(["STANDARD", "PROCESSING"]).default("STANDARD"), address: z.string().trim().max(300).optional() });
export const warehouseUpdateSchema = warehouseSchema.partial().extend({ active: z.boolean().optional() });
export const baySchema = z.object({ code: z.string().trim().min(1).max(40), name: z.string().trim().max(120).optional() });
export const rowSchema = z.object({ code: z.string().trim().min(1).max(40), capacityBales: z.number().int().positive().optional() });
export const warehouseInventoryQuerySchema = z.object({ status: z.string().optional(), bayId: uuidSchema.optional(), rowId: uuidSchema.optional(), search: z.string().trim().max(100).optional() });

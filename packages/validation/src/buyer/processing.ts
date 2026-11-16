import { z } from "zod";
import { companyProfileSchema } from "./buyer-admin";
import { isoDateSchema, pageQuerySchema, uuidSchema } from "./common";

const text = (max: number) => z.string().trim().min(1).max(max);
const decimal = z.string().regex(/^\d+(?:\.\d{1,3})?$/);
export const processingCompanySchema = companyProfileSchema;
export const createProcessingCompanySchema = processingCompanySchema;
export const updateProcessingCompanySchema = processingCompanySchema.partial().refine((v) => Object.keys(v).length > 0, "Nothing to change");
export const processingCompanyStatusSchema = z.object({ active: z.boolean() });
export const createDispatchSchema = z.object({
  processingCompanyId: uuidSchema,
  dispatchDate: isoDateSchema,
  reason: text(300),
  notes: text(1000).nullable().optional(),
  documentId: uuidSchema.nullable().optional(),
  baleIds: z.array(uuidSchema).min(1).max(1000),
});
export const dispatchQuerySchema = pageQuerySchema;
export type ProcessingCompanyInput = z.infer<typeof processingCompanySchema>;
export type CreateProcessingCompanyInput = z.infer<typeof createProcessingCompanySchema>;
export type UpdateProcessingCompanyInput = z.infer<typeof updateProcessingCompanySchema>;
export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
export type DispatchQuery = z.infer<typeof dispatchQuerySchema>;
export { decimal };

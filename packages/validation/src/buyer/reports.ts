import { z } from "zod";

export const reportTypeSchema = z.enum(["inventory", "purchases", "receiving", "dispatches"]);
export const reportFormatSchema = z.enum(["json", "pdf", "xlsx"]);
export const reportQuerySchema = z.object({
  type: reportTypeSchema.default("inventory"),
  format: reportFormatSchema.default("json"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

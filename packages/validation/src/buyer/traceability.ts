import { z } from "zod";

export const traceabilityQuerySchema = z.object({
  barcode: z.string().min(1).max(32),
});
export type TraceabilityQuery = z.infer<typeof traceabilityQuerySchema>;

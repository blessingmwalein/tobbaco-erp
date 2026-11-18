import { z } from "zod";
import { isoDateSchema } from "./common";

const blank = (v: unknown) => (v === "" || v === null ? undefined : v);

/** Dates are calendar days ("yyyy-mm-dd") — the same format the date pickers send. The end day is included. */
export const dashboardQuerySchema = z
  .object({
    from: z.preprocess(blank, isoDateSchema.optional()),
    to: z.preprocess(blank, isoDateSchema.optional()),
    floor: z.preprocess(blank, z.string().trim().max(100).optional()),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { path: ["to"], message: "The end date must not be before the start date" });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

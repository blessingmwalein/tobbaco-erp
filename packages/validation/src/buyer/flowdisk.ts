import { z } from "zod";

const decimal = z.string().trim().regex(/^\d+(?:\.\d{1,6})?$/, "Enter a positive decimal value");

export const flowDiskHeaderSchema = z.object({
  floorName: z.string().trim().min(1).max(120),
  buyerCode: z.string().trim().min(1).max(20).regex(/^[A-Z0-9-]+$/i),
  buyerName: z.string().trim().min(1).max(160),
  saleDateFrom: z.iso.date(),
  saleDateTo: z.iso.date(),
  exchangeRate: decimal.nullable(),
});

export const flowDiskRowSchema = z.object({
  buyerGrade: z.string().trim().min(1).max(40),
  growerNo: z.string().trim().min(1).max(40),
  lotNo: z.string().trim().min(1).max(40),
  massKg: decimal,
  uscPerKg: decimal,
  usdValue: decimal,
  barcode: z.string().min(9).max(10),
  timbGrade: z.string().trim().max(40).nullable(),
});

export const createFlowDiskImportSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content: z.string().min(1, "The Flow Disk file is empty"),
});

export const confirmFlowDiskImportSchema = z.object({
  correctedRows: z.array(flowDiskRowSchema).optional(),
});

export type FlowDiskHeaderInput = z.infer<typeof flowDiskHeaderSchema>;
export type FlowDiskRowInput = z.infer<typeof flowDiskRowSchema>;
export type CreateFlowDiskImportInput = z.infer<typeof createFlowDiskImportSchema>;
export type ConfirmFlowDiskImportInput = z.infer<typeof confirmFlowDiskImportSchema>;

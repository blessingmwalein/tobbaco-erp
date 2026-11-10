import { z } from "zod";
import { checkTicketBarcode, isValidGrowerNo, isValidScaleBarcode, normaliseGrowerNo } from "@tobacco/shared";
import { normaliseVehicleReg, upperCode, validateLot } from "./rules";

/** Form/request schemas shared by the UI now and the NestJS API later. */

const trimmed = (label: string) => z.string().trim().min(1, `${label} is required`);

export const growerNoSchema = z
  .string()
  .trim()
  .min(1, "Grower number is required")
  .transform(normaliseGrowerNo)
  .refine(isValidGrowerNo, "Please check format and validity of grower number");

export const scaleBarcodeSchema = z
  .string()
  .trim()
  .refine(isValidScaleBarcode, "Please check barcode");

export const ticketBarcodeSchema = z
  .string()
  .trim()
  .refine((v) => checkTicketBarcode(v).valid, "Please enter a valid barcode");

// ── Daily setup ─────────────────────────────────────────────────
export const saleDateFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of sale is required"),
  isActive: z.boolean(),
  canScanFloorSummary: z.boolean(),
});
export type SaleDateForm = z.infer<typeof saleDateFormSchema>;

export const startOfDayFormSchema = z.object({
  sellingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selling date is required"),
  exchangeRate: z
    .string()
    .trim()
    .min(1, "Exchange rate is required")
    .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, "Exchange Rate should be bigger than ZERO!"),
});
export type StartOfDayForm = z.infer<typeof startOfDayFormSchema>;

// ── Receiving ───────────────────────────────────────────────────
export const transporterNoteFormSchema = z.object({
  transporterName: trimmed("Transporter name"),
  idNumber: trimmed("ID number"),
  vehicleReg: trimmed("Vehicle registration").transform(normaliseVehicleReg),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number is required")
    .regex(/^[0-9+\s-]+$/, "Phone number may contain digits, +, - and spaces only"),
  permitNo: z.string().trim().optional(),
});
export type TransporterNoteForm = z.input<typeof transporterNoteFormSchema>;

export const addGrowerFormSchema = z.object({
  growerNo: growerNoSchema,
  location: trimmed("Location").transform(upperCode),
  bales: z.coerce.number().int("Whole number of bales").min(1, "At least 1 bale").max(999, "Too many bales"),
  saleDay: z.coerce.number().int().min(1).max(31),
  saleMonth: z.coerce.number().int().min(1).max(12),
});
export type AddGrowerForm = z.input<typeof addGrowerFormSchema>;

export const baleCaptureFormSchema = z.object({
  scaleBarcode: scaleBarcodeSchema,
  growerNo: growerNoSchema,
  group: z.coerce.number().int("Group must be a whole number").min(1, "Group must be 1 or more"),
  lot: z
    .string()
    .trim()
    .refine((v) => validateLot(v).ok, "Please enter a valid lot number"),
});
export type BaleCaptureForm = z.input<typeof baleCaptureFormSchema>;

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "A reason is required (at least 3 characters)"),
});
export type ReasonForm = z.infer<typeof reasonSchema>;

// ── Tickets ─────────────────────────────────────────────────────
export const startBarcodeFormSchema = z.object({
  startBarcode: ticketBarcodeSchema,
});

export const interruptedTicketFormSchema = z.object({
  lastPrintedBarcode: ticketBarcodeSchema,
  newStartBarcode: ticketBarcodeSchema,
});

// ── Floor summary / data capture ────────────────────────────────
export const floorScanFormSchema = z.object({
  row: z.coerce.number({ error: "Please enter a Row Number" }).int("Please enter an integer for Row Number").min(1),
  barcode: z.string().trim().min(1, "Scan a ticket barcode"),
});

export const classificationFormSchema = z.object({
  timbGrade: z.string().transform(upperCode),
  hessianOwner: z.string().optional(),
});

export const eBuyingFormSchema = z.object({
  buyer: z.string().transform(upperCode),
  buyerGrade: z.string().transform(upperCode),
  price: z.string().trim(),
  saleCode: z.string().transform(upperCode).optional(),
});

// ── Dispatch / payments ─────────────────────────────────────────
export const dispatchInitiateFormSchema = z
  .object({
    warehouseCode: trimmed("Destination warehouse"),
    product: z.literal("GREEN"),
    noTransportDetails: z.boolean(),
    transportName: z.string().trim().optional(),
    truckReg: z.string().trim().optional(),
    driver: z.string().trim().optional(),
    driverNationalId: z.string().trim().optional(),
    driverCell: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.noTransportDetails) return;
    for (const [key, label] of [
      ["transportName", "Transport name"],
      ["truckReg", "Truck registration"],
      ["driver", "Driver"],
    ] as const) {
      if (!v[key]) ctx.addIssue({ code: "custom", path: [key], message: `${label} is required unless "No Transportation Details" is ticked` });
    }
  });
export type DispatchInitiateForm = z.input<typeof dispatchInitiateFormSchema>;

export const paymentScheduleFormSchema = z.object({
  invoicesDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invoices date is required"),
  batchNo: z.coerce.number().int().min(0, "Batch # must be 0 or a pay batch number"),
  currency: z.enum(["USD", "ZWL"]),
});
export type PaymentScheduleForm = z.input<typeof paymentScheduleFormSchema>;

export const bankConfirmationFormSchema = z.object({
  reference: z.string().trim().min(3, "Bank/CloudPay confirmation reference is required"),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a decimal like 499.43"),
});

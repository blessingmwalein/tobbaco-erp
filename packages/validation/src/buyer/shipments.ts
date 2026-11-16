import { z } from "zod";
import { uuidSchema } from "./common";

export const buyerShipmentImportSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content: z.string().min(1),
  dispatchReference: z.string().trim().min(1).max(80),
  purchaseReference: z.string().trim().min(1).max(120),
  dispatchDate: z.string().date(),
  dispatchLocation: z.string().trim().max(160).optional(),
  destinationWarehouseId: uuidSchema,
  expectedArrivalAt: z.string().datetime().optional(),
  truckRegistration: z.string().trim().min(1).max(40),
  trailerRegistration: z.string().trim().max(40).optional(),
  driverName: z.string().trim().min(1).max(160),
  driverPhone: z.string().trim().max(40).optional(),
  transporter: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const buyerShipmentArrivalSchema = z.object({
  actualArrivalAt: z.string().datetime().optional(),
  receivingWarehouseId: uuidSchema,
  actualTruckRegistration: z.string().trim().max(40).optional(),
  driverConfirmed: z.boolean().optional(),
  arrivalNotes: z.string().trim().max(500).optional(),
});

export const buyerShipmentStatusSchema = z.object({
  status: z.enum(["IN_TRANSIT", "ARRIVED", "RECEIVING", "RECONCILIATION_REQUIRED", "CONFIRMED", "STORAGE_IN_PROGRESS", "ALLOCATED", "CANCELLED"]),
});

export type BuyerShipmentImportInput = z.infer<typeof buyerShipmentImportSchema>;
export type BuyerShipmentArrivalInput = z.infer<typeof buyerShipmentArrivalSchema>;

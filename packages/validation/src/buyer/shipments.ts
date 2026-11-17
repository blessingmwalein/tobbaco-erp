import { z } from "zod";
import { uuidSchema } from "./common";

/**
 * Shipment JSON import. Only the file content and the destination warehouse are required from the operator — the
 * purchase is derived from the dispatched bale barcodes when `purchaseReference` is omitted, and the dispatch
 * metadata (reference, date, truck, driver, transporter, location) is read from the LeafLogix JSON when not supplied.
 */
export const buyerShipmentImportSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content: z.string().min(1),
  dispatchReference: z.string().trim().min(1).max(80).optional(),
  purchaseReference: z.string().trim().min(1).max(120).optional(),
  dispatchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format yyyy-mm-dd").optional(),
  dispatchLocation: z.string().trim().max(160).optional(),
  destinationWarehouseId: uuidSchema,
  expectedArrivalAt: z.string().datetime().optional(),
  truckRegistration: z.string().trim().min(1).max(40).optional(),
  trailerRegistration: z.string().trim().max(40).optional(),
  driverName: z.string().trim().min(1).max(160).optional(),
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

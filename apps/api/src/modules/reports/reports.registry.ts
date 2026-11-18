import type { ReportId } from "@tobacco/shared";
import { stockByGrade, stockByLocation, inventoryPosition, warehouseMovements } from "./queries/inventory";
import { flowDiskImports, invoiceCharges, purchaseRegister, purchasesByGrade } from "./queries/purchases";
import { baleDiscrepancies, purchaseShipmentReceived, receivingSessions, shipmentRegister } from "./queries/receiving";
import type { ReportRunner } from "./reports.types";

/** report id -> the function that builds its rows. The columns, filters and permissions live in the shared catalogue. */
export const REPORT_RUNNERS: Record<ReportId, ReportRunner> = {
  "purchase-register": purchaseRegister,
  "invoice-charges": invoiceCharges,
  "purchases-by-grade": purchasesByGrade,
  "flow-disk-imports": flowDiskImports,
  "purchase-shipment-received": purchaseShipmentReceived,
  "shipment-register": shipmentRegister,
  "receiving-sessions": receivingSessions,
  "bale-discrepancies": baleDiscrepancies,
  "stock-by-location": stockByLocation,
  "stock-by-grade": stockByGrade,
  "inventory-position": inventoryPosition,
  "warehouse-movements": warehouseMovements,
};

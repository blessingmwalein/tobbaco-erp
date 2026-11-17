import type { IsoDateString } from "./common";

/** Where a purchased bale currently sits in the purchase → shipment → receiving → storage lifecycle. */
export type BaleLifecycle =
  | "NOT_DISPATCHED"
  | "IN_TRANSIT"
  | "ARRIVED_NOT_RECEIVED"
  | "RECEIVED"
  | "ALLOCATED";

export interface ReconciliationShipmentProgressDto {
  id: string;
  reference: string;
  dispatchDate: IsoDateString;
  truckRegistration: string;
  driverName: string | null;
  destinationWarehouse: { id: string; code: string; name: string } | null;
  expectedBales: number;
  receivedBales: number;
  allocatedBales: number;
  status: string;
}

export interface ReconciliationBaleDto {
  id: string;
  barcode: string;
  buyerGrade: string;
  timbGrade: string | null;
  growerNo: string;
  lotNo: string;
  massKg: string;
  uscPerKg: string;
  usdValue: string;
  /** Lifecycle bucket the bale currently falls into. */
  lifecycle: BaleLifecycle;
  dispatched: boolean;
  shipmentId: string | null;
  shipmentReference: string | null;
  received: boolean;
  receivedAt: IsoDateString | null;
  allocated: boolean;
  /** Human-readable discrepancy note (missing, unexpected, duplicate scan, unresolved exception …). */
  discrepancy: string | null;
}

export interface ReconciliationSummaryDto {
  totalPurchasedBales: number;
  totalPurchasedMassKg: string;
  totalDispatchedBales: number;
  totalReceivedBales: number;
  totalAllocatedBales: number;
  /** Dispatched but not yet physically received. */
  outstandingBales: number;
  /** Purchased but not yet dispatched on any shipment. */
  notYetDispatchedBales: number;
  /** Dispatched but never arrived/received. */
  missingBales: number;
  unexpectedBales: number;
  duplicateScans: number;
  openExceptions: number;
  resolvedExceptions: number;
  shipmentCount: number;
}

export interface PurchaseReconciliationDto {
  id: string;
  purchaseId: string;
  purchaseReference: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceReference: string | null;
  buyerName: string | null;
  floorName: string;
  saleDate: IsoDateString;
  status: "AWAITING_SHIPMENTS" | "IN_PROGRESS" | "CLOSED";
  summary: ReconciliationSummaryDto;
  shipments: ReconciliationShipmentProgressDto[];
  bales: ReconciliationBaleDto[];
  /** True when every received bale has been allocated to a warehouse location. */
  allocationComplete: boolean;
  closedAt: IsoDateString | null;
  closedByName: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ReconciliationListItemDto {
  id: string;
  purchaseId: string;
  purchaseReference: string;
  invoiceNumber: string | null;
  buyerName: string | null;
  floorName: string;
  saleDate: IsoDateString;
  status: "AWAITING_SHIPMENTS" | "IN_PROGRESS" | "CLOSED";
  totalPurchasedBales: number;
  totalDispatchedBales: number;
  totalReceivedBales: number;
  outstandingBales: number;
  shipmentCount: number;
  allocationComplete: boolean;
  closedAt: IsoDateString | null;
  updatedAt: IsoDateString;
}

/** Complete report payload (JSON export is this object verbatim; PDF/CSV render from it). */
export interface ReconciliationReportDto {
  generatedAt: IsoDateString;
  purchase: {
    reference: string;
    invoiceNumber: string | null;
    invoiceReference: string | null;
    buyerName: string | null;
    floorName: string;
    saleDate: IsoDateString;
  };
  summary: ReconciliationSummaryDto;
  shipments: ReconciliationShipmentProgressDto[];
  bales: ReconciliationBaleDto[];
  discrepancies: {
    missing: Array<{ barcode: string; growerNo: string; lotNo: string; massKg: string }>;
    unexpected: Array<{ barcode: string; note: string }>;
    duplicateScans: Array<{ barcode: string; note: string }>;
    openExceptions: Array<{ id: string; barcode: string; kind: string; explanation: string }>;
    resolvedExceptions: number;
  };
}

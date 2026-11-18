/**
 * Buyer dashboard.
 *
 * What the filters mean:
 *  - The date range (and floor) select PURCHASES by sale date; purchase, receiving, levy and payable figures describe those purchases.
 *  - Everything marked "live" — shipments on the road / at the gate / being received, open sessions, exceptions and stock in
 *    warehouses — is the position RIGHT NOW. It ignores the date range and honours only the floor filter.
 */
export interface DashboardShipmentItem {
  id: string;
  reference: string;
  purchaseReference: string;
  truck: string;
  dispatchDate: string;
  expectedArrivalAt: string | null;
  arrivedAt: string | null;
  expectedBales: number;
  receivedBales: number;
  expectedMassKg: string;
  /** Business days since dispatch (in transit) or between dispatch and arrival. */
  daysSinceDispatch: number;
  status: string;
}

export interface DashboardShipmentStage {
  /** Shipments in this stage right now. */
  count: number;
  /** Bales on those shipments (per their manifests). */
  bales: number;
  massKg: string;
  /** Up to five, the ones that have waited longest first. */
  items: DashboardShipmentItem[];
}

export interface BuyerDashboardDto {
  filters: { from: string | null; to: string | null; floor: string | null };
  floorOptions: string[];
  /** The actual sale dates covered by the purchases that match the filters. */
  period: { firstSaleDate: string | null; lastSaleDate: string | null };
  summary: {
    purchaseCount: number;
    purchasedBales: number;
    purchasedMassKg: string;
    /** Tobacco value (US$) of the matching purchases. */
    totalSpendUsd: string;
    /** Bales of the matching purchases that have been received. */
    receivedBales: number;
    receivedMassKg: string;
    /** Purchased minus received. */
    pendingReceiptBales: number;
    /** Live: bales in a warehouse location right now. */
    inventoryBales: number;
    /** Live: received (in stock) but not yet allocated to a location. */
    unallocatedReceivedBales: number;
    /** Levies and floor clearing from the invoices (section B, excluding the USD/ZiG split line). */
    leviesUsd: string;
    leviesZig: string;
    payableUsd: string;
    payableZig: string;
    /** Live. */
    openReceivingSessions: number;
    /** Live. */
    openExceptions: number;
  };
  /** Live. */
  shipments: {
    inTransit: DashboardShipmentStage;
    /** Arrived at the gate, receiving not started. */
    arrived: DashboardShipmentStage;
    /** A receiving session is scanning them now. */
    receiving: DashboardShipmentStage;
    /** Fully scanned, waiting for warehouse locations. */
    awaitingStorage: DashboardShipmentStage;
    /** Shipments received and stored within the date range (all time when no range). */
    completed: { count: number; bales: number };
  };
  /** Live. */
  openSessions: Array<{
    id: string;
    reference: string;
    startedAt: string;
    purchaseReference: string;
    shipmentReference: string | null;
    expectedBales: number;
    scannedBales: number;
  }>;
  recentPurchases: Array<{
    id: string;
    reference: string;
    floorName: string;
    saleDate: string;
    totalBales: number;
    totalUsdValue: string;
    receivingStatus: string;
  }>;
}

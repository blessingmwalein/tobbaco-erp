export interface BuyerDashboardDto {
  filters: { from: string | null; to: string | null; floor: string | null };
  floorOptions: string[];
  summary: {
    purchasedBales: number;
    purchasedMassKg: string;
    totalSpendUsd: string;
    receivedBales: number;
    receivedMassKg: string;
    inventoryBales: number;
    costsUsd: string;
    costsZig: string;
    payableUsd: string;
    payableZig: string;
    openReceivingSessions: number;
    openExceptions: number;
  };
  openSessions: Array<{
    id: string;
    reference: string;
    startedAt: string;
    purchaseReference: string;
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

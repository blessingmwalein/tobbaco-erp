import type {
  BaleLifecycle,
  ReconciliationBaleDto,
  ReconciliationSummaryDto,
} from "@tobacco/shared";

type LifecycleLine = {
  baleId: string;
  shipmentId: string | null;
  shipmentReference: string | null;
  shipmentStatus: string | null;
  status: string; // BuyerShipmentBale.status
  receivedAt: Date | null;
  allocatedAt: Date | null;
};

/** Build the bale-level comparison from a purchase's bales and its shipments' bale lines. Pure + deterministic. */
export function buildBales(purchase: {
  bales: Array<{ id: string; barcode: string; buyerGrade: string; timbGrade?: string | null; growerNo: string; lotNo: string; massKg: { toString(): string }; uscPerKg: { toString(): string }; usdValue: { toString(): string }; receivedAt?: Date | null }>;
  shipments: Array<{ id: string; reference: string; status: string; bales: Array<{ baleId: string; status: string; receivedAt?: Date | null; allocatedAt?: Date | null; bale?: { receivedAt?: Date | null } }> }>;
}): { bales: ReconciliationBaleDto[]; byBarcode: Map<string, ReconciliationBaleDto> } {
  const linesByBale = new Map<string, LifecycleLine>();
  for (const s of purchase.shipments ?? []) {
    for (const line of s.bales ?? []) {
      linesByBale.set(line.baleId, {
        baleId: line.baleId,
        shipmentId: s.id,
        shipmentReference: s.reference,
        shipmentStatus: s.status,
        status: line.status,
        receivedAt: (line.receivedAt ?? line.bale?.receivedAt ?? null) as Date | null,
        allocatedAt: (line.allocatedAt ?? null) as Date | null,
      });
    }
  }
  const bales: ReconciliationBaleDto[] = (purchase.bales ?? []).map((b) => {
    const line = linesByBale.get(b.id);
    let lifecycle: BaleLifecycle = "NOT_DISPATCHED";
    let shipmentReference: string | null = null;
    let received = false;
    let allocated = false;
    let discrepancy: string | null = null;
    if (line) {
      shipmentReference = line.shipmentReference;
      if (line.status === "ALLOCATED") { lifecycle = "ALLOCATED"; allocated = true; received = true; }
      else if (line.status === "RECEIVED" || b.receivedAt) { lifecycle = "RECEIVED"; received = true; }
      else if (line.status === "MISSING") { lifecycle = "ARRIVED_NOT_RECEIVED"; discrepancy = "Flagged missing"; }
      else if (line.shipmentStatus === "ARRIVED" || line.shipmentStatus === "RECEIVING" || line.shipmentStatus === "CONFIRMED" || line.shipmentStatus === "RECONCILIATION_REQUIRED") lifecycle = "ARRIVED_NOT_RECEIVED";
      else lifecycle = "IN_TRANSIT";
    }
    return {
      id: b.id, barcode: b.barcode, buyerGrade: b.buyerGrade, timbGrade: b.timbGrade ?? null,
      growerNo: b.growerNo, lotNo: b.lotNo, massKg: b.massKg.toString(), uscPerKg: b.uscPerKg.toString(), usdValue: b.usdValue.toString(),
      lifecycle, dispatched: Boolean(line), shipmentId: line?.shipmentId ?? null, shipmentReference, received,
      receivedAt: line?.receivedAt ? line.receivedAt.toISOString() : (b.receivedAt ? b.receivedAt.toISOString() : null), allocated, discrepancy,
    };
  });
  return { bales, byBarcode: new Map(bales.map((b) => [b.barcode, b])) };
}

/** Compute the purchase-level reconciliation summary. The key invariant (brief §6): undispatched bales are never
 *  reported as "missing" — `outstandingBales` counts only dispatched-but-not-received, and `notYetDispatchedBales`
 *  counts purchased-but-not-dispatched. */
export function computeSummary(
  purchase: { totalBales: number; totalMassKg: { toString(): string } },
  bales: ReconciliationBaleDto[],
  scans: Array<{ result: string }>,
  exceptions: Array<{ status: string }>,
): ReconciliationSummaryDto {
  const totalReceivedBales = bales.filter((b) => b.received).length;
  return {
    totalPurchasedBales: purchase.totalBales,
    totalPurchasedMassKg: purchase.totalMassKg.toString(),
    totalDispatchedBales: bales.filter((b) => b.dispatched).length,
    totalReceivedBales,
    totalAllocatedBales: bales.filter((b) => b.allocated).length,
    // Dispatched but not yet physically received — distinct from bales that were never dispatched.
    outstandingBales: bales.filter((b) => b.dispatched && !b.received).length,
    notYetDispatchedBales: bales.filter((b) => !b.dispatched).length,
    missingBales: bales.filter((b) => b.discrepancy === "Flagged missing").length,
    unexpectedBales: scans.filter((sc) => sc.result === "UNEXPECTED" || sc.result === "WRONG_BUYER" || sc.result === "WRONG_PURCHASE").length,
    duplicateScans: scans.filter((sc) => sc.result === "DUPLICATE_SCAN").length,
    openExceptions: exceptions.filter((e) => e.status === "OPEN").length,
    resolvedExceptions: exceptions.filter((e) => e.status === "RESOLVED").length,
    shipmentCount: 0,
  };
}

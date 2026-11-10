/**
 * The documented Ethical sandbox test day (17 September 2026) — values taken from the e-Port manuals.
 * Anything marked `demo` is NOT documented and exists only so the journey can be clicked through end to end.
 * Used by the seed, the scenario presets and the end-to-end tests.
 */
export const DOCUMENTED = {
  saleDate: "2026-09-17",
  previousSaleDates: ["2026-09-10", "2026-09-11"],
  season: 2026,
  sellingPoint: { id: "EL", code: "EL", name: "Ethical Sales Floor", saleRoom: "A", receivingLocation: "A" },
  exchangeRate: "26.68450000",
  transporterNote: {
    docNo: "TDN0000002",
    transporterName: "Tendai Moyo",
    idNumber: "63-123456-A-42",
    vehicleRegTyped: "AEX 1234",
    vehicleReg: "AEX1234",
    phone: "0772123456",
  },
  files: {
    booking: "ELS_ETHICAL_20260917.txt",
    stopOrder: "EL_stoporders_20260917.txt",
  },
  growers: [
    {
      growerNo: "V100060",
      firstName: "Chengetai",
      surname: "Chingoma",
      district: 14,
      bales: 3,
      gdn: "GDN0000005",
      bookingRef: "EL2609170001",
      row: 1,
      saleRefNo: 4,
      batchRefNo: 4,
      /** Documented: scale barcodes 2609170001–3, masses 112/98/105, ticket barcodes, grades, buyer, prices. */
      bales_: [
        { scale: "2609170001", mass: 112, group: 1, lot: "1", ticket: "1000001013", timbGrade: "A10", buyer: "JM", buyerGrade: "11OF", priceCents: 212 },
        { scale: "2609170002", mass: 98, group: 1, lot: "2", ticket: "1000001024", timbGrade: "A1E", buyer: "JM", buyerGrade: "11OF", priceCents: 198 },
        { scale: "2609170003", mass: 105, group: 1, lot: "3", ticket: "1000001035", timbGrade: "A1L", buyer: "JM", buyerGrade: "11OF", priceCents: 185 },
      ],
      /** Derived arithmetic from the documented price (US cents/kg) × mass — illustrative, formula unverified (UQ-05). */
      grossCents: 62573,
      demo: false,
    },
    {
      growerNo: "V100061",
      firstName: "Trust",
      surname: "Gwenzi",
      district: 32,
      bales: 2,
      gdn: "GDN0000004",
      bookingRef: "EL2609170002",
      row: 2,
      saleRefNo: 5,
      batchRefNo: 5,
      /** Documented: ticket barcodes 1000001046 / 1000001057 and 2 bales. DEMO: scale barcodes, masses, grades, buyer, prices. */
      bales_: [
        { scale: "2609170004", mass: 101, group: 1, lot: "1", ticket: "1000001046", timbGrade: "A10", buyer: "JM", buyerGrade: "11OF", priceCents: 205 },
        { scale: "2609170005", mass: 96, group: 1, lot: "2", ticket: "1000001057", timbGrade: "A1E", buyer: "JM", buyerGrade: "11OF", priceCents: 190 },
      ],
      grossCents: 38945,
      demo: true,
    },
  ],
  payBatchNo: 1001,
  historicalPayBatchNo: 1000,
  /** Deductions Dashboard totals for 17 Sep (Manual 07). */
  deductions: {
    totalCents: 17311,
    lines: 11,
    growersAffected: 2,
    creditors: 6,
    floorChargesCents: 12311,
    timbStopOrderCents: 5000,
    stopOrder: { growerNo: "V100060", creditorCode: "00050", amountCents: 5000, priority: 1, recType: "06", stopOrderNo: 1 },
  },
  buyer: { code: "JM", grade: "11OF", packingWarehouse: "CURVERID" },
  rejectedSaleCodes: ["RO", "RH", "CO"],
  ticketBarcodes: {
    V100060: ["1000001013", "1000001024", "1000001035"],
    V100061: ["1000001046", "1000001057"],
  },
  /** Manual "range" shown in the manuals — spans 23 and 12 numerically but only 3 and 2 tickets. */
  ticketRanges: { V100060: ["1000001013", "1000001035"], V100061: ["1000001046", "1000001057"] },
} as const;

export type DocumentedGrower = (typeof DOCUMENTED.growers)[number];

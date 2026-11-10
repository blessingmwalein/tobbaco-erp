import { ROLES } from "../roles";
import type {
  AppUser,
  Buyer,
  Creditor,
  DeliveryNote,
  Grower,
  GrowerBankAccount,
  GrowerBooking,
  GrowerCharge,
  ImportJob,
  MockDb,
  PayBatch,
  PaymentSchedule,
  PaymentScheduleLine,
  PaymentTransaction,
  PriceBatch,
  Sale,
  StartOfDay,
  TimbGrade,
  TransporterNote,
  Warehouse,
  FloorSummary,
  Settings,
} from "../types";
import { DOCUMENTED } from "./documented";

export const MOCK_DB_VERSION = 1;

const D = DOCUMENTED;
/** Local-naive timestamp (no zone suffix) for a fixed demo date/time, so display never shifts by timezone. */
export const ts = (date: string, time = "07:30:00") => `${date}T${time}`;

// ── Users (one per role + demo operator) ────────────────────────
const userDefs: Array<[string, string, string]> = [
  ["system-admin", "Administrator", "administrator"],
  ["supervisor", "Rudo Makoni", "rudo.makoni"],
  ["timb-clerk", "Nyasha Chirwa", "nyasha.chirwa"],
  ["receiving-clerk", "Kudzai Sibanda", "kudzai.sibanda"],
  ["receiving-supervisor", "Tariro Mutasa", "tariro.mutasa"],
  ["ticket-clerk", "Tapiwa Zvobgo", "tapiwa.zvobgo"],
  ["floor-summary-clerk", "Rumbidzai Hove", "rumbidzai.hove"],
  ["data-clerk", "Tonderai Banda", "tonderai.banda"],
  ["data-processing-supervisor", "Chipo Ndlovu", "chipo.ndlovu"],
  ["accounts", "Farai Dube", "farai.dube"],
  ["dispatch-clerk", "Tawanda Mpofu", "tawanda.mpofu"],
  ["dispatch-supervisor", "Memory Chikwanha", "memory.chikwanha"],
  ["demo-operator", "Demo Operator", "demo.operator"],
];

function buildUsers(): AppUser[] {
  return userDefs.map(([roleId, name, handle]) => ({
    id: `user-${roleId}`,
    name,
    email: `${handle}@demo.eport.test`,
    roleIds: [roleId],
    active: true,
    sellingPointIds: [],
    permissionOverrides: { grant: [], deny: [] },
    isDemo: true,
  }));
}

// ── Growers ─────────────────────────────────────────────────────
const documentedGrowers: Grower[] = [
  { growerNo: "V100043", firstName: "Simba", surname: "Chingoma", district: 28, active: true, season: 2026 },
  { growerNo: "V100058", firstName: "Simba", surname: "Mhlanga", district: 7, active: true, season: 2026 },
  { growerNo: "V100060", firstName: "Chengetai", surname: "Chingoma", district: 14, active: true, season: 2026 },
  { growerNo: "V100061", firstName: "Trust", surname: "Gwenzi", district: 32, active: true, season: 2026 },
  { growerNo: "V100074", firstName: "Farai", surname: "Ngapasare", district: 12, active: true, season: 2026, isDemo: true },
  { growerNo: "V100079", firstName: "Chengetai", surname: "Zacharia", district: 18, active: true, season: 2026, isDemo: true },
  { growerNo: "V100088A", firstName: "Mavis", surname: "Chinyepe", district: 5, active: true, season: 2026, isDemo: true },
  { growerNo: "V100097", firstName: "Tapiwa", surname: "Nyamande", district: 23, active: true, season: 2026, isDemo: true },
];

const demoFirst = ["Tinashe", "Rutendo", "Blessing", "Kuda", "Shamiso", "Lovemore", "Vimbai", "Garikai", "Tsitsi", "Munyaradzi", "Chiedza", "Wellington", "Nomsa", "Takudzwa", "Precious", "Simbarashe", "Fadzai", "Lazarus", "Ruvimbo", "Panashe"];
const demoLast = ["Moyo", "Ncube", "Sibanda", "Dube", "Mutasa", "Chikwanha", "Zvobgo", "Hove", "Banda", "Ndlovu", "Mpofu", "Makoni", "Chirwa", "Mashingaidze", "Muzenda", "Gumbo", "Marufu", "Tshuma", "Kanyama", "Nyathi"];

function buildDemoGrowers(): Grower[] {
  const out: Grower[] = [];
  for (let i = 0; i < 40; i++) {
    out.push({
      growerNo: `V1001${String(i).padStart(2, "0")}`,
      firstName: demoFirst[i % demoFirst.length]!,
      surname: demoLast[(i * 7 + 3) % demoLast.length]!,
      district: 1 + ((i * 5) % 35),
      cellphone: `07${(71 + (i % 8)).toString()}${String(100000 + i * 137).slice(0, 6)}`,
      active: i % 17 !== 16,
      season: 2026,
      isDemo: true,
    });
  }
  return out;
}

// ── Reference data ──────────────────────────────────────────────
const buyers: Buyer[] = [
  { code: "JM", name: "Buyer JM", packingWarehouseCode: "CURVERID", grades: ["11OF", "12OF", "13OF", "11OL"] },
  { code: "KT", name: "Buyer KT (demo)", packingWarehouseCode: "DEMOWH2", grades: ["21OF", "22OF"], isDemo: true },
  { code: "AB", name: "Buyer AB (demo)", packingWarehouseCode: "DEMOWH2", grades: ["31OF", "32OF"], isDemo: true },
];

const timbGrades: TimbGrade[] = [
  { code: "A10", isReason: false },
  { code: "A1E", isReason: false },
  { code: "A1L", isReason: false },
  { code: "A1F", isReason: false, isDemo: true },
  { code: "B1L", isReason: false, isDemo: true },
  { code: "B1F", isReason: false, isDemo: true },
  { code: "X01", description: "Rejected — poor condition (demo reason)", isReason: true, isDemo: true },
  { code: "X02", description: "Rejected — moisture (demo reason)", isReason: true, isDemo: true },
];

const warehouses: Warehouse[] = [
  { code: "CURVERID", name: "CURVERID", buyerCodes: ["JM"], active: true },
  { code: "DEMOWH2", name: "Demo Packing Warehouse 2", buyerCodes: ["KT", "AB"], active: true, isDemo: true },
];

const creditors: Creditor[] = [
  { code: "00050", name: "Creditor 00050", kind: "TIMB_CREDITOR", isDemo: true },
  { code: "00061", name: "Creditor 00061", kind: "TIMB_CREDITOR", isDemo: true },
  { code: "FC", name: "Floor Commission", kind: "FLOOR_CHARGE", isDemo: true },
  { code: "WA", name: "Weigh and Auction", kind: "FLOOR_CHARGE", isDemo: true },
  { code: "BC", name: "Bank Charges", kind: "FLOOR_CHARGE", isDemo: true },
  { code: "GL", name: "Govt Levy", kind: "FLOOR_CHARGE", isDemo: true },
  { code: "AL", name: "Afforestation Levy", kind: "FLOOR_CHARGE", isDemo: true },
];

/**
 * Per-line floor-charge amounts are ILLUSTRATIVE. Only the totals are documented:
 * $123.11 across both growers (+ $50.00 TIMB stop order = $173.11, 11 lines, 6 creditors). UQ-05.
 */
const growerCharges: GrowerCharge[] = [
  { code: "FC", name: "Floor Commission", creditorCode: "FC", order: 1, currency: "USD", basis: "UNVERIFIED", active: true, isDemo: true, demoAmountCentsByGrower: { V100060: 2100, V100061: 1400 } },
  { code: "WA", name: "Weigh and Auction", creditorCode: "WA", order: 2, currency: "USD", basis: "UNVERIFIED", active: true, isDemo: true, demoAmountCentsByGrower: { V100060: 1250, V100061: 1250 } },
  { code: "BC", name: "Bank Charges", creditorCode: "BC", order: 3, currency: "USD", basis: "UNVERIFIED", active: true, isDemo: true, demoAmountCentsByGrower: { V100060: 500, V100061: 500 } },
  { code: "GL", name: "Govt Levy", creditorCode: "GL", order: 4, currency: "USD", basis: "UNVERIFIED", active: true, isDemo: true, demoAmountCentsByGrower: { V100060: 2500, V100061: 1168 } },
  { code: "AL", name: "Afforestation Levy", creditorCode: "AL", order: 5, currency: "USD", basis: "UNVERIFIED", active: true, isDemo: true, demoAmountCentsByGrower: { V100060: 1280, V100061: 363 } },
];

const growerBankAccounts: GrowerBankAccount[] = [
  { id: "bank-V100060-USD", growerNo: "V100060", currency: "USD", bankName: "Demo Bank A", bankCode: "DBA", branchCode: "001", accountNo: "4100060001", accountName: "Chengetai Chingoma", isDemo: true },
  { id: "bank-V100060-ZWL", growerNo: "V100060", currency: "ZWL", bankName: "Demo Bank A", bankCode: "DBA", branchCode: "001", accountNo: "4100060002", accountName: "Chengetai Chingoma", isDemo: true },
  { id: "bank-V100061-USD", growerNo: "V100061", currency: "USD", bankName: "Demo Bank B", bankCode: "DBB", branchCode: "014", accountNo: "7100061001", accountName: "Trust Gwenzi", isDemo: true },
  { id: "bank-V100043-USD", growerNo: "V100043", currency: "USD", bankName: "Demo Bank A", bankCode: "DBA", branchCode: "003", accountNo: "4100043001", accountName: "Simba Chingoma", isDemo: true },
  { id: "bank-V100058-USD", growerNo: "V100058", currency: "USD", bankName: "Demo Bank B", bankCode: "DBB", branchCode: "014", accountNo: "7100058001", accountName: "Simba Mhlanga", isDemo: true },
];

// ── Historical data (documented in the manuals' screenshots) ────
const historicalBookings: GrowerBooking[] = [
  ["EL2609100001", "V100043", "Simba", "Chingoma", 3, "14:51:00"],
  ["EL2609100002", "V100058", "Simba", "Mhlanga", 5, "14:51:00"],
  ["EL2609100003", "V100060", "Chengetai", "Chingoma", 8, "14:51:00"],
  ["EL2609100004", "V100061", "Trust", "Gwenzi", 6, "14:51:00"],
  ["EL2609100005", "V100074", "Farai", "Ngapasare", 12, "14:51:00"],
  ["EL2609100007", "V100088A", "Mavis", "Chinyepe", 10, "14:53:00"],
  ["EL2609100006", "V100079", "Chengetai", "Zacharia", 4, "14:51:00"],
  ["EL2609100008", "V100097", "Tapiwa", "Nyamande", 7, "14:53:00"],
].map(([bookedId, growerNo, firstName, surname, bales, time], i) => ({
  id: `booking-${bookedId}`,
  bookedId: bookedId as string,
  sellDate: "2026-09-11",
  season: 2026,
  growerNo: growerNo as string,
  firstName: firstName as string,
  surname: surname as string,
  bookDate: "2026-09-11",
  balesBooked: bales as number,
  sourceBales: 0,
  floor: "EL",
  bookedBy: "TIMB Online",
  lastUpdated: ts("2026-09-11", time as string),
  importJobId: "import-0001",
  isDemo: i > 3 ? true : undefined,
}));

const historicalImport: ImportJob = {
  id: "import-0001",
  ref: "IMP-0001",
  type: "GROWER_BOOKING",
  filename: "ELS_ETHICAL_20260911.txt",
  sizeBytes: 612,
  status: "COMPLETED",
  created: 8,
  updated: 0,
  errorCount: 0,
  rowErrors: [],
  records: [],
  checksum: "demo-0911",
  startedAt: ts("2026-09-11", "14:50:55"),
  finishedAt: ts("2026-09-11", "14:51:03"),
  userId: "user-timb-clerk",
  resultMessage: "Grower Booking Import complete: 8 created, 0 updated, 0 errors.",
  isSample: true,
};

const historicalTransporterNote: TransporterNote = {
  id: "tdn-0000001",
  docNo: "TDN0000001",
  state: "COMPLETED",
  sellingPointId: "EL",
  transporterName: "Demo Transporter",
  idNumber: "00-000000-X-00",
  vehicleReg: "ABC0001",
  phone: "0770000000",
  growers: [
    { growerNo: "V100058", location: "A", bales: 3, saleDay: 11, saleMonth: 9, gdnId: "gdn-0000001" },
    { growerNo: "V100043", location: "A", bales: 3, saleDay: 11, saleMonth: 9, gdnId: "gdn-0000002" },
    { growerNo: "V100058", location: "A", bales: 2, saleDay: 11, saleMonth: 9, gdnId: "gdn-0000003" },
  ],
  createdBy: "user-receiving-clerk",
  createdAt: ts("2026-09-10", "14:30:00"),
  completedAt: ts("2026-09-10", "14:39:00"),
  isDemo: true,
};

const historicalDeliveryNotes: DeliveryNote[] = [
  { n: 1, grower: "V100058", bales: 3, row: 1, created: "16:06:00" },
  { n: 2, grower: "V100043", bales: 3, row: 3, created: "14:39:00" },
  { n: 3, grower: "V100058", bales: 2, row: 2, created: "14:39:00" },
].map(({ n, grower, bales, row, created }) => ({
  id: `gdn-${String(n).padStart(7, "0")}`,
  docNo: `GDN${String(n).padStart(7, "0")}`,
  transporterNoteId: "tdn-0000001",
  growerNo: grower,
  location: "A",
  row,
  balesDeclared: bales,
  state: "LAID" as const,
  sellingPointId: "EL",
  sellingDate: "2026-09-11",
  season: 2026,
  floorSale: 1,
  createdAt: ts("2026-09-10", created),
  updatedAt: ts("2026-09-11", "07:30:30"),
  historicalBaleCount: bales,
  isDemo: n !== 2 ? undefined : undefined,
}));

const historicalFloorSummaries: FloorSummary[] = [
  { id: "fs-0001", gdnId: "gdn-0000001", growerNo: "V100058", row: 1, totalBales: 3, district: 7, sellingTime: undefined },
  { id: "fs-0002", gdnId: "gdn-0000002", growerNo: "V100043", row: 3, totalBales: 3, district: 28, sellingTime: "07:30:15" },
  { id: "fs-0003", gdnId: "gdn-0000003", growerNo: "V100058", row: 2, totalBales: 2, district: 7, sellingTime: "07:30:00" },
].map((f) => ({
  ...f,
  sellingPointId: "EL",
  sellingDate: "2026-09-11",
  season: 2026,
  groupFirst: 1,
  groupLast: 1,
  unbooked: 0,
}));

const historicalSaleSpec = [
  { refNo: 1, growerNo: "V100058", gdn: "gdn-0000001", usd: 42720, bales: 3, mass: 310 },
  { refNo: 2, growerNo: "V100058", gdn: "gdn-0000003", usd: 10450, bales: 2, mass: 160 },
  { refNo: 3, growerNo: "V100043", gdn: "gdn-0000002", usd: 19370, bales: 3, mass: 240 },
];

const historicalSales: Sale[] = historicalSaleSpec.map((s) => ({
  id: `sale-${s.refNo}`,
  refNo: s.refNo,
  saleNo: 1,
  growerNo: s.growerNo,
  sellingPointId: "EL",
  floorCode: "EL",
  saleDate: "2026-09-11",
  gdnId: s.gdn,
  priceBatchId: `batch-${s.refNo}`,
  status: "PROCESSED",
  released: true,
  releasedAt: ts("2026-09-11", "15:30:00"),
  releasedBy: "user-data-processing-supervisor",
  payBatchNo: D.historicalPayBatchNo,
  balancedAt: ts("2026-09-11", "11:00:00"),
  balancedBy: "user-data-processing-supervisor",
  processedAt: ts("2026-09-11", "13:00:00"),
  processedBy: "user-data-processing-supervisor",
  createdAt: ts("2026-09-11", "07:30:30"),
  updatedAt: ts("2026-09-11", "13:00:00"),
  historical: { usdValueCents: s.usd, baleCount: s.bales, massKg: s.mass },
  isDemo: true,
}));

const historicalBatches: PriceBatch[] = historicalSaleSpec.map((s) => ({
  id: `batch-${s.refNo}`,
  refNo: s.refNo,
  saleId: `sale-${s.refNo}`,
  growerNo: s.growerNo,
  saleNo: 1,
  sellingDate: "2026-09-11",
  sellingPointId: "EL",
  status: "POSTED",
  postedBy: "user-data-clerk",
  postedAt: ts("2026-09-11", "10:30:00"),
  lastUpdatedBy: "user-data-clerk",
  createdAt: ts("2026-09-11", "07:30:30"),
  isDemo: true,
}));

const historicalStartOfDays: StartOfDay[] = D.previousSaleDates.map((d, i) => ({
  id: `sod-${d}`,
  sellingPointId: "EL",
  sellingDate: d,
  exchangeRate: D.exchangeRate,
  status: "POSTED",
  createdBy: "user-system-admin",
  createdAt: ts(d, "06:30:00"),
  postedBy: "user-system-admin",
  postedAt: ts(d, "06:31:00"),
}));

const historicalPayBatch: PayBatch = {
  no: D.historicalPayBatchNo,
  sellingPointId: "EL",
  saleDate: "2026-09-11",
  saleIds: ["sale-1", "sale-2", "sale-3"],
  createdAt: ts("2026-09-11", "13:00:00"),
  createdBy: "user-data-processing-supervisor",
};

/** DEMO historical payment (amounts = gross; deductions for historical demo sales are not seeded). */
const historicalSchedule: PaymentSchedule = {
  id: "psch-1000-usd",
  ref: "PSCH-1000-USD",
  payBatchNo: D.historicalPayBatchNo,
  currency: "USD",
  invoicesDate: "2026-09-11",
  sellingPointId: "EL",
  status: "PAID",
  generatedAt: ts("2026-09-11", "14:00:00"),
  generatedBy: "user-accounts",
  excluded: [],
  csvFilename: "payment_schedule_1000_USD.csv",
  csvDownloads: 1,
  isDemo: true,
};

const historicalLines: PaymentScheduleLine[] = [
  { growerNo: "V100058", name: "Simba Mhlanga", usd: 42720 + 10450, acct: "7100058001", bankCode: "DBB", bank: "Demo Bank B", branch: "014" },
  { growerNo: "V100043", name: "Simba Chingoma", usd: 19370, acct: "4100043001", bankCode: "DBA", bank: "Demo Bank A", branch: "003" },
].map((l, i) => ({
  id: `pline-1000-${i + 1}`,
  scheduleId: "psch-1000-usd",
  growerNo: l.growerNo,
  beneficiary: l.name,
  currency: "USD",
  creditAccount: l.acct,
  amountCents: l.usd,
  debitAccount: "DEMO-DEBIT-0001",
  companyName: "Ethical Sales Floor (demo)",
  batchReference: "1000",
  transactionId: `1000-${i + 1}`,
  bankCode: l.bankCode,
  bank: l.bank,
  branchCode: l.branch,
  transactionType: "CREDIT",
  transactionDate: "2026-09-11",
  status: "PAID" as const,
  confirmationRef: `DEMO-CONF-100${i + 1}`,
  confirmedAt: ts("2026-09-11", "16:00:00"),
  confirmedBy: "user-accounts",
}));

const historicalPaymentTx: PaymentTransaction[] = [
  { id: "ptx-0001", scheduleId: "psch-1000-usd", kind: "SCHEDULE_GENERATED", at: ts("2026-09-11", "14:00:00"), userId: "user-accounts", note: "Schedule generated (demo history)" },
  { id: "ptx-0002", scheduleId: "psch-1000-usd", kind: "CSV_DOWNLOADED", at: ts("2026-09-11", "14:01:00"), userId: "user-accounts", note: "Bank CSV downloaded (demo history)" },
  { id: "ptx-0003", scheduleId: "psch-1000-usd", lineId: "pline-1000-1", kind: "CONFIRMED", at: ts("2026-09-11", "16:00:00"), userId: "user-accounts", reference: "DEMO-CONF-1001", amountCents: 42720 + 10450, note: "Bank confirmation recorded (demo history)" },
  { id: "ptx-0004", scheduleId: "psch-1000-usd", lineId: "pline-1000-2", kind: "CONFIRMED", at: ts("2026-09-11", "16:00:00"), userId: "user-accounts", reference: "DEMO-CONF-1002", amountCents: 19370, note: "Bank confirmation recorded (demo history)" },
];

const settings: Settings = {
  demoToday: D.saleDate,
  sellingPointId: "EL",
  seasonYear: 2026,
  latencyMs: 120,
  localCurrencyCode: "ZWL",
  rejectedSaleCodes: [...D.rejectedSaleCodes],
  requireDifferentBatchUser: false,
  unbookedPolicy: "WARN",
  approvalRequiredFor: ["sale.reverse"],
  companyName: "Ethical Sales Floor (demo)",
  debitAccount: "DEMO-DEBIT-0001",
  bankCsvTransactionType: "CREDIT",
};

/**
 * The fresh state: the morning of 17 Sep 2026, before any sale-day action.
 * Always returns a DEEP CLONE — the arrays above are module-level constants and scenario builders / tests mutate
 * the result, so sharing references would leak state between calls.
 */
export function createSeedDb(): MockDb {
  return structuredClone(buildSeed());
}

function buildSeed(): MockDb {
  return {
    meta: {
      version: MOCK_DB_VERSION,
      scenario: "FRESH",
      seq: {
        tdn: 1,
        gdn: 3,
        sale: 3,
        batch: 3,
        bale: 0,
        import: 1,
        approval: 0,
        dispatch: 0,
        payBatch: D.historicalPayBatchNo,
        audit: 2,
        generic: 100,
        scaleBarcode: 5,
      },
      createdAt: ts(D.saleDate, "06:00:00"),
    },
    settings: structuredClone(settings),
    users: buildUsers(),
    roles: structuredClone(ROLES),
    seasons: [
      { id: "season-2026", year: 2026, active: true },
      { id: "season-2025", year: 2025, active: false },
    ],
    sellingPoints: [
      { id: "EL", code: "EL", name: D.sellingPoint.name, active: true, saleRooms: [D.sellingPoint.saleRoom], floorRows: 12 },
    ],
    baleLocations: [
      { code: "A", description: "Receiving row A" },
      { code: "B", description: "Receiving row B (demo)" },
    ],
    growers: [...documentedGrowers, ...buildDemoGrowers()],
    growerBankAccounts,
    creditors,
    buyers,
    timbGrades,
    warehouses,
    growerCharges,
    receivingSaleDates: [
      {
        id: "rsd-2026-09-11",
        sellingPointId: "EL",
        date: "2026-09-11",
        isActive: false,
        canScanFloorSummary: true,
        createdBy: "user-receiving-supervisor",
        createdAt: ts("2026-09-11", "06:20:00"),
      },
    ],
    startOfDays: historicalStartOfDays,
    bookings: historicalBookings,
    importJobs: [historicalImport],
    stopOrders: [],
    transporterNotes: [historicalTransporterNote],
    deliveryNotes: historicalDeliveryNotes,
    bales: [],
    scaleReadings: D.growers.flatMap((g) =>
      g.bales_.map((b, i) => ({
        scaleBarcode: b.scale,
        mass: b.mass,
        weighedAt: ts(D.saleDate, `09:${String(10 + i + (g.growerNo === "V100061" ? 10 : 0)).padStart(2, "0")}:00`),
        scaleId: "SCALE-1",
        isDemo: g.demo ? true : undefined,
      })),
    ),
    ticketEvents: [],
    userNextBarcode: {},
    floorSummaries: historicalFloorSummaries,
    floorScans: [],
    sales: historicalSales,
    priceBatches: historicalBatches,
    approvals: [],
    deductions: [],
    internalInvoices: [],
    merchantLoans: [],
    payBatches: [historicalPayBatch],
    paymentSchedules: [historicalSchedule],
    paymentLines: historicalLines,
    paymentTransactions: historicalPaymentTx,
    dispatchNotes: [],
    shipmentExports: [],
    audit: [
      { id: "aud-0001", at: ts("2026-09-11", "06:31:00"), userId: "user-system-admin", userName: "Administrator", action: "start-of-day.post", entityType: "StartOfDay", entityId: "sod-2026-09-11", entityRef: "2026-09-11", reason: "Demo history" },
      { id: "aud-0002", at: ts("2026-09-11", "13:00:00"), userId: "user-data-processing-supervisor", userName: "Chipo Ndlovu", action: "deductions.process", entityType: "PayBatch", entityId: "1000", entityRef: "1000", reason: "Demo history" },
    ],
    notifications: [
      { id: "ntf-0001", at: ts(D.saleDate, "06:00:00"), level: "info", title: "New sale day", body: "17 September 2026 has no receiving sale date yet. Create one in Daily Setup.", href: "/setup/sale-dates", read: false },
    ],
  };
}

import type {
  ApprovalStatus,
  DeductionSource,
  DeliveryNoteState,
  DispatchState,
  ImportStatus,
  ImportType,
  PaymentLineStatus,
  PaymentScheduleStatus,
  PriceBatchState,
  SaleState,
  StartOfDayState,
  TransporterNoteState,
} from "./enums";
import type { Permission } from "./permissions";

/**
 * Domain types for the MOCK database.
 * Money: integer minor units (`*Cents`) — exact. Exchange rates / local-currency amounts are decimal strings
 * handled with decimal.js (see money.ts). Weights: integer kg in the documented data, but typed `number`.
 * `isDemo: true` marks records that are NOT in the manuals (demo-labelled in the UI).
 */
export type ISODate = string; // 2026-09-17
export type ISODateTime = string; // 2026-09-17T07:30:25.000Z

export interface DemoFlag {
  isDemo?: boolean;
}

// ── Identity ─────────────────────────────────────────────────────
export interface AppUser extends DemoFlag {
  id: string;
  name: string;
  email: string;
  roleIds: string[];
  active: boolean;
  /** Empty = all selling points. */
  sellingPointIds: string[];
  permissionOverrides: { grant: Permission[]; deny: Permission[] };
  lastLoginAt?: ISODateTime;
}

// ── Master data ──────────────────────────────────────────────────
export interface Season {
  id: string;
  year: number;
  active: boolean;
}

export interface SellingPoint {
  id: string;
  code: string; // EL
  name: string; // Ethical Sales Floor
  active: boolean;
  saleRooms: string[]; // ["A"]
  /** Number of floor rows per sale room (demo value — not documented). */
  floorRows: number;
}

export interface BaleLocation {
  code: string; // "A" — receiving location/row (Manual 03)
  description: string;
}

export interface Grower extends DemoFlag {
  growerNo: string; // V100060 (may have suffix letter, e.g. V100088A)
  firstName: string;
  surname: string;
  initial?: string;
  district: number;
  cellphone?: string;
  active: boolean;
  season: number;
}

export interface GrowerBankAccount extends DemoFlag {
  id: string;
  growerNo: string;
  currency: string; // USD | ZWL
  bankName: string;
  bankCode: string;
  branchCode: string;
  accountNo: string;
  accountName: string;
}

export interface Creditor extends DemoFlag {
  code: string; // 00050
  name: string;
  kind: "TIMB_CREDITOR" | "FLOOR_CHARGE";
  cellphone?: string;
}

export interface BuyerGrade {
  code: string; // 11OF
}

export interface Buyer extends DemoFlag {
  code: string; // JM
  name: string;
  packingWarehouseCode?: string; // CURVERID
  grades: string[];
}

export interface TimbGrade extends DemoFlag {
  code: string; // A10, A1E, A1L ...
  description?: string;
  /** Reason codes may only be used with a sale code (rejected bale). Unverified (UQ-08). */
  isReason: boolean;
}

export interface Warehouse extends DemoFlag {
  code: string; // CURVERID
  name: string;
  buyerCodes: string[];
  active: boolean;
}

export interface GrowerCharge extends DemoFlag {
  code: string; // FC
  name: string; // Floor Commission
  creditorCode: string;
  order: number; // within the "statutory and floor charges" group
  currency: string;
  /** How the real charge is computed is NOT documented (UQ-05). Shown, never applied in Phase 1. */
  basis: "UNVERIFIED";
  /** Illustrative fixed amounts used by the mock processing run. */
  demoAmountCentsByGrower: Record<string, number>;
  active: boolean;
}

// ── Settings ─────────────────────────────────────────────────────
export interface Settings {
  /** The mock "today" — the documented test sale day. */
  demoToday: ISODate;
  sellingPointId: string;
  seasonYear: number;
  latencyMs: number;
  localCurrencyCode: string; // configurable (UQ-04): ZWL per the brief/manual 08
  rejectedSaleCodes: string[]; // RO, RH, CO (Manual 09)
  requireDifferentBatchUser: boolean; // unverified (UQ-06)
  unbookedPolicy: "WARN" | "BLOCK"; // unverified (UQ-09)
  /** Actions that create a pending approval instead of executing. Unverified (UQ-06). */
  approvalRequiredFor: string[];
  companyName: string;
  debitAccount: string;
  bankCsvTransactionType: string;
}

// ── Daily setup ──────────────────────────────────────────────────
export interface ReceivingSaleDate {
  id: string;
  sellingPointId: string;
  date: ISODate;
  isActive: boolean;
  canScanFloorSummary: boolean;
  createdBy: string;
  createdAt: ISODateTime;
}

export interface StartOfDay {
  id: string;
  sellingPointId: string;
  sellingDate: ISODate;
  exchangeRate: string; // decimal string, e.g. "26.68450000"
  status: StartOfDayState;
  createdBy: string;
  createdAt: ISODateTime;
  postedBy?: string;
  postedAt?: ISODateTime;
}

// ── TIMB ─────────────────────────────────────────────────────────
export interface GrowerBooking extends DemoFlag {
  id: string;
  bookedId: string; // EL2609170001 — TIMB booking reference
  sellDate: ISODate;
  season: number;
  growerNo: string;
  firstName: string;
  surname: string;
  bookDate: ISODate;
  balesBooked: number;
  sourceBales: number; // "Source B…" column (UQ-09) — meaning unknown
  floor: string; // EL
  bookedBy: string; // "TIMB Online"
  lastUpdated: ISODateTime;
  importJobId?: string;
}

export interface ImportRowError {
  row: number;
  field?: string;
  value?: string;
  message: string;
}

export interface ImportJob {
  id: string;
  ref: string; // IMP-0001
  type: ImportType;
  filename: string;
  sizeBytes: number;
  status: ImportStatus;
  created: number;
  updated: number;
  errorCount: number;
  rowErrors: ImportRowError[];
  /** Plain-text records kept so the preview/error download works (mock only; real files are encrypted). */
  records: Array<Record<string, string>>;
  checksum: string;
  startedAt: ISODateTime;
  finishedAt?: ISODateTime;
  userId: string;
  resultMessage?: string;
  /** True when the dev sample file was used. Real TIMB decryption is NOT implemented (UQ-13). */
  isSample: boolean;
}

export interface StopOrder extends DemoFlag {
  id: string;
  timbFile: string; // EL_stoporders_20260917.txt
  fileDate: ISODate; // from the file name — links to that day's sales
  growerNo: string;
  creditorCode: string;
  amount1Cents: number;
  amount2Cents: number;
  amount3Cents: number; // Amount 1/2/3 meaning unknown (UQ-07)
  paidAmountCents: number;
  priority: number;
  recType: string; // "06"
  stopOrderNo: number;
  percent: number;
  season: number;
  createdAt: ISODateTime;
  importJobId?: string;
}

// ── Receiving ────────────────────────────────────────────────────
export interface TransporterGrowerLine {
  growerNo: string;
  location: string; // receiving row/location, "A"
  bales: number;
  saleDay: number;
  saleMonth: number;
  gdnId?: string; // set when the note is completed
}

export interface TransporterNote extends DemoFlag {
  id: string;
  docNo: string; // TDN0000002
  state: TransporterNoteState;
  sellingPointId: string;
  transporterName: string;
  idNumber: string;
  vehicleReg: string; // spaces removed
  phone: string;
  permitNo?: string;
  growers: TransporterGrowerLine[];
  createdBy: string;
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
}

export interface DeliveryNote extends DemoFlag {
  id: string;
  docNo: string; // GDN0000005
  transporterNoteId?: string;
  growerNo: string;
  location: string;
  row?: number; // floor row (set at floor summary)
  balesDeclared: number;
  state: DeliveryNoteState;
  sellingPointId: string;
  sellingDate: ISODate;
  season: number;
  floorSale: number;
  startBarcode?: string;
  lotHighest?: number;
  lotLowest?: number;
  /** Set when the grower delivery is completed (Manual 03 Step 5): Open → Tickets Printing. */
  deliveryClosedAt?: ISODateTime;
  ticketsConfirmedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Historical demo notes carry no bale rows. */
  historicalBaleCount?: number;
}

export interface Bale extends DemoFlag {
  id: string;
  scaleBarcode: string; // 2609170001
  ticketBarcode?: string; // 1000001013 (10 chars, check char last)
  growerNo: string;
  gdnId: string;
  group: number;
  lot: string; // "3" or "12/3"
  mass: number; // kg
  ejected: boolean;
  printed: boolean;
  ticketDate?: ISODate;
  floorRow?: number;
  scannedAt?: ISODateTime;
  // classification (Manual 06)
  timbGrade?: string;
  hessianOwner?: string;
  // e-Buying
  buyerCode?: string;
  buyerGrade?: string;
  priceCents?: number; // US cents per kg
  saleCode?: string;
  // batch (second capture)
  batchPriceCents?: number;
  saleId?: string;
  dispatchNoteId?: string;
  capturedBy: string;
  capturedAt: ISODateTime;
}

export interface ScaleReading extends DemoFlag {
  scaleBarcode: string;
  mass: number;
  weighedAt: ISODateTime;
  scaleId: string;
}

export interface TicketEvent {
  id: string;
  gdnId: string;
  kind: "ALLOCATE" | "PRINT" | "REPRINT" | "CONFIRM" | "REVERSE" | "INTERRUPT";
  at: ISODateTime;
  userId: string;
  detail: string;
}

// ── Floor summary ────────────────────────────────────────────────
export interface FloorSummary extends DemoFlag {
  id: string;
  gdnId: string;
  growerNo: string;
  sellingPointId: string;
  sellingDate: ISODate;
  season: number;
  district: number;
  row: number;
  groupFirst: number;
  groupLast: number;
  totalBales: number;
  unbooked: number;
  sellingTime?: string; // "07:30:25" (meaning unclear, UQ-10)
}

export interface FloorScan {
  id: string;
  barcode: string;
  row?: number;
  saleRoom: string;
  at: ISODateTime;
  userId: string;
  result: "OK" | "DUPLICATE" | "INVALID";
  message: string;
}

// ── Sales ────────────────────────────────────────────────────────
export interface Sale extends DemoFlag {
  id: string;
  refNo: number; // "Salesmaster 4"
  saleNo: number; // "Sale 1"
  growerNo: string;
  sellingPointId: string;
  floorCode: string; // EL
  saleDate: ISODate;
  gdnId: string;
  priceBatchId: string;
  status: SaleState;
  released: boolean;
  releasedAt?: ISODateTime;
  releasedBy?: string;
  payBatchNo?: number;
  zwgPaymentRef?: string;
  usdPaymentRef?: string;
  balancedAt?: ISODateTime;
  balancedBy?: string;
  processedAt?: ISODateTime;
  processedBy?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Historical demo sales carry aggregates only (no bale rows). */
  historical?: { usdValueCents: number; baleCount: number; massKg: number };
}

export interface PriceBatch extends DemoFlag {
  id: string;
  refNo: number; // "Batch 4"
  saleId: string;
  growerNo: string;
  saleNo: number;
  sellingDate: ISODate;
  sellingPointId: string;
  status: PriceBatchState;
  postedBy?: string;
  postedAt?: ISODateTime;
  lastUpdatedBy: string;
  createdAt: ISODateTime;
}

export interface Approval {
  id: string;
  ref: string; // APR-0001
  entityType: string;
  entityId: string;
  entityRef: string;
  action: string;
  requestedBy: string;
  requestReason: string;
  requestedAt: ISODateTime;
  status: ApprovalStatus;
  decidedBy?: string;
  decisionReason?: string;
  decidedAt?: ISODateTime;
}

// ── Deductions & payments ────────────────────────────────────────
export interface Deduction {
  id: string;
  saleId: string;
  growerNo: string;
  source: DeductionSource;
  /** 1–5, the documented processing order. */
  sequence: number;
  creditorCode: string;
  creditorName: string;
  description: string;
  currency: string;
  amountCents: number;
  paidCents: number;
  payBatchNo: number;
  sellingDate: ISODate;
  createdAt: ISODateTime;
  isDemoAmount?: boolean;
}

export interface InternalInvoice extends DemoFlag {
  id: string;
  growerNo: string;
  creditorCode: string;
  description: string;
  amountCents: number;
  currency: string;
  status: "OPEN" | "SETTLED";
}

export interface MerchantLoan extends DemoFlag {
  id: string;
  growerNo: string;
  creditorCode: string;
  balanceCents: number;
  currency: string;
  status: "OPEN" | "SETTLED";
}

export interface PayBatch {
  no: number; // 1001
  sellingPointId: string;
  saleDate: ISODate;
  saleIds: string[];
  createdAt: ISODateTime;
  createdBy: string;
}

export interface PaymentScheduleLine {
  id: string;
  scheduleId: string;
  growerNo: string;
  beneficiary: string;
  currency: string;
  creditAccount: string;
  amountCents: number;
  debitAccount: string;
  companyName: string;
  batchReference: string;
  transactionId: string;
  bankCode: string;
  bank: string;
  branchCode: string;
  transactionType: string;
  transactionDate: ISODate;
  status: PaymentLineStatus;
  confirmationRef?: string;
  confirmedAt?: ISODateTime;
  confirmedBy?: string;
  failureReason?: string;
}

export interface PaymentSchedule extends DemoFlag {
  id: string;
  ref: string; // PSCH-1001-USD
  payBatchNo: number;
  currency: string;
  invoicesDate: ISODate;
  sellingPointId: string;
  status: PaymentScheduleStatus;
  generatedAt: ISODateTime;
  generatedBy: string;
  excluded: Array<{ growerNo: string; name: string; reason: string }>;
  csvFilename: string;
  csvDownloads: number;
}

/** Immutable payment history. Never edited or deleted. */
export interface PaymentTransaction {
  id: string;
  scheduleId: string;
  lineId?: string;
  kind: "SCHEDULE_GENERATED" | "CSV_DOWNLOADED" | "CLOUDPAY_SUBMITTED_MOCK" | "CONFIRMED" | "FAILED" | "RECONCILED_NOTE";
  at: ISODateTime;
  userId: string;
  reference?: string;
  amountCents?: number;
  note: string;
}

// ── Dispatch ─────────────────────────────────────────────────────
export interface DispatchNote extends DemoFlag {
  id: string;
  ref: string; // FLDN/2026/09/0001
  state: DispatchState;
  warehouseCode: string;
  product: "GREEN";
  noTransportDetails: boolean;
  transportName?: string;
  truckReg?: string;
  driver?: string;
  driverNationalId?: string;
  driverCell?: string;
  baleIds: string[];
  totalBales: number;
  totalMass: number;
  createdBy: string;
  createdAt: ISODateTime;
  /** Loading finished ("Done") — still Draft until posted. */
  loadingDoneAt?: ISODateTime;
  dispatchDate?: ISODate;
  postedBy?: string;
  postedAt?: ISODateTime;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: ISODateTime;
  mobileCreated: boolean;
}

export interface ShipmentExport {
  id: string;
  dispatchNoteId: string;
  filename: string;
  generatedAt: ISODateTime;
  generatedBy: string;
  rowCount: number;
  csv: string;
  isMockFormat: boolean; // shipment-file columns undocumented (UQ-12)
}

// ── Cross-cutting ────────────────────────────────────────────────
export interface AuditEntry {
  id: string;
  at: ISODateTime;
  userId: string;
  userName: string;
  action: string; // e.g. "sale.balance"
  entityType: string;
  entityId: string;
  entityRef?: string;
  previous?: unknown;
  next?: unknown;
  reason?: string;
  meta?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  at: ISODateTime;
  level: "info" | "success" | "warning" | "error";
  title: string;
  body: string;
  href?: string;
  read: boolean;
}

export type ScenarioId =
  | "FRESH"
  | "START_OF_DAY"
  | "BOOKINGS_IMPORTED"
  | "RECEIVING_IN_PROGRESS"
  | "RECEIVED"
  | "TICKETS_CONFIRMED"
  | "FLOOR_SUMMARY_DONE"
  | "READY_TO_BALANCE"
  | "BALANCED"
  | "PROCESSED"
  | "READY_TO_DISPATCH"
  | "VALIDATION_SHOWCASE";

export interface MockDbMeta {
  version: number;
  scenario: ScenarioId;
  /** Monotonic counters for human-readable references. */
  seq: {
    tdn: number;
    gdn: number;
    sale: number;
    batch: number;
    bale: number;
    import: number;
    approval: number;
    dispatch: number;
    payBatch: number;
    audit: number;
    generic: number;
    scaleBarcode: number;
  };
  createdAt: ISODateTime;
}

export interface MockDb {
  meta: MockDbMeta;
  settings: Settings;
  users: AppUser[];
  roles: import("./roles").RoleDef[];
  seasons: Season[];
  sellingPoints: SellingPoint[];
  baleLocations: BaleLocation[];
  growers: Grower[];
  growerBankAccounts: GrowerBankAccount[];
  creditors: Creditor[];
  buyers: Buyer[];
  timbGrades: TimbGrade[];
  warehouses: Warehouse[];
  growerCharges: GrowerCharge[];
  receivingSaleDates: ReceivingSaleDate[];
  startOfDays: StartOfDay[];
  bookings: GrowerBooking[];
  importJobs: ImportJob[];
  stopOrders: StopOrder[];
  transporterNotes: TransporterNote[];
  deliveryNotes: DeliveryNote[];
  bales: Bale[];
  scaleReadings: ScaleReading[];
  ticketEvents: TicketEvent[];
  /** userId → next 10-char ticket barcode on that user's roll (Manual 04: start barcodes belong to each user). */
  userNextBarcode: Record<string, string>;
  floorSummaries: FloorSummary[];
  floorScans: FloorScan[];
  sales: Sale[];
  priceBatches: PriceBatch[];
  approvals: Approval[];
  deductions: Deduction[];
  internalInvoices: InternalInvoice[];
  merchantLoans: MerchantLoan[];
  payBatches: PayBatch[];
  paymentSchedules: PaymentSchedule[];
  paymentLines: PaymentScheduleLine[];
  paymentTransactions: PaymentTransaction[];
  dispatchNotes: DispatchNote[];
  shipmentExports: ShipmentExport[];
  audit: AuditEntry[];
  notifications: Notification[];
}

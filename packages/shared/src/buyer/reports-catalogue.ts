import type { BuyerPermission } from "./permissions";
import type { ReportArea, ReportColumnDto, ReportFilterKey } from "./dto/reports";

/**
 * The Buyer Portal report catalogue — ONE definition per report, shared by the API (which builds the rows) and the web
 * workbench (which renders the filters, columns and tabs). Formulas and semantics are documented in
 * docs/buyer-portal/REPORTS.md.
 */
export const REPORT_IDS = [
  "purchase-register",
  "invoice-charges",
  "purchases-by-grade",
  "flow-disk-imports",
  "purchase-shipment-received",
  "shipment-register",
  "receiving-sessions",
  "bale-discrepancies",
  "stock-by-location",
  "stock-by-grade",
  "inventory-position",
  "warehouse-movements",
] as const;
export type ReportId = (typeof REPORT_IDS)[number];

export interface ReportOption {
  value: string;
  label: string;
}

export interface ReportDefinition {
  id: ReportId;
  area: ReportArea;
  title: string;
  description: string;
  filters: ReportFilterKey[];
  /** What the date range filters (shown on the picker and in the exports). */
  dateLabel?: string;
  statusLabel?: string;
  statusOptions?: ReportOption[];
  kindLabel?: string;
  kindOptions?: ReportOption[];
  columns: ReportColumnDto[];
  /** Permissions needed IN ADDITION to `buyer.reports.view`, so a role never sees data it cannot open elsewhere. */
  requires: BuyerPermission[];
  defaultSort: { key: string; dir: "asc" | "desc" };
  /** Order used instead of `defaultSort` while "only with differences" is on and the user picked no sort. */
  varianceSort?: { key: string; dir: "asc" | "desc" };
  /** Shown under the table and in the exports. */
  notes?: string[];
  /** Excel sheet name when the title is longer than Excel's 31-character limit. */
  sheetName?: string;
}

export const REPORT_AREAS: Array<{ id: ReportArea; title: string; description: string }> = [
  { id: "purchases", title: "Purchase Reports", description: "What was bought at the floor, what it cost, and the invoice charges." },
  { id: "receiving", title: "Receiving Reports", description: "Purchase vs shipment vs received: what the invoice says, what the floor sent, what was scanned." },
  { id: "inventory", title: "Inventory Reports", description: "Stock on hand by warehouse, location and grade, bale-level position, ageing and movements." },
];

const opt = (value: string, label: string): ReportOption => ({ value, label });

const RECEIVING_STATUSES = [
  opt("NOT_STARTED", "Not started"),
  opt("PARTIALLY_DISPATCHED", "Partially dispatched"),
  opt("IN_PROGRESS", "In progress"),
  opt("PARTIALLY_RECEIVED", "Partially received"),
  opt("COMPLETE", "Complete"),
];
const RECONCILIATION_STATUSES = [opt("AWAITING_SHIPMENTS", "Awaiting shipments"), opt("IN_PROGRESS", "In progress"), opt("CLOSED", "Closed")];
const SHIPMENT_STATUSES = [
  opt("IN_TRANSIT", "In transit"),
  opt("ARRIVED", "Arrived"),
  opt("RECEIVING", "Being received"),
  opt("CONFIRMED", "Confirmed (awaiting storage)"),
  opt("ALLOCATED", "Received and stored"),
  opt("CANCELLED", "Cancelled"),
];
const BALE_STATUSES = [
  opt("IN_STOCK", "In stock"),
  opt("RETURNED", "Returned from processing"),
  opt("EXCEPTION", "Exception"),
  opt("EXPECTED", "Expected (not received)"),
  opt("DISPATCHED", "Dispatched / in transit"),
  opt("SUPERSEDED", "Superseded"),
];

const col = (key: string, header: string, format: ReportColumnDto["format"], extra: Partial<ReportColumnDto> = {}): ReportColumnDto => ({ key, header, format, ...extra });

export const REPORT_CATALOGUE: ReportDefinition[] = [
  // ── Purchase reports ───────────────────────────────────────────────────────
  {
    id: "purchase-register",
    area: "purchases",
    title: "Purchase Register",
    description: "One row per purchase: sale date, floor, invoice, bales, mass, value, what is payable and how far receiving has got.",
    filters: ["dateRange", "floor", "search", "status", "kind"],
    dateLabel: "Sale date",
    statusLabel: "Receiving status",
    statusOptions: RECEIVING_STATUSES,
    kindLabel: "Reconciliation",
    kindOptions: RECONCILIATION_STATUSES,
    requires: ["buyer.purchases.view"],
    defaultSort: { key: "saleDate", dir: "desc" },
    columns: [
      col("reference", "Purchase", "mono", { sortable: true }),
      col("saleDate", "Sale date", "date", { sortable: true }),
      col("floorName", "Floor", "text", { sortable: true }),
      col("invoiceNo", "Invoice", "mono"),
      col("bales", "Bales", "int", { sortable: true }),
      col("massKg", "Mass (kg)", "mass", { sortable: true }),
      col("avgUsc", "Avg USc/kg", "money"),
      col("usd", "Value (US$)", "money", { sortable: true, currency: "USD" }),
      col("payableUsd", "Payable US$", "money", { currency: "USD" }),
      col("payableZig", "Payable ZiG", "money", { currency: "ZiG" }),
      col("shipments", "Shipments", "int"),
      col("receivingStatus", "Receiving", "status"),
      col("reconciliationStatus", "Reconciliation", "status"),
    ],
  },
  {
    id: "invoice-charges",
    area: "purchases",
    title: "Invoices & Charges",
    description: "Each buyer invoice with the tobacco value, the levies and floor charges (USD and ZiG) and the amount payable.",
    filters: ["dateRange", "floor", "search"],
    dateLabel: "Sale date",
    requires: ["buyer.purchases.view", "buyer.invoices.view"],
    defaultSort: { key: "saleDate", dir: "desc" },
    columns: [
      col("reference", "Invoice ref.", "mono", { sortable: true }),
      col("invoiceNo", "Invoice no.", "mono"),
      col("saleDate", "Sale date", "date", { sortable: true }),
      col("floorName", "Floor", "text", { sortable: true }),
      col("tobaccoUsd", "Tobacco US$", "money", { currency: "USD" }),
      col("tobaccoZig", "Tobacco ZiG", "money", { currency: "ZiG" }),
      col("govLevyUsd", "Gov. levy US$", "money", { currency: "USD" }),
      col("govLevyZig", "Gov. levy ZiG", "money", { currency: "ZiG" }),
      col("ttaUsd", "TTA levy US$", "money", { currency: "USD" }),
      col("ttaZig", "TTA levy ZiG", "money", { currency: "ZiG" }),
      col("clearingUsd", "Clearing US$", "money", { currency: "USD" }),
      col("clearingZig", "Clearing ZiG", "money", { currency: "ZiG" }),
      col("payableUsd", "Payable US$", "money", { sortable: true, currency: "USD" }),
      col("payableZig", "Payable ZiG", "money", { sortable: true, currency: "ZiG" }),
    ],
    notes: [
      "Amounts are shown as printed on the invoice; levy rates are not recomputed.",
      "Payable is the sum of section B (the USD/ZiG split plus levies and clearing). Section A, the tobacco value, is informational.",
    ],
  },
  {
    id: "purchases-by-grade",
    area: "purchases",
    title: "Purchases by Grade",
    description: "Bales, mass and value bought per buyer grade, with the average price and each grade's share.",
    filters: ["dateRange", "floor", "grade", "purchaseId"],
    dateLabel: "Sale date",
    requires: ["buyer.purchases.view"],
    defaultSort: { key: "bales", dir: "desc" },
    columns: [
      col("grade", "Buyer grade", "text", { sortable: true }),
      col("bales", "Bales", "int", { sortable: true }),
      col("massKg", "Mass (kg)", "mass", { sortable: true }),
      col("usd", "Value (US$)", "money", { sortable: true, currency: "USD" }),
      col("avgUsc", "Avg USc/kg", "money", { sortable: true }),
      col("share", "Share of bales", "percent", { sortable: true }),
    ],
  },
  {
    id: "flow-disk-imports",
    area: "purchases",
    title: "Flow Disk Import Register",
    description: "Every Flow Disk / invoice import: when, what file, how many rows were valid and where it ended up.",
    filters: ["dateRange", "search", "status"],
    dateLabel: "Imported on",
    statusLabel: "Import status",
    statusOptions: [opt("STAGED", "Staged"), opt("COMPLETED", "Completed"), opt("REJECTED_DUPLICATE", "Rejected (duplicate)"), opt("FAILED", "Failed"), opt("CANCELLED", "Cancelled")],
    requires: ["buyer.purchases.view"],
    defaultSort: { key: "createdAt", dir: "desc" },
    columns: [
      col("reference", "Import", "mono", { sortable: true }),
      col("filename", "File", "text"),
      col("createdAt", "Imported", "datetime", { sortable: true }),
      col("status", "Status", "status", { sortable: true }),
      col("records", "Rows", "int"),
      col("valid", "Valid", "int"),
      col("invalid", "Invalid", "int"),
      col("massKg", "Mass (kg)", "mass"),
      col("usd", "Value (US$)", "money", { currency: "USD" }),
      col("purchase", "Purchase", "mono"),
      col("format", "Format", "text"),
    ],
  },

  // ── Receiving reports ──────────────────────────────────────────────────────
  {
    id: "purchase-shipment-received",
    area: "receiving",
    title: "Purchase vs Shipment vs Received",
    sheetName: "Purchase-Shipment-Received",
    varianceSort: { key: "outstanding", dir: "desc" }, // the physical gap (dispatched, not received) first
    description: "Per purchase: what the invoice says was bought, what the floor's shipment sheets say was dispatched, and what was actually scanned in — with the differences.",
    filters: ["dateRange", "floor", "search", "kind", "onlyVariances"],
    dateLabel: "Sale date",
    kindLabel: "Reconciliation",
    kindOptions: RECONCILIATION_STATUSES,
    requires: ["buyer.purchases.view", "buyer.receiving.view"],
    defaultSort: { key: "saleDate", dir: "desc" },
    columns: [
      col("reference", "Purchase", "mono", { sortable: true }),
      col("saleDate", "Sale date", "date", { sortable: true }),
      col("floorName", "Floor", "text"),
      col("purchasedBales", "Purchased bales", "int", { sortable: true }),
      col("purchasedKg", "Purchased kg", "mass", { sortable: true }),
      col("dispatchedBales", "Dispatched bales", "int", { sortable: true }),
      col("dispatchedKg", "Dispatched kg", "mass"),
      col("receivedBales", "Received bales", "int", { sortable: true }),
      col("receivedKg", "Received kg (weighed)", "mass"),
      col("weighed", "Weighed", "text", { align: "right" }),
      col("notDispatched", "Not yet dispatched", "int", { sortable: true }),
      col("outstanding", "Outstanding", "int", { sortable: true }),
      col("massVarianceKg", "Mass variance (kg)", "mass", { sortable: true }),
      col("reconciliationStatus", "Reconciliation", "status"),
    ],
    notes: [
      "Purchased = the invoice / Flow Disk. Dispatched = the shipment manifests the floor sent (cancelled shipments excluded). Received = bales scanned in during receiving.",
      "Outstanding = dispatched but not yet received. Not yet dispatched = purchased but on no shipment.",
      "Mass variance = received weight minus dispatched weight, over bales that were weighed at receiving. Bales scanned without a weight are not part of the variance (see 'Weighed').",
      "'Only with differences' keeps purchases where any of not-yet-dispatched, outstanding or mass variance is not zero.",
    ],
  },
  {
    id: "shipment-register",
    area: "receiving",
    title: "Shipment Register",
    description: "Every shipment from the floor: truck and driver, destination, expected vs received, days in transit and where it stands.",
    filters: ["dateRange", "status", "warehouseId", "purchaseId", "search"],
    dateLabel: "Dispatch date",
    statusLabel: "Shipment status",
    statusOptions: SHIPMENT_STATUSES,
    requires: ["buyer.receiving.view"],
    defaultSort: { key: "dispatchDate", dir: "desc" },
    columns: [
      col("reference", "Shipment", "mono", { sortable: true }),
      col("purchase", "Purchase", "mono"),
      col("dispatchDate", "Dispatched", "date", { sortable: true }),
      col("truck", "Truck / trailer", "text"),
      col("driver", "Driver / transporter", "text"),
      col("destination", "Destination", "text"),
      col("expectedBales", "Expected bales", "int", { sortable: true }),
      col("receivedBales", "Received bales", "int"),
      col("expectedKg", "Expected kg", "mass"),
      col("receivedKg", "Received kg", "mass"),
      col("arrivedAt", "Arrived", "datetime", { sortable: true }),
      col("daysInTransit", "Days in transit", "int", { sortable: true }),
      col("status", "Status", "status", { sortable: true }),
    ],
    notes: ["Received kg is the manifest weight of the bales received so far. Days in transit counts from dispatch to arrival (or to today while still in transit)."],
  },
  {
    id: "receiving-sessions",
    area: "receiving",
    title: "Receiving Sessions",
    description: "Scanning sessions: who ran them, when, how many bales were scanned against what was expected, and the exceptions raised.",
    filters: ["dateRange", "status", "purchaseId", "search"],
    dateLabel: "Started on",
    statusLabel: "Session status",
    statusOptions: [opt("OPEN", "Open"), opt("CONFIRMED", "Confirmed"), opt("ALLOCATED", "Stored"), opt("CANCELLED", "Cancelled")],
    requires: ["buyer.receiving.view"],
    defaultSort: { key: "startedAt", dir: "desc" },
    columns: [
      col("reference", "Session", "mono", { sortable: true }),
      col("shipment", "Shipment", "mono"),
      col("purchase", "Purchase", "mono"),
      col("startedAt", "Started", "datetime", { sortable: true }),
      col("startedBy", "Started by", "text"),
      col("confirmedAt", "Confirmed", "datetime", { sortable: true }),
      col("duration", "Duration", "text", { align: "right" }),
      col("expectedBales", "Expected", "int"),
      col("scannedBales", "Scanned", "int"),
      col("exceptions", "Exceptions (open / all)", "text", { align: "right" }),
      col("status", "Status", "status", { sortable: true }),
    ],
  },
  {
    id: "bale-discrepancies",
    area: "receiving",
    title: "Bale Discrepancies",
    description: "Bale by bale: dispatched but not received, missing, and the unexpected / wrong / invalid scans — each with its explanation.",
    filters: ["dateRange", "kind", "purchaseId", "search"],
    dateLabel: "Date raised / dispatched",
    kindLabel: "Discrepancy",
    kindOptions: [
      opt("OUTSTANDING", "Outstanding (dispatched, not yet received)"),
      opt("MISSING", "Missing (shipment finished without it)"),
      opt("UNEXPECTED", "Unexpected bale"),
      opt("WRONG_PURCHASE", "Wrong purchase"),
      opt("WRONG_BUYER", "Wrong buyer"),
      opt("INVALID_BARCODE", "Invalid barcode"),
      opt("DUPLICATE_SCAN", "Duplicate scan"),
      opt("EXCEPTION", "Other exception"),
    ],
    requires: ["buyer.receiving.view"],
    defaultSort: { key: "since", dir: "desc" },
    columns: [
      col("kind", "Discrepancy", "status", { sortable: true }),
      col("barcode", "Barcode", "mono", { sortable: true }),
      col("purchase", "Purchase", "mono"),
      col("shipment", "Shipment", "mono"),
      col("since", "Since", "datetime", { sortable: true }),
      col("detail", "Detail / explanation", "text", { width: 3 }),
      col("state", "State", "status"),
    ],
    notes: [
      "Outstanding / missing are derived from the shipment manifests: a dispatched bale that has not been received. It is 'missing' once its shipment has been confirmed or its purchase reconciliation closed without it.",
      "For wrong-buyer scans only the scanned barcode and your own explanation are shown — nothing about another company's stock.",
    ],
  },

  // ── Inventory reports ──────────────────────────────────────────────────────
  {
    id: "stock-by-location",
    area: "inventory",
    title: "Stock by Warehouse & Location",
    description: "Bales on hand per warehouse, bay and row with mass, value and how full each row is.",
    filters: ["warehouseId", "bayId", "kind", "includeEmpty"],
    kindLabel: "Warehouse type",
    kindOptions: [opt("STANDARD", "Buyer warehouses"), opt("PROCESSING", "Processing warehouses")],
    requires: ["buyer.warehouse.view"],
    defaultSort: { key: "warehouse", dir: "asc" },
    columns: [
      col("warehouse", "Warehouse", "text", { sortable: true }),
      col("kind", "Type", "text"),
      col("bay", "Bay", "text", { sortable: true }),
      col("row", "Row", "text", { sortable: true }),
      col("bales", "Bales", "int", { sortable: true }),
      col("massKg", "Mass (kg)", "mass", { sortable: true }),
      col("usd", "Value (US$)", "money", { sortable: true, currency: "USD" }),
      col("capacity", "Capacity (bales)", "int"),
      col("occupancy", "Occupancy", "percent", { sortable: true }),
    ],
    notes: ["On hand = bales in stock, returned from processing, or flagged as an exception that sit in a location. Row capacity is advisory."],
  },
  {
    id: "stock-by-grade",
    area: "inventory",
    title: "Stock by Grade",
    description: "Stock on hand per buyer grade and warehouse, with the average price.",
    filters: ["warehouseId", "grade", "purchaseId", "dateRange"],
    dateLabel: "Received on",
    requires: ["buyer.warehouse.view"],
    defaultSort: { key: "grade", dir: "asc" },
    columns: [
      col("grade", "Buyer grade", "text", { sortable: true }),
      col("warehouse", "Warehouse", "text", { sortable: true }),
      col("bales", "Bales", "int", { sortable: true }),
      col("massKg", "Mass (kg)", "mass", { sortable: true }),
      col("usd", "Value (US$)", "money", { sortable: true, currency: "USD" }),
      col("avgUsc", "Avg USc/kg", "money", { sortable: true }),
    ],
    notes: ["'Received, not yet stored' lists bales that were scanned in but have not been allocated to a warehouse location."],
  },
  {
    id: "inventory-position",
    area: "inventory",
    title: "Inventory Position",
    description: "One row per bale: grade, grower, lot, weight, value, status, exact location and how many days it has been in stock.",
    filters: ["search", "status", "warehouseId", "bayId", "grade", "purchaseId", "dateRange"],
    dateLabel: "Received on",
    statusLabel: "Bale status",
    statusOptions: BALE_STATUSES,
    requires: ["buyer.warehouse.view"],
    defaultSort: { key: "receivedAt", dir: "desc" },
    columns: [
      col("barcode", "Barcode", "mono", { sortable: true }),
      col("grade", "Grade", "text", { sortable: true }),
      col("grower", "Grower", "text"),
      col("lot", "Lot", "text"),
      col("massKg", "Mass (kg)", "mass", { sortable: true }),
      col("usd", "Value (US$)", "money", { sortable: true, currency: "USD" }),
      col("status", "Status", "status", { sortable: true }),
      col("location", "Location", "text"),
      col("purchase", "Purchase", "mono"),
      col("receivedAt", "Received", "datetime", { sortable: true }),
      col("ageDays", "Age (days)", "int", { sortable: true }),
    ],
    notes: ["With no status chosen the report lists stock on hand (in stock, returned, exception). Age counts business days since the bale was received."],
  },
  {
    id: "warehouse-movements",
    area: "inventory",
    title: "Warehouse Movements",
    description: "The movement ledger: every put-away, move and transfer with who did it, why, and from where to where.",
    filters: ["dateRange", "kind", "warehouseId", "search"],
    dateLabel: "Moved on",
    kindLabel: "Movement type",
    kindOptions: [opt("STORE", "Stored"), opt("MOVE", "Moved"), opt("TRANSFER", "Transferred"), opt("DISPATCH_OUT", "Dispatched out"), opt("RETURN_IN", "Returned in")],
    requires: ["buyer.warehouse.view"],
    defaultSort: { key: "performedAt", dir: "desc" },
    columns: [
      col("performedAt", "When", "datetime", { sortable: true }),
      col("barcode", "Barcode", "mono"),
      col("type", "Type", "status", { sortable: true }),
      col("from", "From", "text"),
      col("to", "To", "text"),
      col("reason", "Reason", "text", { width: 2 }),
      col("performedBy", "By", "text"),
      col("reference", "Reference", "text"),
    ],
  },
];

export const REPORTS_BY_ID: Record<ReportId, ReportDefinition> = Object.fromEntries(REPORT_CATALOGUE.map((r) => [r.id, r])) as Record<ReportId, ReportDefinition>;

export const reportsForArea = (area: ReportArea): ReportDefinition[] => REPORT_CATALOGUE.filter((r) => r.area === area);

/** The reports a user may run: `buyer.reports.view` plus each report's own domain permission. */
export function reportsFor(permissions: ReadonlySet<string> | readonly string[] | undefined, area?: ReportArea): ReportDefinition[] {
  const has = (p: string) => (permissions instanceof Set ? permissions.has(p) : (permissions as readonly string[] | undefined)?.includes(p) ?? false);
  if (!has("buyer.reports.view")) return [];
  return REPORT_CATALOGUE.filter((r) => (!area || r.area === area) && r.requires.every(has));
}

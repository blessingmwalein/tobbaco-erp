/**
 * Buyer Portal enums — shared by the NestJS API (Prisma maps these 1:1), the web client and tests.
 * The API is authoritative for every transition; the UI only renders them.
 */

/** Current state of an individual purchased bale (a projection of its immutable event history). */
export const BALE_STATUSES = [
  "EXPECTED", // in the imported manifest, not yet physically received
  "IN_STOCK", // received and stored in a buyer (standard) warehouse — available for dispatch
  "DISPATCHED", // sent to a processing company (in transit / under processing) — NOT available stock
  "RETURNED", // received back from processing and stored in a processing warehouse
  "EXCEPTION", // flagged for investigation
  "SUPERSEDED", // original record replaced by a re-identified (new barcode) successor — history kept
] as const;
export type BaleStatus = (typeof BALE_STATUSES)[number];

export const BALE_STATUS_LABEL: Record<BaleStatus, string> = {
  EXPECTED: "Expected",
  IN_STOCK: "In stock",
  DISPATCHED: "Dispatched to processor",
  RETURNED: "Returned from processing",
  EXCEPTION: "Exception",
  SUPERSEDED: "Re-identified",
};

/** Result of scanning one barcode in a receiving session (brief §5 verification statuses). */
export const SCAN_RESULTS = [
  "RECEIVED",
  "UNEXPECTED", // scanned but not in the expected purchase
  "DUPLICATE_SCAN", // already scanned in this or a previous session
  "WRONG_BUYER", // belongs to another buyer (no detail is ever revealed)
  "WRONG_PURCHASE", // exists for this buyer but on another purchase
  "INVALID_BARCODE", // malformed or failed the check character
  "EXCEPTION", // operator-flagged for investigation
] as const;
export type ScanResult = (typeof SCAN_RESULTS)[number];

export const SCAN_RESULT_LABEL: Record<ScanResult, string> = {
  RECEIVED: "Received",
  UNEXPECTED: "Unexpected",
  DUPLICATE_SCAN: "Duplicate scan",
  WRONG_BUYER: "Wrong buyer",
  WRONG_PURCHASE: "Wrong purchase",
  INVALID_BARCODE: "Invalid barcode",
  EXCEPTION: "Exception",
};

export const RECEIVING_SESSION_STATUSES = ["OPEN", "CONFIRMED", "CANCELLED"] as const;
export type ReceivingSessionStatus = (typeof RECEIVING_SESSION_STATUSES)[number];

/** Flow Disk import: staged (preview) until the buyer confirms; duplicates are rejected, never half-imported. */
export const FLOW_DISK_IMPORT_STATUSES = ["STAGED", "COMPLETED", "REJECTED_DUPLICATE", "FAILED", "CANCELLED"] as const;
export type FlowDiskImportStatus = (typeof FLOW_DISK_IMPORT_STATUSES)[number];

export const IMPORT_ISSUE_KINDS = [
  "INVALID_RECORD",
  "DUPLICATE_BARCODE",
  "MISSING_BARCODE",
  "INVALID_BARCODE_CHECK",
  "MISSING_GROWER",
  "MISSING_LOT",
  "INVALID_MASS",
  "INVALID_VALUE",
  "VALUE_MISMATCH", // value != mass × USc/kg ÷ 100
  "EXISTING_BALE", // barcode already registered (this or another purchase)
] as const;
export type ImportIssueKind = (typeof IMPORT_ISSUE_KINDS)[number];

export const DISPATCH_STATUSES = ["DISPATCHED", "PARTIALLY_RETURNED", "RETURNED", "CLOSED"] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export const RETURN_STATUSES = ["OPEN", "CONFIRMED", "CANCELLED"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** What happened to one bale in a processing return (brief §8 return scenarios). */
export const RETURN_OUTCOMES = ["RETURNED", "DAMAGED", "REGRADED", "REIDENTIFIED", "UNEXPECTED", "MISSING"] as const;
export type ReturnOutcome = (typeof RETURN_OUTCOMES)[number];

export const WAREHOUSE_KINDS = ["STANDARD", "PROCESSING"] as const;
export type WarehouseKind = (typeof WAREHOUSE_KINDS)[number];

export const MOVEMENT_TYPES = ["STORE", "MOVE", "TRANSFER", "DISPATCH_OUT", "RETURN_IN"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Immutable timeline events (brief §10). */
export const BALE_EVENT_TYPES = [
  "PURCHASED",
  "IMPORTED",
  "RECEIVED",
  "STORED",
  "MOVED",
  "DISPATCHED",
  "RETURNED",
  "RE_IDENTIFIED",
  "EXCEPTION_FLAGGED",
  "EXCEPTION_RESOLVED",
  "CORRECTION",
] as const;
export type BaleEventType = (typeof BALE_EVENT_TYPES)[number];

export const BUYER_ORG_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type BuyerOrgStatus = (typeof BUYER_ORG_STATUSES)[number];

export const ONE_TIME_TOKEN_KINDS = ["PASSWORD_RESET", "ACCOUNT_ACTIVATION"] as const;
export type OneTimeTokenKind = (typeof ONE_TIME_TOKEN_KINDS)[number];

/** The two kinds of authenticated principals. Tokens carry this so a buyer token can never be used as staff. */
export const PRINCIPAL_TYPES = ["STAFF", "BUYER"] as const;
export type PrincipalType = (typeof PRINCIPAL_TYPES)[number];

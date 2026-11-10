/** Status enums. States marked "(proposed)" come from the brief, not the manuals — see status-transitions.md. */

export const TRANSPORTER_NOTE_STATES = ["OPEN", "COMPLETED"] as const;
export type TransporterNoteState = (typeof TRANSPORTER_NOTE_STATES)[number];

/** Manual 03/04/05. The manuals' status bar also shows "Laying" (UQ-02) — not modelled. */
export const DELIVERY_NOTE_STATES = ["OPEN", "TICKETS_PRINTING", "CHECKED", "LAID"] as const;
export type DeliveryNoteState = (typeof DELIVERY_NOTE_STATES)[number];

export const DELIVERY_NOTE_STATE_LABEL: Record<DeliveryNoteState, string> = {
  OPEN: "Open",
  TICKETS_PRINTING: "Tickets Printing",
  CHECKED: "Checked",
  LAID: "Laid",
};

export const PRICE_BATCH_STATES = ["DRAFT", "POSTED"] as const;
export type PriceBatchState = (typeof PRICE_BATCH_STATES)[number];

/** Manual 06/07. The sale status bar also shows "Posted" (UQ-02) — not modelled. */
export const SALE_STATES = ["DRAFT", "BALANCED", "PROCESSED"] as const;
export type SaleState = (typeof SALE_STATES)[number];

export const START_OF_DAY_STATES = ["DRAFT", "POSTED"] as const;
export type StartOfDayState = (typeof START_OF_DAY_STATES)[number];

/** Brief proposal; manual 09 only shows a "State" column. */
export const DISPATCH_STATES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type DispatchState = (typeof DISPATCH_STATES)[number];

/** (proposed) */
export const IMPORT_STATUSES = [
  "UPLOADED",
  "VALIDATING",
  "PROCESSING",
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const IMPORT_TYPES = ["GROWER_REGISTER", "CREDITOR_REGISTER", "GROWER_BOOKING", "STOP_ORDER"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export const IMPORT_TYPE_LABEL: Record<ImportType, string> = {
  GROWER_REGISTER: "Grower register",
  CREDITOR_REGISTER: "Creditor register",
  GROWER_BOOKING: "Grower bookings",
  STOP_ORDER: "Stop orders",
};

/** (proposed) */
export const PAYMENT_SCHEDULE_STATUSES = ["DRAFT", "GENERATED", "SUBMITTED", "PARTIALLY_PAID", "PAID", "FAILED"] as const;
export type PaymentScheduleStatus = (typeof PAYMENT_SCHEDULE_STATUSES)[number];

export const PAYMENT_LINE_STATUSES = ["PENDING", "SUBMITTED", "PAID", "FAILED"] as const;
export type PaymentLineStatus = (typeof PAYMENT_LINE_STATUSES)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Deduction order — Manual 07 (documented). */
export const DEDUCTION_SOURCES = [
  "GROWER_CHARGE",
  "INTERNAL_INVOICE",
  "MERCHANT_LOAN",
  "TIMB_INVOICE",
  "TIMB_STOP_ORDER",
] as const;
export type DeductionSource = (typeof DEDUCTION_SOURCES)[number];

export const DEDUCTION_SOURCE_LABEL: Record<DeductionSource, string> = {
  GROWER_CHARGE: "Statutory & floor charges",
  INTERNAL_INVOICE: "Internal invoices",
  MERCHANT_LOAN: "Merchant loans",
  TIMB_INVOICE: "TIMB invoices",
  TIMB_STOP_ORDER: "TIMB stop orders",
};

/** Labels the Deductions Dashboard uses for "Deductions by Source" (Manual 07). */
export const DEDUCTION_DASHBOARD_SOURCE_LABEL: Record<DeductionSource, string> = {
  GROWER_CHARGE: "Internal USD invoices",
  INTERNAL_INVOICE: "Internal USD invoices",
  MERCHANT_LOAN: "Merchant loans",
  TIMB_INVOICE: "TIMB USD invoices",
  TIMB_STOP_ORDER: "TIMB USD Stop Orders",
};

export const SALE_STAGES = [
  "DAILY_SETUP",
  "BOOKING_IMPORT",
  "RECEIVING",
  "TICKET_PRINTING",
  "FLOOR_SUMMARY",
  "DATA_CAPTURE",
  "BATCH_PROCESSING",
  "BALANCING",
  "STOP_ORDERS",
  "PAYMENT",
  "DISPATCH",
] as const;
export type SaleStage = (typeof SALE_STAGES)[number];

export const SALE_STAGE_LABEL: Record<SaleStage, string> = {
  DAILY_SETUP: "Daily setup",
  BOOKING_IMPORT: "TIMB booking import",
  RECEIVING: "Receiving & bale capture",
  TICKET_PRINTING: "Ticket printing",
  FLOOR_SUMMARY: "Floor summary",
  DATA_CAPTURE: "Data capture",
  BATCH_PROCESSING: "Batch processing",
  BALANCING: "Sale balancing",
  STOP_ORDERS: "Stop orders & deductions",
  PAYMENT: "Grower payment",
  DISPATCH: "Floor dispatch",
};

export type StageStatus = "NOT_STARTED" | "ACTIVE" | "COMPLETE" | "BLOCKED" | "ATTENTION";

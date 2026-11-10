/**
 * System message catalogue.
 * `verbatim: true`  → text copied exactly from the e-Port manuals.
 * `verbatim: false` → the manual elides part of the text ("…") or gives only a description;
 *                     wording completed by us and flagged. `source: "APP"` = not in the manuals (our addition).
 * Placeholders: {name}.
 */
export type Severity = "success" | "info" | "warning" | "error";

export interface MessageDef {
  text: string;
  severity: Severity;
  /** Manual number ("01".."09") or "APP". */
  source: string;
  verbatim: boolean;
  meaning?: string;
  action?: string;
}

const m = (
  severity: Severity,
  source: string,
  text: string,
  verbatim = true,
  meaning?: string,
  action?: string,
): MessageDef => ({ severity, source, text, verbatim, meaning, action });

export const MESSAGES = {
  // ── 01 Daily setup ──────────────────────────────────────────────
  SOD_RATE_NOT_POSITIVE: m("error", "01", "Exchange Rate should be bigger than ZERO!", true, "Start of Day needs a positive exchange rate.", "Enter the day's rate."),
  SOD_PREVIOUS_UNFINISHED: m("error", "01", "You can not run Start of Day when there are Sales in Draft or Balanced state from Previous dates!", true, "Earlier sales are still Draft or Balanced.", "Finish balancing and processing the earlier sales first (Manuals 06 and 07)."),
  SOD_COMPLETED: m("success", "01", "Start of Day Completed Successfully.", true),
  SALE_DATE_MISSING: m("error", "01", "Please set a sale date", true, "No active receiving sale date.", "Create/activate the receiving sale date (Manual 01, Step 1)."),
  SALE_DATE_EXPIRED: m("error", "01", "Date has expired. Please set a valid sale date", true, "The active receiving sale date is in the past.", "Create/activate today's receiving sale date (Manual 01, Step 1)."),

  // ── 02 TIMB booking import / 07 stop order import ───────────────
  IMPORT_KEY_MISSING_BOOKING: m("error", "02", "Booking Decryption Keys for {prefix} is missing. Check filename of file", true, "The file was renamed, or belongs to another floor.", "Use the original file name, which starts with ELS."),
  BOOKING_IMPORT_COMPLETE: m("success", "02", "Grower Booking Import complete: {created} created, {updated} updated, {errors} errors.", true),
  IMPORT_COMPLETE_WITH_ERRORS: m("warning", "02", "Import complete with errors", true, "Some lines could not be read, for example an unknown grower.", "Import the grower register, then import the booking file again."),
  STOP_IMPORT_COMPLETE: m("success", "07", "Stop Order import complete — {created} created, {updated} updated, {errors} errors.", true),
  STOP_NO_VALID_RECORDS: m("error", "07", "Uploaded file does not contain any valid records", true, "Wrong or corrupted file.", "Ask TIMB to resend it. Don't edit the file."),
  IMPORT_KEY_MISSING_STOP: m("error", "07", "Decryption Keys for {prefix} need to be added", true, "The file was renamed.", "Use the original name, which starts with EL."),
  REGISTER_IMPORT_COMPLETE: m("success", "APP", "Import complete: {created} created, {updated} updated, {errors} errors.", false, "Register import result (the manuals do not give the register wording).", undefined),

  // ── 03 Receiving ────────────────────────────────────────────────
  DOCUMENT_CLOSED: m("success", "03", "Document successfully closed", true),
  BALE_ADDED: m("success", "03", "Bale added", true),
  DELIVERY_BALANCED: m("success", "03", "Delivery Balanced", true),
  DELIVERY_CLOSED: m("success", "03", "Delivery Document #{gdn} for grower {grower} is closed", true),
  NO_PENDING_DELIVERY: m("error", "03", "The grower number does not have any pending delivery note", true, "The grower isn't on a completed transporter note.", "Add the grower and complete the transporter note (Steps 2–3)."),
  GROWER_INVALID: m("error", "03", "Please check format and validity of grower number", true, "Not in the grower register.", "Check the number, or import the grower (Manual 02)."),
  BARCODE_CHECK: m("error", "03", "Please check barcode", true, "Scale barcode blank or too short.", "Rescan."),
  LOT_INVALID: m("error", "03", "Please enter a valid lot number", true, "Letters, or starts or ends with /.", "Use digits and / only."),
  BALE_IN_CLOSED_DOCUMENT: m("error", "03", "Bale is already associated with a Closed Document", true, "This scale barcode was captured on another delivery.", "Supervisor checks and ejects it if wrong."),
  TALLY_LESS: m("error", "03", "The number of bales captured is less than number of bales delivered", false, "Tally doesn't match the declared bales.", "Capture the missing bale, or supervisor ejects the extra one."),
  TALLY_GREATER: m("error", "03", "The number of bales captured is greater than number of bales delivered", false, "Tally doesn't match the declared bales.", "Capture the missing bale, or supervisor ejects the extra one."),
  GROUP_LOT_REPEATED: m("error", "03", "Repeated Group & Lot Number Combination in line {line}", true, "Two bales have the same group and lot.", "Supervisor ejects one, and you recapture it."),
  GROUP_INVALID: m("error", "03", "Group number must be a whole number of 1 or more", false, "Group must be 1 or more.", "Correct the group number."),
  SCALE_READING_MISSING: m("error", "APP", "No scale reading found for barcode {barcode}. Weigh the bale first.", false, "Our addition: mass comes from the scale; no reading exists for this barcode.", "Weigh the bale, then scan again."),
  BALE_ALREADY_CAPTURED: m("error", "APP", "Scale barcode {barcode} is already captured on this open delivery", false, "Our addition: duplicate scale barcode on the same delivery.", "Check the barcode."),
  BALE_EJECTED: m("success", "03", "Bale ejected", false),
  BOOKING_MISMATCH: m("warning", "APP", "Grower {grower} declared {declared} bales but booked {booked} (unbooked: {unbooked}).", false, "Our addition (UQ-09): the manuals say receiving checks bales against bookings but not whether it blocks.", "Supervisor reviews."),

  // ── 04 Ticket printing ─────────────────────────────────────────
  BARCODES_ALREADY_USED: m("error", "04", "Barcodes already used in Tickets", true, "Your start barcode overlaps tickets already printed this season.", "Set Starting Barcode (Step 2) with the first unused barcode on your roll."),
  BARCODE_INVALID_TICKET: m("error", "04", "Please enter a valid barcode", true, "Start barcode not 10 characters, or wrong check character.", "Type the full barcode exactly as printed on the ticket."),
  NO_PREVIOUS_BARCODE: m("error", "04", "There is no previously set barcode", true, "You have never set a start barcode.", "Use Set Starting Barcode (Step 2)."),
  BALE_NO_BARCODE: m("error", "04", "Bale has no barcode in line {line}", true, "Barcodes weren't allocated before confirming.", "Use Next Barcode (Step 3), then confirm again."),
  TICKETS_ALLOCATED: m("success", "APP", "{count} barcodes allocated ({first} – {last})", false),
  TICKETS_CONFIRMED: m("success", "APP", "Ticket printing confirmed — delivery {gdn} is now Checked", false),
  PRINTING_REVERSED: m("warning", "APP", "Printing status reversed for {gdn} — back to Tickets Printing", false),

  // ── 05 Floor summary ───────────────────────────────────────────
  FLOOR_SCANNING_OFF: m("error", "05", "Floor Summary scanning is currently off. Ask the receiving manager to turn it on.", false, "The manager turned scanning off.", "Ask the receiving manager to turn it on."),
  FLOOR_ADD_SALE_DATE: m("error", "05", "Please Add a Current Sale Date,.", true, "No active sale date for today.", "Manual 01, Step 1."),
  FLOOR_ROW_REQUIRED: m("error", "05", "Please enter a Row Number", false, "Row blank.", "Type the row number."),
  FLOOR_ROW_INTEGER: m("error", "05", "Please enter an integer for Row Number", false, "Row not a number.", "Type the row number."),
  FLOOR_BALE_NOT_FOUND: m("error", "05", "Cannot find the bale: {barcode}", false, "The barcode isn't a printed ticket.", "Rescan. Check you scanned the ticket, not the scale label."),
  FLOOR_NOT_ON_FLOOR: m("error", "05", "This bale is not supposed to be on the floor. Please check with supervisor", true, "The delivery isn't Checked (tickets not confirmed).", "Ticket clerk confirms printing (Manual 04)."),
  FLOOR_OTHER_SELLING_POINT: m("error", "05", "This delivery is for {sellingPoint}", false, "The bale belongs to another selling point.", "Move the bale."),
  FLOOR_DUPLICATE_SCAN: m("warning", "APP", "Ticket {barcode} was already scanned (row {row})", false, "Our addition (brief: duplicate detection); the manual lists no duplicate-scan message.", "Do not scan it again."),
  FLOOR_SCANNED_PROGRESS: m("info", "05", "Scanned {scanned} of {total}", true),
  FLOOR_SUMMARY_COMPLETE: m("success", "APP", "Floor summary complete for {grower} — delivery {gdn} is Laid, draft sale created", false),

  // ── 06 Data capture and balancing ──────────────────────────────
  INVALID_BUYER: m("error", "06", "Invalid Buyer: {value}", true, "Unknown buyer.", "Check the code on the buyer's ticket."),
  INVALID_BUYER_GRADE: m("error", "06", "Invalid Buyer Grade: {value}", true, "The grade doesn't belong to that buyer.", "Check the code on the buyer's ticket."),
  INVALID_TIMB_GRADE: m("error", "06", "Invalid TIMB Grade / Reason: {value}", true, "Unknown grade.", "Check the grade code."),
  BARCODE_ALREADY_PROCESSED: m("error", "06", "Barcode already processed for Sales Sheet: {sale}", true, "The sale is already balanced or processed.", "Supervisor corrects it with a sale reversal or adjustment."),
  CAPTURE_STATE_NOT_ALLOWED: m("error", "06", "The state of this barcode does not allow Data Capturing: {barcode}", true, "No draft sale for this bale (floor summary incomplete).", "Finish the floor summary (Manual 05)."),
  BALANCE_PRICE_MISMATCH: m("error", "06", "Balancing stops on a price mismatch: ticket {barcode} captured {captured}, batch {batch}", false, "Captured price and batch price differ.", "Check the batch sheet and correct the wrong one."),
  INVALID_REASON_REJECTED: m("error", "06", "invalid Reason specified for this rejected bale!", true, "Sale code without a valid reason.", "Enter a TIMB reason."),
  SALE_BALANCED: m("success", "06", "Sale has balanced!", true),
  BATCH_POSTED: m("success", "06", "Batch has been posted.", true),
  BATCH_PRICES_INCOMPLETE: m("error", "APP", "Enter a batch price for every purchased ticket before posting ({missing} missing).", false, "Our addition: the manual does not say whether posting is blocked with missing prices.", undefined),
  BALE_SAVED: m("success", "06", "Details saved", false),
  SALE_MISSING_FIELD: m("error", "06", "Ticket {barcode} is missing {field}", false, "Every bale needs a buyer, a buyer grade, a TIMB grade and a price.", "Capture the missing detail."),

  // ── 07 Stop orders and deductions ──────────────────────────────
  NO_EXCHANGE_RATE: m("error", "07", "Exchange rate is not set for this sale. Post Start of Day for the sale date.", false, "No posted Start of Day for that sale date.", "Post Start of Day (Manual 01)."),
  PENDING_APPROVALS: m("error", "07", "There are :: {count} :: Pending Approvals. Approve them first.", false, "Sales still await approval.", "Approve them first."),
  STOP_NOT_DEDUCTED: m("warning", "07", "Stop order not deducted", true, "The file-name date doesn't match the sale date.", "Import the file for the correct day, then process again."),
  STOP_PROCESSING_COMPLETE: m("success", "APP", "Stop Order Processing complete: {sales} sales processed, pay batch {batch}.", false),
  NO_BALANCED_SALES: m("info", "APP", "There are no Balanced sales to process for this selling point.", false),

  // ── 08 Grower payment ──────────────────────────────────────────
  PAY_NO_SALE_DATE: m("error", "08", "Cannot Find the Sale Date in Receiving Department", true, undefined, "Use a date that has a receiving sale date."),
  PAY_NO_SOD: m("error", "08", "Cannot Find the Start of Date in Data Processing", true, undefined, "Post Start of Day for that date."),
  PAY_NO_UNPAID: m("error", "08", "No unpaid records found for this date and selling point", true, undefined, "Check the batch number and that the sales are processed."),
  PAY_CLOUDPAY_MOCK: m("warning", "APP", "CloudPay is a mock in this demo — nothing was sent to any bank. Growers stay unpaid until a payment confirmation is recorded.", false),
  PAY_CSV_NOT_PAID: m("info", "08", "Downloading the CSV doesn't mark growers as paid.", true),

  // ── 09 Floor dispatch ──────────────────────────────────────────
  DISPATCH_NOT_RELEASED: m("error", "09", "Bale '{barcode}' cannot be dispatched: its sale has not been released yet.", false, "Dispatch refuses bales from unreleased sales.", "Release the sale first."),
  DISPATCH_WRONG_WAREHOUSE: m("error", "09", "Bale '{barcode}' cannot be dispatched: wrong warehouse — its buyer packs at {warehouse}.", false, "The bale belongs on a truck to its buyer's warehouse.", undefined),
  DISPATCH_REJECTED_CODE: m("error", "09", "Bale '{barcode}' cannot be dispatched: it has a rejected sale code ({code}).", false, "RO, RH and CO are rejected sale codes.", undefined),
  DISPATCH_ALREADY_ON_NOTE: m("error", "09", "Bale '{barcode}' is already on dispatch note {ref}.", false, "A bale cannot be dispatched twice.", undefined),
  DISPATCH_REMOVE_ONLY_DRAFT: m("error", "09", "You can only remove bales from a draft dispatch note.", true, undefined, "Reset the note to draft (supervisor)."),
  DISPATCH_CANNOT_DELETE: m("error", "09", "You cannot delete dispatch notes. Please cancel them instead.", true, undefined, "Use Cancel Dispatch."),
  DISPATCH_POST_FIRST: m("error", "09", "The dispatch note must be in Posted state to generate a shipment file.", true, undefined, "Post the note first."),
  DISPATCH_NOT_FOUND_BALE: m("error", "APP", "Cannot find the bale: {barcode}", false),

  // ── App-level ──────────────────────────────────────────────────
  PERMISSION_DENIED: m("error", "APP", "You don't have permission to do that ({permission}). Backend enforcement arrives in Phase 2; here the action is simply blocked.", false),
  SIMULATED_NOTICE: m("info", "APP", "Simulated — this demo runs on local mock data. The backend will be authoritative.", false),
} as const satisfies Record<string, MessageDef>;

export type MessageKey = keyof typeof MESSAGES;

export function formatMessage(key: MessageKey, params: Record<string, string | number> = {}): string {
  return MESSAGES[key].text.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`,
  );
}

export class AppError extends Error {
  readonly key: MessageKey | "CUSTOM";
  readonly severity: Severity;
  readonly field?: string;
  constructor(key: MessageKey, params: Record<string, string | number> = {}, field?: string) {
    super(formatMessage(key, params));
    this.name = "AppError";
    this.key = key;
    this.severity = MESSAGES[key].severity;
    this.field = field;
  }
}

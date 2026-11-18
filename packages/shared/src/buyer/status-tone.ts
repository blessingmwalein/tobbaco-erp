/**
 * One mapping from a status code to a tone, shared by the web badges and the PDF/Excel exports so a status looks the
 * same everywhere (green = done/healthy, amber = in progress/needs attention soon, red = problem, blue = informational).
 */
export type StatusTone = "success" | "warning" | "danger" | "primary" | "neutral";

const SUCCESS = new Set([
  "RECEIVED", "ALLOCATED", "CONFIRMED", "COMPLETE", "COMPLETED", "CLOSED", "IN_STOCK", "ACTIVE", "RESOLVED", "VALID",
  "RETURNED", "CONFIRMED_IMPORT", "OK", "MATCHED", "COMPLETED_IMPORT",
]);
const WARNING = new Set([
  "IN_TRANSIT", "ARRIVED", "RECEIVING", "RECONCILIATION_REQUIRED", "STORAGE_IN_PROGRESS", "OPEN", "IN_PROGRESS",
  "PARTIAL", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED", "AWAITING_SHIPMENTS", "AWAITING_RECEIPT", "OUTSTANDING",
  "STAGED", "PARSED", "EXPECTED", "DISPATCHED", "NOT_STARTED", "PENDING",
]);
const DANGER = new Set([
  "MISSING", "UNEXPECTED", "CANCELLED", "INVALID", "INVALID_BARCODE", "WRONG_BUYER", "WRONG_PURCHASE", "DUPLICATE_SCAN",
  "EXCEPTION", "REJECTED", "FAILED", "INACTIVE", "SUPERSEDED", "VARIANCE",
]);

export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  const key = status.toUpperCase();
  if (SUCCESS.has(key)) return "success";
  if (WARNING.has(key)) return "warning";
  if (DANGER.has(key)) return "danger";
  return "neutral";
}

/** "IN_TRANSIT" → "In transit". */
export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const words = status.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

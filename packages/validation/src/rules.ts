import { formatMessage, type MessageKey } from "@tobacco/shared";

/** Pure business-rule validators. No I/O, no React. Messages come from the verbatim catalogue. */

export interface RuleResult {
  ok: boolean;
  key?: MessageKey;
  message?: string;
}

const ok = (): RuleResult => ({ ok: true });
const fail = (key: MessageKey, params: Record<string, string | number> = {}): RuleResult => ({
  ok: false,
  key,
  message: formatMessage(key, params),
});

/** Manual 03: "Lot #: Digits and / only, for example 3 or 12/3"; invalid when letters, or starts/ends with "/". */
export function validateLot(lot: string): RuleResult {
  const t = lot.trim();
  if (t.length === 0) return fail("LOT_INVALID");
  if (!/^\d+(\/\d+)*$/.test(t)) return fail("LOT_INVALID");
  return ok();
}

/** Manual 03: "Group #: A whole number, 1 or more". */
export function validateGroup(group: number | string): RuleResult {
  const n = typeof group === "string" ? Number(group.trim()) : group;
  if (!Number.isInteger(n) || n < 1) return fail("GROUP_INVALID");
  return ok();
}

/** Manual 03: no group + lot pair may repeat. Returns the 1-based line of the first repeat, or null. */
export function findRepeatedGroupLot(items: Array<{ group: number; lot: string }>): number | null {
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const key = `${item.group}|${item.lot.trim()}`;
    if (seen.has(key)) return i + 1;
    seen.add(key);
  }
  return null;
}

/** Manual 06: price is US cents per kg, whole number. */
export function validatePriceCents(value: number | string): RuleResult & { value?: number } {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, key: "SALE_MISSING_FIELD", message: "Price must be a whole number of US cents per kg (greater than 0)." };
  }
  return { ok: true, value: n };
}

/** Manual 06: "Codes are converted to capitals automatically." */
export function upperCode(input: string | undefined | null): string {
  return (input ?? "").trim().toUpperCase();
}

/** Manual 03: "Vehicle Reg: Number plate (spaces are removed automatically)". */
export function normaliseVehicleReg(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** Manual 01: Start of Day requires a positive exchange rate. */
export function validateExchangeRate(rate: string | number): RuleResult {
  const n = typeof rate === "string" ? Number(rate.trim()) : rate;
  if (!Number.isFinite(n) || n <= 0) return fail("SOD_RATE_NOT_POSITIVE");
  return ok();
}

/** Manual 01: Start of Day refuses while earlier sales are still Draft or Balanced. */
export function validateStartOfDayPrerequisites(input: {
  selectedDate: string;
  sales: Array<{ saleDate: string; status: "DRAFT" | "BALANCED" | "PROCESSED" }>;
}): RuleResult {
  const blocking = input.sales.some(
    (s) => s.saleDate < input.selectedDate && (s.status === "DRAFT" || s.status === "BALANCED"),
  );
  return blocking ? fail("SOD_PREVIOUS_UNFINISHED") : ok();
}

/** Manual 02/07: file-name prefix selects the decryption key (ELS… bookings, EL… stop orders). */
export function validateImportFilename(
  type: "GROWER_REGISTER" | "CREDITOR_REGISTER" | "GROWER_BOOKING" | "STOP_ORDER",
  filename: string,
): RuleResult & { prefix?: string } {
  if (type === "GROWER_BOOKING") {
    const prefix = filename.slice(0, 3);
    return prefix === "ELS" ? { ok: true, prefix } : { ...fail("IMPORT_KEY_MISSING_BOOKING", { prefix: prefix || "?" }), prefix };
  }
  if (type === "STOP_ORDER") {
    const prefix = filename.slice(0, 2);
    return prefix === "EL" ? { ok: true, prefix } : { ...fail("IMPORT_KEY_MISSING_STOP", { prefix: prefix || "?" }), prefix };
  }
  // Register file prefixes are not documented (UQ-13): accept any name in the dev adapter.
  return { ok: true };
}

/** "…YYYYMMDD…" in a stop-order file name links stop orders to that day's sales (Manual 07). */
export function dateFromStopOrderFilename(filename: string): string | null {
  const m = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Barcode helpers.
 *
 * Ticket barcode (Manual 04): 10 characters = 9 digits + 1 check character. Each next ticket is base+1 with its own
 * check character, so a "range" like 1000001013 – 1000001035 covers 3 tickets (1013, 1024, 1035), NOT 23.
 *
 * The check-character ALGORITHM IS NOT DOCUMENTED (UQ-01). `digit-sum mod 10` fits all five documented tickets
 * (100000101→3, …102→4, …103→5, …104→6, …105→7) but is UNVERIFIED. It sits behind `BarcodeCheckAlgorithm`
 * so the real algorithm can be dropped in without touching callers.
 */
export interface BarcodeCheckAlgorithm {
  id: string;
  verified: boolean;
  compute(base9: string): string;
}

export const DIGIT_SUM_MOD10: BarcodeCheckAlgorithm = {
  id: "digit-sum-mod-10 (UNVERIFIED — UQ-01)",
  verified: false,
  compute(base9: string): string {
    let sum = 0;
    for (const ch of base9) sum += Number(ch);
    return String(sum % 10);
  },
};

let activeAlgorithm: BarcodeCheckAlgorithm = DIGIT_SUM_MOD10;

export function setBarcodeCheckAlgorithm(a: BarcodeCheckAlgorithm): void {
  activeAlgorithm = a;
}
export function getBarcodeCheckAlgorithm(): BarcodeCheckAlgorithm {
  return activeAlgorithm;
}

export const TICKET_BARCODE_LENGTH = 10;

export function buildTicketBarcode(base: number): string {
  const base9 = String(base).padStart(9, "0");
  return base9 + activeAlgorithm.compute(base9);
}

export type TicketBarcodeCheck =
  | { valid: true; base: number; barcode: string }
  | { valid: false; reason: "LENGTH" | "NOT_DIGITS" | "CHECK_CHARACTER" };

export function checkTicketBarcode(input: string): TicketBarcodeCheck {
  const s = input.trim();
  if (s.length !== TICKET_BARCODE_LENGTH) return { valid: false, reason: "LENGTH" };
  if (!/^\d{10}$/.test(s)) return { valid: false, reason: "NOT_DIGITS" };
  const base9 = s.slice(0, 9);
  if (activeAlgorithm.compute(base9) !== s.slice(9)) return { valid: false, reason: "CHECK_CHARACTER" };
  return { valid: true, base: Number(base9), barcode: s };
}

export function isValidTicketBarcode(input: string): boolean {
  return checkTicketBarcode(input).valid;
}

/** The barcode that follows `barcode` on a roll: base+1 with a fresh check character. */
export function nextTicketBarcode(barcode: string): string {
  const c = checkTicketBarcode(barcode);
  if (!c.valid) throw new Error("Invalid ticket barcode");
  return buildTicketBarcode(c.base + 1);
}

/** Scale barcode (Manual 03): "blank or too short" is rejected. Minimum length unverified; sample = 10 digits. */
export const SCALE_BARCODE_MIN_LENGTH = 10;
export function isValidScaleBarcode(input: string): boolean {
  const s = input.trim();
  return /^\d+$/.test(s) && s.length >= SCALE_BARCODE_MIN_LENGTH;
}

/** Grower numbers look like V100060 or V100088A (suffix letter seen in the booking list). */
export const GROWER_NO_PATTERN = /^V\d{6}[A-Z]?$/;
export function normaliseGrowerNo(input: string): string {
  const t = input.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d{6}[A-Z]?$/.test(t)) return `V${t}`; // receiving form shows the fixed "V" prefix and takes the digits
  return t;
}
export function isValidGrowerNo(input: string): boolean {
  return GROWER_NO_PATTERN.test(normaliseGrowerNo(input));
}

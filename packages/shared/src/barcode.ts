/**
 * Barcode helpers.
 *
 * Bale / ticket barcode: 10 characters = 9 digits + 1 CHECK CHARACTER.
 * The check character is the **Code 39 modulo-43** character: sum the Code 39 values of the 9 digits and take the
 * Code 39 character at (sum mod 43). The character set is `0-9 A-Z - . space $ / + %`, so the check character can be a
 * letter, a symbol (`+ $ . /`) or a SPACE.
 *
 * Evidence (UQ-01, resolved): this matches **43 of 43** barcodes on the real MOROZ buyer invoice (22 May 2026) and all
 * five documented floor tickets (1000001013 … 1000001057). The previous guess (digit-sum mod 10) matched only 4 of 43.
 *
 * Because the check character can be a space, barcodes must NEVER be blindly trimmed. `checkBaleBarcode` accepts a
 * 9-character value whose check character should be a blank (a trailing space lost in transit) and reports it as
 * `inferredBlank`.
 *
 * Each next ticket on a roll is base + 1 with its own check character, so a "range" such as 1000001013 – 1000001035
 * covers 3 tickets (1000001013, 1000001024, 1000001035), not 23.
 */
export interface BarcodeCheckAlgorithm {
  id: string;
  verified: boolean;
  compute(base9: string): string;
}

/** Code 39 character set in value order: index = value. */
export const CODE39_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";

export const CODE39_MOD43: BarcodeCheckAlgorithm = {
  id: "code39-mod43 (verified: 43/43 invoice barcodes)",
  verified: true,
  compute(base9: string): string {
    let sum = 0;
    for (const ch of base9) {
      const v = CODE39_CHARSET.indexOf(ch);
      if (v < 0) throw new Error(`Character "${ch}" is not in the Code 39 set`);
      sum += v;
    }
    return CODE39_CHARSET[sum % 43]!;
  },
};

let activeAlgorithm: BarcodeCheckAlgorithm = CODE39_MOD43;

export function setBarcodeCheckAlgorithm(a: BarcodeCheckAlgorithm): void {
  activeAlgorithm = a;
}
export function getBarcodeCheckAlgorithm(): BarcodeCheckAlgorithm {
  return activeAlgorithm;
}

export const TICKET_BARCODE_LENGTH = 10;
export const BARCODE_BASE_LENGTH = 9;

export function buildTicketBarcode(base: number): string {
  const base9 = String(base).padStart(BARCODE_BASE_LENGTH, "0");
  return base9 + activeAlgorithm.compute(base9);
}

export type BarcodeFailure = "LENGTH" | "NOT_DIGITS" | "CHECK_CHARACTER";

export type BarcodeCheck =
  | {
      valid: true;
      base: number;
      /** Normalised 10-character barcode (check character preserved, including a blank). */
      barcode: string;
      checkChar: string;
      /** True when the input had only 9 characters and the correct check character is a blank. */
      inferredBlank: boolean;
    }
  | { valid: false; reason: BarcodeFailure };

/**
 * Validate a raw barcode WITHOUT trimming. Only line endings are removed (a trailing space is meaningful).
 * Use `checkTicketBarcode` for human-typed input (which trims surrounding whitespace first).
 */
export function checkBaleBarcode(raw: string): BarcodeCheck {
  const s = raw.replace(/[\r\n]+/g, "");
  if (s.length !== TICKET_BARCODE_LENGTH && s.length !== BARCODE_BASE_LENGTH) return { valid: false, reason: "LENGTH" };
  const base9 = s.slice(0, BARCODE_BASE_LENGTH);
  if (!/^\d{9}$/.test(base9)) return { valid: false, reason: "NOT_DIGITS" };
  const expected = activeAlgorithm.compute(base9);
  const inferredBlank = s.length === BARCODE_BASE_LENGTH;
  const actual = inferredBlank ? " " : s.charAt(9);
  if (actual !== expected) return { valid: false, reason: "CHECK_CHARACTER" };
  return { valid: true, base: Number(base9), barcode: base9 + actual, checkChar: actual, inferredBlank };
}

export type TicketBarcodeCheck =
  | { valid: true; base: number; barcode: string }
  | { valid: false; reason: BarcodeFailure };

/** Human-typed / scanned ticket barcode: surrounding whitespace is ignored, then the Code 39 mod-43 check applies. */
export function checkTicketBarcode(input: string): TicketBarcodeCheck {
  const r = checkBaleBarcode(input.trim());
  return r.valid ? { valid: true, base: r.base, barcode: r.barcode } : r;
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

/** Floor grower numbers look like V100060 or V100088A (suffix letter seen in the booking list). */
export const GROWER_NO_PATTERN = /^V\d{6}[A-Z]?$/;
export function normaliseGrowerNo(input: string): string {
  const t = input.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d{6}[A-Z]?$/.test(t)) return `V${t}`; // receiving form shows the fixed "V" prefix and takes the digits
  return t;
}
export function isValidGrowerNo(input: string): boolean {
  return GROWER_NO_PATTERN.test(normaliseGrowerNo(input));
}

import Decimal from "decimal.js";

/**
 * Money helpers. USD amounts are integer cents; exchange rates and local-currency values are decimal strings.
 * Never use JS floating point for money (brief Part 14). Rounding mode is NOT documented (UQ-05) — half-up is a placeholder.
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/** Price is US cents per kg (whole number), mass in kg → value in whole cents. */
export function ticketValueCents(priceCentsPerKg: number, massKg: number): number {
  return new Decimal(priceCentsPerKg).mul(massKg).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function sumCents(values: Array<number | undefined | null>): number {
  return values.reduce<number>((a, v) => a + (v ?? 0), 0);
}

export function formatUsd(cents: number | undefined | null, opts: { sign?: boolean } = {}): string {
  const value = (cents ?? 0) / 100;
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (value < 0) return `-${s}`;
  return opts.sign && value > 0 ? `+${s}` : s;
}

/** Plain decimal text for CSV files. */
export function centsToDecimalString(cents: number): string {
  return new Decimal(cents).div(100).toFixed(2);
}

export function parseDecimal(input: string): Decimal | null {
  const t = input.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return new Decimal(t);
}

/** USD cents × rate (local units per USD) → local amount, 2 dp, as a string. */
export function convertCentsToLocal(cents: number, rate: string): string {
  return new Decimal(cents).div(100).mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function formatLocal(amount: string, currency: string): string {
  const [int, frac = "00"] = amount.split(".");
  const withCommas = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${withCommas}.${frac}`;
}

export function formatRate(rate: string): string {
  return new Decimal(rate).toFixed(4);
}

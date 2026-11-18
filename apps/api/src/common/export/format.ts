import type { ReportColumnFormat } from "@tobacco/shared";

// The display helpers are shared with the web app (one implementation for screen and file).
export { DOC_TIME_ZONE, formatCell, formatDecimal, formatDocDate, formatDocDateTime, harareParts } from "@tobacco/shared";
import { formatDecimal } from "@tobacco/shared";

/** Default relative widths (PDF / Excel) by format. */
export const DEFAULT_WEIGHT: Record<ReportColumnFormat, number> = {
  text: 1.7,
  mono: 1.3,
  status: 1.2,
  date: 1,
  datetime: 1.35,
  int: 0.75,
  mass: 0.95,
  money: 1.05,
  percent: 0.75,
};

export const defaultAlign = (format: ReportColumnFormat): "left" | "right" | "center" =>
  format === "int" || format === "mass" || format === "money" || format === "percent" ? "right" : "left";

/** Excel number formats by column format. */
export const XLSX_NUMFMT = {
  int: "#,##0",
  mass: "#,##0.0",
  money: "#,##0.00",
  percent: '0.0"%"',
  date: "dd mmm yyyy",
  datetime: "dd mmm yyyy hh:mm",
} as const;

/** "NN rows" style counters etc. */
export const plural = (n: number, one: string, many = `${one}s`) => `${formatDecimal(n, 0)} ${n === 1 ? one : many}`;

/** Safe file-name stem: letters, digits, dash/underscore. */
export function fileStem(...parts: Array<string | undefined | null>): string {
  return parts
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Display formatting for report values. ONE implementation shared by the web tables and the PDF / Excel / CSV exports,
 * so a number or date reads the same on screen and in the file. Money and weights are decimal STRINGS — never floats.
 * The business runs in Africa/Harare (UTC+2, no daylight saving): instants are always shown in that zone.
 */
import { humanizeStatus } from "./status-tone";
import type { ReportCell, ReportColumnDto } from "./dto/reports";

/** The business runs in Africa/Harare (UTC+2, no daylight saving): every date/time in a document is shown in that zone. */
export const DOC_TIME_ZONE = "Africa/Harare";
const UTC_PLUS = 2 * 3_600_000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Format a decimal STRING (or number) with fixed decimals and thousands separators — no float rounding on strings. */
export function formatDecimal(raw: string | number, scale: number, group = true): string {
  const text = typeof raw === "number" ? raw.toFixed(scale) : raw.trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return text;
  const sign = m[1] ?? "";
  let int = m[2] ?? "0";
  let frac = m[3] ?? "";
  if (frac.length > scale) {
    // round half up on the digit after the kept ones, using BigInt so large values stay exact
    const scaled = BigInt(int + frac.slice(0, scale)) + (frac.charCodeAt(scale) >= 53 ? 1n : 0n);
    const digits = scaled.toString().padStart(scale + 1, "0");
    int = digits.slice(0, digits.length - scale);
    frac = scale ? digits.slice(digits.length - scale) : "";
  } else {
    frac = frac.padEnd(scale, "0");
  }
  const body = group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : int;
  const negative = sign === "-" && /[1-9]/.test(int + frac);
  return `${negative ? "-" : ""}${body}${scale ? `.${frac}` : ""}`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: DOC_TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
const dateOnlyFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: DOC_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });

/** "17 Nov 2026". A bare "yyyy-mm-dd" is a calendar date (no zone shift); an instant is shown in Harare time. */
export function formatDocDate(value: string | Date): string {
  if (typeof value === "string" && DATE_ONLY.test(value)) return dateOnlyFmt.format(new Date(`${value}T00:00:00Z`));
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : dateFmt.format(d);
}

/** "17 Nov 2026 14:05" in Harare time. */
export function formatDocDateTime(value: string | Date): string {
  if (typeof value === "string" && DATE_ONLY.test(value)) return formatDocDate(value);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : `${dateFmt.format(d)} ${timeFmt.format(d)}`;
}

/** Harare wall-clock parts of an instant: yyyy-mm-dd and HH:mm. */
export function harareParts(value: Date): { day: string; time: string } {
  const shifted = new Date(value.getTime() + UTC_PLUS);
  return { day: shifted.toISOString().slice(0, 10), time: shifted.toISOString().slice(11, 16) };
}

const isBlank = (v: ReportCell | undefined): v is null | undefined => v === null || v === undefined || v === "";

/** Display text for a cell (PDF and anywhere a human reads it). */
export function formatCell(value: ReportCell | undefined, col: Pick<ReportColumnDto, "format">): string {
  if (isBlank(value)) return "—";
  const v = value;
  switch (col.format) {
    case "int":
      return typeof v === "number" ? formatDecimal(Math.round(v), 0) : formatDecimal(String(v), 0);
    case "mass":
      return formatDecimal(typeof v === "boolean" ? String(v) : v, 1);
    case "money":
      return formatDecimal(typeof v === "boolean" ? String(v) : v, 2);
    case "percent":
      return `${formatDecimal(typeof v === "boolean" ? String(v) : v, 1)}%`;
    case "date":
      return formatDocDate(String(v));
    case "datetime":
      return formatDocDateTime(String(v));
    case "status":
      return humanizeStatus(String(v));
    case "mono":
    case "text":
    default:
      return typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
  }
}


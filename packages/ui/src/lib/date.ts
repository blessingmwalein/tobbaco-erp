import { format, isValid, parse } from "date-fns";

/**
 * Calendar-date helpers for the date pickers.
 *
 * A picked date is a CALENDAR DATE, not an instant: it travels as a "yyyy-mm-dd" string. Converting through
 * `toISOString()` would shift it by a day (Zimbabwe is UTC+2: local midnight is 22:00 the previous day in UTC),
 * so every conversion here uses the LOCAL calendar fields.
 */
export type IsoDate = string;

export interface IsoDateRange {
  from?: IsoDate;
  to?: IsoDate;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date -> "yyyy-mm-dd". */
export function toIsoDate(date: Date): IsoDate {
  return format(date, "yyyy-MM-dd");
}

/** "yyyy-mm-dd" -> local midnight; anything else (or an impossible date like 2026-02-31) -> undefined. */
export function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!value || !ISO.test(value)) return undefined;
  const date = parse(value, "yyyy-MM-dd", new Date());
  return isValid(date) ? date : undefined;
}

/** "17 Nov 2026" (en-GB style). Empty string for an invalid value. */
export function formatPickerDate(value: string | null | undefined): string {
  const date = parseIsoDate(value);
  return date ? format(date, "d MMM yyyy") : "";
}

/** Human summary of a range for the trigger button. */
export function formatPickerRange(range: IsoDateRange, empty = "Any date"): string {
  const from = formatPickerDate(range.from);
  const to = formatPickerDate(range.to);
  if (from && to) return from === to ? from : `${from} – ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return empty;
}

/**
 * Click logic for choosing a range in two clicks: the first click starts a range, the second completes it
 * (clicking an earlier day swaps the ends); clicking again after a complete range starts over.
 */
export function nextRange(current: IsoDateRange, clicked: IsoDate): IsoDateRange {
  const { from, to } = current;
  if (!from || to) return { from: clicked };
  return clicked < from ? { from: clicked, to: from } : { from, to: clicked };
}

export interface RangePreset {
  id: string;
  label: string;
  range: (today: Date) => { from: Date; to: Date };
}

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const DEFAULT_RANGE_PRESETS: RangePreset[] = [
  { id: "today", label: "Today", range: (t) => ({ from: t, to: t }) },
  { id: "yesterday", label: "Yesterday", range: (t) => ({ from: addDays(t, -1), to: addDays(t, -1) }) },
  { id: "last-7", label: "Last 7 days", range: (t) => ({ from: addDays(t, -6), to: t }) },
  { id: "last-30", label: "Last 30 days", range: (t) => ({ from: addDays(t, -29), to: t }) },
  { id: "this-month", label: "This month", range: (t) => ({ from: startOfMonth(t), to: t }) },
  {
    id: "last-month",
    label: "Last month",
    range: (t) => {
      const first = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      return { from: first, to: new Date(t.getFullYear(), t.getMonth(), 0) };
    },
  },
  { id: "this-year", label: "This year", range: (t) => ({ from: new Date(t.getFullYear(), 0, 1), to: t }) },
];

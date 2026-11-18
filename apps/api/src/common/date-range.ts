/**
 * Date filters, one consistent meaning everywhere.
 *
 * The UI sends CALENDAR DATES ("yyyy-mm-dd"). The business runs in Africa/Harare (UTC+2, no daylight saving), so
 * "17 Nov" means 17 Nov 00:00 → 18 Nov 00:00 in Harare, NOT in UTC. A scan at 01:30 Harare time on the 18th is
 * 23:30 UTC on the 17th and must count as the 18th. The "to" day is INCLUSIVE.
 *
 *  - `timestampRange`  — for timestamp columns (receivedAt, startedAt, performedAt …): `{ gte, lt }` instants.
 *  - `dateColumnRange` — for `@db.Date` columns (saleDate, dispatchDate …): `{ gte, lte }` at UTC midnight.
 */
export const BUSINESS_TIME_ZONE = "Africa/Harare";
const BUSINESS_UTC_OFFSET = "+02:00";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type DayInput = string | Date | null | undefined;

/** Normalise to "yyyy-mm-dd" (a Date coming from `z.coerce.date("2026-11-17")` is UTC midnight, so UTC fields are right). */
export function toIsoDay(input: DayInput): string | undefined {
  if (input === null || input === undefined || input === "") return undefined;
  const iso = input instanceof Date ? input.toISOString().slice(0, 10) : input;
  if (!ISO_DAY.test(iso)) throw new RangeError(`Expected a yyyy-mm-dd date, got "${String(input)}"`);
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`"${iso}" is not a real calendar date`);
  }
  return iso;
}

function nextIsoDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** The instant the business day starts (00:00 in Harare). */
export function businessDayStart(day: string): Date {
  return new Date(`${toIsoDay(day)}T00:00:00${BUSINESS_UTC_OFFSET}`);
}

/** The instant the business day ENDS (exclusive): 00:00 Harare the next day. */
export function businessDayEnd(day: string): Date {
  return new Date(`${nextIsoDay(toIsoDay(day)!)}T00:00:00${BUSINESS_UTC_OFFSET}`);
}

export function timestampRange(from?: DayInput, to?: DayInput): { gte?: Date; lt?: Date } | undefined {
  const f = toIsoDay(from);
  const t = toIsoDay(to);
  if (!f && !t) return undefined;
  return { ...(f ? { gte: businessDayStart(f) } : {}), ...(t ? { lt: businessDayEnd(t) } : {}) };
}

export function dateColumnRange(from?: DayInput, to?: DayInput): { gte?: Date; lte?: Date } | undefined {
  const f = toIsoDay(from);
  const t = toIsoDay(to);
  if (!f && !t) return undefined;
  return { ...(f ? { gte: new Date(`${f}T00:00:00Z`) } : {}), ...(t ? { lte: new Date(`${t}T00:00:00Z`) } : {}) };
}

/** Whole days between two instants, counted on the Harare calendar (used for "days in transit", "stock age"). */
export function businessDaysBetween(start: Date, end: Date): number {
  const day = (d: Date) => Math.floor((d.getTime() + 2 * 3_600_000) / 86_400_000);
  return Math.max(0, day(end) - day(start));
}

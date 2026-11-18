import { Prisma } from "@prisma/client";
import type { ReportRow } from "@tobacco/shared";
import { AppError } from "../../common/app-error";
import { formatDecimal } from "../../common/export";
import { MAX_EXPORT_ROWS } from "@tobacco/validation";
import type { Paging } from "./reports.types";

export const ZERO = new Prisma.Decimal(0);

/** Decimal -> fixed-scale decimal STRING (never a JS float). */
export const fx = (d: Prisma.Decimal | null | undefined, scale: number): string => (d ?? ZERO).toFixed(scale);
export const mass = (d: Prisma.Decimal | null | undefined) => fx(d, 1);
export const money = (d: Prisma.Decimal | null | undefined) => fx(d, 2);

export const sumDec = (xs: Array<Prisma.Decimal | null | undefined>): Prisma.Decimal => xs.reduce<Prisma.Decimal>((a, b) => a.plus(b ?? 0), ZERO);

/** `@db.Date` value -> "yyyy-mm-dd". */
export const dayOf = (d: Date): string => d.toISOString().slice(0, 10);
export const instant = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export const contains = (s: string) => ({ contains: s, mode: "insensitive" as const });

/** Tile text: grouped integer / fixed decimals. */
export const tInt = (n: number) => formatDecimal(n, 0);
export const tMass = (d: Prisma.Decimal | null | undefined) => `${formatDecimal(mass(d), 1)} kg`;
export const tUsd = (d: Prisma.Decimal | null | undefined) => `US$ ${formatDecimal(money(d), 2)}`;
export const tZig = (d: Prisma.Decimal | null | undefined) => `ZiG ${formatDecimal(money(d), 2)}`;

/** Prisma skip/take for a page; throws EXPORT_TOO_LARGE when an export would exceed the cap. */
export function limits(paging: Paging, total: number): { skip?: number; take?: number } {
  if (paging === "all") {
    if (total > MAX_EXPORT_ROWS) throw tooLarge(total);
    return {};
  }
  return { skip: (paging.page - 1) * paging.pageSize, take: paging.pageSize };
}

export function tooLarge(total: number): AppError {
  return AppError.unprocessable(
    "EXPORT_TOO_LARGE",
    `This report has ${formatDecimal(total, 0)} rows, more than the ${formatDecimal(MAX_EXPORT_ROWS, 0)} an export can hold. Narrow the date range or filters and try again.`,
  );
}

/** In-memory paging for reports computed as a whole (group-by style). */
export function pageOf<T>(rows: T[], paging: Paging): T[] {
  if (paging === "all") {
    if (rows.length > MAX_EXPORT_ROWS) throw tooLarge(rows.length);
    return rows;
  }
  const start = (paging.page - 1) * paging.pageSize;
  return rows.slice(start, start + paging.pageSize);
}

/** Stable in-memory sort by a column key: numbers numerically (decimal strings too), dates/text naturally. Nulls last. */
export function sortRows(rows: ReportRow[], sort: { key: string; dir: "asc" | "desc" }): ReportRow[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null);
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const x = a.row[sort.key];
      const y = b.row[sort.key];
      if (x === null || x === undefined) return y === null || y === undefined ? a.i - b.i : 1;
      if (y === null || y === undefined) return -1;
      const nx = num(x);
      const ny = num(y);
      const cmp = nx !== null && ny !== null ? nx - ny : String(x).localeCompare(String(y), "en", { numeric: true, sensitivity: "base" });
      return cmp !== 0 ? cmp * sign : a.i - b.i;
    })
    .map((x) => x.row);
}

/**
 * DB ordering from a whitelisted column key. Unknown keys fall back to the default; an `id` tiebreaker keeps pages stable.
 */
export function dbOrder<O>(
  sort: { key: string; dir: "asc" | "desc" } | undefined,
  map: Record<string, (dir: "asc" | "desc") => O>,
  fallback: { key: string; dir: "asc" | "desc" },
): Array<O | { id: "asc" }> {
  const chosen = sort && map[sort.key] ? sort : fallback;
  return [map[chosen.key]!(chosen.dir), { id: "asc" }];
}

/** Process an array in chunks (keeps `IN (...)` lists well under Postgres' parameter limit). */
export async function inChunks<T, R>(items: T[], size: number, fn: (chunk: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await fn(items.slice(i, i + size))));
  return out;
}

export const humanDuration = (ms: number): string => {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
};

import { formatDate, formatDateTime, formatInt, formatUsd, ticketValueCents, type Bale, type MockDb, type Sale } from "@tobacco/shared";
import type { Cell, ReportColumn, ReportFilters, ReportRow } from "./types";

// ── Filters ─────────────────────────────────────────────────────
export function inRange(date: string | undefined | null, f: ReportFilters): boolean {
  if (!date) return !f.from && !f.to;
  const d = date.slice(0, 10);
  if (f.from && d < f.from) return false;
  if (f.to && d > f.to) return false;
  return true;
}

/** Season is derived from the record's date (year) — the manuals only show season on bookings, notes and stop orders. */
export const seasonOk = (date: string | undefined | null, f: ReportFilters) => !f.season || (date ?? "").slice(0, 4) === f.season;
export const spOk = (id: string | undefined | null, f: ReportFilters) => !f.sellingPoint || !id || id === f.sellingPoint;
export const growerOk = (growerNo: string | undefined | null, f: ReportFilters) => !f.grower || growerNo === f.grower;

export function growerName(db: MockDb, growerNo: string): string {
  const g = db.growers.find((x) => x.growerNo === growerNo);
  return g ? `${g.firstName} ${g.surname}` : growerNo;
}

export function userNameOf(db: MockDb, userId: string | undefined): string {
  if (!userId) return "—";
  return db.users.find((u) => u.id === userId)?.name ?? userId;
}

// ── Sale arithmetic (price × mass; formula unverified — UQ-05) ──
export function liveBales(db: MockDb, gdnId: string): Bale[] {
  return db.bales.filter((b) => b.gdnId === gdnId && !b.ejected);
}

export function saleBales(db: MockDb, sale: Sale): Bale[] {
  return db.bales.filter((b) => b.saleId === sale.id && !b.ejected);
}

export function saleBaleCount(db: MockDb, sale: Sale): number {
  return sale.historical?.baleCount ?? saleBales(db, sale).length;
}

export function saleMassKg(db: MockDb, sale: Sale): number {
  return sale.historical?.massKg ?? saleBales(db, sale).reduce((a, b) => a + b.mass, 0);
}

/** Gross US value in cents. Bales with a sale code (not bought) are left out of the total (Manual 06). */
export function saleGrossCents(db: MockDb, sale: Sale): number {
  if (sale.historical) return sale.historical.usdValueCents;
  return saleBales(db, sale).reduce((a, b) => (b.saleCode || !b.priceCents ? a : a + ticketValueCents(b.priceCents, b.mass)), 0);
}

export function saleDeductionsCents(db: MockDb, sale: Sale): number {
  return db.deductions.filter((d) => d.saleId === sale.id).reduce((a, d) => a + d.amountCents, 0);
}

export function baleIsComplete(b: Bale): boolean {
  if (b.saleCode) return Boolean(b.timbGrade);
  return Boolean(b.timbGrade && b.buyerCode && b.buyerGrade && b.priceCents);
}

// ── Formatting ──────────────────────────────────────────────────
export function humanise(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatAmount(cents: number, currency = "USD"): string {
  if (currency === "USD") return formatUsd(cents);
  const [int, frac = "00"] = (Math.abs(cents) / 100).toFixed(2).split(".");
  const withCommas = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${cents < 0 ? "-" : ""}${currency} ${withCommas}.${frac}`;
}

/** Totals per currency, e.g. "USD $499.43 · ZWL 1,000.00" (never silently adds different currencies). */
export function sumByCurrency(items: Array<{ currency: string; cents: number }>): string {
  const totals = new Map<string, number>();
  for (const i of items) totals.set(i.currency, (totals.get(i.currency) ?? 0) + i.cents);
  if (totals.size === 0) return formatUsd(0);
  return [...totals.entries()].map(([c, v]) => formatAmount(v, c)).join(" · ");
}

export function displayValue(col: ReportColumn, row: ReportRow): string {
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return "—";
  switch (col.format) {
    case "int":
      return formatInt(Number(v));
    case "mass":
      return `${Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 })} kg`;
    case "date":
      return formatDate(String(v));
    case "datetime":
      return formatDateTime(String(v));
    case "amount":
      return formatAmount(Number(v), col.currencyKey ? String(row[col.currencyKey] ?? "USD") : "USD");
    case "status":
      return humanise(String(v));
    default:
      return String(v);
  }
}

/** CSV-friendly raw value: money as plain decimals, dates ISO. */
export function exportValue(col: ReportColumn, row: ReportRow): string {
  const v: Cell | undefined = row[col.key];
  if (v === null || v === undefined) return "";
  if (col.format === "amount") return (Number(v) / 100).toFixed(2);
  return String(v);
}

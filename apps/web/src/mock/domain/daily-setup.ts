import { AppError, Decimal } from "@tobacco/shared";
import { validateExchangeRate, validateStartOfDayPrerequisites } from "@tobacco/validation";
import { audit, failText, notify, requirePermission, type Ctx } from "../ctx";

/**
 * Daily setup (Manual 01): the two records that must exist every sale day.
 * 1. Sale Date - Receiving (active, today) — Receiving Supervisor.
 * 2. Start of Day (posted, with exchange rate) — Data Processing Supervisor.
 */

export interface CreateSaleDateInput {
  date: string;
  isActive: boolean;
  canScanFloorSummary: boolean;
}

export function createSaleDate(ctx: Ctx, input: CreateSaleDateInput) {
  requirePermission(ctx, "sale-day.create");
  const sp = ctx.db.settings.sellingPointId;
  if (ctx.db.receivingSaleDates.some((d) => d.sellingPointId === sp && d.date === input.date))
    failText(`A receiving sale date for ${input.date} already exists. Activate the existing one instead.`);
  if (input.isActive) requirePermission(ctx, "sale-day.activate");
  // "Is Active — Ticked. This unticks the previous date" (Manual 01, Step 1)
  if (input.isActive) for (const d of ctx.db.receivingSaleDates) if (d.sellingPointId === sp) d.isActive = false;
  const record = {
    id: `rsd-${input.date}`,
    sellingPointId: sp,
    date: input.date,
    isActive: input.isActive,
    canScanFloorSummary: input.canScanFloorSummary,
    createdBy: ctx.actor.id,
    createdAt: ctx.now,
  };
  ctx.db.receivingSaleDates.push(record);
  audit(ctx, { action: "sale-date.create", entityType: "ReceivingSaleDate", entityId: record.id, entityRef: input.date, next: record });
  return record;
}

export function setSaleDateActive(ctx: Ctx, input: { id: string; isActive: boolean }) {
  requirePermission(ctx, "sale-day.activate");
  const rec = ctx.db.receivingSaleDates.find((d) => d.id === input.id);
  if (!rec) failText("Sale date not found");
  const previous = { isActive: rec.isActive };
  if (input.isActive) for (const d of ctx.db.receivingSaleDates) if (d.sellingPointId === rec.sellingPointId) d.isActive = false;
  rec.isActive = input.isActive;
  audit(ctx, { action: input.isActive ? "sale-date.activate" : "sale-date.deactivate", entityType: "ReceivingSaleDate", entityId: rec.id, entityRef: rec.date, previous, next: { isActive: rec.isActive } });
  return rec;
}

/** "Turn Off/Turn On Floor Summary Scanning" — stops or restarts scanning for the whole floor (Manual 05). */
export function setFloorScanning(ctx: Ctx, input: { enabled: boolean }) {
  requirePermission(ctx, "floor-summary.toggle-scanning");
  const sp = ctx.db.settings.sellingPointId;
  const rec = ctx.db.receivingSaleDates.find((d) => d.sellingPointId === sp && d.isActive);
  if (!rec) throw new AppError("FLOOR_ADD_SALE_DATE");
  const previous = { canScanFloorSummary: rec.canScanFloorSummary };
  rec.canScanFloorSummary = input.enabled;
  audit(ctx, { action: "floor-summary.toggle-scanning", entityType: "ReceivingSaleDate", entityId: rec.id, entityRef: rec.date, previous, next: { canScanFloorSummary: input.enabled } });
  return rec;
}

export interface PostStartOfDayInput {
  sellingDate: string;
  exchangeRate: string;
}

export function postStartOfDay(ctx: Ctx, input: PostStartOfDayInput) {
  requirePermission(ctx, "sale-day.post");
  const rate = validateExchangeRate(input.exchangeRate);
  if (!rate.ok && rate.key) throw new AppError(rate.key);
  const prereq = validateStartOfDayPrerequisites({
    selectedDate: input.sellingDate,
    sales: ctx.db.sales.map((s) => ({ saleDate: s.saleDate, status: s.status })),
  });
  if (!prereq.ok && prereq.key) throw new AppError(prereq.key);
  const sp = ctx.db.settings.sellingPointId;
  if (ctx.db.startOfDays.some((s) => s.sellingPointId === sp && s.sellingDate === input.sellingDate && s.status === "POSTED"))
    failText(`Start of Day for ${input.sellingDate} is already posted. Whether a posted rate can be changed is not documented (UQ-16).`);

  const rec = {
    id: `sod-${input.sellingDate}`,
    sellingPointId: sp,
    sellingDate: input.sellingDate,
    exchangeRate: new Decimal(input.exchangeRate.trim()).toFixed(8),
    status: "POSTED" as const,
    createdBy: ctx.actor.id,
    createdAt: ctx.now,
    postedBy: ctx.actor.id,
    postedAt: ctx.now,
  };
  ctx.db.startOfDays = ctx.db.startOfDays.filter((s) => s.id !== rec.id);
  ctx.db.startOfDays.push(rec);
  audit(ctx, { action: "start-of-day.post", entityType: "StartOfDay", entityId: rec.id, entityRef: rec.sellingDate, next: rec, reason: `Exchange rate ${rec.exchangeRate}` });
  notify(ctx, { level: "success", title: "Start of Day posted", body: `${rec.sellingDate} at ${rec.exchangeRate}`, href: "/setup/start-of-day" });
  return rec;
}

import type { MockDb, ReceivingSaleDate, SellingPoint, StartOfDay } from "@tobacco/shared";

/** Current operating context derived from the DB: the active sale date, Start of Day, selling point and season. */
export interface SaleContext {
  today: string;
  sellingPoint: SellingPoint;
  seasonYear: number;
  activeSaleDate?: ReceivingSaleDate;
  /** True when the active receiving sale date equals the demo "today". */
  saleDateIsCurrent: boolean;
  startOfDay?: StartOfDay;
  startOfDayPosted: boolean;
  exchangeRate?: string;
}

export function selectSaleContext(db: MockDb): SaleContext {
  const today = db.settings.demoToday;
  const sellingPoint = db.sellingPoints.find((s) => s.id === db.settings.sellingPointId) ?? db.sellingPoints[0]!;
  const activeSaleDate = db.receivingSaleDates.find((d) => d.sellingPointId === sellingPoint.id && d.isActive);
  const startOfDay = db.startOfDays.find((s) => s.sellingPointId === sellingPoint.id && s.sellingDate === today);
  return {
    today,
    sellingPoint,
    seasonYear: db.settings.seasonYear,
    activeSaleDate,
    saleDateIsCurrent: activeSaleDate?.date === today,
    startOfDay,
    startOfDayPosted: startOfDay?.status === "POSTED",
    exchangeRate: startOfDay?.exchangeRate,
  };
}

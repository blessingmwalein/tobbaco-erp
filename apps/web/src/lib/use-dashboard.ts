"use client";

import { useState } from "react";
import { useDb, useDbQuery } from "@/mock/hooks";
import { selectDashboard } from "./dashboard";
import { selectSaleContext } from "./sale-context";

/** Shared by the dashboard and the sale-day workflow page: date filter + derived model. */
export function useDashboardModel() {
  const ctx = useDb(selectSaleContext);
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? ctx.today;
  const dates = useDb((db) => {
    const set = new Set<string>([db.settings.demoToday]);
    for (const d of db.receivingSaleDates) set.add(d.date);
    for (const s of db.startOfDays) set.add(s.sellingDate);
    for (const s of db.sales) set.add(s.saleDate);
    for (const b of db.bookings) set.add(b.sellDate);
    return [...set].sort().reverse();
  });
  const sellingPointId = ctx.sellingPoint.id;
  const query = useDbQuery(["dashboard", date, sellingPointId], (db) => selectDashboard(db, date, sellingPointId));
  return { ctx, date, setDate: setPicked, dates, sellingPointId, ...query };
}

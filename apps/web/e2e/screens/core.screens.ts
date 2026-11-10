import type { Screen } from "./types";

export const SCREENS: Screen[] = [
  { id: "00-login", path: "/login", role: null },
  { id: "01-dashboard-fresh", path: "/dashboard", role: "demo-operator", scenario: "FRESH", tall: true },
  { id: "02-dashboard-processed", path: "/dashboard", role: "demo-operator", scenario: "PROCESSED", tall: true },
  { id: "03-sale-day-workflow", path: "/sale-day", role: "demo-operator", scenario: "FLOOR_SUMMARY_DONE", tall: true },
  { id: "04-sale-dates", path: "/setup/sale-dates", role: "receiving-supervisor", scenario: "START_OF_DAY" },
  { id: "05-start-of-day", path: "/setup/start-of-day", role: "data-processing-supervisor", scenario: "FRESH" },
  { id: "06-floor-hub", path: "/floor", role: "demo-operator", scenario: "TICKETS_CONFIRMED" },
];

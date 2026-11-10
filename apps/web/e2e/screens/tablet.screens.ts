import type { Screen } from "./types";

/** The brief: desktop-first, but tablets and smaller screens must stay usable. */
export const SCREENS: Screen[] = [
  { id: "99-tablet-dashboard", path: "/dashboard", role: "demo-operator", scenario: "PROCESSED", width: 820, height: 1180 },
  { id: "99-tablet-bale-capture", path: "/floor/receiving/gdn-0000005/bales", role: "receiving-clerk", scenario: "RECEIVING_IN_PROGRESS", width: 1024, height: 768 },
  { id: "99-tablet-floor-summary", path: "/floor/floor-summary", role: "floor-summary-clerk", scenario: "TICKETS_CONFIRMED", width: 1024, height: 768 },
  { id: "99-tablet-sale", path: "/sales/sale-5", role: "data-processing-supervisor", scenario: "VALIDATION_SHOWCASE", width: 1024, height: 768 },
];

import type { Screen } from "./types";

/** Reports and administration. */
export const SCREENS: Screen[] = [
  { id: "90-reports-catalogue", path: "/reports", role: "supervisor", scenario: "READY_TO_DISPATCH", tall: true },
  { id: "91-report-daily-receiving", path: "/reports/daily-receiving", role: "supervisor", scenario: "PROCESSED", tall: true },
  { id: "92-report-deductions", path: "/reports/deduction", role: "accounts", scenario: "PROCESSED", tall: true },
  { id: "93-admin-users", path: "/admin/users", role: "system-admin", scenario: "PROCESSED" },
  { id: "94-admin-roles-matrix", path: "/admin/roles", role: "system-admin", scenario: "FRESH", tall: true },
  { id: "95-admin-audit", path: "/admin/audit", role: "system-admin", scenario: "PROCESSED" },
  { id: "96-admin-settings", path: "/admin/settings", role: "system-admin", scenario: "FRESH", tall: true },
  { id: "97-admin-reference-data", path: "/admin/reference-data", role: "system-admin", scenario: "FRESH" },
  { id: "98-admin-devices", path: "/admin/devices", role: "system-admin", scenario: "FRESH", tall: true },
];

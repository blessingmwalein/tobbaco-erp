/**
 * Buyer Portal permissions — a separate namespace (`buyer.*`) from the internal ERP permissions.
 * Enforced by the API (guards); the UI only hides/disables. Buyer users can never hold staff permissions.
 */
export const BUYER_PERMISSION_GROUPS = [
  {
    group: "Overview",
    permissions: [["buyer.dashboard.view", "View the dashboard"]],
  },
  {
    group: "Purchases",
    permissions: [
      ["buyer.purchases.view", "View purchases, manifests and the purchase register"],
      ["buyer.invoices.view", "View buyer invoices and financial summaries"],
      ["buyer.flowdisk.import", "Import Flow Disk files and invoice documents"],
    ],
  },
  {
    group: "Receiving",
    permissions: [
      ["buyer.receiving.view", "View receiving sessions and reconciliation"],
      ["buyer.receiving.scan", "Run receiving sessions: scan, assign locations, confirm"],
      ["buyer.receiving.exceptions", "Flag exceptions and record explanations"],
      ["buyer.receiving.correct", "Authorise corrections to a received bale"],
    ],
  },
  {
    group: "Warehouse",
    permissions: [
      ["buyer.warehouse.view", "View warehouses, bays, rows and inventory"],
      ["buyer.warehouse.manage", "Create and edit warehouses, bays and rows"],
      ["buyer.warehouse.move", "Move and transfer bales between locations"],
    ],
  },
  {
    group: "Processing",
    permissions: [
      ["buyer.processing.view", "View processing companies, dispatches and returns"],
      ["buyer.processing.companies", "Manage processing companies"],
      ["buyer.dispatch.create", "Dispatch bales to a processing company"],
      ["buyer.returns.receive", "Receive processed tobacco and reconcile returns"],
    ],
  },
  {
    group: "Traceability and reports",
    permissions: [
      ["buyer.traceability.view", "View bale traceability timelines"],
      ["buyer.reports.view", "View reports"],
      ["buyer.reports.export", "Export reports (PDF / Excel)"],
      ["buyer.audit.view", "View the company audit history"],
    ],
  },
  {
    group: "Administration",
    permissions: [
      ["buyer.users.manage", "Manage the company's users and roles"],
      ["buyer.company.manage", "Edit the company profile"],
    ],
  },
] as const;

type PermissionEntry = (typeof BUYER_PERMISSION_GROUPS)[number]["permissions"][number];
export type BuyerPermission = PermissionEntry[0];

export const ALL_BUYER_PERMISSIONS: BuyerPermission[] = BUYER_PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p[0] as BuyerPermission),
);

export const BUYER_PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  BUYER_PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p[0], p[1]])),
);

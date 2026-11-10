/**
 * Action-level permission keys.
 * Brief examples are kept verbatim; extra keys are derived from documented manual actions
 * (see docs/research/role-permission-matrix.md). The backend (Phase 2) is the authority —
 * in Phase 1 these only drive the mocked UI.
 */
export const PERMISSION_GROUPS = [
  {
    group: "Sale day",
    permissions: [
      ["sale-day.view", "View sale-day dashboard and workflow"],
      ["sale-day.create", "Create the receiving sale date"],
      ["sale-day.activate", "Activate a sale date / allow floor scanning"],
      ["sale-day.post", "Post Start of Day"],
    ],
  },
  {
    group: "TIMB data",
    permissions: [
      ["timb.view", "View TIMB records and import history"],
      ["timb.import-growers", "Import grower register files"],
      ["timb.import-creditors", "Import creditor register files"],
      ["timb.import-bookings", "Import grower booking files"],
      ["timb.import-stop-orders", "Import stop order files"],
      ["timb.download-errors", "Download import error reports"],
      ["growers.view", "View the grower register"],
      ["growers.edit-bank", "Edit grower bank details"],
    ],
  },
  {
    group: "Receiving",
    permissions: [
      ["receiving.view", "View receiving and delivery notes"],
      ["receiving.create-delivery", "Create transporter delivery notes"],
      ["receiving.add-grower", "Add growers to a delivery note"],
      ["receiving.capture-bale", "Capture bale details"],
      ["receiving.complete-delivery", "Complete deliveries"],
      ["receiving.eject-bale", "Eject an incorrectly captured bale"],
    ],
  },
  {
    group: "Tickets",
    permissions: [
      ["tickets.view", "View ticket printing queue"],
      ["tickets.allocate", "Set starting barcode and allocate barcodes"],
      ["tickets.print", "Print tickets"],
      ["tickets.confirm", "Confirm ticket printing"],
      ["tickets.interrupt", "Record an interrupted ticket run"],
      ["tickets.reverse-printing", "Reverse printing status (supervisor)"],
    ],
  },
  {
    group: "Floor summary",
    permissions: [
      ["floor-summary.view", "View floor summaries"],
      ["floor-summary.scan", "Scan tickets into floor rows"],
      ["floor-summary.complete", "Complete floor summaries"],
      ["floor-summary.toggle-scanning", "Turn floor-summary scanning on/off"],
    ],
  },
  {
    group: "Data capture",
    permissions: [
      ["data-capture.view", "View data capture stations"],
      ["data-capture.classify", "Capture TIMB grade / reason / hessian"],
      ["data-capture.capture-buyer", "Capture buyer, buyer grade and sale code"],
      ["data-capture.capture-price", "Capture bale prices"],
      ["batch.view", "View price batches"],
      ["batch.capture-price", "Enter batch (second capture) prices"],
      ["batch.post", "Post a price batch"],
    ],
  },
  {
    group: "Sales",
    permissions: [
      ["sales.view", "View sales (ticket processing)"],
      ["sales.balance", "Balance a sale"],
      ["sales.reverse", "Reverse a balanced sale"],
      ["sales.approve", "Approve sale exceptions"],
      ["sales.release", "Release a sale for dispatch"],
      ["approvals.view", "View approvals"],
      ["approvals.request", "Request an approval"],
      ["approvals.decide", "Approve or reject requests"],
    ],
  },
  {
    group: "Deductions",
    permissions: [
      ["deductions.view", "View deductions and creditors"],
      ["deductions.process", "Run stop order / deduction processing"],
    ],
  },
  {
    group: "Payments",
    permissions: [
      ["payments.view", "View processed sales, sales sheets and payments"],
      ["payments.generate-schedule", "Generate payment schedules"],
      ["payments.export", "Export bank CSV files"],
      ["payments.confirm-payment", "Record verified payment confirmations"],
    ],
  },
  {
    group: "Dispatch",
    permissions: [
      ["dispatch.view", "View dispatch notes"],
      ["dispatch.create", "Initiate dispatch"],
      ["dispatch.scan", "Scan and remove bales on a draft note"],
      ["dispatch.post", "Post dispatch notes"],
      ["dispatch.cancel", "Cancel draft dispatch notes (with reason)"],
      ["dispatch.reset", "Reset a note to draft (supervisor)"],
      ["dispatch.generate-shipment-file", "Generate warehouse shipment files"],
    ],
  },
  {
    group: "Reports and administration",
    permissions: [
      ["reports.view", "View reports"],
      ["reports.export", "Export reports (CSV / PDF)"],
      ["audit.view", "View the audit log"],
      ["admin.users", "Manage users"],
      ["admin.roles", "Manage roles and permissions"],
      ["admin.settings", "Manage system settings"],
      ["admin.reference-data", "Manage seasons, selling points and reference data"],
    ],
  },
] as const;

type GroupPermissions = (typeof PERMISSION_GROUPS)[number]["permissions"][number];
export type Permission = GroupPermissions[0];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p[0] as Permission),
);

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p[0], p[1]])),
);

export function permissionGroupOf(permission: string): string {
  return PERMISSION_GROUPS.find((g) => g.permissions.some((p) => p[0] === permission))?.group ?? "Other";
}

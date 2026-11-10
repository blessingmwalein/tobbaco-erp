import type { Crumb } from "@tobacco/ui";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "sale-day": "Sale day workflow",
  setup: "Daily setup",
  "sale-dates": "Sale dates",
  "start-of-day": "Start of Day",
  timb: "TIMB data",
  imports: "Imports",
  new: "New",
  bookings: "Bookings",
  growers: "Growers",
  creditors: "Creditors",
  buyers: "Buyers",
  receiving: "Receiving",
  "transporter-notes": "Transporter notes",
  "delivery-notes": "Delivery notes",
  corrections: "Corrections",
  tickets: "Ticket printing",
  "floor-summary": "Floor summary",
  batches: "Price batches",
  sales: "Sales & balancing",
  approvals: "Approvals",
  finance: "Finance",
  "stop-order-processing": "Stop order processing",
  "stop-orders": "Stop orders",
  deductions: "Deductions",
  "grower-charges": "Grower charges",
  "sales-sheets": "Sales sheets",
  payments: "Payments",
  dispatch: "Dispatch",
  shipments: "Shipment files",
  reports: "Reports",
  admin: "Administration",
  users: "Users",
  roles: "Roles & permissions",
  audit: "Audit log",
  "reference-data": "Reference data",
  devices: "Devices",
  settings: "Settings",
};

/** Segments with no page of their own link to the nearest sensible parent. */
const REDIRECT: Record<string, string> = {
  "/setup": "/setup/sale-dates",
  "/timb": "/timb/imports",
  "/finance": "/finance/payments",
  "/admin": "/admin/users",
  "/receiving": "/receiving/delivery-notes",
};

export function breadcrumbsFor(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Home", href: "/dashboard" }];
  let acc = "";
  segments.forEach((seg, i) => {
    acc += `/${seg}`;
    const decoded = decodeURIComponent(seg);
    const label = LABELS[seg] ?? decoded;
    const last = i === segments.length - 1;
    if (seg === "dashboard") return;
    crumbs.push({ label, href: last ? undefined : (REDIRECT[acc] ?? acc) });
  });
  return crumbs;
}

import type { Crumb } from "@tobacco/ui";
import { BUYER_NAV_ITEMS } from "./buyer-nav";

const LABELS: Record<string, string> = {
  buyer: "Buyer Portal",
  new: "New",
  imports: "Invoices Import",
  invoices: "Buyer Invoices",
  purchases: "Purchase Register",
  manifests: "Bale Manifests",
  receiving: "Bale Receiving",
  shipments: "Invoice Shipments",
  reconciliation: "Receiving Reconciliation",
  inventory: "Warehouse Inventory",
  movements: "Warehouse Movements",
  processing: "Processing",
  companies: "Processing Companies",
  dispatches: "Dispatches",
  returns: "Processing Returns",
  warehouses: "Buyer Warehouses",
  locations: "Bays & Rows",
  traceability: "Bale Traceability",
  reports: "Reports",
  admin: "Administration",
  users: "Buyer Users",
  company: "Company Profile",
  audit: "Audit History",
  account: "Account Settings",
};

const REDIRECT: Record<string, string> = {
  "/buyer": "/buyer/dashboard",
  "/buyer/processing": "/buyer/processing/dispatches",
  "/buyer/reports": "/buyer/reports/purchases",
  "/buyer/admin": "/buyer/admin/users",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Breadcrumbs from the URL. Record ids show as "Details"; pages can override by rendering their own PageHeader crumbs. */
export function buyerBreadcrumbsFor(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Home", href: "/buyer/dashboard" }];
  let acc = "";
  segments.forEach((seg, i) => {
    acc += `/${seg}`;
    if (seg === "buyer" || seg === "dashboard") return;
    const last = i === segments.length - 1;
    const label = UUID.test(seg) ? "Details" : (LABELS[seg] ?? BUYER_NAV_ITEMS.find((n) => n.href === acc)?.label ?? decodeURIComponent(seg));
    crumbs.push({ label, href: last ? undefined : (REDIRECT[acc] ?? acc) });
  });
  return crumbs;
}

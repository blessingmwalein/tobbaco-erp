import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  History,
  LayoutDashboard,
  PackageSearch,
  Receipt,
  ScanBarcode,
  Settings,
  Truck,
  UserCog,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import type { BuyerPermission } from "@tobacco/shared";

export interface BuyerNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from the sidebar when the signed-in user's role lacks this permission. */
  permission?: BuyerPermission;
  keywords?: string;
}

export interface BuyerNavGroup {
  label: string;
  items: BuyerNavItem[];
}

/** Buyer Portal navigation — restructured to mirror the business workflow:
 * Flow Disk import → invoice → purchase register → shipment import → in-transit → arrival → bale receiving →
 * purchase-level reconciliation → reconciliation report → warehouse allocation → inventory & traceability. */
export const BUYER_NAV_GROUPS: BuyerNavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/buyer/dashboard", icon: LayoutDashboard, permission: "buyer.dashboard.view" }],
  },
  {
    label: "Purchases",
    items: [
      { label: "Invoices Import", href: "/buyer/imports", icon: FileDown, permission: "buyer.flowdisk.import", keywords: "flow disk invoice upload" },
      { label: "Invoices", href: "/buyer/invoices", icon: Receipt, permission: "buyer.invoices.view", keywords: "invoice financial charges" },
      { label: "Purchase Register", href: "/buyer/purchases", icon: ClipboardList, permission: "buyer.purchases.view" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Invoice Shipments", href: "/buyer/shipments", icon: Truck, permission: "buyer.receiving.view", keywords: "shipment json dispatch truck arrival" },
      { label: "Bales Receiving", href: "/buyer/receiving", icon: ScanBarcode, permission: "buyer.receiving.view", keywords: "scan receive" },
      { label: "Receiving Reconciliation", href: "/buyer/reconciliation", icon: ClipboardCheck, permission: "buyer.receiving.view", keywords: "purchase reconcile close report" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Warehouse Inventory", href: "/buyer/inventory", icon: Boxes, permission: "buyer.warehouse.view", keywords: "stock bales" },
      { label: "Warehouse Movements", href: "/buyer/movements", icon: ArrowLeftRight, permission: "buyer.warehouse.view", keywords: "transfer move ledger" },
      { label: "Bale Traceability", href: "/buyer/traceability", icon: PackageSearch, permission: "buyer.traceability.view", keywords: "timeline history barcode" },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Purchase Reports", href: "/buyer/reports/purchases", icon: BarChart3, permission: "buyer.reports.view" },
      { label: "Receiving Reports", href: "/buyer/reports/receiving", icon: BarChart3, permission: "buyer.reports.view" },
      { label: "Inventory Reports", href: "/buyer/reports/inventory", icon: BarChart3, permission: "buyer.reports.view" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Buyer Users", href: "/buyer/admin/users", icon: UserCog, permission: "buyer.users.manage" },
      { label: "Company Profile", href: "/buyer/admin/company", icon: Building2, permission: "buyer.company.manage" },
      { label: "Audit History", href: "/buyer/admin/audit", icon: History, permission: "buyer.audit.view" },
      { label: "Account Settings", href: "/buyer/account", icon: Settings },
    ],
  },
];

export const BUYER_NAV_ITEMS: BuyerNavItem[] = BUYER_NAV_GROUPS.flatMap((g) => g.items);

/**
 * Active when the path is the item or inside it — but a more specific sibling wins
 * (e.g. /buyer/receiving/reconciliation highlights "Receiving Reconciliation", not "Bale Receiving").
 */
export function isBuyerNavActive(pathname: string, href: string): boolean {
  const within = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  if (!within(href)) return false;
  return !BUYER_NAV_ITEMS.some((other) => other.href !== href && other.href.startsWith(`${href}/`) && within(other.href));
}

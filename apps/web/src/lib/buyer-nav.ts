import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  Factory,
  Grid3x3,
  History,
  LayoutDashboard,
  PackageCheck,
  PackageSearch,
  Receipt,
  ScanBarcode,
  Settings,
  Truck,
  Undo2,
  UserCog,
  Warehouse,
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

/** Buyer Portal navigation — the structure in the feature brief (§12). */
export const BUYER_NAV_GROUPS: BuyerNavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/buyer/dashboard", icon: LayoutDashboard, permission: "buyer.dashboard.view" }],
  },
  {
    label: "Purchases",
    items: [
      { label: "Buyer Invoices", href: "/buyer/invoices", icon: Receipt, permission: "buyer.invoices.view", keywords: "invoice financial charges" },
      { label: "Flow Disk Imports", href: "/buyer/imports", icon: FileDown, permission: "buyer.purchases.view", keywords: "flow disk import upload" },
      { label: "Purchase Register", href: "/buyer/purchases", icon: ClipboardList, permission: "buyer.purchases.view" },
      { label: "Bale Manifests", href: "/buyer/manifests", icon: FileSpreadsheet, permission: "buyer.purchases.view", keywords: "expected bales" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Bale Receiving", href: "/buyer/receiving", icon: ScanBarcode, permission: "buyer.receiving.view", keywords: "scan receive" },
      { label: "Incoming Shipments", href: "/buyer/shipments", icon: Truck, permission: "buyer.receiving.view", keywords: "dispatch manifest truck arrival" },
      { label: "Receiving Reconciliation", href: "/buyer/receiving/reconciliation", icon: ClipboardCheck, permission: "buyer.receiving.view" },
      { label: "Warehouse Inventory", href: "/buyer/inventory", icon: Boxes, permission: "buyer.warehouse.view", keywords: "stock bales" },
      { label: "Warehouse Movements", href: "/buyer/movements", icon: ArrowLeftRight, permission: "buyer.warehouse.view", keywords: "transfer move ledger" },
    ],
  },
  {
    label: "Processing",
    items: [
      { label: "Processing Companies", href: "/buyer/processing/companies", icon: Factory, permission: "buyer.processing.view" },
      { label: "Dispatches", href: "/buyer/processing/dispatches", icon: Truck, permission: "buyer.processing.view", keywords: "dispatch to processor" },
      { label: "Processing Returns", href: "/buyer/processing/returns", icon: Undo2, permission: "buyer.processing.view", keywords: "processed tobacco back" },
      { label: "Processing Reconciliation", href: "/buyer/processing/reconciliation", icon: PackageCheck, permission: "buyer.processing.view" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Buyer Warehouses", href: "/buyer/warehouses", icon: Warehouse, permission: "buyer.warehouse.view" },
      { label: "Warehouse Bays & Rows", href: "/buyer/warehouses/locations", icon: Grid3x3, permission: "buyer.warehouse.view", keywords: "bay row location" },
      { label: "Processing Warehouses", href: "/buyer/processing/warehouses", icon: Building2, permission: "buyer.warehouse.view" },
      { label: "Bale Traceability", href: "/buyer/traceability", icon: PackageSearch, permission: "buyer.traceability.view", keywords: "timeline history barcode" },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Purchase Reports", href: "/buyer/reports/purchases", icon: BarChart3, permission: "buyer.reports.view" },
      { label: "Receiving Reports", href: "/buyer/reports/receiving", icon: BarChart3, permission: "buyer.reports.view" },
      { label: "Inventory Reports", href: "/buyer/reports/inventory", icon: BarChart3, permission: "buyer.reports.view" },
      { label: "Processing Reports", href: "/buyer/reports/processing", icon: BarChart3, permission: "buyer.reports.view" },
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

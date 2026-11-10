import {
  BadgeDollarSign,
  BarChart3,
  Boxes,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Cpu,
  FileDown,
  FileSpreadsheet,
  FileStack,
  Gauge,
  Handshake,
  History,
  Landmark,
  LayoutDashboard,
  Layers,
  ListChecks,
  PackageCheck,
  Printer,
  Receipt,
  ScanLine,
  Scale,
  Settings,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  UsersRound,
  Warehouse,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { MockDb, Permission } from "@tobacco/shared";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from the sidebar when the current role lacks this permission. */
  permission?: Permission;
  /** Extra search keywords. */
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "sale-day.view" },
      { label: "Sale day workflow", href: "/sale-day", icon: Workflow, permission: "sale-day.view", keywords: "stages pipeline exceptions" },
    ],
  },
  {
    label: "Daily setup",
    items: [
      { label: "Sale dates", href: "/setup/sale-dates", icon: CalendarDays, permission: "sale-day.view", keywords: "receiving sale date" },
      { label: "Start of Day", href: "/setup/start-of-day", icon: CalendarCheck, permission: "sale-day.view", keywords: "exchange rate sod" },
    ],
  },
  {
    label: "TIMB data",
    items: [
      { label: "Imports", href: "/timb/imports", icon: FileDown, permission: "timb.view", keywords: "register booking stop order file" },
      { label: "Bookings", href: "/timb/bookings", icon: ClipboardCheck, permission: "timb.view" },
    ],
  },
  {
    label: "Registers",
    items: [
      { label: "Growers", href: "/growers", icon: Users, permission: "growers.view" },
      { label: "Creditors", href: "/creditors", icon: Landmark, permission: "deductions.view" },
      { label: "Buyers", href: "/buyers", icon: Handshake, permission: "growers.view", keywords: "grades warehouse" },
    ],
  },
  {
    label: "Receiving",
    items: [
      { label: "Transporter notes", href: "/receiving/transporter-notes", icon: Truck, permission: "receiving.view", keywords: "tdn delivery" },
      { label: "Delivery notes", href: "/receiving/delivery-notes", icon: PackageCheck, permission: "receiving.view", keywords: "gdn grower bales" },
      { label: "Corrections", href: "/receiving/corrections", icon: ShieldCheck, permission: "receiving.eject-bale", keywords: "eject bale supervisor" },
    ],
  },
  {
    label: "Floor operations",
    items: [
      { label: "Ticket printing", href: "/tickets", icon: Printer, permission: "tickets.view", keywords: "barcode" },
      { label: "Floor summary", href: "/floor-summary", icon: ScanLine, permission: "floor-summary.view", keywords: "rows laying" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Price batches", href: "/batches", icon: Layers, permission: "batch.view", keywords: "batch processing" },
      { label: "Sales & balancing", href: "/sales", icon: Scale, permission: "sales.view", keywords: "ticket processing balance" },
      { label: "Approvals", href: "/approvals", icon: ListChecks, permission: "approvals.view" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Stop order processing", href: "/finance/stop-order-processing", icon: Gauge, permission: "deductions.view" },
      { label: "Stop orders", href: "/finance/stop-orders", icon: FileStack, permission: "deductions.view" },
      { label: "Deductions", href: "/finance/deductions", icon: Receipt, permission: "deductions.view", keywords: "dashboard" },
      { label: "Grower charges", href: "/finance/grower-charges", icon: BadgeDollarSign, permission: "deductions.view" },
      { label: "Sales sheets", href: "/finance/sales-sheets", icon: FileSpreadsheet, permission: "payments.view" },
      { label: "Payments", href: "/finance/payments", icon: Landmark, permission: "payments.view", keywords: "schedule bank csv cloudpay" },
    ],
  },
  {
    label: "Dispatch",
    items: [
      { label: "Dispatch notes", href: "/dispatch", icon: Truck, permission: "dispatch.view" },
      { label: "Shipment files", href: "/dispatch/shipments", icon: Warehouse, permission: "dispatch.view" },
    ],
  },
  {
    label: "Insight",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3, permission: "reports.view" }],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/admin/users", icon: UserCog, permission: "admin.users" },
      { label: "Roles & permissions", href: "/admin/roles", icon: ShieldCheck, permission: "admin.roles" },
      { label: "Audit log", href: "/admin/audit", icon: History, permission: "audit.view" },
      { label: "Reference data", href: "/admin/reference-data", icon: Boxes, permission: "admin.reference-data", keywords: "seasons selling points grades" },
      { label: "Devices", href: "/admin/devices", icon: Cpu, permission: "admin.settings", keywords: "scanner scale printer" },
      { label: "Settings", href: "/admin/settings", icon: Settings, permission: "admin.settings" },
    ],
  },
];

/** The dedicated floor workspaces (separate shell: big fields, scanner-first). */
export interface FloorStation {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  permission: Permission;
  manual: string;
}

export const FLOOR_STATIONS: FloorStation[] = [
  { label: "Receiving", href: "/floor/receiving", icon: Truck, description: "Transporter note, growers on the truck, bale capture with the scale", permission: "receiving.view", manual: "Manual 03" },
  { label: "Ticket printing", href: "/floor/tickets", icon: Printer, description: "Start barcode, allocate, print and confirm tickets", permission: "tickets.view", manual: "Manual 04" },
  { label: "Floor summary", href: "/floor/floor-summary", icon: ScanLine, description: "Scan tickets into floor rows; completes the grower's floor summary", permission: "floor-summary.view", manual: "Manual 05" },
  { label: "Data capture", href: "/floor/data-capture", icon: UsersRound, description: "Classification, e-Buying and all-details stations", permission: "data-capture.view", manual: "Manual 06" },
  { label: "Dispatch", href: "/floor/dispatch", icon: Warehouse, description: "Load trucks by scanning bale tickets", permission: "dispatch.view", manual: "Manual 09" },
];

/** Live counts shown next to nav items. */
export function navBadges(db: MockDb): Record<string, number> {
  const today = db.settings.demoToday;
  return {
    "/tickets": db.deliveryNotes.filter((d) => d.state === "TICKETS_PRINTING").length,
    "/floor-summary": db.deliveryNotes.filter((d) => d.state === "CHECKED").length,
    "/batches": db.priceBatches.filter((b) => b.status === "DRAFT").length,
    "/sales": db.sales.filter((s) => s.status === "DRAFT" && s.saleDate === today).length,
    "/approvals": db.approvals.filter((a) => a.status === "PENDING").length,
    "/dispatch": db.dispatchNotes.filter((d) => d.state === "DRAFT").length,
  };
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

import type { Type } from "@nestjs/common";
import { AuditViewModule } from "./audit-view/audit-view.module";
import { BuyerAdminModule } from "./buyer-admin/buyer-admin.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { FlowdiskModule } from "./flowdisk/flowdisk.module";
import { LedgerModule } from "./ledger/ledger.module";
import { MovementsModule } from "./movements/movements.module";
import { ProcessingModule } from "./processing/processing.module";
import { PurchasesModule } from "./purchases/purchases.module";
import { ReceivingModule } from "./receiving/receiving.module";
import { ReportsModule } from "./reports/reports.module";
import { ReturnsModule } from "./returns/returns.module";
import { StaffModule } from "./staff/staff.module";
import { TraceabilityModule } from "./traceability/traceability.module";
import { WarehousesModule } from "./warehouses/warehouses.module";
import { ShipmentsModule } from "./shipments/shipments.module";

/**
 * Registry of feature modules. Every module slot is registered here up front so parallel workstreams only ever edit
 * files inside their own `modules/<name>/` folder and app.module.ts never changes.
 */
export const FEATURE_MODULES: Type<unknown>[] = [
  StaffModule,
  LedgerModule,
  BuyerAdminModule, // Stage 1: buyer organisations + users (staff + buyer-admin endpoints), company profile
  DashboardModule, // Stage 1: dashboard aggregates
  FlowdiskModule, // Stage 2: Flow Disk + invoice import
  PurchasesModule, // Stage 2: invoices, purchases, bale manifests
  ReceivingModule, // Stage 3: receiving sessions, scans, reconciliation
  WarehousesModule, // Stage 4: warehouses / bays / rows / inventory
  ShipmentsModule, // Buyer dispatch manifests, arrivals, and incoming shipments
  MovementsModule, // Stage 4: movements ledger + transfers
  ProcessingModule, // Stage 5: processing companies + dispatches
  ReturnsModule, // Stage 6: processing returns + processing warehouse
  TraceabilityModule, // Stage 7: per-bale timeline
  ReportsModule, // Stage 7: reports (PDF / Excel)
  AuditViewModule, // Stage 7: audit history view
];

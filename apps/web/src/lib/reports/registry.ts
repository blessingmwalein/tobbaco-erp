import { userActivityReport } from "./activity";
import { dispatchReport, shipmentReport } from "./dispatch";
import { creditorReport, deductionReport, paymentReconciliationReport, paymentScheduleReport } from "./finance";
import { baleReceiving, dailyReceiving, floorSummaryReport, growerDelivery, ticketPrinting } from "./receiving";
import { batchProcessingReport, dataCaptureReport, salesReport } from "./sales";
import type { ReportArea, ReportDef } from "./types";

/** Grower sales sheets live in Finance (printable per-grower sheet); the catalogue links there. */
const growerSalesSheet: ReportDef = {
  slug: "grower-sales-sheet",
  title: "Grower sales sheet",
  description: "The per-grower sales sheet (tickets, buyers, prices, deductions, net) — printable. Opens in Finance.",
  area: "Floor & sales",
  filters: [],
  externalHref: "/finance/sales-sheets",
  run: () => ({ columns: [], rows: [], tiles: [] }),
};

/** The 16 reports from the brief (Part 11), in catalogue order. */
export const REPORTS: ReportDef[] = [
  dailyReceiving,
  growerDelivery,
  baleReceiving,
  ticketPrinting,
  floorSummaryReport,
  dataCaptureReport,
  salesReport,
  growerSalesSheet,
  batchProcessingReport,
  deductionReport,
  creditorReport,
  paymentScheduleReport,
  paymentReconciliationReport,
  dispatchReport,
  shipmentReport,
  userActivityReport,
];

export const REPORT_AREAS: ReportArea[] = ["Receiving & tickets", "Floor & sales", "Finance", "Dispatch", "Administration"];

export function getReport(slug: string): ReportDef | undefined {
  return REPORTS.find((r) => r.slug === slug);
}

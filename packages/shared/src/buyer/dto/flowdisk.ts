import type { ImportIssueKind, FlowDiskImportStatus } from "../enums";
import type { DecimalString, IsoDateString, Page } from "./common";

export interface FlowDiskHeader {
  floorName: string;
  buyerCode: string;
  buyerName: string;
  saleDateFrom: IsoDateString;
  saleDateTo: IsoDateString;
  exchangeRate: DecimalString | null;
}

export interface FlowDiskRow {
  rowNumber: number;
  buyerGrade: string;
  growerNo: string;
  lotNo: string;
  massKg: DecimalString;
  uscPerKg: DecimalString;
  usdValue: DecimalString;
  barcode: string;
  timbGrade: string | null;
}

export interface FlowDiskIssue {
  rowNumber: number;
  kind: ImportIssueKind;
  field: string | null;
  message: string;
}

export interface FlowDiskInvoiceDraft {
  preparedBy: string | null;
  totalZigValue: DecimalString | null;
  payableUsd: DecimalString | null;
  payableZig: DecimalString | null;
  charges: Array<{ status: string; code: string; label: string; amountUsd: DecimalString; amountZig: DecimalString; sortOrder: number }>;
  gradeSummary: Array<{ grade: string; bales: number; massKg: DecimalString; avgUsc: DecimalString; usdValue: DecimalString }>;
}

export interface FlowDiskParseResult {
  parserId: string;
  parserVersion: string;
  formatVerified: boolean;
  header: FlowDiskHeader;
  rows: FlowDiskRow[];
  issues: FlowDiskIssue[];
  totalMassKg: DecimalString;
  totalUsdValue: DecimalString;
  invoiceDraft: FlowDiskInvoiceDraft | null;
}

export interface FlowDiskImportDto {
  id: string;
  reference: string;
  filename: string;
  status: FlowDiskImportStatus;
  parserId: string;
  parserVersion: string;
  formatVerified: boolean;
  recordCount: number;
  validCount: number;
  invalidCount: number;
  expectedMassKg: DecimalString;
  expectedUsdValue: DecimalString;
  createdAt: IsoDateString;
}

export type FlowDiskImportPage = Page<FlowDiskImportDto>;

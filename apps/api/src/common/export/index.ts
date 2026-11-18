import type { ReportExportFormat } from "@tobacco/shared";
import { buildCsvReport } from "./csv-report";
import { fileStem } from "./format";
import { buildPdfReport } from "./pdf-report";
import type { ExportDocument, ExportFile } from "./types";
import { buildXlsxReport } from "./xlsx-report";

export * from "./types";
export { buildCsvReport, csvEscape, csvValue } from "./csv-report";
export { buildPdfReport, pdfSafe } from "./pdf-report";
export { buildXlsxReport } from "./xlsx-report";
export { DOC_TIME_ZONE, fileStem, formatCell, formatDecimal, formatDocDate, formatDocDateTime, harareParts } from "./format";

const MIME: Record<ReportExportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

/** Build the requested file for a document; `stem` names it (`<stem>.<ext>`). */
export async function buildExport(doc: ExportDocument, format: ReportExportFormat, stem: string): Promise<ExportFile> {
  const data = format === "pdf" ? await buildPdfReport(doc) : format === "xlsx" ? await buildXlsxReport(doc) : buildCsvReport(doc);
  return { data, mimeType: MIME[format], filename: `${fileStem(stem) || "report"}.${format}` };
}

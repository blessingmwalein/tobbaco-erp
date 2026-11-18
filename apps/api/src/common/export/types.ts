import type { ReportAppliedFilter, ReportColumnDto, ReportRow, ReportTileDto } from "@tobacco/shared";

/** One table in a report (most reports have exactly one; "by location" style reports may have several). */
export interface ExportSection {
  /** Heading above the table (PDF) and, for multi-table documents, the sheet name. */
  title?: string;
  /** Excel sheet name (max 31 characters); defaults to the title. */
  sheetName?: string;
  columns: ReportColumnDto[];
  rows: ReportRow[];
  /** Totals row (keys match column keys); shown bold under the table / in Excel. */
  totals?: ReportRow | null;
}

/** Everything an exporter needs: the same data model feeds the PDF, the Excel workbook and the CSV. */
export interface ExportDocument {
  title: string;
  subtitle?: string;
  company: string;
  generatedAt: Date;
  generatedBy: string;
  filters: ReportAppliedFilter[];
  tiles: ReportTileDto[];
  sections: ExportSection[];
  notes?: string[];
}

export interface ExportFile {
  data: Buffer;
  filename: string;
  mimeType: string;
}

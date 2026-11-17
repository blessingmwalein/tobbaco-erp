export type ReportType = "inventory" | "purchases" | "receiving" | "dispatches" | "reconciliation";
export type ReportFormat = "json" | "pdf" | "xlsx" | "csv";
export interface ReportRowDto { [key: string]: unknown }
export interface ReportDto {
  type: ReportType;
  generatedAt: string;
  items: ReportRowDto[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReportType = "inventory" | "purchases" | "receiving" | "dispatches";
export type ReportFormat = "json" | "pdf" | "xlsx";
export interface ReportRowDto { [key: string]: unknown }
export interface ReportDto {
  type: ReportType;
  generatedAt: string;
  items: ReportRowDto[];
  total: number;
  page: number;
  pageSize: number;
}

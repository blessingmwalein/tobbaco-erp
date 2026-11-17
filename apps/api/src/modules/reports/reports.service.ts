import { Inject, Injectable } from "@nestjs/common";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";
import type { ReportDto, ReportFormat, ReportType } from "@tobacco/shared";
import type { ReportQuery } from "@tobacco/validation";
import { pageArgs } from "../../common/pagination";
import { PrismaService } from "../../database/prisma.service";

type Row = Record<string, unknown>;
const serialise = (row: Row): Row => Object.fromEntries(Object.entries(row).map(([k, v]) => [
  k, v && typeof v === "object" && "toString" in v && !(v instanceof Date) ? String(v) : v,
]));

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(organisationId: string, q: ReportQuery): Promise<ReportDto> {
    const db = this.prisma.forOrganisation(organisationId);
    const date = q.from || q.to ? { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } : undefined;
    let items: Row[]; let total: number;
    if (q.type === "inventory") {
      const where = { ...(date ? { createdAt: date } : {}) };
      const [rows, count] = await Promise.all([db.bale.findMany({ where, orderBy: { createdAt: "desc" }, ...pageArgs(q), select: { id: true, barcode: true, season: true, buyerGrade: true, massKg: true, usdValue: true, status: true, createdAt: true } }), db.bale.count({ where })]);
      items = rows as unknown as Row[]; total = count;
    } else if (q.type === "purchases") {
      const where = { ...(date ? { saleDate: date } : {}) };
      const [rows, count] = await Promise.all([db.purchase.findMany({ where, orderBy: { saleDate: "desc" }, ...pageArgs(q), select: { id: true, reference: true, saleDate: true, totalBales: true, totalMassKg: true, totalUsdValue: true, receivingStatus: true } }), db.purchase.count({ where })]);
      items = rows as unknown as Row[]; total = count;
    } else if (q.type === "receiving") {
      const where = { ...(date ? { startedAt: date } : {}) };
      const [rows, count] = await Promise.all([db.receivingSession.findMany({ where, orderBy: { startedAt: "desc" }, ...pageArgs(q), select: { id: true, reference: true, status: true, startedAt: true, confirmedAt: true, reconciliation: true } }), db.receivingSession.count({ where })]);
      items = rows as unknown as Row[]; total = count;
    } else if (q.type === "reconciliation") {
      const where = { ...(date ? { updatedAt: date } : {}) };
      const [rows, count] = await Promise.all([db.purchaseReconciliation.findMany({ where, orderBy: { updatedAt: "desc" }, ...pageArgs(q), select: { id: true, status: true, closedAt: true, updatedAt: true, purchase: { select: { reference: true, saleDate: true, totalBales: true, floorName: true } } } }), db.purchaseReconciliation.count({ where })]);
      items = rows as unknown as Row[]; total = count;
    } else {
      const where = { ...(date ? { dispatchDate: date } : {}) };
      const [rows, count] = await Promise.all([db.dispatch.findMany({ where, orderBy: { dispatchDate: "desc" }, ...pageArgs(q), select: { id: true, reference: true, dispatchDate: true, status: true, totalBales: true, totalMassKg: true, reason: true } }), db.dispatch.count({ where })]);
      items = rows as unknown as Row[]; total = count;
    }
    return { type: q.type as ReportType, generatedAt: new Date().toISOString(), items: items.map(serialise), total, page: q.page, pageSize: q.pageSize };
  }

  async export(organisationId: string, q: ReportQuery, format: Exclude<ReportFormat, "json">): Promise<{ data: Buffer; filename: string; mimeType: string }> {
    const report = await this.list(organisationId, q);
    if (format === "csv") {
      const keys = report.items.length ? Object.keys(report.items[0]) : ["message"];
      const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = [keys.join(",")];
      for (const row of report.items) lines.push(keys.map((k) => esc(row[k])).join(","));
      return { data: Buffer.from(lines.join("\n"), "utf8"), filename: `${report.type}.csv`, mimeType: "text/csv" };
    }
    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(report.type);
      const keys = report.items.length ? Object.keys(report.items[0]) : ["message"];
      sheet.columns = keys.map((key) => ({ header: key, key, width: 22 }));
      report.items.forEach((row) => sheet.addRow(row));
      const data = Buffer.from(await workbook.xlsx.writeBuffer());
      return { data, filename: `${report.type}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText(`${report.type} report`, { x: 40, y: 750, size: 16, font, color: rgb(0, 0, 0) });
    page.drawText(`Generated ${report.generatedAt} · ${report.total} records`, { x: 40, y: 730, size: 9, font });
    let y = 705;
    for (const row of report.items) {
      const text = Object.entries(row).map(([k, v]) => `${k}: ${String(v)}`).join(" | ").slice(0, 125);
      page.drawText(text, { x: 40, y, size: 7, font });
      y -= 13;
      if (y < 35) break;
    }
    return { data: Buffer.from(await pdf.save()), filename: `${report.type}.pdf`, mimeType: "application/pdf" };
  }
}

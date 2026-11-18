import ExcelJS from "exceljs";
import type { ReportCell, ReportColumnDto } from "@tobacco/shared";
import { humanizeStatus } from "@tobacco/shared";
import { DEFAULT_WEIGHT, XLSX_NUMFMT, defaultAlign, formatDocDateTime } from "./format";
import type { ExportDocument, ExportSection } from "./types";

const NAVY = "FF2E3D61";
const STRIPE = "FFF5F6FA";
const RULE = "FFD3D6E0";
const TONE_FILL = { good: "FFE3F4EA", warn: "FFFCEFD6", bad: "FFFBE3E3", neutral: "FFEEF0F6" } as const;
const FORBIDDEN_SHEET_CHARS = /[\\/?*[\]:]/g;
const EXCEL_DAY = 86_400_000;

const sheetName = (name: string, used: Set<string>): string => {
  let base = name.replace(FORBIDDEN_SHEET_CHARS, " ").trim().slice(0, 31) || "Data";
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${base.slice(0, 28)} ${i}`;
  used.add(candidate.toLowerCase());
  return candidate;
};

/** Excel has no time zones: store Harare wall-clock time so the sheet shows what the user saw in the portal. */
const toExcelDate = (text: string, withTime: boolean): Date | string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00Z`);
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  const shifted = new Date(d.getTime() + 2 * 3_600_000);
  return withTime ? shifted : new Date(Math.floor(shifted.getTime() / EXCEL_DAY) * EXCEL_DAY);
};

/** A typed Excel value (real numbers and dates, not text) for a raw report cell. */
function excelValue(value: ReportCell | undefined, col: ReportColumnDto): ExcelJS.CellValue {
  if (value === null || value === undefined || value === "") return null;
  switch (col.format) {
    case "int":
    case "mass":
    case "money":
    case "percent": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : String(value);
    }
    case "date":
      return toExcelDate(String(value), false);
    case "datetime":
      return toExcelDate(String(value), true);
    case "status":
      return humanizeStatus(String(value));
    default:
      return typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  }
}

function numFmt(col: ReportColumnDto): string | undefined {
  switch (col.format) {
    case "int":
    case "mass":
    case "money":
    case "percent":
    case "date":
    case "datetime":
      return XLSX_NUMFMT[col.format];
    default:
      return undefined;
  }
}

function addSummarySheet(workbook: ExcelJS.Workbook, doc: ExportDocument, used: Set<string>) {
  const sheet = workbook.addWorksheet(sheetName("Summary", used), { properties: { tabColor: { argb: NAVY } } });
  sheet.columns = [{ width: 30 }, { width: 44 }, { width: 44 }];
  sheet.getCell("A1").value = doc.title;
  sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: NAVY } };
  let r = 2;
  if (doc.subtitle) {
    sheet.getCell(`A${r}`).value = doc.subtitle;
    sheet.getCell(`A${r}`).font = { italic: true, color: { argb: "FF666C70" } };
    r++;
  }
  sheet.getCell(`A${r}`).value = doc.company;
  sheet.getCell(`A${r}`).font = { bold: true };
  r++;
  sheet.getCell(`A${r}`).value = `Generated ${formatDocDateTime(doc.generatedAt)} (Harare time) by ${doc.generatedBy}`;
  sheet.getCell(`A${r}`).font = { color: { argb: "FF666C70" } };
  r += 2;

  const heading = (text: string) => {
    const cell = sheet.getCell(`A${r}`);
    cell.value = text;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    for (const c of ["A", "B", "C"]) sheet.getCell(`${c}${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    r++;
  };

  heading("Filters applied");
  if (doc.filters.length === 0) {
    sheet.getCell(`A${r}`).value = "None — all records";
    r++;
  }
  for (const f of doc.filters) {
    sheet.getCell(`A${r}`).value = f.label;
    sheet.getCell(`A${r}`).font = { bold: true };
    sheet.getCell(`B${r}`).value = f.value;
    r++;
  }
  r++;

  if (doc.tiles.length) {
    heading("Key figures");
    for (const t of doc.tiles) {
      sheet.getCell(`A${r}`).value = t.label;
      sheet.getCell(`B${r}`).value = t.value;
      sheet.getCell(`B${r}`).font = { bold: true };
      sheet.getCell(`B${r}`).alignment = { horizontal: "left" };
      if (t.detail) sheet.getCell(`C${r}`).value = t.detail;
      sheet.getCell(`C${r}`).font = { color: { argb: "FF666C70" } };
      sheet.getCell(`A${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TONE_FILL[t.tone ?? "neutral"] } };
      r++;
    }
    r++;
  }

  const rowCount = doc.sections.reduce((s, x) => s + x.rows.length, 0);
  heading("Contents");
  doc.sections.forEach((s, i) => {
    sheet.getCell(`A${r}`).value = s.title ?? (doc.sections.length === 1 ? "Data" : `Table ${i + 1}`);
    sheet.getCell(`B${r}`).value = `${s.rows.length.toLocaleString("en-US")} row${s.rows.length === 1 ? "" : "s"}`;
    r++;
  });
  sheet.getCell(`A${r}`).value = "Total rows";
  sheet.getCell(`A${r}`).font = { bold: true };
  sheet.getCell(`B${r}`).value = rowCount;
  sheet.getCell(`B${r}`).numFmt = "#,##0";
  sheet.getCell(`B${r}`).alignment = { horizontal: "left" };
  r += 2;

  for (const note of doc.notes ?? []) {
    sheet.getCell(`A${r}`).value = note;
    sheet.mergeCells(`A${r}:C${r}`);
    sheet.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
    sheet.getCell(`A${r}`).font = { italic: true, color: { argb: "FF666C70" } };
    sheet.getRow(r).height = Math.max(15, Math.ceil(note.length / 110) * 15);
    r++;
  }
}

function addDataSheet(workbook: ExcelJS.Workbook, doc: ExportDocument, section: ExportSection, index: number, used: Set<string>) {
  const title = section.title ?? (doc.sections.length === 1 ? doc.title : `Table ${index + 1}`);
  const sheet = workbook.addWorksheet(sheetName(section.sheetName ?? title, used), { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = section.columns.map((c) => ({
    key: c.key,
    header: c.header,
    width: Math.max(c.header.length + 3, Math.round(8 + 9 * (c.width ?? DEFAULT_WEIGHT[c.format]))),
  }));

  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell((cell, col) => {
    const def = section.columns[col - 1]!;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: (def.align ?? defaultAlign(def.format)) === "right" ? "right" : "left", wrapText: true };
  });

  section.rows.forEach((row, rowIndex) => {
    const excelRow = sheet.addRow(Object.fromEntries(section.columns.map((c) => [c.key, excelValue(row[c.key], c)])));
    excelRow.eachCell({ includeEmpty: true }, (cell, col) => {
      const def = section.columns[col - 1]!;
      const fmt = numFmt(def);
      if (fmt) cell.numFmt = fmt;
      cell.alignment = { vertical: "middle", horizontal: (def.align ?? defaultAlign(def.format)) === "right" ? "right" : "left" };
      if (def.format === "mono") cell.font = { name: "Consolas", size: 10 };
      if (rowIndex % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE } };
      cell.border = { bottom: { style: "hair", color: { argb: RULE } } };
    });
  });

  if (section.totals) {
    const totals = sheet.addRow(Object.fromEntries(section.columns.map((c, i) => [c.key, i === 0 && (section.totals![c.key] ?? null) === null ? "Total" : excelValue(section.totals![c.key], c)])));
    totals.eachCell({ includeEmpty: true }, (cell, col) => {
      const def = section.columns[col - 1]!;
      const fmt = numFmt(def);
      if (fmt) cell.numFmt = fmt;
      cell.font = { bold: true };
      cell.alignment = { horizontal: (def.align ?? defaultAlign(def.format)) === "right" ? "right" : "left" };
      cell.border = { top: { style: "thin", color: { argb: NAVY } }, bottom: { style: "double", color: { argb: NAVY } } };
    });
  }

  if (section.columns.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: section.columns.length } };
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  sheet.headerFooter = { oddFooter: "&L&8" + doc.company.replace(/&/g, "&&") + " · " + title.replace(/&/g, "&&") + "&R&8Page &P of &N" };
  sheet.pageSetup.printTitlesRow = "1:1";
}

/** Excel workbook: a Summary sheet (title, filters, key figures) plus one formatted, filterable sheet per table. */
export async function buildXlsxReport(doc: ExportDocument): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Tobacco ERP · Buyer Portal";
  workbook.created = doc.generatedAt;
  workbook.title = doc.title;
  const used = new Set<string>();
  addSummarySheet(workbook, doc, used);
  doc.sections.forEach((section, i) => addDataSheet(workbook, doc, section, i, used));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

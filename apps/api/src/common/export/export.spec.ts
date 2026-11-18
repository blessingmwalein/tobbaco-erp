import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import type { ReportColumnDto, ReportRow } from "@tobacco/shared";
import { buildCsvReport, buildExport, buildPdfReport, buildXlsxReport, csvEscape, csvValue, formatCell, formatDecimal, pdfSafe, type ExportDocument } from "./index";

const columns: ReportColumnDto[] = [
  { key: "barcode", header: "Barcode", format: "mono" },
  { key: "grade", header: "Grade", format: "text" },
  { key: "bales", header: "Bales", format: "int" },
  { key: "massKg", header: "Mass (kg)", format: "mass" },
  { key: "usd", header: "Value (US$)", format: "money" },
  { key: "variance", header: "Variance", format: "mass" },
  { key: "saleDate", header: "Sale date", format: "date" },
  { key: "receivedAt", header: "Received", format: "datetime" },
  { key: "status", header: "Status", format: "status" },
];

const row = (i: number, over: ReportRow = {}): ReportRow => ({
  barcode: `1110${String(i).padStart(5, "0")}A`,
  grade: "L4OMA",
  bales: 1,
  massKg: "112.0",
  usd: "302.40",
  variance: "0.0",
  saleDate: "2026-05-22",
  receivedAt: "2026-11-17T22:30:00.000Z", // 00:30 on the 18th in Harare
  status: "IN_TRANSIT",
  ...over,
});

const doc = (rows: ReportRow[], extra: Partial<ExportDocument> = {}): ExportDocument => ({
  title: "Inventory Position",
  subtitle: "One row per bale",
  company: "MOROZ TOBACCO",
  generatedAt: new Date("2026-11-17T10:00:00Z"),
  generatedBy: "Moroz Administrator",
  filters: [{ label: "Received", value: "1 Nov 2026 – 17 Nov 2026" }],
  tiles: [{ label: "Bales", value: "1,200", tone: "good" }, { label: "Mass (kg)", value: "134,400.0" }],
  sections: [{ columns, rows, totals: { bales: rows.length, massKg: "112.0", usd: "302.40" } }],
  ...extra,
});

describe("number and date formatting", () => {
  it("formats decimal strings exactly (no float rounding) with grouping", () => {
    expect(formatDecimal("1234567.891", 2)).toBe("1,234,567.89");
    expect(formatDecimal("0.005", 2)).toBe("0.01"); // half up
    expect(formatDecimal("2.675", 2)).toBe("2.68"); // the classic float trap: Number(2.675).toFixed(2) === "2.67"
    expect(formatDecimal("999.995", 2)).toBe("1,000.00"); // carries into the integer part
    expect(formatDecimal("-0.001", 2)).toBe("0.00"); // never "-0.00"
    expect(formatDecimal("112", 1)).toBe("112.0");
    expect(formatDecimal(3314, 0)).toBe("3,314");
  });

  it("shows instants in Harare time and bare dates as calendar dates", () => {
    expect(formatCell("2026-11-17T22:30:00.000Z", { format: "datetime" })).toBe("18 Nov 2026 00:30");
    expect(formatCell("2026-05-22", { format: "date" })).toBe("22 May 2026");
    expect(formatCell(null, { format: "mass" })).toBe("—");
    expect(formatCell("IN_TRANSIT", { format: "status" })).toBe("In transit");
  });
});

describe("CSV", () => {
  it("has a BOM, CRLF line endings, raw values and a totals row", () => {
    const text = buildCsvReport(doc([row(1), row(2)])).toString("utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).split("\r\n");
    expect(lines[0]).toBe("Barcode,Grade,Bales,Mass (kg),Value (US$),Variance,Sale date,Received,Status");
    expect(lines[1]).toBe("111000001A,L4OMA,1,112.0,302.40,0.0,2026-05-22,2026-11-18 00:30,IN_TRANSIT");
    expect(lines[3]).toBe("Total,,2,112.0,302.40,,,,"); // first column carries the label
  });

  it("quotes commas, quotes and newlines, and always quotes values with edge spaces (barcodes can end in a blank)", () => {
    expect(csvEscape('a,"b"')).toBe('"a,""b"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("111089477 ")).toBe('"111089477 "');
    expect(csvEscape("plain")).toBe("plain");
  });

  it("neutralises formula injection in text columns but leaves negative numbers alone", () => {
    expect(csvValue("=HYPERLINK(\"http://evil\")", { format: "text" })).toBe("'=HYPERLINK(\"http://evil\")");
    expect(csvValue("+1+1", { format: "mono" })).toBe("'+1+1");
    expect(csvValue("@SUM(A1)", { format: "status" })).toBe("'@SUM(A1)");
    expect(csvValue("-5.0", { format: "mass" })).toBe("-5.0"); // a variance is a number, not a formula
    expect(csvValue("-12", { format: "int" })).toBe("-12");
  });
});

describe("Excel", () => {
  it("writes a Summary sheet and a formatted data sheet with real numbers, real dates and a totals row", async () => {
    const buffer = await buildXlsxReport(doc([row(1), row(2, { variance: "-3.5", status: "MISSING" })], { notes: ["Mass variance covers weighed bales only."] }));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Summary", "Inventory Position"]);

    const summary = wb.getWorksheet("Summary")!;
    const summaryText = summary.getSheetValues().flat().filter((v) => typeof v === "string").join("|");
    expect(summaryText).toContain("MOROZ TOBACCO");
    expect(summaryText).toContain("Received");
    expect(summaryText).toContain("1 Nov 2026 – 17 Nov 2026");
    expect(summaryText).toContain("Mass variance covers weighed bales only.");

    const sheet = wb.getWorksheet("Inventory Position")!;
    expect(sheet.getRow(1).values).toEqual([undefined, "Barcode", "Grade", "Bales", "Mass (kg)", "Value (US$)", "Variance", "Sale date", "Received", "Status"]);
    const r2 = sheet.getRow(3);
    expect(r2.getCell(3).value).toBe(1); // number, not text
    expect(r2.getCell(4).value).toBe(112);
    expect(r2.getCell(4).numFmt).toBe("#,##0.0");
    expect(r2.getCell(5).numFmt).toBe("#,##0.00");
    expect(r2.getCell(6).value).toBe(-3.5);
    expect(r2.getCell(7).value).toBeInstanceOf(Date);
    expect((r2.getCell(7).value as Date).toISOString().slice(0, 10)).toBe("2026-05-22");
    expect((r2.getCell(8).value as Date).toISOString()).toBe("2026-11-18T00:30:00.000Z"); // Harare wall-clock stored as-is
    expect(r2.getCell(9).value).toBe("Missing");
    expect(sheet.getRow(4).getCell(1).value).toBe("Total");
    expect(sheet.getRow(4).getCell(3).value).toBe(2);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.autoFilter).toBeTruthy();
  });

  it("keeps a trailing-space barcode intact", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildXlsxReport(doc([row(1, { barcode: "111089477 " })]))) as unknown as ArrayBuffer);
    expect(wb.getWorksheet("Inventory Position")!.getRow(2).getCell(1).value).toBe("111089477 ");
  });

  it("gives several tables their own valid, unique sheet names", async () => {
    const wb = new ExcelJS.Workbook();
    const d = doc([], {
      sections: [
        { title: "Stock: by warehouse/bay", columns, rows: [row(1)] },
        { title: "Stock: by warehouse/bay", columns, rows: [row(2)] },
      ],
    });
    await wb.xlsx.load((await buildXlsxReport(d)) as unknown as ArrayBuffer);
    const names = wb.worksheets.map((w) => w.name);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    expect(names.every((n) => n.length <= 31 && !/[\\/?*[\]:]/.test(n))).toBe(true);
  });
});

describe("PDF", () => {
  it("paginates a long table across pages with a footer 'Page i of n' on each", async () => {
    const rows = Array.from({ length: 230 }, (_, i) => row(i + 1));
    const bytes = await buildPdfReport(doc(rows));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(6); // ~35 rows per landscape page
    const size = pdf.getPage(0).getSize();
    expect(Math.round(size.width)).toBe(842); // A4 landscape
    expect(Math.round(size.height)).toBe(595);
    expect(pdf.getTitle()).toBe("Inventory Position");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("does not throw on characters Helvetica cannot encode (ZiG, arrows, emoji, CJK)", async () => {
    const bytes = await buildPdfReport(doc([row(1, { grade: "ZiG → ≥ 5 ✓ 😀 中文", barcode: "111089477 " })], { filters: [{ label: "Floor", value: "ETHICAL ★" }] }));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(pdfSafe("ZiG → ≥ 5 ✓")).toBe("ZiG -> >= 5 ?");
    expect(pdfSafe("naïve – “quoted”")).toBe("naïve – “quoted”"); // WinAnsi characters survive
  });

  it("renders an empty table and a document with no tiles or filters", async () => {
    const bytes = await buildPdfReport(doc([], { tiles: [], filters: [], sections: [{ columns, rows: [] }] }));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe("buildExport", () => {
  it("names files from a safe stem and picks the right MIME type", async () => {
    const d = doc([row(1)]);
    const pdf = await buildExport(d, "pdf", "Inventory Position_2026-11-01_to_2026-11-17");
    expect(pdf).toMatchObject({ filename: "inventory-position_2026-11-01_to_2026-11-17.pdf", mimeType: "application/pdf" });
    expect((await buildExport(d, "xlsx", "x")).mimeType).toContain("spreadsheetml");
    expect((await buildExport(d, "csv", "../../etc/passwd")).filename).toBe("etc-passwd.csv");
  });
});

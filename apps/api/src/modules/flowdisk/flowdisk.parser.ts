import { checkBaleBarcode } from "@tobacco/shared";
import type { FlowDiskHeader, FlowDiskIssue, FlowDiskInvoiceDraft, FlowDiskParseResult, FlowDiskRow } from "@tobacco/shared";

export const FLOW_DISK_PARSER_ID = "flowdisk-v0";
export const FLOW_DISK_PARSER_VERSION = "0.1.0";

type RawRow = Omit<FlowDiskRow, "rowNumber">;

export function parseFlowDisk(filename: string, content: string): FlowDiskParseResult {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  const parsed = isCsv ? parseCsv(filename, content) : parseV(content);
  const issues: FlowDiskIssue[] = [...parsed.issues];
  const seenBarcodes = new Map<string, number>();
  const rows = parsed.rows.map((row, index) => {
    const rowNumber = row.rowNumber || index + 1;
    validateRow(row, rowNumber, issues);
    if (row.barcode) {
      const previous = seenBarcodes.get(row.barcode);
      if (previous) issues.push(issue(rowNumber, "DUPLICATE_BARCODE", "barcode", `Barcode duplicates row ${previous}`));
      else seenBarcodes.set(row.barcode, rowNumber);
    }
    return { ...row, rowNumber };
  });
  const validRows = rows.filter((row) => !issues.some((entry) => entry.rowNumber === row.rowNumber));
  return {
    parserId: FLOW_DISK_PARSER_ID,
    parserVersion: FLOW_DISK_PARSER_VERSION,
    formatVerified: false,
    header: parsed.header,
    rows,
    issues,
    totalMassKg: sum(validRows.map((row) => row.massKg)),
    totalUsdValue: sum(validRows.map((row) => row.usdValue)),
    invoiceDraft: parsed.invoiceDraft,
  };
}

function parseV(content: string): { header: FlowDiskHeader; rows: FlowDiskRow[]; issues: FlowDiskIssue[]; invoiceDraft: FlowDiskInvoiceDraft | null } {
  let header: FlowDiskHeader | null = null;
  const rows: FlowDiskRow[] = [];
  const issues: FlowDiskIssue[] = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const parts = line.split("|");
    const kind = parts[0]?.trim().toUpperCase();
    if (kind === "H" && parts.length >= 7) {
      header = {
        floorName: parts[1]!.trim(),
        buyerCode: parts[2]!.trim().toUpperCase(),
        buyerName: parts[3]!.trim(),
        saleDateFrom: parts[4]!.trim(),
        saleDateTo: parts[5]!.trim(),
        exchangeRate: parts[6]!.trim() || null,
      };
    } else if (kind === "B" && parts.length >= 9) {
      rows.push(toRow(parts.slice(1), index + 1));
    } else if (kind !== "T") {
      issues.push({ rowNumber: index + 1, kind: "INVALID_RECORD", field: null, message: `Unrecognised Flow Disk record on line ${index + 1}` });
    }
  }
  if (!header) throw new Error("Flow Disk file has no header record");
  return { header, rows, issues, invoiceDraft: null };
}

function parseCsv(filename: string, content: string): { header: FlowDiskHeader; rows: FlowDiskRow[]; issues: FlowDiskIssue[]; invoiceDraft: FlowDiskInvoiceDraft | null } {
  const metadata: Record<string, string> = {};
  const charges: FlowDiskInvoiceDraft["charges"] = [];
  const gradeSummary: FlowDiskInvoiceDraft["gradeSummary"] = [];
  const dataLines = content.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("#")) {
      const separator = trimmed.indexOf(":");
      if (separator > 1) {
        const key = trimmed.slice(1, separator).trim().toLowerCase();
        const value = trimmed.slice(separator + 1).trim();
        metadata[key] = value;
        if (key === "charge") {
          const [status, code, label, amountUsd, amountZig] = value.split("|");
          if (status && code && label && amountUsd && amountZig) charges.push({ status, code, label, amountUsd, amountZig, sortOrder: charges.length });
        }
        if (key === "grade summary") {
          const [grade, bales, massKg, avgUsc, usdValue] = value.split("|");
          if (grade && bales && massKg && avgUsc && usdValue) gradeSummary.push({ grade, bales: Number(bales), massKg, avgUsc, usdValue });
        }
      }
      return false;
    }
    return true;
  });
  const filenameMatch = filename.match(/([A-Z0-9-]+)[_-](\d{4})(\d{2})(\d{2})/i);
  const inferredDate = filenameMatch ? `${filenameMatch[2]}-${filenameMatch[3]}-${filenameMatch[4]}` : "";
  const inferredBuyer = filenameMatch?.[1]?.toUpperCase() ?? "UNKNOWN";
  const records = dataLines.map(parseCsvLine);
  const fields = records.shift()?.map((field) => field.trim().toLowerCase()) ?? [];
  const index = (name: string) => fields.indexOf(name.toLowerCase());
  const required = ["buyergrade", "growernr", "lotnr", "mass", "usckg", "usdvalue", "barcode", "timbgrade"];
  const missing = required.filter((name) => index(name) < 0);
  if (missing.length) throw new Error(`Flow Disk CSV is missing columns: ${missing.join(", ")}`);
  const rows = records.map((record, rowIndex) => ({
    rowNumber: rowIndex + 2,
    buyerGrade: record[index("buyergrade")]?.trim() ?? "",
    growerNo: record[index("growernr")]?.trim() ?? "",
    lotNo: record[index("lotnr")]?.trim() ?? "",
    massKg: record[index("mass")]?.trim() ?? "",
    uscPerKg: record[index("usckg")]?.trim() ?? "",
    usdValue: record[index("usdvalue")]?.trim() ?? "",
    barcode: record[index("barcode")] ?? "",
    timbGrade: record[index("timbgrade")]?.trim() || null,
  }));
  const first = rows[0];
  if (!first) throw new Error("Flow Disk CSV has no data rows");
  return {
    header: {
      floorName: metadata.floor?.trim() || "Unknown",
      buyerCode: metadata.buyer?.match(/-\s*([A-Z0-9-]+)$/i)?.[1]?.toUpperCase() || inferredBuyer,
      buyerName: metadata.buyer?.replace(/\s*-\s*[A-Z0-9-]+$/i, "").trim() || metadata.buyer || "Unknown",
      saleDateFrom: metadata.from || inferredDate,
      saleDateTo: metadata.to || inferredDate,
      exchangeRate: metadata["exchange rate"] || null,
    },
    rows,
    issues: [],
    invoiceDraft: charges.length || gradeSummary.length || metadata["payable usd"] || metadata["payable zig"] ? {
      preparedBy: metadata["prepared by"] || null,
      totalZigValue: metadata["tobacco value zig"] || null,
      payableUsd: metadata["payable usd"] || null,
      payableZig: metadata["payable zig"] || null,
      charges,
      gradeSummary,
    } : null,
  };
}

function toRow(parts: string[], rowNumber: number): FlowDiskRow {
  return {
    rowNumber,
    buyerGrade: parts[0]?.trim() ?? "",
    growerNo: parts[1]?.trim() ?? "",
    lotNo: parts[2]?.trim() ?? "",
    massKg: parts[3]?.trim() ?? "",
    uscPerKg: parts[4]?.trim() ?? "",
    usdValue: parts[5]?.trim() ?? "",
    barcode: parts[6] ?? "",
    timbGrade: parts[7]?.trim() || null,
  };
}

function validateRow(row: RawRow, rowNumber: number, issues: FlowDiskIssue[]): void {
  if (!row.barcode) issues.push(issue(rowNumber, "MISSING_BARCODE", "barcode", "Barcode is required"));
  else if (!checkBaleBarcode(row.barcode).valid) issues.push(issue(rowNumber, "INVALID_BARCODE_CHECK", "barcode", "Barcode failed the Code 39 check character"));
  if (!row.growerNo) issues.push(issue(rowNumber, "MISSING_GROWER", "growerNo", "Grower number is required"));
  if (!row.lotNo) issues.push(issue(rowNumber, "MISSING_LOT", "lotNo", "Lot number is required"));
  if (!positive(row.massKg)) issues.push(issue(rowNumber, "INVALID_MASS", "massKg", "Mass must be greater than zero"));
  if (!positive(row.usdValue)) issues.push(issue(rowNumber, "INVALID_VALUE", "usdValue", "USD value must be greater than zero"));
  if (positive(row.massKg) && positive(row.uscPerKg) && positive(row.usdValue)) {
    const expected = Number(row.massKg) * Number(row.uscPerKg) / 100;
    if (Math.abs(expected - Number(row.usdValue)) > 0.02) issues.push(issue(rowNumber, "VALUE_MISMATCH", "usdValue", `USD value does not match mass × USc/kg ÷ 100 (${expected.toFixed(2)})`));
  }
}

function issue(rowNumber: number, kind: FlowDiskIssue["kind"], field: string, message: string): FlowDiskIssue {
  return { rowNumber, kind, field, message };
}

function positive(value: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0;
}

function sum(values: string[]): string {
  return values.reduce((total, value) => total + Number(value), 0).toFixed(2);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += char;
  }
  cells.push(cell);
  return cells;
}

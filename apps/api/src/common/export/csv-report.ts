import type { ReportCell, ReportColumnDto } from "@tobacco/shared";
import { harareParts } from "./format";
import type { ExportDocument } from "./types";

/** Strings that a spreadsheet would execute as a formula when the file is opened (CSV/formula injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** The one CSV escaper: quote when needed, and ALWAYS quote values with leading/trailing spaces (barcodes may end in a blank). */
export function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Raw (unformatted) text for a CSV cell: decimals as given, dates as yyyy-mm-dd, date-times as "yyyy-mm-dd HH:mm" (Harare). */
export function csvValue(value: ReportCell | undefined, col: Pick<ReportColumnDto, "format">): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
  switch (col.format) {
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : harareParts(new Date(text)).day;
    case "datetime": {
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      const p = harareParts(new Date(text));
      return `${p.day} ${p.time}`;
    }
    case "int":
    case "mass":
    case "money":
    case "percent":
      return text; // numbers are never prefixed: a negative variance must stay a number
    default:
      // text / mono / status: neutralise anything a spreadsheet would run as a formula
      return FORMULA_START.test(text) ? `'${text}` : text;
  }
}

/**
 * Plain CSV: UTF-8 with BOM (Excel then reads accents correctly), CRLF line endings, a header row and raw values.
 * A document with several tables writes each under a title row, separated by a blank line.
 */
export function buildCsvReport(doc: ExportDocument): Buffer {
  const out: string[] = [];
  doc.sections.forEach((section, index) => {
    if (index > 0) out.push("");
    if (doc.sections.length > 1 && section.title) out.push(csvEscape(section.title));
    out.push(section.columns.map((c) => csvEscape(c.header)).join(","));
    for (const row of section.rows) out.push(section.columns.map((c) => csvEscape(csvValue(row[c.key], c))).join(","));
    if (section.totals) {
      out.push(
        section.columns
          .map((c, i) => csvEscape(i === 0 && (section.totals![c.key] === undefined || section.totals![c.key] === null) ? "Total" : csvValue(section.totals![c.key], c)))
          .join(","),
      );
    }
  });
  return Buffer.concat([Buffer.from("﻿", "utf8"), Buffer.from(out.join("\r\n") + "\r\n", "utf8")]);
}

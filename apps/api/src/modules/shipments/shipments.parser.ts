import { checkBaleBarcode } from "@tobacco/shared";

export type DispatchManifestRow = { rowNumber: number; barcode: string; massKg: string };
export type DispatchManifestIssue = { rowNumber: number; field: string; message: string };

export function parseDispatchManifest(content: string): { rows: DispatchManifestRow[]; issues: DispatchManifestIssue[] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
  if (!lines.length) throw new Error("Dispatch file has no records");
  const header = parseLine(lines[0]!).map((value) => value.trim().toLowerCase());
  const barcodeIndex = header.findIndex((value) => ["barcode", "bale", "balebarcode"].includes(value.replace(/[\s_-]/g, "")));
  const massIndex = header.findIndex((value) => ["mass", "masskg", "weight", "weightkg"].includes(value.replace(/[\s_-]/g, "")));
  if (barcodeIndex < 0 || massIndex < 0) throw new Error("Dispatch file must contain Barcode and MassKg columns");
  const issues: DispatchManifestIssue[] = [];
  const rows = lines.slice(1).map((line, index) => {
    const values = parseLine(line);
    const rowNumber = index + 2;
    const barcode = values[barcodeIndex] ?? "";
    const massKg = values[massIndex] ?? "";
    if (!barcode) issues.push({ rowNumber, field: "barcode", message: "Barcode is required" });
    else if (!checkBaleBarcode(barcode).valid) issues.push({ rowNumber, field: "barcode", message: "Barcode failed the Code 39 check character" });
    if (!/^\d+(?:\.\d+)?$/.test(massKg) || Number(massKg) <= 0) issues.push({ rowNumber, field: "massKg", message: "Mass must be greater than zero" });
    return { rowNumber, barcode, massKg };
  });
  return { rows, issues };
}

function parseLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

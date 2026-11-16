import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MZ_20260522_BALES, MZ_20260522_INVOICE } from "@tobacco/shared/fixtures";

const outputDir = join(process.cwd(), "samples", "flowdisk");

function vFile(): string {
  const header = [
    "H",
    MZ_20260522_INVOICE.floorName,
    MZ_20260522_INVOICE.buyerCode,
    MZ_20260522_INVOICE.buyerName,
    MZ_20260522_INVOICE.saleDateFrom,
    MZ_20260522_INVOICE.saleDateTo,
    MZ_20260522_INVOICE.exchangeRate,
  ].join("|");
  const rows = MZ_20260522_BALES.map((bale) =>
    ["B", bale.buyerGrade, bale.growerNo, bale.lotNo, bale.mass.toFixed(1), bale.uscPerKg.toFixed(2), bale.usdValue, bale.barcode, bale.timbGrade].join("|"),
  );
  const total = ["T", MZ_20260522_INVOICE.totals.bales, MZ_20260522_INVOICE.totals.massKg.toFixed(1), MZ_20260522_INVOICE.totals.usdValue].join("|");
  return [header, ...rows, total].join("\n") + "\n";
}

function csvFile(): string {
  const header = "BuyerGrade,GrowerNr,LotNr,Mass,UscKg,UsdValue,Barcode,TimbGrade";
  const rows = MZ_20260522_BALES.map((bale) =>
    [bale.buyerGrade, bale.growerNo, bale.lotNo, bale.mass.toFixed(1), bale.uscPerKg.toFixed(2), bale.usdValue, csv(bale.barcode), bale.timbGrade].join(","),
  );
  const metadata = [
    `# Floor: ${MZ_20260522_INVOICE.floorName}`,
    `# Buyer: ${MZ_20260522_INVOICE.buyerName} - ${MZ_20260522_INVOICE.buyerCode}`,
    `# From: ${MZ_20260522_INVOICE.saleDateFrom}`,
    `# To: ${MZ_20260522_INVOICE.saleDateTo}`,
    `# Exchange Rate: ${MZ_20260522_INVOICE.exchangeRate}`,
    `# Prepared By: ${MZ_20260522_INVOICE.preparedBy}`,
    `# Tobacco Value ZiG: ${MZ_20260522_INVOICE.tobaccoValueTotal.zig}`,
    `# Payable USD: ${MZ_20260522_INVOICE.payableTotal.usd}`,
    `# Payable ZiG: ${MZ_20260522_INVOICE.payableTotal.zig}`,
    ...MZ_20260522_INVOICE.charges.map((charge) => `# Charge: ${charge.status}|${charge.code}|${charge.label}|${charge.usd}|${charge.zig}`),
    ...MZ_20260522_INVOICE.gradeSummary.map((summary) => `# Grade Summary: ${summary.grade}|${summary.bales}|${summary.massKg}.0|${summary.avgUscPerKg}.00|${summary.usdValue}`),
  ];
  return [...metadata, header, ...rows].join("\n") + "\n";
}

function csv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "MZ_20260522.V"), vFile(), "utf8");
  await writeFile(join(outputDir, "MZ_20260522.csv"), csvFile(), "utf8");
  console.log(`Wrote ${MZ_20260522_BALES.length} bales to ${outputDir}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

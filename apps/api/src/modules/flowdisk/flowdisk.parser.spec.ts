import { buildTicketBarcode } from "@tobacco/shared";
import { parseFlowDisk } from "./flowdisk.parser";

describe("parseFlowDisk", () => {
  const barcode = buildTicketBarcode(111000001);

  it("parses the v0 pipe-delimited format and preserves a blank check character", () => {
    const blankBarcode = buildTicketBarcode(111000002);
    const result = parseFlowDisk(
      "MZ_20260522.V",
      [
        "H|ETHICAL SALES FLOOR|MZ|MOROZ TOBACCO|2026-05-22|2026-05-22|26.3216",
        `B|L4OMA|349376|0057|112.0|270.00|302.40|${barcode}|L4OK`,
        `B|L4OMA|349376|0058|100.0|250.00|250.00|${blankBarcode}|L4OK`,
        "T|2|212.0|552.40",
      ].join("\n"),
    );

    expect(result.header.buyerCode).toBe("MZ");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.barcode).toBe(barcode);
    expect(result.issues).toEqual([]);
    expect(result.totalMassKg).toBe("212.00");
    expect(result.totalUsdValue).toBe("552.40");
  });

  it("parses CSV with quoted fields and reports row-level validation issues", () => {
    const result = parseFlowDisk(
      "manifest.csv",
      [
        "BuyerGrade,GrowerNr,LotNr,Mass,UscKg,UsdValue,Barcode,TimbGrade",
        `L4OMA,349376,0057,112.0,270.00,302.40,${barcode},L4OK`,
        'L4OMA,349376,0058,100.0,250.00,999.00,"bad,barcode",L4OK',
      ].join("\n"),
    );

    expect(result.rows).toHaveLength(2);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rowNumber: 3, kind: "INVALID_BARCODE_CHECK" }),
      expect.objectContaining({ rowNumber: 3, kind: "VALUE_MISMATCH" }),
    ]));
    expect(result.totalMassKg).toBe("112.00");
  });

  it("parses invoice charges and grade summaries from CSV metadata", () => {
    const result = parseFlowDisk(
      "MZ_20260522.csv",
      [
        "# Charge: A|TOBACCO_VALUE|TOBACCO VALUE|7396.77|194694.82",
        "# Grade Summary: L4OMA|42|3242.0|224.00|7263.57",
        "# Payable USD: 5189.34",
        "# Payable ZiG: 62195.41",
        "BuyerGrade,GrowerNr,LotNr,Mass,UscKg,UsdValue,Barcode,TimbGrade",
        `L4OMA,349376,0057,112.0,270.00,302.40,${barcode},L4OK`,
      ].join("\n"),
    );

    expect(result.invoiceDraft).toEqual(expect.objectContaining({
      payableUsd: "5189.34",
      payableZig: "62195.41",
      charges: [expect.objectContaining({ code: "TOBACCO_VALUE", amountZig: "194694.82" })],
      gradeSummary: [expect.objectContaining({ grade: "L4OMA", bales: 42 })],
    }));
  });

  it("rejects a file with no header record", () => {
    expect(() => parseFlowDisk("bad.V", `B|L4OMA|349376|0057|112|270|302.4|${barcode}|L4OK`)).toThrow("no header");
  });
});

/**
 * The 43 bales of the real sample buyer invoice (ETHICAL LEAF TOBACCO — ETHICAL SALES FLOOR, buyer MOROZ TOBACCO - MZ,
 * sale date 22 May 2026), extracted from rptDetailBuyerInvocie22.pdf by column position and verified:
 * value = mass × USc/kg ÷ 100 on every row; totals 3,314 kg / US$7,396.77; barcodes pass Code 39 mod-43 (43/43).
 * REAL BUSINESS DATA — do not publish. Barcodes are exactly 10 characters: 9 digits + check character,
 * and the check character can be a SPACE (two bales) — never trim these strings.
 */
export interface InvoiceBaleRow {
  buyerGrade: string;
  growerNo: string;
  lotNo: string;
  mass: number;
  uscPerKg: number;
  usdValue: string;
  barcode: string;
  timbGrade: string;
}

export const MZ_20260522_BALES: InvoiceBaleRow[] = [
  { buyerGrade: "L4OMA", growerNo: "349376", lotNo: "0057", mass: 112, uscPerKg: 270, usdValue: "302.40", barcode: "111000937M", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "304439", lotNo: "0014", mass: 62, uscPerKg: 170, usdValue: "105.40", barcode: "111000978R", timbGrade: "T3OKA" },
  { buyerGrade: "L4OMA", growerNo: "475614", lotNo: "0052", mass: 98, uscPerKg: 220, usdValue: "215.60", barcode: "111000999U", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "414228", lotNo: "0049", mass: 107, uscPerKg: 255, usdValue: "272.85", barcode: "111001036D", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "188394", lotNo: "0042", mass: 80, uscPerKg: 250, usdValue: "200.00", barcode: "1110010419", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "346062", lotNo: "0001", mass: 99, uscPerKg: 250, usdValue: "247.50", barcode: "111001046E", timbGrade: "L4OA" },
  { buyerGrade: "L4OMA", growerNo: "346062", lotNo: "0002", mass: 76, uscPerKg: 251, usdValue: "190.76", barcode: "111001047F", timbGrade: "X3OA" },
  { buyerGrade: "L4OMA", growerNo: "408723", lotNo: "0046", mass: 84, uscPerKg: 220, usdValue: "184.80", barcode: "111001061B", timbGrade: "L3OA" },
  { buyerGrade: "L4OMA", growerNo: "109347", lotNo: "0103", mass: 74, uscPerKg: 260, usdValue: "192.40", barcode: "111001071C", timbGrade: "L3OKA" },
  { buyerGrade: "L4OMA", growerNo: "408070", lotNo: "0002", mass: 91, uscPerKg: 185, usdValue: "168.35", barcode: "111001106B", timbGrade: "X3OA" },
  { buyerGrade: "L4OMA", growerNo: "408070", lotNo: "0003", mass: 97, uscPerKg: 245, usdValue: "237.65", barcode: "111001107C", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "408070", lotNo: "0017", mass: 70, uscPerKg: 230, usdValue: "161.00", barcode: "1110011207", timbGrade: "L3OKA" },
  { buyerGrade: "L4OMA", growerNo: "408070", lotNo: "0018", mass: 36, uscPerKg: 238, usdValue: "85.68", barcode: "1110011218", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "408070", lotNo: "0027", mass: 50, uscPerKg: 255, usdValue: "127.50", barcode: "1110011308", timbGrade: "L4OA" },
  { buyerGrade: "L4OMA", growerNo: "302209", lotNo: "0005", mass: 62, uscPerKg: 245, usdValue: "151.90", barcode: "111001377L", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "302209", lotNo: "0007", mass: 65, uscPerKg: 249, usdValue: "161.85", barcode: "111001379N", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "304048", lotNo: "0003", mass: 42, uscPerKg: 206, usdValue: "86.52", barcode: "111001402A", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "303873", lotNo: "0005", mass: 116, uscPerKg: 205, usdValue: "237.80", barcode: "111001419I", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "276106", lotNo: "0008", mass: 110, uscPerKg: 193, usdValue: "212.30", barcode: "111001435G", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "395144", lotNo: "0062", mass: 112, uscPerKg: 190, usdValue: "212.80", barcode: "111001453G", timbGrade: "SD" },
  { buyerGrade: "L4OMA", growerNo: "290689", lotNo: "0008", mass: 80, uscPerKg: 125, usdValue: "100.00", barcode: "111001456J", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "276607", lotNo: "0003", mass: 70, uscPerKg: 195, usdValue: "136.50", barcode: "111079985+", timbGrade: "L4RK" },
  { buyerGrade: "L4OMA", growerNo: "405079", lotNo: "0033", mass: 92, uscPerKg: 180, usdValue: "165.60", barcode: "111089337X", timbGrade: "L4OFA" },
  { buyerGrade: "L4OMA", growerNo: "398887", lotNo: "0036", mass: 83, uscPerKg: 235, usdValue: "195.05", barcode: "111089477 ", timbGrade: "L4OA" },
  { buyerGrade: "L4OMA", growerNo: "332201", lotNo: "0011", mass: 78, uscPerKg: 185, usdValue: "144.30", barcode: "111089528Z", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "365634", lotNo: "0013", mass: 107, uscPerKg: 261, usdValue: "279.27", barcode: "111089559$", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "345814", lotNo: "0002", mass: 72, uscPerKg: 185, usdValue: "133.20", barcode: "111089683.", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "395144", lotNo: "0030", mass: 104, uscPerKg: 260, usdValue: "270.40", barcode: "111089694$", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "395144", lotNo: "0031", mass: 69, uscPerKg: 271, usdValue: "186.99", barcode: "111089695/", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "358097", lotNo: "0027", mass: 48, uscPerKg: 110, usdValue: "52.80", barcode: "111089735Z", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "358097", lotNo: "0039", mass: 96, uscPerKg: 264, usdValue: "253.44", barcode: "111089747 ", timbGrade: "L4OKV" },
  { buyerGrade: "L4OMA", growerNo: "232316A", lotNo: "0007", mass: 72, uscPerKg: 240, usdValue: "172.80", barcode: "1110898780", timbGrade: "T3OA" },
  { buyerGrade: "L4OMA", growerNo: "215819", lotNo: "0003", mass: 72, uscPerKg: 230, usdValue: "165.60", barcode: "111090017K", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "215819", lotNo: "0005", mass: 116, uscPerKg: 242, usdValue: "280.72", barcode: "111090020E", timbGrade: "L4OA" },
  { buyerGrade: "L4OMA", growerNo: "215819", lotNo: "0010", mass: 106, uscPerKg: 261, usdValue: "276.66", barcode: "111090024I", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "215819", lotNo: "0012", mass: 42, uscPerKg: 260, usdValue: "109.20", barcode: "111090026K", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "301324", lotNo: "0200", mass: 74, uscPerKg: 200, usdValue: "148.00", barcode: "111090098T", timbGrade: "X4OA" },
  { buyerGrade: "L4OMA", growerNo: "301324", lotNo: "0204", mass: 50, uscPerKg: 245, usdValue: "122.50", barcode: "111090102F", timbGrade: "T3OKA" },
  { buyerGrade: "L4OMA", growerNo: "408109", lotNo: "0008", mass: 34, uscPerKg: 130, usdValue: "44.20", barcode: "111090333L", timbGrade: "L4OK" },
  { buyerGrade: "L4OMA", growerNo: "221723", lotNo: "0206", mass: 32, uscPerKg: 244, usdValue: "78.08", barcode: "111090344N", timbGrade: "L4OFA" },
  { buyerGrade: "L4OMA", growerNo: "333726", lotNo: "0002", mass: 42, uscPerKg: 210, usdValue: "88.20", barcode: "111090389W", timbGrade: "L4OKA" },
  { buyerGrade: "L4OMA", growerNo: "331232", lotNo: "0007", mass: 60, uscPerKg: 175, usdValue: "105.00", barcode: "111090484S", timbGrade: "T3OKA" },
  { buyerGrade: "L4R", growerNo: "413258", lotNo: "0114", mass: 72, uscPerKg: 185, usdValue: "133.20", barcode: "111085065R", timbGrade: "L3OKA" },
];

/** Invoice-level facts printed on the sample (page 1 header/summary, page 2 charges). Amounts as printed. */
export const MZ_20260522_INVOICE = {
  company: "ETHICAL LEAF TOBACCO",
  floorName: "ETHICAL SALES FLOOR",
  buyerCode: "MZ",
  buyerName: "MOROZ TOBACCO",
  saleDateFrom: "2026-05-22",
  saleDateTo: "2026-05-22",
  /** The printed document carries NO invoice number; a reference is generated at import. */
  invoiceNumber: null as string | null,
  generatedReference: "BINV-MZ-20260522",
  exchangeRate: "26.3216",
  preparedBy: "PLuya",
  printedAt: "2026-05-22T20:39:29",
  pages: 2,
  totals: { bales: 43, massKg: 3314, avgUscPerKg: 223, usdValue: "7396.77" },
  gradeSummary: [
    { grade: "L4OMA", bales: 42, massKg: 3242, avgUscPerKg: 224, usdValue: "7263.57" },
    { grade: "L4R", bales: 1, massKg: 72, avgUscPerKg: 185, usdValue: "133.20" },
  ],
  charges: [
    { status: "A", code: "TOBACCO_VALUE", label: "TOBACCO VALUE", usd: "7396.77", zig: "194694.82" },
    { status: "B", code: "CURRENCY_SPLIT", label: "USD \ ZiG Split", usd: "5177.74", zig: "58408.45" },
    { status: "B", code: "BUYER_GOVERNMENT_LEVY", label: "BUYER GOVERNMENT LEVY", usd: "0.00", zig: "2920.43" },
    { status: "B", code: "TTA_LEVY", label: "TTA LEVY", usd: "11.60", zig: "130.84" },
    { status: "B", code: "FLOOR_CLEARING", label: "FLOOR CLEARING", usd: "0.00", zig: "735.69" },
  ],
  /** Totals printed under each block. */
  tobaccoValueTotal: { usd: "7396.77", zig: "194694.82" },
  payableTotal: { usd: "5189.34", zig: "62195.41" },
} as const;

import { describe, expect, it } from "vitest";
import { ts } from "@tobacco/shared/fixtures";
import { Decimal } from "@tobacco/shared";
import { ctxFor, dbAt } from "../testing";
import {
  BANK_CSV_COLUMNS,
  generatePaymentSchedule,
  payWithCloudPayMock,
  recordCsvDownload,
  recordPaymentConfirmation,
  recordPaymentFailure,
  scheduleCsv,
  selectSalesSheets,
} from "./payments";

const base = { invoicesDate: "2026-09-17", sellingPointId: "EL", batchNo: 1001, currency: "USD" };

describe("generatePaymentSchedule", () => {
  it("creates a USD schedule for pay batch 1001 with both growers and the 13 documented CSV columns", () => {
    const db = dbAt("PROCESSED");
    const { schedules, excluded } = generatePaymentSchedule(ctxFor(db, "accounts"), base);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({ ref: "PSCH-1001-USD", payBatchNo: 1001, currency: "USD", status: "GENERATED" });
    expect(excluded).toEqual([]);

    const lines = db.paymentLines.filter((l) => l.scheduleId === "psch-1001-usd");
    expect(lines.map((l) => [l.growerNo, l.amountCents, l.status])).toEqual([
      ["V100060", 49943, "PENDING"],
      ["V100061", 34264, "PENDING"],
    ]);

    const csv = scheduleCsv(db, "psch-1001-usd");
    expect(csv.headers).toEqual([...BANK_CSV_COLUMNS]);
    expect(csv.headers).toEqual([
      "Transaction_Type", "Beneficiary", "Currency", "Credit_Account", "transaction_date", "Amount", "Debit_Account",
      "Company_Name", "Batch_Reference", "Transaction_Id", "Bank_Code", "Bank", "Branch_Code",
    ]);
    expect(csv.rows).toHaveLength(2);
    expect(csv.rows[0]).toEqual([
      "CREDIT", "Chengetai Chingoma", "USD", "4100060001", "2026-09-17", "499.43", "DEMO-DEBIT-0001",
      "Ethical Sales Floor (demo)", "1001", "1001-USD-1", "DBA", "Demo Bank A", "001",
    ]);
    expect(db.paymentTransactions.filter((t) => t.scheduleId === "psch-1001-usd").map((t) => t.kind)).toEqual(["SCHEDULE_GENERATED"]);
  });

  it("with batch 0 schedules every unpaid processed sale on the date", () => {
    const db = dbAt("PROCESSED");
    const { schedules } = generatePaymentSchedule(ctxFor(db, "accounts"), { ...base, batchNo: 0 });
    expect(schedules.map((s) => s.payBatchNo)).toEqual([1001]);
  });

  it("leaves out growers without a bank account in that currency (ZWL: V100061 excluded)", () => {
    const db = dbAt("PROCESSED");
    const { schedules, excluded } = generatePaymentSchedule(ctxFor(db, "accounts"), { ...base, currency: "ZWL" });
    expect(excluded).toEqual([{ growerNo: "V100061", name: "Trust Gwenzi", reason: "No ZWL bank account on file", payBatchNo: 1001 }]);
    expect(schedules[0]!.excluded).toHaveLength(1);
    const lines = db.paymentLines.filter((l) => l.scheduleId === "psch-1001-zwl");
    expect(lines).toHaveLength(1);
    // Decimal conversion at the Start-of-Day rate (UQ-04: unverified).
    expect(lines[0]!.amountCents).toBe(new Decimal(49943).mul("26.68450000").toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber());
    expect(lines[0]!.currency).toBe("ZWL");
  });

  it("refuses a duplicate schedule for the same pay batch and currency", () => {
    const db = dbAt("PROCESSED");
    generatePaymentSchedule(ctxFor(db, "accounts"), base);
    expect(() => generatePaymentSchedule(ctxFor(db, "accounts"), base)).toThrow(/pay batch 1001 already exists \(PSCH-1001-USD\)/);
    expect(db.paymentSchedules.filter((s) => s.payBatchNo === 1001)).toHaveLength(1);
    // batch 0 simply has nothing left to do
    expect(() => generatePaymentSchedule(ctxFor(db, "accounts"), { ...base, batchNo: 0 })).toThrow("No unpaid records found for this date and selling point");
  });

  it("uses the documented messages in the documented order", () => {
    const db = dbAt("PROCESSED");
    const ctx = ctxFor(db, "accounts");
    expect(() => generatePaymentSchedule(ctx, { ...base, invoicesDate: "2026-09-20" })).toThrow("Cannot Find the Sale Date in Receiving Department");

    db.receivingSaleDates.push({ id: "rsd-x", sellingPointId: "EL", date: "2026-09-18", isActive: false, canScanFloorSummary: true, createdBy: "user-supervisor", createdAt: ts("2026-09-18") });
    expect(() => generatePaymentSchedule(ctx, { ...base, invoicesDate: "2026-09-18" })).toThrow("Cannot Find the Start of Date in Data Processing");

    // 11 Sep is fully paid already (demo history) → nothing unpaid
    expect(() => generatePaymentSchedule(ctx, { ...base, invoicesDate: "2026-09-11", batchNo: 0 })).toThrow("No unpaid records found for this date and selling point");
    // a wrong batch number
    expect(() => generatePaymentSchedule(ctx, { ...base, batchNo: 4242 })).toThrow("No unpaid records found");
  });

  it("does not create an empty schedule when nobody has a bank account", () => {
    const db = dbAt("PROCESSED");
    db.growerBankAccounts = [];
    expect(() => generatePaymentSchedule(ctxFor(db, "accounts"), base)).toThrow(/header row/);
    expect(db.paymentSchedules.some((s) => s.payBatchNo === 1001)).toBe(false);
  });

  it("only schedules PROCESSED sales", () => {
    const db = dbAt("BALANCED");
    expect(() => generatePaymentSchedule(ctxFor(db, "accounts"), { ...base, batchNo: 0 })).toThrow("No unpaid records found");
  });

  it("is permission-checked", () => {
    const db = dbAt("PROCESSED");
    expect(() => generatePaymentSchedule(ctxFor(db, "receiving-clerk"), base)).toThrow(/payments\.generate-schedule/);
    expect(() => generatePaymentSchedule(ctxFor(db, "data-processing-supervisor"), base)).toThrow(/payments\.generate-schedule/);
  });
});

describe("payment safeguards", () => {
  function scheduled() {
    const db = dbAt("PROCESSED");
    generatePaymentSchedule(ctxFor(db, "accounts"), base);
    return db;
  }

  it("downloading the CSV does NOT mark growers paid", () => {
    const db = scheduled();
    const out = recordCsvDownload(ctxFor(db, "accounts"), { scheduleId: "psch-1001-usd" });
    expect(out.rows).toHaveLength(2);
    expect(out.message).toBe("Downloading the CSV doesn't mark growers as paid.");
    expect(db.paymentLines.filter((l) => l.scheduleId === "psch-1001-usd").every((l) => l.status === "PENDING")).toBe(true);
    expect(db.paymentSchedules.find((s) => s.id === "psch-1001-usd")).toMatchObject({ status: "GENERATED", csvDownloads: 1 });
    expect(db.paymentTransactions.some((t) => t.kind === "CSV_DOWNLOADED" && t.scheduleId === "psch-1001-usd")).toBe(true);
    expect(db.paymentTransactions.some((t) => t.kind === "CONFIRMED" && t.scheduleId === "psch-1001-usd")).toBe(false);
  });

  it("the CloudPay MOCK submits but never marks anything paid, and says nothing was sent", () => {
    const db = scheduled();
    const out = payWithCloudPayMock(ctxFor(db, "accounts"), { scheduleId: "psch-1001-usd" });
    expect(out.submitted).toBe(2);
    expect(out.message).toContain("nothing was sent to any bank");
    const lines = db.paymentLines.filter((l) => l.scheduleId === "psch-1001-usd");
    expect(lines.every((l) => l.status === "SUBMITTED")).toBe(true);
    expect(lines.some((l) => l.status === "PAID")).toBe(false);
    expect(db.paymentSchedules.find((s) => s.id === "psch-1001-usd")!.status).toBe("SUBMITTED");
    const tx = db.paymentTransactions.filter((t) => t.kind === "CLOUDPAY_SUBMITTED_MOCK");
    expect(tx).toHaveLength(2);
    expect(tx[0]!.note).toContain("MOCK");
  });

  it("confirmation needs a reference and the exact amount; only then is the line PAID", () => {
    const db = scheduled();
    const ctx = ctxFor(db, "accounts");
    expect(() => recordPaymentConfirmation(ctx, { lineId: "pline-1001-usd-1", reference: "", amount: "499.43" })).toThrow(/reference is required/);
    expect(() => recordPaymentConfirmation(ctx, { lineId: "pline-1001-usd-1", reference: "BANK-REF-1", amount: "499.42" })).toThrow(/does not match the scheduled amount 499.43/);
    expect(() => recordPaymentConfirmation(ctx, { lineId: "pline-1001-usd-1", reference: "BANK-REF-1", amount: "abc" })).toThrow(/decimal/);
    expect(db.paymentLines.find((l) => l.id === "pline-1001-usd-1")!.status).toBe("PENDING");

    recordPaymentConfirmation(ctx, { lineId: "pline-1001-usd-1", reference: "BANK-REF-1", amount: "499.43" });
    expect(db.paymentLines.find((l) => l.id === "pline-1001-usd-1")).toMatchObject({ status: "PAID", confirmationRef: "BANK-REF-1", confirmedBy: "user-accounts" });
    expect(db.paymentSchedules.find((s) => s.id === "psch-1001-usd")!.status).toBe("PARTIALLY_PAID");
    // payment reference is linked to the grower's sale
    expect(db.sales.find((s) => s.growerNo === "V100060" && s.payBatchNo === 1001)!.usdPaymentRef).toBe("BANK-REF-1");

    // the same reference cannot confirm another payment; a paid line cannot be confirmed twice
    expect(() => recordPaymentConfirmation(ctx, { lineId: "pline-1001-usd-2", reference: "BANK-REF-1", amount: "342.64" })).toThrow(/already been used/);
    expect(() => recordPaymentConfirmation(ctx, { lineId: "pline-1001-usd-1", reference: "BANK-REF-9", amount: "499.43" })).toThrow(/already confirmed/);

    recordPaymentConfirmation(ctx, { lineId: "pline-1001-usd-2", reference: "BANK-REF-2", amount: "342.64" });
    expect(db.paymentSchedules.find((s) => s.id === "psch-1001-usd")!.status).toBe("PAID");
    expect(db.paymentTransactions.filter((t) => t.kind === "CONFIRMED" && t.scheduleId === "psch-1001-usd")).toHaveLength(2);
  });

  it("failures are recorded as new transactions, can be retried and never touch paid lines", () => {
    const db = scheduled();
    const ctx = ctxFor(db, "accounts");
    expect(() => recordPaymentFailure(ctx, { lineId: "pline-1001-usd-2", reason: "" })).toThrow(/reason is required/);
    recordPaymentFailure(ctx, { lineId: "pline-1001-usd-2", reason: "Account closed" });
    expect(db.paymentLines.find((l) => l.id === "pline-1001-usd-2")).toMatchObject({ status: "FAILED", failureReason: "Account closed" });
    const before = db.paymentTransactions.length;
    payWithCloudPayMock(ctx, { scheduleId: "psch-1001-usd" });
    expect(db.paymentTransactions.length).toBeGreaterThan(before); // append-only
    recordPaymentConfirmation(ctx, { lineId: "pline-1001-usd-1", reference: "REF-A", amount: "499.43" });
    expect(() => recordPaymentFailure(ctx, { lineId: "pline-1001-usd-1", reason: "oops" })).toThrow(/cannot be marked failed/);
  });

  it("confirmation and export are permission-checked", () => {
    const db = scheduled();
    expect(() => recordPaymentConfirmation(ctxFor(db, "data-processing-supervisor"), { lineId: "pline-1001-usd-1", reference: "R1", amount: "499.43" })).toThrow(/payments\.confirm-payment/);
    expect(() => recordCsvDownload(ctxFor(db, "data-clerk"), { scheduleId: "psch-1001-usd" })).toThrow(/payments\.export/);
    expect(() => payWithCloudPayMock(ctxFor(db, "receiving-clerk"), { scheduleId: "psch-1001-usd" })).toThrow(/payments\.export/);
  });
});

describe("selectSalesSheets", () => {
  it("builds a per-grower sheet that reconciles gross − deductions = net", () => {
    const db = dbAt("PROCESSED");
    const sheets = selectSalesSheets(db, { saleDate: "2026-09-17", sellingPointId: "EL", refNo: 0, batchNo: 0 });
    expect(sheets.map((s) => s.sale.growerNo)).toEqual(["V100060", "V100061"]);
    const s60 = sheets[0]!;
    expect(s60.tickets.map((t) => t.barcode)).toEqual(["1000001013", "1000001024", "1000001035"]);
    expect(s60.tickets.reduce((a, t) => a + t.valueCents, 0)).toBe(s60.gross);
    expect([s60.gross, s60.deductionsCents, s60.netCents]).toEqual([62573, 12630, 49943]);
    expect(s60.paymentStatus).toBe("No payment schedule yet");
    expect(selectSalesSheets(db, { saleDate: "2026-09-17", sellingPointId: "EL", refNo: 5, batchNo: 0 })).toHaveLength(1);
    expect(selectSalesSheets(db, { saleDate: "2026-09-17", sellingPointId: "EL", refNo: 0, batchNo: 9999 })).toHaveLength(0);
  });
});

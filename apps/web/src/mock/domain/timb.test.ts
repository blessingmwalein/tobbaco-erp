import { describe, expect, it } from "vitest";
import { MESSAGES } from "@tobacco/shared";
import { SAMPLE_FILES } from "@tobacco/shared/fixtures";
import { ctxFor, dbAt } from "../testing";
import {
  IMPORT_PERMISSION,
  importTimbFile,
  previewTimbFile,
  removeGrowerBankAccount,
  saveBuyer,
  saveGrowerBankAccount,
} from "./timb";

const sample = (key: string) => {
  const s = SAMPLE_FILES.find((x) => x.key === key);
  if (!s) throw new Error(`sample ${key}`);
  return s;
};
const run = (db: ReturnType<typeof dbAt>, roleId: string, key: string, over: Partial<{ filename: string; content: string }> = {}) => {
  const s = sample(key);
  return importTimbFile(ctxFor(db, roleId), {
    type: s.importType,
    filename: over.filename ?? s.filename,
    content: over.content ?? s.content,
    sizeBytes: (over.content ?? s.content).length,
    isSample: true,
  });
};

describe("file-name rules (Manual 02 / 07)", () => {
  const db = dbAt("FRESH");
  it("rejects a renamed booking file with the verbatim key message (prefix = first 3 chars)", () => {
    const p = previewTimbFile(db, { type: "GROWER_BOOKING", filename: "bookings_for_today.txt", content: sample("booking-renamed").content });
    expect(p.prefix.ok).toBe(false);
    expect(p.prefix.message).toBe("Booking Decryption Keys for boo is missing. Check filename of file");
    expect(p.canImport).toBe(false);
  });
  it("accepts ELS… bookings and EL… stop orders; register prefixes are not documented", () => {
    expect(previewTimbFile(db, { type: "GROWER_BOOKING", filename: "ELS_ETHICAL_20260917.txt", content: sample("booking-0917").content }).prefix.ok).toBe(true);
    expect(previewTimbFile(db, { type: "STOP_ORDER", filename: "EL_stoporders_20260917.txt", content: sample("stoporders-0917").content }).prefix.ok).toBe(true);
    expect(previewTimbFile(db, { type: "STOP_ORDER", filename: "XX_stoporders_20260917.txt", content: sample("stoporders-0917").content }).prefix.message).toBe(
      "Decryption Keys for XX need to be added",
    );
    expect(previewTimbFile(db, { type: "GROWER_REGISTER", filename: "anything.txt", content: sample("growers-sample").content }).prefix.ok).toBe(true);
  });
  it("preview is pure (writes nothing)", () => {
    const before = JSON.stringify(db);
    previewTimbFile(db, { type: "GROWER_BOOKING", filename: "ELS_ETHICAL_20260917.txt", content: sample("booking-0917").content });
    expect(JSON.stringify(db)).toBe(before);
  });
});

describe("booking import (Manual 02)", () => {
  it("creates the two documented bookings and reports the verbatim result", () => {
    const db = dbAt("FRESH");
    const out = run(db, "timb-clerk", "booking-0917");
    expect(out.ok).toBe(true);
    expect(out.message).toBe("Grower Booking Import complete: 2 created, 0 updated, 0 errors.");
    expect(out.job.status).toBe("COMPLETED");
    expect(db.bookings.filter((b) => b.sellDate === "2026-09-17").map((b) => [b.bookedId, b.growerNo, b.balesBooked])).toEqual(
      expect.arrayContaining([
        ["EL2609170001", "V100060", 3],
        ["EL2609170002", "V100061", 2],
      ]),
    );
    expect(db.audit[0]!.action).toBe("timb.import-grower-booking");
    expect(db.notifications[0]!.title).toContain("Import complete");
  });

  it("is idempotent: importing the same file again updates and never duplicates", () => {
    const db = dbAt("FRESH");
    run(db, "timb-clerk", "booking-0917");
    const count = db.bookings.length;
    const again = run(db, "timb-clerk", "booking-0917");
    expect(again.message).toBe("Grower Booking Import complete: 0 created, 2 updated, 0 errors.");
    expect(db.bookings.length).toBe(count);
    const p = previewTimbFile(db, { type: "GROWER_BOOKING", filename: "ELS_ETHICAL_20260917.txt", content: sample("booking-0917").content });
    expect(p.duplicateOf?.ref).toMatch(/^IMP-/);
    expect(p.wouldCreate).toBe(0);
    expect(p.wouldUpdate).toBe(2);
  });

  it("reports row-level errors (unknown grower, bad count) and completes with errors", () => {
    const db = dbAt("FRESH");
    const out = run(db, "timb-clerk", "booking-0918-errors");
    expect(out.job.status).toBe("COMPLETED_WITH_ERRORS");
    expect(out.message).toBe("Grower Booking Import complete: 1 created, 0 updated, 2 errors.");
    expect(out.job.rowErrors.map((e) => [e.row, e.field])).toEqual([
      [2, "grower_no"],
      [3, "bales_booked"],
    ]);
    expect(out.job.rowErrors[0]!.message).toContain("Import the grower register");
    expect(db.bookings.some((b) => b.bookedId === "EL2609180001")).toBe(true);
    expect(db.bookings.some((b) => b.bookedId === "EL2609180002")).toBe(false);
  });

  it("records a FAILED job (not thrown) when the file was renamed", () => {
    const db = dbAt("FRESH");
    const before = db.bookings.length;
    const out = run(db, "timb-clerk", "booking-renamed");
    expect(out.ok).toBe(false);
    expect(out.job.status).toBe("FAILED");
    expect(out.message).toBe("Booking Decryption Keys for boo is missing. Check filename of file");
    expect(db.bookings.length).toBe(before);
    expect(db.importJobs[0]!.id).toBe(out.job.id);
  });

  it("an imported booking makes a later import of an unknown grower succeed once the register is imported", () => {
    const db = dbAt("FRESH");
    const bad = {
      filename: "ELS_ETHICAL_20260919.txt",
      content: "booking_ref,grower_no,first_name,surname,sell_date,book_date,bales_booked\nEL2609190001,V100150,Rudo,Mashingaidze,2026-09-19,2026-09-18,4\n",
    };
    expect(run(db, "timb-clerk", "booking-0917", bad).job.errorCount).toBe(1);
    run(db, "timb-clerk", "growers-sample");
    expect(run(db, "timb-clerk", "booking-0917", bad).message).toBe("Grower Booking Import complete: 1 created, 0 updated, 0 errors.");
  });
});

describe("register imports", () => {
  it("grower register upserts by grower number", () => {
    const db = dbAt("FRESH");
    const out = run(db, "timb-clerk", "growers-sample");
    expect(out.job.created).toBe(2);
    expect(out.job.updated).toBe(1);
    expect(db.growers.find((g) => g.growerNo === "V100060")!.cellphone).toBe("0771000060");
    expect(db.growers.find((g) => g.growerNo === "V100150")!.surname).toBe("Mashingaidze");
  });
  it("creditor register upserts by creditor code", () => {
    const db = dbAt("FRESH");
    const out = run(db, "timb-clerk", "creditors-sample"); // 00050 and 00061 are already registered
    expect(out.job.created).toBe(0);
    expect(out.job.updated).toBe(2);
    const added = run(db, "timb-clerk", "creditors-sample", {
      content: "creditor_code,creditor_name,cellphone\n00099,Creditor 00099,0242000099\n00050,Creditor 00050,0242000050\n",
    });
    expect(added.job.created).toBe(1);
    expect(added.job.updated).toBe(1);
    expect(db.creditors.find((c) => c.code === "00099")!.kind).toBe("TIMB_CREDITOR");
  });
  it("fails a file with a missing column", () => {
    const db = dbAt("FRESH");
    const out = importTimbFile(ctxFor(db, "timb-clerk"), { type: "CREDITOR_REGISTER", filename: "c.txt", content: "creditor_code\n00099\n", sizeBytes: 20, isSample: false });
    expect(out.ok).toBe(false);
    expect(out.message).toContain("creditor_name");
  });
});

describe("stop order import (Manual 07)", () => {
  it("creates the documented $50.00 stop order for V100060 / creditor 00050", () => {
    const db = dbAt("FRESH");
    const out = run(db, "timb-clerk", "stoporders-0917");
    expect(out.message).toBe("Stop Order import complete — 1 created, 0 updated, 0 errors.");
    const so = db.stopOrders.find((s) => s.growerNo === "V100060")!;
    expect(so.amount1Cents).toBe(5000);
    expect(so.creditorCode).toBe("00050");
    expect(so.fileDate).toBe("2026-09-17");
    expect(so.recType).toBe("06");
    expect(so.paidAmountCents).toBe(0);
  });
  it("re-import updates in place (no duplicates) and keeps the paid amount", () => {
    const db = dbAt("FRESH");
    run(db, "timb-clerk", "stoporders-0917");
    db.stopOrders[0]!.paidAmountCents = 5000;
    const out = run(db, "timb-clerk", "stoporders-0917");
    expect(out.job.updated).toBe(1);
    expect(out.job.created).toBe(0);
    expect(db.stopOrders).toHaveLength(1);
    expect(db.stopOrders[0]!.paidAmountCents).toBe(5000);
  });
  it("a later file for the same date replaces earlier UNPAID lines not in it", () => {
    const db = dbAt("FRESH");
    const two =
      "stop_order_no,grower_no,creditor_code,creditor_name,amount_1,amount_2,amount_3,priority,rec_type,percent\n" +
      "1,V100060,00050,Creditor 00050,50.00,0,0,1,06,0\n" +
      "2,V100061,00061,Creditor 00061,25.00,0,0,1,06,0\n";
    run(db, "timb-clerk", "stoporders-0917", { content: two });
    expect(db.stopOrders).toHaveLength(2);
    const p = previewTimbFile(db, { type: "STOP_ORDER", filename: "EL_stoporders_20260917.txt", content: [...two.split("\n")].slice(0, 2).join("\n") + "\n" });
    expect(p.wouldRemove).toBe(1);
    run(db, "timb-clerk", "stoporders-0917");
    expect(db.stopOrders).toHaveLength(1);
    expect(db.stopOrders[0]!.growerNo).toBe("V100060");
  });
  it("creates unknown growers and creditors automatically", () => {
    const db = dbAt("FRESH");
    const content =
      "stop_order_no,grower_no,creditor_code,creditor_name,amount_1,amount_2,amount_3,priority,rec_type,percent\n" +
      "1,V100777,00077,New Creditor,10.00,0,0,1,06,0\n";
    const p = previewTimbFile(db, { type: "STOP_ORDER", filename: "EL_stoporders_20260917.txt", content });
    expect(p.autoCreate).toEqual({ growers: 1, creditors: 1 });
    run(db, "timb-clerk", "stoporders-0917", { content });
    expect(db.growers.some((g) => g.growerNo === "V100777")).toBe(true);
    expect(db.creditors.some((c) => c.code === "00077")).toBe(true);
  });
  it("a file with no valid records is refused with the verbatim message", () => {
    const db = dbAt("FRESH");
    const out = run(db, "timb-clerk", "stoporders-0917", {
      content: "stop_order_no,grower_no,creditor_code,creditor_name,amount_1,amount_2,amount_3,priority,rec_type,percent\n",
    });
    expect(out.ok).toBe(false);
    expect(out.message).toBe("Uploaded file does not contain any valid records");
  });
  it("the date in the file name is the sale date it is linked to", () => {
    const db = dbAt("FRESH");
    run(db, "timb-clerk", "stoporders-bad");
    expect(db.stopOrders[0]!.fileDate).toBe("2026-09-16");
  });
});

describe("permissions", () => {
  it("a receiving clerk cannot import anything", () => {
    const db = dbAt("FRESH");
    for (const [type, perm] of Object.entries(IMPORT_PERMISSION)) {
      expect(() =>
        importTimbFile(ctxFor(db, "receiving-clerk"), { type: type as keyof typeof IMPORT_PERMISSION, filename: "ELS_X_20260917.txt", content: "x", sizeBytes: 1, isSample: false }),
      ).toThrow(new RegExp(perm.replace(".", "\\.")));
    }
    expect(db.importJobs).toHaveLength(1);
  });
  it("the data processing supervisor imports stop orders but not bookings", () => {
    const db = dbAt("FRESH");
    expect(run(db, "data-processing-supervisor", "stoporders-0917").ok).toBe(true);
    expect(() => run(db, "data-processing-supervisor", "booking-0917")).toThrow(/timb\.import-bookings/);
  });
});

describe("grower bank accounts", () => {
  const input = { growerNo: "V100074", currency: "USD", bankName: "Demo Bank A", bankCode: "DBA", branchCode: "002", accountNo: "4100074001", accountName: "Farai Ngapasare" };
  it("accounts can add and edit; the receiving clerk cannot", () => {
    const db = dbAt("FRESH");
    expect(() => saveGrowerBankAccount(ctxFor(db, "receiving-clerk"), input)).toThrow(/growers\.edit-bank/);
    const acc = saveGrowerBankAccount(ctxFor(db, "accounts"), input);
    expect(acc.id).toBe("bank-V100074-USD");
    const edited = saveGrowerBankAccount(ctxFor(db, "accounts"), { ...input, id: acc.id, branchCode: "009" });
    expect(edited.branchCode).toBe("009");
    expect(db.audit.map((a) => a.action)).toEqual(expect.arrayContaining(["growers.add-bank", "growers.edit-bank"]));
  });
  it("rejects a second account in the same currency and bad input", () => {
    const db = dbAt("FRESH");
    expect(() => saveGrowerBankAccount(ctxFor(db, "accounts"), { ...input, growerNo: "V100060" })).toThrow(/already has a USD bank account/);
    expect(() => saveGrowerBankAccount(ctxFor(db, "accounts"), { ...input, accountNo: "1" })).toThrow(/Account number/);
    expect(() => saveGrowerBankAccount(ctxFor(db, "accounts"), { ...input, growerNo: "V999999" })).toThrow(MESSAGES.GROWER_INVALID.text);
    expect(() => saveGrowerBankAccount(ctxFor(db, "accounts"), { ...input, currency: "EUR" })).toThrow(/Currency/);
  });
  it("removal needs a reason and is audited", () => {
    const db = dbAt("FRESH");
    expect(() => removeGrowerBankAccount(ctxFor(db, "accounts"), { id: "bank-V100061-USD", reason: "" })).toThrow(/reason/);
    removeGrowerBankAccount(ctxFor(db, "accounts"), { id: "bank-V100061-USD", reason: "Closed account" });
    expect(db.growerBankAccounts.some((a) => a.id === "bank-V100061-USD")).toBe(false);
    expect(db.audit[0]!.action).toBe("growers.remove-bank");
  });
});

describe("buyers", () => {
  it("only reference-data admins edit buyers; grades are uppercased and de-duplicated; warehouse link follows", () => {
    const db = dbAt("FRESH");
    expect(() => saveBuyer(ctxFor(db, "accounts"), { code: "JM", name: "x", grades: [] })).toThrow(/admin\.reference-data/);
    const b = saveBuyer(ctxFor(db, "system-admin"), { code: "jm", name: "Buyer JM", packingWarehouseCode: "DEMOWH2", grades: ["11of", "11OF", "12OF"] });
    expect(b.grades).toEqual(["11OF", "12OF"]);
    expect(db.warehouses.find((w) => w.code === "CURVERID")!.buyerCodes).not.toContain("JM");
    expect(db.warehouses.find((w) => w.code === "DEMOWH2")!.buyerCodes).toContain("JM");
  });
  it("creates new buyers, refuses duplicates and unknown warehouses", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    expect(saveBuyer(ctx, { code: "ZZ", name: "Buyer ZZ", grades: ["41OF"], isNew: true }).code).toBe("ZZ");
    expect(() => saveBuyer(ctx, { code: "ZZ", name: "dup", grades: [], isNew: true })).toThrow(/already exists/);
    expect(() => saveBuyer(ctx, { code: "YY", name: "n", grades: [], packingWarehouseCode: "NOPE", isNew: true })).toThrow(/not set up/);
  });
});

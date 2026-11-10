import { describe, expect, it } from "vitest";
import {
  dateFromStopOrderFilename,
  findRepeatedGroupLot,
  normaliseVehicleReg,
  upperCode,
  validateExchangeRate,
  validateGroup,
  validateImportFilename,
  validateLot,
  validatePriceCents,
  validateStartOfDayPrerequisites,
} from "./rules";
import { baleCaptureFormSchema, dispatchInitiateFormSchema, transporterNoteFormSchema } from "./schemas";

describe("lot numbers (Manual 03)", () => {
  it.each(["3", "12/3", "1/2/3"])("accepts %s", (lot) => expect(validateLot(lot).ok).toBe(true));
  it.each(["", "A1", "/3", "3/", "3//4", "1.5", "1 2"])("rejects %j with the documented message", (lot) => {
    const r = validateLot(lot);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Please enter a valid lot number");
  });
});

describe("group numbers", () => {
  it("must be a whole number of 1 or more", () => {
    expect(validateGroup(1).ok).toBe(true);
    expect(validateGroup("2").ok).toBe(true);
    expect(validateGroup(0).ok).toBe(false);
    expect(validateGroup(1.5).ok).toBe(false);
    expect(validateGroup("x").ok).toBe(false);
  });
});

describe("repeated group + lot", () => {
  it("returns the 1-based line of the first repeat", () => {
    expect(findRepeatedGroupLot([{ group: 1, lot: "1" }, { group: 1, lot: "2" }, { group: 1, lot: "3" }])).toBeNull();
    expect(findRepeatedGroupLot([{ group: 1, lot: "1" }, { group: 1, lot: "2" }, { group: 1, lot: "2" }])).toBe(3);
    expect(findRepeatedGroupLot([{ group: 1, lot: "1" }, { group: 2, lot: "1" }])).toBeNull();
  });
});

describe("Start of Day (Manual 01)", () => {
  it("needs a positive exchange rate, with the documented message", () => {
    expect(validateExchangeRate("26.6845").ok).toBe(true);
    for (const bad of ["0", "-1", "", "abc"]) {
      const r = validateExchangeRate(bad);
      expect(r.ok).toBe(false);
      expect(r.message).toBe("Exchange Rate should be bigger than ZERO!");
    }
  });
  it("is blocked by earlier Draft or Balanced sales, not by Processed or later-dated ones", () => {
    const base = { selectedDate: "2026-09-17" };
    expect(validateStartOfDayPrerequisites({ ...base, sales: [{ saleDate: "2026-09-11", status: "PROCESSED" }] }).ok).toBe(true);
    expect(validateStartOfDayPrerequisites({ ...base, sales: [{ saleDate: "2026-09-11", status: "DRAFT" }] }).ok).toBe(false);
    const balanced = validateStartOfDayPrerequisites({ ...base, sales: [{ saleDate: "2026-09-11", status: "BALANCED" }] });
    expect(balanced.message).toBe("You can not run Start of Day when there are Sales in Draft or Balanced state from Previous dates!");
    expect(validateStartOfDayPrerequisites({ ...base, sales: [{ saleDate: "2026-09-17", status: "DRAFT" }] }).ok).toBe(true);
  });
});

describe("import file names (Manuals 02 and 07)", () => {
  it("booking files must start with ELS", () => {
    expect(validateImportFilename("GROWER_BOOKING", "ELS_ETHICAL_20260917.txt").ok).toBe(true);
    const r = validateImportFilename("GROWER_BOOKING", "bookings_for_today.txt");
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Booking Decryption Keys for boo is missing. Check filename of file");
  });
  it("stop order files must start with EL and carry the sale date", () => {
    expect(validateImportFilename("STOP_ORDER", "EL_stoporders_20260917.txt").ok).toBe(true);
    expect(validateImportFilename("STOP_ORDER", "stoporders.txt").message).toBe("Decryption Keys for st need to be added");
    expect(dateFromStopOrderFilename("EL_stoporders_20260917.txt")).toBe("2026-09-17");
    expect(dateFromStopOrderFilename("EL_stoporders.txt")).toBeNull();
  });
});

describe("normalisers", () => {
  it("removes spaces from vehicle registrations and uppercases codes", () => {
    expect(normaliseVehicleReg("AEX 1234")).toBe("AEX1234");
    expect(upperCode(" jm ")).toBe("JM");
    expect(upperCode(undefined)).toBe("");
  });
  it("price is a whole number of US cents per kg", () => {
    expect(validatePriceCents("212")).toMatchObject({ ok: true, value: 212 });
    expect(validatePriceCents("2.5").ok).toBe(false);
    expect(validatePriceCents(0).ok).toBe(false);
  });
});

describe("form schemas", () => {
  it("transporter note strips spaces from the registration (documented AEX 1234 → AEX1234)", () => {
    const r = transporterNoteFormSchema.parse({ transporterName: "Tendai Moyo", idNumber: "63-123456-A-42", vehicleReg: "AEX 1234", phone: "0772123456" });
    expect(r.vehicleReg).toBe("AEX1234");
  });
  it("bale capture accepts the documented first bale and rejects bad lots", () => {
    expect(baleCaptureFormSchema.safeParse({ scaleBarcode: "2609170001", growerNo: "100060", group: "1", lot: "1" }).success).toBe(true);
    expect(baleCaptureFormSchema.safeParse({ scaleBarcode: "2609170001", growerNo: "100060", group: "0", lot: "1" }).success).toBe(false);
    expect(baleCaptureFormSchema.safeParse({ scaleBarcode: "2609170001", growerNo: "100060", group: "1", lot: "/1" }).success).toBe(false);
  });
  it("dispatch needs transport details unless 'No Transportation Details' is ticked", () => {
    const base = { warehouseCode: "CURVERID", product: "GREEN" as const };
    expect(dispatchInitiateFormSchema.safeParse({ ...base, noTransportDetails: true }).success).toBe(true);
    expect(dispatchInitiateFormSchema.safeParse({ ...base, noTransportDetails: false }).success).toBe(false);
    expect(dispatchInitiateFormSchema.safeParse({ ...base, noTransportDetails: false, transportName: "T", truckReg: "AEX1234", driver: "D" }).success).toBe(true);
  });
});

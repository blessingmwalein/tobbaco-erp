import { describe, expect, it } from "vitest";
import {
  buildTicketBarcode,
  checkTicketBarcode,
  isValidGrowerNo,
  isValidScaleBarcode,
  nextTicketBarcode,
  normaliseGrowerNo,
} from "./barcode";
import { DOCUMENTED } from "./fixtures/documented";

describe("ticket barcodes (Manual 04)", () => {
  it("builds the five documented ticket barcodes from their 9-digit bases", () => {
    expect(buildTicketBarcode(100000101)).toBe("1000001013");
    expect(buildTicketBarcode(100000102)).toBe("1000001024");
    expect(buildTicketBarcode(100000103)).toBe("1000001035");
    expect(buildTicketBarcode(100000104)).toBe("1000001046");
    expect(buildTicketBarcode(100000105)).toBe("1000001057");
  });

  it("a documented 'range' is not a bale count: 1000001013–1000001035 is 3 tickets, 1000001046–1000001057 is 2", () => {
    for (const [grower, [first, last]] of Object.entries(DOCUMENTED.ticketRanges)) {
      const a = checkTicketBarcode(first);
      const b = checkTicketBarcode(last);
      if (!a.valid || !b.valid) throw new Error("documented barcode failed validation");
      const tickets = b.base - a.base + 1;
      expect(tickets).toBe(grower === "V100060" ? 3 : 2);
      expect(Number(last) - Number(first) + 1).toBeGreaterThan(tickets);
    }
  });

  it("walks the roll: next ticket is base+1 with a fresh check character", () => {
    expect(nextTicketBarcode("1000001013")).toBe("1000001024");
    expect(nextTicketBarcode("1000001035")).toBe("1000001046");
    expect(nextTicketBarcode("1000001057")).toBe("1000001068");
  });

  it("rejects wrong length, non-digits and a wrong check character", () => {
    expect(checkTicketBarcode("100000101")).toEqual({ valid: false, reason: "LENGTH" });
    expect(checkTicketBarcode("10000010133")).toEqual({ valid: false, reason: "LENGTH" });
    expect(checkTicketBarcode("10000010A3")).toEqual({ valid: false, reason: "NOT_DIGITS" });
    expect(checkTicketBarcode("1000001014")).toEqual({ valid: false, reason: "CHECK_CHARACTER" });
    expect(checkTicketBarcode(" 1000001013 ").valid).toBe(true);
  });

  it("every ticket in the documented dataset validates", () => {
    for (const list of Object.values(DOCUMENTED.ticketBarcodes)) for (const t of list) expect(checkTicketBarcode(t).valid).toBe(true);
  });
});

describe("scale barcodes (Manual 03)", () => {
  it("accepts the documented 10-digit scale barcodes and rejects blank/short/non-numeric", () => {
    expect(isValidScaleBarcode("2609170001")).toBe(true);
    expect(isValidScaleBarcode("")).toBe(false);
    expect(isValidScaleBarcode("26091")).toBe(false);
    expect(isValidScaleBarcode("26091700AB")).toBe(false);
  });
});

describe("grower numbers", () => {
  it("normalises the digits typed after the fixed V prefix", () => {
    expect(normaliseGrowerNo("100060")).toBe("V100060");
    expect(normaliseGrowerNo(" v100061 ")).toBe("V100061");
    expect(normaliseGrowerNo("100088a")).toBe("V100088A");
  });
  it("validates the formats seen in the manuals", () => {
    expect(isValidGrowerNo("V100060")).toBe(true);
    expect(isValidGrowerNo("V100088A")).toBe(true);
    expect(isValidGrowerNo("100060")).toBe(true);
    expect(isValidGrowerNo("X1")).toBe(false);
    expect(isValidGrowerNo("")).toBe(false);
  });
});

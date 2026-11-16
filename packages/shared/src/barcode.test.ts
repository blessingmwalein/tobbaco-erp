import { describe, expect, it } from "vitest";
import { MZ_20260522_BALES } from "./fixtures/buyer-invoice-mz";
import {
  CODE39_MOD43,
  buildTicketBarcode,
  checkBaleBarcode,
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
    expect(checkTicketBarcode("10000010")).toEqual({ valid: false, reason: "LENGTH" });
    expect(checkTicketBarcode("10000010133")).toEqual({ valid: false, reason: "LENGTH" });
    expect(checkTicketBarcode("10000010A3")).toEqual({ valid: false, reason: "NOT_DIGITS" });
    expect(checkTicketBarcode("1000001014")).toEqual({ valid: false, reason: "CHECK_CHARACTER" });
    // 9 characters means "the check character is a blank" — only valid when the computed check character IS a blank
    expect(checkTicketBarcode("100000101")).toEqual({ valid: false, reason: "CHECK_CHARACTER" });
    expect(checkTicketBarcode(" 1000001013 ").valid).toBe(true);
  });

  it("every ticket in the documented dataset validates", () => {
    for (const list of Object.values(DOCUMENTED.ticketBarcodes)) for (const t of list) expect(checkTicketBarcode(t).valid).toBe(true);
  });
});

describe("Code 39 modulo-43 check character (UQ-01 resolved by the real buyer invoice)", () => {
  it("all 43 barcodes on the MOROZ invoice (22 May 2026) pass, including letters, symbols and blanks", () => {
    expect(MZ_20260522_BALES).toHaveLength(43);
    for (const b of MZ_20260522_BALES) {
      expect(b.barcode).toHaveLength(10);
      const r = checkBaleBarcode(b.barcode);
      expect(r.valid, b.barcode).toBe(true);
    }
    const checkChars = new Set(MZ_20260522_BALES.map((b) => b.barcode[9]));
    expect(checkChars.has(" ")).toBe(true); // two bales have a blank check character
    expect([...checkChars].some((c) => "+$./".includes(c!))).toBe(true); // and several have symbols
  });

  it("a blank check character must never be lost to trimming: the 9-character form is accepted only as an inferred blank", () => {
    const blank = MZ_20260522_BALES.filter((b) => b.barcode.endsWith(" "));
    expect(blank.map((b) => b.barcode)).toEqual(["111089477 ", "111089747 "]);
    for (const b of blank) {
      const trimmed = b.barcode.trimEnd();
      expect(trimmed).toHaveLength(9);
      const r = checkBaleBarcode(trimmed);
      expect(r).toMatchObject({ valid: true, inferredBlank: true, barcode: b.barcode });
    }
    // a 9-character value whose real check character is NOT blank is rejected
    expect(checkBaleBarcode("111000937")).toEqual({ valid: false, reason: "CHECK_CHARACTER" });
  });

  it("computes the documented examples", () => {
    expect(CODE39_MOD43.compute("111000937")).toBe("M"); // 22 → M
    expect(CODE39_MOD43.compute("111000978")).toBe("R"); // 27 → R
    expect(CODE39_MOD43.compute("111001041")).toBe("9"); // 9 → 9
    expect(CODE39_MOD43.compute("111089477")).toBe(" "); // 38 → blank
    expect(buildTicketBarcode(111000937)).toBe("111000937M");
  });

  it("the superseded digit-sum-mod-10 guess would have failed (evidence for the switch)", () => {
    const digitSumMod10 = MZ_20260522_BALES.filter((b) => String([...b.barcode.slice(0, 9)].reduce((a, c) => a + Number(c), 0) % 10) === b.barcode[9]);
    expect(digitSumMod10.length).toBeLessThan(10); // 4 of 43
  });

  it("rejects a corrupted barcode from the invoice", () => {
    expect(checkBaleBarcode("111000937N")).toEqual({ valid: false, reason: "CHECK_CHARACTER" });
    expect(checkBaleBarcode("11100093MM")).toEqual({ valid: false, reason: "NOT_DIGITS" });
  });

  it("the next ticket after one with a letter check character still increments the base", () => {
    expect(nextTicketBarcode("111000937M")).toBe(buildTicketBarcode(111000938));
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

import { describe, expect, it } from "vitest";
import { centsToDecimalString, convertCentsToLocal, formatLocal, formatUsd, sumCents, ticketValueCents } from "./money";
import { DOCUMENTED } from "./fixtures/documented";

describe("money (decimal-safe)", () => {
  it("values documented V100060 tickets: price (US cents/kg) × mass (kg)", () => {
    const [a, b, c] = DOCUMENTED.growers[0].bales_;
    expect(ticketValueCents(a.priceCents, a.mass)).toBe(23744);
    expect(ticketValueCents(b.priceCents, b.mass)).toBe(19404);
    expect(ticketValueCents(c.priceCents, c.mass)).toBe(19425);
    expect(sumCents([23744, 19404, 19425])).toBe(DOCUMENTED.growers[0].grossCents);
    expect(formatUsd(DOCUMENTED.growers[0].grossCents)).toBe("$625.73");
  });

  it("DEMO V100061 gross matches the fixture", () => {
    const total = sumCents(DOCUMENTED.growers[1].bales_.map((b) => ticketValueCents(b.priceCents, b.mass)));
    expect(total).toBe(DOCUMENTED.growers[1].grossCents);
  });

  it("avoids floating-point drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // JS floats
    expect(ticketValueCents(10, 0.3)).toBe(3);
    expect(centsToDecimalString(1)).toBe("0.01");
    expect(centsToDecimalString(12311)).toBe("123.11");
  });

  it("converts USD to local currency at the Start-of-Day rate with half-up rounding", () => {
    expect(convertCentsToLocal(10450, "26.68450000")).toBe("2788.53"); // matches the documented historical row
    expect(convertCentsToLocal(42720, "26.6845")).toBe("11399.62"); // matches the documented historical row (11,399.6184…)
    expect(formatLocal("11399.62", "ZWL")).toBe("ZWL 11,399.62");
  });

  it("documented deductions reconcile: $123.11 floor charges + $50.00 stop order = $173.11", () => {
    expect(DOCUMENTED.deductions.floorChargesCents + DOCUMENTED.deductions.timbStopOrderCents).toBe(DOCUMENTED.deductions.totalCents);
    expect(formatUsd(DOCUMENTED.deductions.totalCents)).toBe("$173.11");
  });
});

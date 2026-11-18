import { businessDayEnd, businessDayStart, businessDaysBetween, dateColumnRange, timestampRange, toIsoDay } from "./date-range";

describe("date ranges (Africa/Harare business days, UTC+2)", () => {
  it("a business day runs 00:00–24:00 Harare time, i.e. 22:00 UTC the day before", () => {
    expect(businessDayStart("2026-11-17").toISOString()).toBe("2026-11-16T22:00:00.000Z");
    expect(businessDayEnd("2026-11-17").toISOString()).toBe("2026-11-17T22:00:00.000Z");
  });

  it("the 'to' day is inclusive and a scan just after Harare midnight belongs to the NEXT day", () => {
    const range = timestampRange("2026-11-17", "2026-11-17")!;
    const within = (iso: string) => new Date(iso) >= range.gte! && new Date(iso) < range.lt!;
    expect(within("2026-11-17T08:00:00Z")).toBe(true); // 10:00 Harare on the 17th
    expect(within("2026-11-17T21:59:59Z")).toBe(true); // 23:59:59 Harare on the 17th
    expect(within("2026-11-17T22:00:00Z")).toBe(false); // 00:00 Harare on the 18th
    expect(within("2026-11-17T23:30:00Z")).toBe(false); // 01:30 Harare on the 18th
    expect(within("2026-11-16T21:59:59Z")).toBe(false); // still the 16th in Harare
  });

  it("supports open-ended ranges and none at all", () => {
    expect(timestampRange("2026-11-01")).toEqual({ gte: new Date("2026-10-31T22:00:00Z") });
    expect(timestampRange(undefined, "2026-11-30")).toEqual({ lt: new Date("2026-11-30T22:00:00Z") });
    expect(timestampRange(undefined, undefined)).toBeUndefined();
    expect(timestampRange("", null)).toBeUndefined();
  });

  it("rolls over month and year ends", () => {
    expect(businessDayEnd("2026-12-31").toISOString()).toBe("2026-12-31T22:00:00.000Z");
    expect(businessDayEnd("2028-02-28").toISOString()).toBe("2028-02-28T22:00:00.000Z"); // leap year: 29th follows
    expect(businessDayEnd("2028-02-29").toISOString()).toBe("2028-02-29T22:00:00.000Z");
  });

  it("date columns compare at UTC midnight and include the 'to' day", () => {
    expect(dateColumnRange("2026-11-01", "2026-11-30")).toEqual({ gte: new Date("2026-11-01T00:00:00Z"), lte: new Date("2026-11-30T00:00:00Z") });
    expect(dateColumnRange()).toBeUndefined();
  });

  it("accepts a Date produced by z.coerce.date('yyyy-mm-dd') and rejects bad input", () => {
    expect(toIsoDay(new Date("2026-11-17T00:00:00Z"))).toBe("2026-11-17");
    expect(() => toIsoDay("17/11/2026")).toThrow(RangeError);
    expect(() => toIsoDay("2026-02-31")).toThrow(/real calendar date/);
  });

  it("counts whole business days (days in transit, stock age)", () => {
    expect(businessDaysBetween(new Date("2026-11-10T08:00:00Z"), new Date("2026-11-17T20:00:00Z"))).toBe(7);
    // 23:30 UTC on the 10th is already the 11th in Harare
    expect(businessDaysBetween(new Date("2026-11-10T23:30:00Z"), new Date("2026-11-17T08:00:00Z"))).toBe(6);
    expect(businessDaysBetween(new Date("2026-11-17T08:00:00Z"), new Date("2026-11-10T08:00:00Z"))).toBe(0);
  });
});

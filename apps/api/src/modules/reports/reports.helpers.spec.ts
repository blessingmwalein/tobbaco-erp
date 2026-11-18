import { Prisma } from "@prisma/client";
import { MAX_EXPORT_ROWS } from "@tobacco/validation";
import { dbOrder, fx, humanDuration, inChunks, limits, pageOf, sortRows, sumDec } from "./reports.helpers";

describe("report helpers", () => {
  it("limits: pages map to skip/take; an export beyond the cap is refused with advice", () => {
    expect(limits({ page: 3, pageSize: 25 }, 1000)).toEqual({ skip: 50, take: 25 });
    expect(limits("all", MAX_EXPORT_ROWS)).toEqual({});
    expect(() => limits("all", MAX_EXPORT_ROWS + 1)).toThrow(/Narrow the date range/);
    try {
      limits("all", MAX_EXPORT_ROWS + 1);
    } catch (e) {
      expect((e as { code: string; getStatus: () => number }).code).toBe("EXPORT_TOO_LARGE");
      expect((e as { getStatus: () => number }).getStatus()).toBe(422);
    }
  });

  it("pageOf slices a computed result and applies the same cap to exports", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ i }));
    expect(pageOf(rows, { page: 2, pageSize: 4 })).toEqual([{ i: 4 }, { i: 5 }, { i: 6 }, { i: 7 }]);
    expect(pageOf(rows, { page: 9, pageSize: 4 })).toEqual([]);
    expect(pageOf(rows, "all")).toHaveLength(10);
    expect(() => pageOf(Array.from({ length: MAX_EXPORT_ROWS + 1 }, () => ({})), "all")).toThrow();
  });

  it("sortRows compares decimal strings numerically (not alphabetically), keeps nulls last and is stable", () => {
    const rows = [{ k: "9.5", n: "b" }, { k: "100.0", n: "a" }, { k: null, n: "z" }, { k: "100.0", n: "c" }];
    expect(sortRows(rows, { key: "k", dir: "asc" }).map((r) => r.n)).toEqual(["b", "a", "c", "z"]);
    expect(sortRows(rows, { key: "k", dir: "desc" }).map((r) => r.n)).toEqual(["a", "c", "b", "z"]);
    expect(sortRows([{ r: "ROW-10" }, { r: "ROW-2" }], { key: "r", dir: "asc" }).map((x) => x.r)).toEqual(["ROW-2", "ROW-10"]); // natural order
  });

  it("dbOrder only honours whitelisted keys and always adds a stable tiebreaker", () => {
    const map = { reference: (d: "asc" | "desc") => ({ reference: d }) };
    const fallback = { key: "reference", dir: "desc" as const };
    expect(dbOrder({ key: "reference", dir: "asc" }, map, fallback)).toEqual([{ reference: "asc" }, { id: "asc" }]);
    expect(dbOrder({ key: "id; DROP TABLE x", dir: "asc" }, map, fallback)).toEqual([{ reference: "desc" }, { id: "asc" }]);
    expect(dbOrder(undefined, map, fallback)).toEqual([{ reference: "desc" }, { id: "asc" }]);
  });

  it("decimal arithmetic stays exact (no float drift) and formats at a fixed scale", () => {
    expect(sumDec([new Prisma.Decimal("0.1"), new Prisma.Decimal("0.2"), null, undefined]).toString()).toBe("0.3");
    expect(fx(new Prisma.Decimal("2.675"), 2)).toBe("2.68");
    expect(fx(null, 1)).toBe("0.0");
  });

  it("inChunks keeps IN lists small and preserves order", async () => {
    const calls: number[] = [];
    const out = await inChunks([1, 2, 3, 4, 5], 2, async (chunk) => {
      calls.push(chunk.length);
      return chunk.map((n) => n * 10);
    });
    expect(calls).toEqual([2, 2, 1]);
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(await inChunks([], 2, async (c) => c)).toEqual([]);
  });

  it("humanDuration reads naturally", () => {
    expect(humanDuration(30_000)).toBe("1 min");
    expect(humanDuration(45 * 60_000)).toBe("45 min");
    expect(humanDuration(75 * 60_000)).toBe("1 h 15 min");
    expect(humanDuration(5 * 3_600_000)).toBe("5 h");
    expect(humanDuration(26 * 3_600_000)).toBe("1 d 2 h");
    expect(humanDuration(-5)).toBe("0 min");
  });
});

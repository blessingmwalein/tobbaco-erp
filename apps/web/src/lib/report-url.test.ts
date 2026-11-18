import { describe, expect, it } from "vitest";
import { REPORTS_BY_ID, REPORT_CATALOGUE, reportsFor, humanizeStatus, statusTone, formatCell, formatDecimal, type ReportColumnDto } from "@tobacco/shared";
import { freshState, hasActiveFilters, parseReportState, stateToParams, toFilterQuery, toPageQuery, withoutFilters } from "./report-url";

const parse = (qs: string) => parseReportState(new URLSearchParams(qs), "purchase-register");

describe("report URL state", () => {
  it("round-trips filters, paging and sort, and keeps URLs short by omitting defaults", () => {
    const state = parse("report=shipment-register&from=2026-05-01&to=2026-05-31&status=IN_TRANSIT&q=TRK%209900&page=3&size=50&sort=dispatchDate&dir=asc&diff=1");
    expect(state).toMatchObject({ report: "shipment-register", from: "2026-05-01", to: "2026-05-31", status: "IN_TRANSIT", search: "TRK 9900", page: 3, pageSize: 50, sort: "dispatchDate", dir: "asc", onlyVariances: true });
    const params = stateToParams(state, "purchase-register").toString();
    expect(parse(params)).toEqual(state);
    expect(stateToParams(freshState("purchase-register"), "purchase-register").toString()).toBe(""); // all defaults → empty URL
    expect(stateToParams({ ...freshState("stock-by-grade"), page: 1 }, "stock-by-grade").toString()).toBe("");
  });

  it("ignores junk in the URL instead of breaking", () => {
    const s = parse("from=yesterday&to=2026-13-99x&page=-4&size=7&dir=sideways&diff=yes");
    expect(s).toMatchObject({ from: undefined, to: undefined, page: 1, pageSize: 25, dir: undefined, onlyVariances: false });
  });

  it("preserves a barcode search with a trailing space (never trimmed)", () => {
    const s = parse(`q=${encodeURIComponent("111000003 ")}`);
    expect(s.search).toBe("111000003 ");
    expect(stateToParams(s, "x").get("q")).toBe("111000003 ");
  });

  it("detects and clears active filters but keeps the sort", () => {
    expect(hasActiveFilters(freshState("r"))).toBe(false);
    const s = { ...parse("floor=OTHER&diff=1&sort=usd&dir=desc&page=4"), report: "purchase-register" };
    expect(hasActiveFilters(s)).toBe(true);
    const cleared = withoutFilters(s);
    expect(hasActiveFilters(cleared)).toBe(false);
    expect(cleared).toMatchObject({ page: 1, sort: "usd", dir: "desc" });
  });

  it("sends the API only the filters the report declares", () => {
    const state = parse("from=2026-05-01&to=2026-05-31&floor=ETHICAL&grade=L4R&status=IN_TRANSIT&diff=1&warehouse=abc");
    const shipments = toFilterQuery(state, REPORTS_BY_ID["shipment-register"]);
    expect(shipments).toMatchObject({ from: "2026-05-01", to: "2026-05-31", status: "IN_TRANSIT", warehouseId: "abc" });
    expect(shipments.floor).toBeUndefined(); // the shipment register has no floor filter
    expect(shipments.grade).toBeUndefined();
    expect(shipments.onlyVariances).toBeUndefined();
    const threeWay = toFilterQuery(state, REPORTS_BY_ID["purchase-shipment-received"]);
    expect(threeWay).toMatchObject({ floor: "ETHICAL", onlyVariances: true });
    expect(toPageQuery({ ...state, page: 2, pageSize: 50 }, REPORTS_BY_ID["purchase-register"])).toMatchObject({ page: 2, pageSize: 50 });
  });
});

describe("report catalogue", () => {
  it("is internally consistent: unique ids and columns, sortable defaults, options for coded filters", () => {
    const ids = REPORT_CATALOGUE.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of REPORT_CATALOGUE) {
      const keys = r.columns.map((c) => c.key);
      expect(new Set(keys).size, `${r.id} has duplicate column keys`).toBe(keys.length);
      expect(keys.length, r.id).toBeGreaterThan(2);
      expect(keys, `${r.id} default sort column must exist`).toContain(r.defaultSort.key);
      if (r.varianceSort) expect(keys).toContain(r.varianceSort.key);
      if (r.filters.includes("status")) expect(r.statusOptions?.length, `${r.id} declares a status filter without options`).toBeGreaterThan(0);
      if (r.filters.includes("kind")) expect(r.kindOptions?.length, `${r.id} declares a kind filter without options`).toBeGreaterThan(0);
      if (r.filters.includes("dateRange")) expect(r.dateLabel, `${r.id} needs a date label`).toBeTruthy();
      expect(r.requires.length, `${r.id} must name the domain permission it needs`).toBeGreaterThan(0);
      for (const c of r.columns.filter((c) => c.sortable)) expect(keys).toContain(c.key);
      if (r.sheetName) expect(r.sheetName.length).toBeLessThanOrEqual(31);
    }
  });

  it("offers each role only the reports its permissions allow", () => {
    const viewer = new Set(["buyer.reports.view", "buyer.purchases.view", "buyer.receiving.view", "buyer.warehouse.view"]);
    const finance = new Set(["buyer.reports.view", "buyer.purchases.view", "buyer.invoices.view", "buyer.receiving.view"]);
    expect(reportsFor(viewer).map((r) => r.id)).not.toContain("invoice-charges"); // no invoices permission
    expect(reportsFor(finance).map((r) => r.id)).toContain("invoice-charges");
    expect(reportsFor(finance, "inventory")).toEqual([]); // finance cannot see warehouse data
    expect(reportsFor(new Set(["buyer.purchases.view"]))).toEqual([]); // no reports permission at all
    expect(reportsFor(viewer, "receiving").map((r) => r.id)).toEqual(["purchase-shipment-received", "shipment-register", "receiving-sessions", "bale-discrepancies"]);
  });
});

describe("report cell formatting (shared by the web table and the exports)", () => {
  const col = (format: ReportColumnDto["format"]): ReportColumnDto => ({ key: "k", header: "K", format });
  it("formats each column type", () => {
    expect(formatCell("1234567.5", col("mass"))).toBe("1,234,567.5");
    expect(formatCell("2320", col("money"))).toBe("2,320.00");
    expect(formatCell(4070, col("int"))).toBe("4,070");
    expect(formatCell("88.2", col("percent"))).toBe("88.2%");
    expect(formatCell("2026-05-22", col("date"))).toBe("22 May 2026");
    expect(formatCell("2026-11-17T22:30:00.000Z", col("datetime"))).toBe("18 Nov 2026 00:30"); // Harare time, whatever the browser's zone
    expect(formatCell(null, col("mass"))).toBe("—");
    expect(formatCell("111089477 ", col("mono"))).toBe("111089477 ");
    expect(formatDecimal("2.675", 2)).toBe("2.68");
  });
  it("maps statuses to a tone and a readable label", () => {
    expect(statusTone("IN_TRANSIT")).toBe("warning");
    expect(statusTone("ALLOCATED")).toBe("success");
    expect(statusTone("MISSING")).toBe("danger");
    expect(statusTone("SOMETHING_NEW")).toBe("neutral");
    expect(humanizeStatus("PARTIALLY_RECEIVED")).toBe("Partially received");
  });
});

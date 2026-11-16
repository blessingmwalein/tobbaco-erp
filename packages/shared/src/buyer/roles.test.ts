import { describe, expect, it } from "vitest";
import { ALL_BUYER_PERMISSIONS, BUYER_ROLES, BUYER_ROLE_IDS, buyerPermissionsFor } from "./index";

const can = (role: (typeof BUYER_ROLE_IDS)[number], perm: (typeof ALL_BUYER_PERMISSIONS)[number]) => buyerPermissionsFor([role]).has(perm);

describe("buyer roles (brief §2)", () => {
  it("defines the five roles from the brief", () => {
    expect(BUYER_ROLES.map((r) => r.name)).toEqual(["Buyer Administrator", "Warehouse Manager", "Operations Officer", "Finance Officer", "Viewer"]);
  });

  it("Buyer Administrator holds every permission", () => {
    expect(new Set(buyerPermissionsFor(["BUYER_ADMINISTRATOR"]))).toEqual(new Set(ALL_BUYER_PERMISSIONS));
  });

  it("Warehouse Manager: receive, scan, manage warehouse locations and transfers — but not dispatch or users", () => {
    for (const p of ["buyer.receiving.scan", "buyer.warehouse.manage", "buyer.warehouse.move"] as const) expect(can("WAREHOUSE_MANAGER", p)).toBe(true);
    for (const p of ["buyer.dispatch.create", "buyer.returns.receive", "buyer.users.manage"] as const) expect(can("WAREHOUSE_MANAGER", p)).toBe(false);
  });

  it("Operations Officer: dispatch and returns — but cannot run receiving sessions or manage users", () => {
    for (const p of ["buyer.dispatch.create", "buyer.returns.receive", "buyer.processing.companies"] as const) expect(can("OPERATIONS_OFFICER", p)).toBe(true);
    for (const p of ["buyer.receiving.scan", "buyer.users.manage", "buyer.flowdisk.import"] as const) expect(can("OPERATIONS_OFFICER", p)).toBe(false);
  });

  it("Finance Officer: purchases, invoices and financial summaries — but cannot touch stock", () => {
    for (const p of ["buyer.purchases.view", "buyer.invoices.view", "buyer.reports.export"] as const) expect(can("FINANCE_OFFICER", p)).toBe(true);
    for (const p of ["buyer.receiving.scan", "buyer.warehouse.move", "buyer.dispatch.create", "buyer.users.manage"] as const) expect(can("FINANCE_OFFICER", p)).toBe(false);
  });

  it("Viewer is read-only: no permission that changes anything", () => {
    const mutating = ALL_BUYER_PERMISSIONS.filter((p) => /import|scan|exceptions|correct|manage|move|companies|create|receive|export/.test(p));
    for (const p of mutating) expect(can("VIEWER", p), p).toBe(false);
    expect(can("VIEWER", "buyer.purchases.view")).toBe(true);
  });

  it("unknown role ids grant nothing; multiple roles union their permissions", () => {
    expect(buyerPermissionsFor(["NOT_A_ROLE"]).size).toBe(0);
    const both = buyerPermissionsFor(["FINANCE_OFFICER", "WAREHOUSE_MANAGER"]);
    expect(both.has("buyer.invoices.view") && both.has("buyer.receiving.scan")).toBe(true);
  });

  it("every permission key is in the buyer.* namespace (never overlaps the internal ERP permissions)", () => {
    expect(ALL_BUYER_PERMISSIONS.every((p) => p.startsWith("buyer."))).toBe(true);
  });
});

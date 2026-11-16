import { TENANT_MODELS, TenantViolationError, scopeArgs } from "./tenant-extension";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("tenant scoping (buyers must never reach another buyer's rows)", () => {
  it("ANDs the organisation into every free-form read, update and delete filter", () => {
    for (const op of ["findFirst", "findMany", "count", "aggregate", "groupBy", "updateMany", "deleteMany"]) {
      const out = scopeArgs("Bale", op, { where: { barcode: "111000937M" } }, ORG) as { where: { AND: unknown[] } };
      expect(out.where.AND).toEqual([{ barcode: "111000937M" }, { buyerOrganisationId: ORG }]);
    }
  });

  it("puts the organisation NEXT TO the unique key for keyed operations (Prisma rejects an AND wrapper there)", () => {
    for (const op of ["findUnique", "findUniqueOrThrow", "update", "delete"]) {
      expect((scopeArgs("Bale", op, { where: { id: "b1" } }, ORG) as { where: unknown }).where).toEqual({ id: "b1", buyerOrganisationId: ORG });
    }
    expect(() => scopeArgs("Bale", "findUnique", { where: { id: "b1", buyerOrganisationId: OTHER } }, ORG)).toThrow(TenantViolationError);
    expect(() => scopeArgs("Bale", "upsert", { where: { id: "b1", buyerOrganisationId: OTHER }, create: {}, update: {} }, ORG)).toThrow(TenantViolationError);
  });

  it("adds the filter even when the caller forgot a `where` entirely", () => {
    const out = scopeArgs("Dispatch", "findMany", undefined, ORG) as { where: { AND: unknown[] } };
    expect(out.where.AND).toEqual([{}, { buyerOrganisationId: ORG }]);
  });

  it("stamps the organisation on create / createMany / upsert", () => {
    expect((scopeArgs("Warehouse", "create", { data: { code: "MAIN", name: "Main" } }, ORG) as { data: Record<string, unknown> }).data.buyerOrganisationId).toBe(ORG);
    const many = scopeArgs("Bale", "createMany", { data: [{ barcode: "a" }, { barcode: "b" }] }, ORG) as { data: Array<Record<string, unknown>> };
    expect(many.data.every((d) => d.buyerOrganisationId === ORG)).toBe(true);
    const up = scopeArgs("Warehouse", "upsert", { where: { id: "x" }, create: { code: "A" }, update: {} }, ORG) as { where: Record<string, unknown>; create: Record<string, unknown> };
    expect(up.create.buyerOrganisationId).toBe(ORG);
    expect(up.where).toEqual({ id: "x", buyerOrganisationId: ORG });
  });

  it("REJECTS an attempt to write a row for another organisation", () => {
    expect(() => scopeArgs("Bale", "create", { data: { buyerOrganisationId: OTHER } }, ORG)).toThrow(TenantViolationError);
    expect(() => scopeArgs("Bale", "createMany", { data: [{ buyerOrganisationId: OTHER }] }, ORG)).toThrow(TenantViolationError);
  });

  it("leaves models without a tenant column untouched", () => {
    const args = { where: { id: "x" } };
    expect(scopeArgs("StaffUser", "findMany", args, ORG)).toBe(args);
    expect(scopeArgs("RefreshToken", "findMany", args, ORG)).toBe(args);
  });

  it("covers every buyer-owned table that carries buyerOrganisationId", () => {
    // Guard against adding a tenant table to the schema and forgetting to list it here.
    const fs = require("node:fs") as typeof import("node:fs");
    const schema = fs.readFileSync(require("node:path").join(__dirname, "../../prisma/schema.prisma"), "utf8");
    const withTenantColumn = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
      .filter(([, , body]) => /^\s+buyerOrganisationId\s+String/m.test(body!))
      .map(([, name]) => name!);
    const missing = withTenantColumn.filter((m) => !(TENANT_MODELS as readonly string[]).includes(m) && !["AuditLog"].includes(m));
    // Models owned by the organisation row itself or accessed only by staff/auth flows are deliberately unscoped.
    const allowedUnscoped = ["BuyerInvoice", "BuyerOrganisation"].filter((m) => missing.includes(m));
    expect(missing.filter((m) => !allowedUnscoped.includes(m))).toEqual([]);
  });
});

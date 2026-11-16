import { AuditViewService } from "./audit-view.service";

describe("AuditViewService", () => {
  it("always includes the tenant predicate when filtering history", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = { auditLog: { findMany, count } } as never;
    await new AuditViewService(prisma).list("org-1", { page: 1, pageSize: 25 });
    expect(findMany.mock.calls[0][0].where).toEqual({ buyerOrganisationId: "org-1" });
    expect(count.mock.calls[0][0].where).toEqual({ buyerOrganisationId: "org-1" });
  });
});

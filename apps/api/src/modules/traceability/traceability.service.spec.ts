import { TraceabilityService } from "./traceability.service";

describe("TraceabilityService", () => {
  it("uses the organisation-scoped client and returns a chronological timeline", async () => {
    const bale = {
      id: "b1", barcode: "123456789 ", events: [{ id: "e1", occurredAt: new Date("2026-01-02"), type: "RECEIVED" }],
      movements: [], scans: [], lineageAsOriginal: [], lineageAsNew: [], purchase: null, warehouse: null, bay: null, row: null,
    };
    const findFirst = jest.fn().mockResolvedValue(bale);
    const prisma = { forOrganisation: jest.fn().mockReturnValue({ bale: { findFirst } }) } as any;
    const result = await new TraceabilityService(prisma).timeline("org-1", "123456789 ");
    expect(prisma.forOrganisation).toHaveBeenCalledWith("org-1");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { barcode: "123456789 " } }));
    expect(result.events[0].occurredAt).toEqual("2026-01-02T00:00:00.000Z");
  });
});

import { describe, expect, it } from "vitest";
import { createDispatchSchema } from "./processing";
import { confirmProcessingReturnSchema } from "./returns";

describe("processing validation", () => {
  it("requires at least one bale for dispatch", () => {
    expect(createDispatchSchema.safeParse({ processingCompanyId: "00000000-0000-0000-0000-000000000001", dispatchDate: "2026-01-01", reason: "Grade", baleIds: [] }).success).toBe(false);
  });
  it("accepts discrepancy explanations and processing locations", () => {
    const result = confirmProcessingReturnSchema.safeParse({
      bales: [{ dispatchBaleId: "00000000-0000-4000-8000-000000000002", scannedBarcode: "123456789X", outcome: "DAMAGED", returnedMassKg: "8.5", explanation: "Wet on arrival", warehouseId: "00000000-0000-4000-8000-000000000003" }],
      explanation: "One bale damaged",
    });
    expect(result.success).toBe(true);
  });
});

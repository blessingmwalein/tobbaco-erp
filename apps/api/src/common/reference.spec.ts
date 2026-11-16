import { formatReference } from "./reference";

describe("document references", () => {
  it("formats human-readable references (DSP-MZ-2026-0001)", () => {
    expect(formatReference("DSP", "MZ", 2026, 1)).toBe("DSP-MZ-2026-0001");
    expect(formatReference("RCV", "MZ", 2026, 42)).toBe("RCV-MZ-2026-0042");
    expect(formatReference("RET", "KT", 2027, 12345)).toBe("RET-KT-2027-12345");
  });
});

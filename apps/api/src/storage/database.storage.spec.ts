import { DatabaseStorage } from "./database.storage";

/** A tiny in-memory stand-in for the `documentBlob` table (the real table is exercised by the integration suite). */
function fakePrisma() {
  const rows = new Map<string, { key: string; data: Uint8Array; contentType: string }>();
  return {
    rows,
    documentBlob: {
      upsert: async ({ where, update, create }: { where: { key: string }; update: { data: Uint8Array; contentType: string }; create: { key: string; data: Uint8Array; contentType: string } }) => {
        rows.set(where.key, rows.has(where.key) ? { key: where.key, ...update } : create);
      },
      findUnique: async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null,
      count: async ({ where }: { where: { key: string } }) => (rows.has(where.key) ? 1 : 0),
    },
  };
}

describe("DatabaseStorage", () => {
  it("round-trips bytes exactly (binary, not just text) and reports existence", async () => {
    const prisma = fakePrisma();
    const storage = new DatabaseStorage(prisma as never);
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x0a, 0x20]); // "%PDF", NUL, 0xFF, LF, trailing blank
    expect(await storage.exists("org/2026/a.pdf")).toBe(false);
    await storage.put("org/2026/a.pdf", bytes, "application/pdf");
    expect(await storage.exists("org/2026/a.pdf")).toBe(true);
    const back = await storage.get("org/2026/a.pdf");
    expect(Buffer.isBuffer(back)).toBe(true);
    expect(back.equals(bytes)).toBe(true);
  });

  it("writing the same key again replaces the file", async () => {
    const storage = new DatabaseStorage(fakePrisma() as never);
    await storage.put("k", Buffer.from("one"), "text/plain");
    await storage.put("k", Buffer.from("two"), "text/plain");
    expect((await storage.get("k")).toString()).toBe("two");
  });

  it("a missing file is a clean 404, not a crash", async () => {
    const storage = new DatabaseStorage(fakePrisma() as never);
    await expect(storage.get("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

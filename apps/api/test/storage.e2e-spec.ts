import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BuyerPrincipal } from "../src/common/principal";
import { DocumentsService } from "../src/storage/documents.service";
import { API, bearer, boot, describeDb, loginBuyer, type Harness } from "./helpers";

/**
 * Vercel's filesystem is read-only: creating `.storage` fails with ENOENT/EROFS and the Flow Disk import returned a 500.
 * These tests recreate that condition with a storage folder that can never be created (it would sit inside a FILE).
 */
const sample = readFileSync(path.join(__dirname, "../samples/flowdisk/MZ_20260528_test_10.csv"), "utf8");
const dir = mkdtempSync(path.join(tmpdir(), "tobacco-storage-"));
const notAFolder = path.join(dir, "not-a-folder");
writeFileSync(notAFolder, "x");
const UNWRITABLE = path.join(notAFolder, ".storage"); // mkdir inside a file can never succeed

const SAVED = { ...process.env };
const configure = (env: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};
afterAll(() => {
  for (const k of ["STORAGE_DRIVER", "STORAGE_LOCAL_DIR", "VERCEL"]) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
});

const principalOf = async (h: Harness, email: string): Promise<BuyerPrincipal> => {
  const u = await h.prisma.buyerUser.findUniqueOrThrow({ where: { email }, include: { organisation: true } });
  return { type: "BUYER", id: u.id, name: u.name, email: u.email, organisationId: u.buyerOrganisationId, organisationCode: u.organisation.code, organisationName: u.organisation.name, roles: ["BUYER_ADMINISTRATOR"], permissions: new Set() };
};

describeDb("document storage on a host with no writable disk (the Vercel 500)", () => {
  describe("local disk storage (the old behaviour)", () => {
    let h: Harness;
    beforeAll(async () => {
      configure({ STORAGE_DRIVER: "local", STORAGE_LOCAL_DIR: UNWRITABLE, VERCEL: undefined });
      h = await boot();
    });
    afterAll(async () => {
      await h?.close();
    });

    it("reproduces the production failure: the import cannot be stored and the API answers 500", async () => {
      const token = bearer(await loginBuyer(h, "admin@moroz-demo.test"));
      const res = await h.http().post(`${API}/buyer/flowdisk/imports`).set("Authorization", token).send({ filename: "MZ.csv", content: sample });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe.each([
    ["STORAGE_DRIVER=database", { STORAGE_DRIVER: "database", VERCEL: undefined }],
    ["no STORAGE_DRIVER but running on Vercel (VERCEL=1)", { STORAGE_DRIVER: undefined, VERCEL: "1" }],
  ])("%s", (_name, env) => {
    let h: Harness;
    let admin: string;
    beforeAll(async () => {
      configure({ ...env, STORAGE_LOCAL_DIR: UNWRITABLE });
      h = await boot();
      admin = bearer(await loginBuyer(h, "admin@moroz-demo.test"));
    });
    afterAll(async () => {
      await h?.close();
    });

    it("stages a Flow Disk import and keeps the file in the database", async () => {
      const res = await h.http().post(`${API}/buyer/flowdisk/imports`).set("Authorization", admin).send({ filename: "MZ_20260528_test_10.csv", content: sample });
      expect(res.status).toBe(201);
      const doc = await h.prisma.document.findFirstOrThrow({ where: { kind: "FLOW_DISK", buyerOrganisationId: h.seed.mzId } });
      expect(doc).toMatchObject({ filename: "MZ_20260528_test_10.csv", mimeType: "text/plain", sizeBytes: Buffer.byteLength(sample) });
      const blob = await h.prisma.documentBlob.findUniqueOrThrow({ where: { key: doc.storageKey } });
      expect(Buffer.from(blob.data).toString("utf8")).toBe(sample); // byte-for-byte, including any trailing blank in a barcode
      expect(blob.contentType).toBe("text/plain");
    });

    it("reads the file back for its owner and shows it to nobody else", async () => {
      const docs = h.app.get(DocumentsService);
      const doc = await h.prisma.document.findFirstOrThrow({ where: { kind: "FLOW_DISK", buyerOrganisationId: h.seed.mzId } });
      const mine = await docs.read(doc.id, await principalOf(h, "admin@moroz-demo.test"));
      expect(mine.data.toString("utf8")).toBe(sample);
      // another company: indistinguishable from "no such document"
      await expect(docs.read(doc.id, await principalOf(h, "admin@kt-demo.test"))).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("accepts a large sale day's file (well over Express' 100 kB default), not a 413", async () => {
      const header = sample.split("\n").filter((l) => !l.startsWith("L4OMA")).join("\n");
      const rows = Array.from({ length: 3000 }, (_, i) => `L4OMA,3${String(i).padStart(5, "0")},${String(i % 9999).padStart(4, "0")},100.0,250.00,250.00,2${String(i).padStart(8, "0")}X,L4OK`).join("\n");
      const content = `${header}\n${rows}\n`;
      expect(Buffer.byteLength(content)).toBeGreaterThan(150_000);
      const res = await h.http().post(`${API}/buyer/flowdisk/imports`).set("Authorization", admin).send({ filename: "big.csv", content });
      expect(res.status).not.toBe(413);
      expect(res.status).toBeLessThan(500);
    });
  });
});

import { AppError } from "../common/app-error";
import type { PrismaService } from "../database/prisma.service";
import type { DocumentStorage } from "./document-storage";

/**
 * Keeps file bytes in PostgreSQL (`document_blobs`). Serverless hosts such as Vercel have a read-only, throw-away
 * filesystem, so files written to disk would not exist on the next request. The bytes live in the same (backed-up) database
 * as everything else and are only reachable through DocumentsService, which checks the owning organisation first.
 * Fine for Flow Disk / invoice sized files (a few MB at most); use object storage if documents ever get large.
 */
export class DatabaseStorage implements DocumentStorage {
  constructor(private readonly prisma: Pick<PrismaService, "documentBlob">) {}

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const bytes = new Uint8Array(data); // Prisma's Bytes column takes a plain Uint8Array
    await this.prisma.documentBlob.upsert({
      where: { key },
      update: { data: bytes, contentType },
      create: { key, data: bytes, contentType },
    });
  }

  async get(key: string): Promise<Buffer> {
    const row = await this.prisma.documentBlob.findUnique({ where: { key }, select: { data: true } });
    if (!row) throw AppError.notFound("Document file");
    return Buffer.from(row.data);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.prisma.documentBlob.count({ where: { key } })) > 0;
  }
}

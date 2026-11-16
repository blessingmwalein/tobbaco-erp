import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Document, DocumentKind } from "@prisma/client";
import { AppError } from "../common/app-error";
import type { Principal } from "../common/principal";
import { PrismaService } from "../database/prisma.service";
import { DOCUMENT_STORAGE, type DocumentStorage } from "./document-storage";

export interface StoreDocumentInput {
  organisationId: string | null;
  kind: DocumentKind;
  filename: string;
  mimeType: string;
  data: Buffer;
  principal?: Principal | null;
}

export function safeFilename(name: string): string {
  return name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "file";
}

/** Stores a file durably and records it (sha256, size, owner). Reads are tenant-checked. */
@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
  ) {}

  async store(input: StoreDocumentInput, db: Pick<PrismaService, "document"> = this.prisma): Promise<Document> {
    const sha256 = createHash("sha256").update(input.data).digest("hex");
    const year = new Date().getFullYear();
    const key = `${input.organisationId ?? "system"}/${year}/${randomUUID()}-${safeFilename(input.filename)}`;
    await this.storage.put(key, input.data, input.mimeType);
    return db.document.create({
      data: {
        buyerOrganisationId: input.organisationId,
        kind: input.kind,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.data.length,
        sha256,
        storageKey: key,
        createdByType: input.principal?.type ?? null,
        createdById: input.principal?.id ?? null,
      },
    });
  }

  /** A buyer can only read their own organisation's documents; staff can read any. */
  async read(id: string, principal: Principal): Promise<{ document: Document; data: Buffer }> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw AppError.notFound("Document");
    if (principal.type === "BUYER" && document.buyerOrganisationId !== principal.organisationId) {
      // Same response as a missing document: never confirm that another organisation's file exists.
      throw AppError.notFound("Document");
    }
    return { document, data: await this.storage.get(document.storageKey) };
  }
}

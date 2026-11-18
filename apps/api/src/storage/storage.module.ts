import { Global, Module } from "@nestjs/common";
import { ENV, resolveStorageDriver, type Env } from "../config/env";
import { PrismaService } from "../database/prisma.service";
import { DatabaseStorage } from "./database.storage";
import { DOCUMENT_STORAGE, type DocumentStorage } from "./document-storage";
import { DocumentsService } from "./documents.service";
import { LocalFsStorage } from "./local-fs.storage";

@Global()
@Module({
  providers: [
    {
      provide: DOCUMENT_STORAGE,
      inject: [ENV, PrismaService],
      useFactory: (env: Env, prisma: PrismaService): DocumentStorage => {
        const driver = resolveStorageDriver(env);
        if (driver === "blob") throw new Error("STORAGE_DRIVER=blob (object storage) is not implemented. Use STORAGE_DRIVER=database on a serverless host, or local for development.");
        return driver === "database" ? new DatabaseStorage(prisma) : new LocalFsStorage(env.STORAGE_LOCAL_DIR);
      },
    },
    DocumentsService,
  ],
  exports: [DOCUMENT_STORAGE, DocumentsService],
})
export class StorageModule {}

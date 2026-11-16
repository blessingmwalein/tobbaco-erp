import { Global, Module } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import { DOCUMENT_STORAGE, type DocumentStorage } from "./document-storage";
import { DocumentsService } from "./documents.service";
import { LocalFsStorage } from "./local-fs.storage";

@Global()
@Module({
  providers: [
    {
      provide: DOCUMENT_STORAGE,
      inject: [ENV],
      useFactory: (env: Env): DocumentStorage => {
        if (env.STORAGE_DRIVER === "blob") {
          throw new Error("STORAGE_DRIVER=blob is not implemented yet (production blob storage). Use STORAGE_DRIVER=local for development.");
        }
        return new LocalFsStorage(env.STORAGE_LOCAL_DIR);
      },
    },
    DocumentsService,
  ],
  exports: [DOCUMENT_STORAGE, DocumentsService],
})
export class StorageModule {}

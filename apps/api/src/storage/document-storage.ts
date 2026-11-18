export const DOCUMENT_STORAGE = Symbol("DOCUMENT_STORAGE");

/**
 * Durable document storage behind an interface (serverless functions have no persistent filesystem in production).
 *  - LocalFsStorage: development (STORAGE_DRIVER=local) — files under STORAGE_LOCAL_DIR (git-ignored).
 *  - DatabaseStorage: production on serverless (STORAGE_DRIVER=database, the default on Vercel) — bytes in PostgreSQL.
 *  - Object storage (Vercel Blob / S3): not implemented; selecting STORAGE_DRIVER=blob fails loudly.
 */
export interface DocumentStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
}

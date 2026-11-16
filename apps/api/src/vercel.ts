import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./bootstrap";

/**
 * Vercel serverless entry: the Nest app is created once per warm instance and reused.
 * Deploy as its own Vercel project with Root Directory = apps/api (see apps/api/vercel.json).
 * Neon: use the POOLED connection string in DATABASE_URL.
 */
let handler: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;

export default async function vercelHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!handler) {
    const app = await createApp();
    await app.init();
    handler = app.getHttpAdapter().getInstance() as (req: IncomingMessage, res: ServerResponse) => void;
  }
  handler(req, res);
}

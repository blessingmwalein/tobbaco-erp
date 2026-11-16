import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/** Correlates a request across logs, audit rows and error responses. Honours an inbound x-request-id. */
export function requestIdMiddleware(req: Request & { id?: string }, res: Response, next: NextFunction): void {
  const inbound = req.headers["x-request-id"];
  const id = (Array.isArray(inbound) ? inbound[0] : inbound)?.slice(0, 64) || randomUUID();
  req.id = id;
  res.setHeader("x-request-id", id);
  const started = Date.now();
  res.on("finish", () => {
    if (process.env.NODE_ENV === "test") return;
    // One JSON line per request (structured logging).
    console.log(JSON.stringify({ t: new Date().toISOString(), requestId: id, method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms: Date.now() - started }));
  });
  next();
}

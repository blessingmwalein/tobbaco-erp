import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { TenantViolationError } from "../database/tenant-extension";

/** Maps every failure to one consistent envelope: { error: { code, message, details?, requestId } }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Http");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req.id;

    const { status, code, message, details } = this.normalise(exception);
    if (status >= 500) {
      this.logger.error(
        JSON.stringify({ requestId, code, message, path: req.originalUrl, stack: exception instanceof Error ? exception.stack : undefined }),
      );
    }
    res.status(status).json({ error: { code, message, details, requestId } });
  }

  private normalise(e: unknown): { status: number; code: string; message: string; details?: unknown } {
    if (e instanceof ZodError) {
      return {
        status: 422,
        code: "VALIDATION_FAILED",
        message: "Some fields are invalid",
        details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      };
    }
    if (e instanceof TenantViolationError) {
      return { status: 403, code: "TENANT_VIOLATION", message: "That record belongs to another organisation" };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return { status: 409, code: "DUPLICATE", message: "That record already exists", details: { target: e.meta?.target } };
      }
      if (e.code === "P2025") return { status: 404, code: "NOT_FOUND", message: "Record not found" };
      if (e.code === "P2003") return { status: 409, code: "RELATED_RECORD", message: "A related record prevents this operation" };
      if (e.code === "P2034") return { status: 409, code: "WRITE_CONFLICT", message: "The data changed while saving — please retry" };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError === false && e instanceof Error && /immutable ledger/i.test(e.message)) {
      return { status: 409, code: "LEDGER_IMMUTABLE", message: "History cannot be edited — add a correcting entry instead" };
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const body = e.getResponse();
      if (typeof body === "object" && body !== null && "code" in body) {
        const b = body as { code: string; message: string; details?: unknown };
        return { status, code: b.code, message: b.message, details: b.details };
      }
      const msg = typeof body === "string" ? body : ((body as { message?: string | string[] }).message ?? e.message);
      return { status, code: status === 429 ? "RATE_LIMITED" : `HTTP_${status}`, message: Array.isArray(msg) ? msg.join("; ") : msg };
    }
    return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong on our side" };
  }
}

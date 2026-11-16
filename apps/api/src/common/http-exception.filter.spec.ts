import type { ArgumentsHost } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { TenantViolationError } from "../database/tenant-extension";
import { AppError } from "./app-error";
import { AllExceptionsFilter } from "./http-exception.filter";

function capture(exception: unknown) {
  const out: { status?: number; body?: { error: { code: string; message: string; details?: unknown; requestId?: string } } } = {};
  const res = { status: (s: number) => ({ json: (b: never) => { out.status = s; out.body = b; } }) };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ id: "req-1", originalUrl: "/x" }) }) } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return out;
}

describe("error envelope", () => {
  it("renders AppError with its stable code and the request id", () => {
    const r = capture(AppError.conflict("DUPLICATE_IMPORT", "This file was already imported", { importId: "i1" }));
    expect(r.status).toBe(409);
    expect(r.body?.error).toMatchObject({ code: "DUPLICATE_IMPORT", message: "This file was already imported", details: { importId: "i1" }, requestId: "req-1" });
  });

  it("maps Zod validation failures to 422 with per-field messages", () => {
    const parsed = z.object({ email: z.string().email() }).safeParse({ email: "nope" });
    const r = capture(parsed.error);
    expect(r.status).toBe(422);
    expect(r.body?.error.code).toBe("VALIDATION_FAILED");
    expect(r.body?.error.details).toEqual([{ path: "email", message: expect.any(String) }]);
  });

  it("maps Prisma unique / not-found / FK / write-conflict errors", () => {
    const mk = (code: string) => new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "6" });
    expect(capture(mk("P2002")).status).toBe(409);
    expect(capture(mk("P2025")).status).toBe(404);
    expect(capture(mk("P2003")).body?.error.code).toBe("RELATED_RECORD");
    expect(capture(mk("P2034")).body?.error.code).toBe("WRITE_CONFLICT");
  });

  it("maps a tenant violation to 403 and a ledger-mutation attempt to 409", () => {
    expect(capture(new TenantViolationError("x")).status).toBe(403);
    const ledger = capture(new Error('Table "bale_events" is an immutable ledger: UPDATE is not allowed'));
    expect(ledger.status).toBe(409);
    expect(ledger.body?.error.code).toBe("LEDGER_IMMUTABLE");
  });

  it("never leaks internals for unexpected errors", () => {
    const r = capture(new Error("connect ECONNREFUSED 10.0.0.1:5432 password=secret"));
    expect(r.status).toBe(500);
    expect(r.body?.error.message).toBe("Something went wrong on our side");
    expect(JSON.stringify(r.body)).not.toContain("secret");
  });
});

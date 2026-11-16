import "reflect-metadata";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { buyerPermissionsFor } from "@tobacco/shared";
import { AppError } from "../../common/app-error";
import { BuyerOnly, Public, RequireBuyerPermission, StaffOnly } from "../../common/decorators";
import type { BuyerPrincipal, Principal } from "../../common/principal";
import { parseEnv } from "../../config/env";
import { AuthGuard } from "./auth.guard";
import { PrincipalService } from "./principal.service";
import { TokenService } from "./token.service";

const env = parseEnv({ DATABASE_URL: "postgresql://u:p@h/db", DIRECT_URL: "postgresql://u:p@h/db", JWT_ACCESS_SECRET: "guard-test-secret-that-is-long-enough-12345" });
const tokens = new TokenService(env);

class Ctrl {
  @Public() open() {}
  secured() {}
  @StaffOnly() staffOnly() {}
  @BuyerOnly() buyerOnly() {}
  @RequireBuyerPermission("buyer.receiving.scan") scan() {}
  @RequireBuyerPermission("buyer.dispatch.create", "buyer.warehouse.move") twoPerms() {}
}

const buyer = (roles: BuyerPrincipal["roles"], org = "org-1"): BuyerPrincipal => ({
  type: "BUYER", id: "u1", name: "U", email: "u@x.test", organisationId: org, organisationCode: "MZ", organisationName: "MOROZ", roles, permissions: buyerPermissionsFor(roles),
});
const staff: Principal = { type: "STAFF", id: "s1", name: "Admin", email: "a@x.test" };

function run(method: keyof Ctrl, opts: { token?: string; principal?: Principal | null } = {}) {
  const principals = { load: jest.fn(async () => (opts.principal === undefined ? null : opts.principal)) } as unknown as PrincipalService;
  const guard = new AuthGuard(new Reflector(), tokens, principals);
  const req: { headers: Record<string, string>; principal?: Principal } = { headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {} };
  const ctx = { getHandler: () => Ctrl.prototype[method], getClass: () => Ctrl, switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return { promise: guard.canActivate(ctx), req };
}
const code = async (p: Promise<unknown>) => (await p.then(() => "OK", (e: AppError) => e.code));

describe("AuthGuard (server-side authorisation)", () => {
  it("lets @Public() routes through without a token", async () => {
    expect(await run("open").promise).toBe(true);
  });

  it("is secure by default: undecorated routes need a signed-in user", async () => {
    expect(await code(run("secured").promise)).toBe("UNAUTHENTICATED");
  });

  it("rejects a malformed or invalid bearer token", async () => {
    expect(await code(run("secured", { token: "garbage" }).promise)).toBe("TOKEN_INVALID");
  });

  it("rejects when the account is no longer active (deactivation is immediate)", async () => {
    const token = tokens.signAccess({ sub: "u1", typ: "BUYER", org: "org-1" });
    expect(await code(run("secured", { token, principal: null }).promise)).toBe("ACCOUNT_INACTIVE");
  });

  it("rejects a token whose tenant claim no longer matches the account's organisation", async () => {
    const token = tokens.signAccess({ sub: "u1", typ: "BUYER", org: "org-OTHER" });
    expect(await code(run("secured", { token, principal: buyer(["VIEWER"], "org-1") }).promise)).toBe("TOKEN_INVALID");
  });

  it("attaches the freshly loaded principal on success", async () => {
    const token = tokens.signAccess({ sub: "u1", typ: "BUYER", org: "org-1" });
    const { promise, req } = run("secured", { token, principal: buyer(["VIEWER"]) });
    expect(await promise).toBe(true);
    expect(req.principal?.type).toBe("BUYER");
  });

  it("keeps staff and buyer areas separate in BOTH directions", async () => {
    const buyerToken = tokens.signAccess({ sub: "u1", typ: "BUYER", org: "org-1" });
    const staffToken = tokens.signAccess({ sub: "s1", typ: "STAFF" });
    expect(await code(run("staffOnly", { token: buyerToken, principal: buyer(["BUYER_ADMINISTRATOR"]) }).promise)).toBe("STAFF_ONLY");
    expect(await code(run("buyerOnly", { token: staffToken, principal: staff }).promise)).toBe("BUYER_ONLY");
    expect(await run("staffOnly", { token: staffToken, principal: staff }).promise).toBe(true);
    expect(await run("buyerOnly", { token: buyerToken, principal: buyer(["VIEWER"]) }).promise).toBe(true);
  });

  it("enforces buyer permissions per role (brief §2 role table)", async () => {
    const token = tokens.signAccess({ sub: "u1", typ: "BUYER", org: "org-1" });
    const as = (roles: BuyerPrincipal["roles"], m: keyof Ctrl = "scan") => code(run(m, { token, principal: buyer(roles) }).promise);
    expect(await as(["WAREHOUSE_MANAGER"])).toBe("OK");
    expect(await as(["BUYER_ADMINISTRATOR"])).toBe("OK");
    expect(await as(["VIEWER"])).toBe("PERMISSION_DENIED");
    expect(await as(["FINANCE_OFFICER"])).toBe("PERMISSION_DENIED");
    expect(await as(["OPERATIONS_OFFICER"])).toBe("PERMISSION_DENIED");
  });

  it("requires ALL listed permissions", async () => {
    const token = tokens.signAccess({ sub: "u1", typ: "BUYER", org: "org-1" });
    expect(await code(run("twoPerms", { token, principal: buyer(["OPERATIONS_OFFICER"]) }).promise)).toBe("OK"); // has dispatch + move
    expect(await code(run("twoPerms", { token, principal: buyer(["WAREHOUSE_MANAGER"]) }).promise)).toBe("PERMISSION_DENIED"); // move only
  });

  it("a staff token can never satisfy a buyer permission", async () => {
    const token = tokens.signAccess({ sub: "s1", typ: "STAFF" });
    expect(await code(run("scan", { token, principal: staff }).promise)).toBe("BUYER_ONLY");
  });
});

import { AuthService } from "../src/modules/auth/auth.service";
import { API, PASSWORD, bearer, boot, describeDb, loginBuyer, loginStaff, type Harness } from "./helpers";

describeDb("auth & access (real HTTP + real database)", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await boot();
  });
  afterAll(async () => {
    await h?.close();
  });

  const ADMIN = "admin@moroz-demo.test";

  it("health is public and reports the database", async () => {
    const res = await h.http().get(`${API}/health`).expect(200);
    expect(res.body).toMatchObject({ status: "ok", db: "up" });
  });

  it("buyer sign-in returns a session with the organisation, roles and permissions", async () => {
    const res = await h.http().post(`${API}/auth/buyer/login`).send({ email: "Warehouse@Moroz-Demo.test ", password: PASSWORD }).expect(200);
    expect(res.body.principal).toMatchObject({ type: "BUYER", email: "warehouse@moroz-demo.test", organisation: { code: "MZ", name: "MOROZ TOBACCO" }, roles: ["WAREHOUSE_MANAGER"] });
    expect(res.body.principal.permissions).toContain("buyer.receiving.scan");
    expect(res.body.principal.permissions).not.toContain("buyer.dispatch.create");
    const me = await h.http().get(`${API}/auth/me`).set("Authorization", bearer(res.body.accessToken)).expect(200);
    expect(me.body.organisation.code).toBe("MZ");
  });

  it("wrong password and unknown email give the same generic answer", async () => {
    const a = await h.http().post(`${API}/auth/buyer/login`).send({ email: ADMIN, password: "Wrong-Password-1" }).expect(401);
    const b = await h.http().post(`${API}/auth/buyer/login`).send({ email: "nobody@moroz-demo.test", password: "Wrong-Password-1" }).expect(401);
    expect(a.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(b.body.error).toMatchObject({ code: "INVALID_CREDENTIALS", message: a.body.error.message });
  });

  it("locks the account after repeated failures — even the correct password is then refused", async () => {
    const email = "viewer@moroz-demo.test";
    for (let i = 0; i < 5; i++) await h.http().post(`${API}/auth/buyer/login`).send({ email, password: "Wrong-Password-1" }).expect(401);
    const locked = await h.http().post(`${API}/auth/buyer/login`).send({ email, password: PASSWORD }).expect(429);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
    await h.prisma.buyerUser.update({ where: { email }, data: { lockedUntil: null, failedLogins: 0 } });
    await h.http().post(`${API}/auth/buyer/login`).send({ email, password: PASSWORD }).expect(200);
  });

  it("secure by default: no token → 401; garbage token → 401", async () => {
    await h.http().get(`${API}/auth/me`).expect(401);
    const res = await h.http().get(`${API}/auth/me`).set("Authorization", "Bearer garbage").expect(401);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });

  it("staff and buyer areas are separate: a buyer token cannot read the staff mailbox", async () => {
    const buyer = await loginBuyer(h, ADMIN);
    const res = await h.http().get(`${API}/staff/dev-mailbox`).set("Authorization", bearer(buyer)).expect(403);
    expect(res.body.error.code).toBe("STAFF_ONLY");
    const staff = await loginStaff(h);
    await h.http().get(`${API}/staff/dev-mailbox`).set("Authorization", bearer(staff)).expect(200);
  });

  it("refresh rotates the token; reusing an old one is treated as theft and revokes the whole family", async () => {
    const first = await loginBuyer(h, ADMIN);
    const second = (await h.http().post(`${API}/auth/refresh`).send({ refreshToken: first.refreshToken }).expect(200)).body;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    const reuse = await h.http().post(`${API}/auth/refresh`).send({ refreshToken: first.refreshToken }).expect(401);
    expect(reuse.body.error.code).toBe("TOKEN_REUSED");
    // the legitimate holder's newer token is now dead too (family revoked)
    await h.http().post(`${API}/auth/refresh`).send({ refreshToken: second.refreshToken }).expect(401);
  });

  it("logout revokes the session family", async () => {
    const t = await loginBuyer(h, ADMIN);
    await h.http().post(`${API}/auth/logout`).send({ refreshToken: t.refreshToken }).expect(204);
    await h.http().post(`${API}/auth/refresh`).send({ refreshToken: t.refreshToken }).expect(401);
  });

  it("deactivating a user takes effect immediately — the existing access token stops working", async () => {
    const t = await loginBuyer(h, "finance@moroz-demo.test");
    await h.http().get(`${API}/auth/me`).set("Authorization", bearer(t)).expect(200);
    await h.prisma.buyerUser.update({ where: { email: "finance@moroz-demo.test" }, data: { active: false } });
    const res = await h.http().get(`${API}/auth/me`).set("Authorization", bearer(t)).expect(401);
    expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");
    await h.http().post(`${API}/auth/refresh`).send({ refreshToken: t.refreshToken }).expect(401);
    const login = await h.http().post(`${API}/auth/buyer/login`).send({ email: "finance@moroz-demo.test", password: PASSWORD }).expect(403);
    expect(login.body.error.code).toBe("ACCOUNT_DISABLED");
    await h.prisma.buyerUser.update({ where: { email: "finance@moroz-demo.test" }, data: { active: true } });
  });

  it("deactivating the whole buyer organisation locks out all its users at once, and only them", async () => {
    const mz = await loginBuyer(h, ADMIN);
    const kt = await loginBuyer(h, "admin@kt-demo.test");
    await h.prisma.buyerOrganisation.update({ where: { code: "MZ" }, data: { status: "INACTIVE" } });
    await h.http().get(`${API}/auth/me`).set("Authorization", bearer(mz)).expect(401);
    await h.http().get(`${API}/auth/me`).set("Authorization", bearer(kt)).expect(200); // another organisation unaffected
    await h.prisma.buyerOrganisation.update({ where: { code: "MZ" }, data: { status: "ACTIVE" } });
  });

  it("password reset: never reveals the email, link works once, old password and sessions die", async () => {
    const email = "operations@moroz-demo.test";
    const session = await loginBuyer(h, email);
    const unknown = await h.http().post(`${API}/auth/forgot-password`).send({ email: "ghost@moroz-demo.test" }).expect(202);
    const known = await h.http().post(`${API}/auth/forgot-password`).send({ email }).expect(202);
    expect(unknown.body).toEqual(known.body); // identical response
    expect(await h.prisma.outboxEmail.count({ where: { toEmail: "ghost@moroz-demo.test" } })).toBe(0);

    const mail = await h.prisma.outboxEmail.findFirstOrThrow({ where: { toEmail: email, kind: "password-reset" } });
    const token = /token=([\w-]+)/.exec(mail.bodyText)![1]!;
    expect(mail.bodyText).toContain("/buyer/reset-password?token=");

    const weak = await h.http().post(`${API}/auth/reset-password`).send({ token, password: "weakpass1" }).expect(422);
    expect(weak.body.error.code).toBe("VALIDATION_FAILED");

    await h.http().post(`${API}/auth/reset-password`).send({ token, password: "Brand-New-Pass-77" }).expect(204);
    const again = await h.http().post(`${API}/auth/reset-password`).send({ token, password: "Another-Pass-88x" }).expect(400);
    expect(again.body.error.code).toBe("TOKEN_INVALID");

    await h.http().post(`${API}/auth/buyer/login`).send({ email, password: PASSWORD }).expect(401); // old password dead
    await h.http().post(`${API}/auth/buyer/login`).send({ email, password: "Brand-New-Pass-77" }).expect(200);
    await h.http().post(`${API}/auth/refresh`).send({ refreshToken: session.refreshToken }).expect(401); // old sessions revoked
  });

  it("account activation: a new user cannot sign in until they set a password from the emailed link", async () => {
    const user = await h.prisma.buyerUser.create({
      data: { buyerOrganisationId: h.seed.mzId, email: "newhire@moroz-demo.test", name: "New Hire", roles: ["VIEWER"] },
    });
    // Answered exactly like a wrong password: nobody can probe which emails have a pending invitation.
    const notYet = await h.http().post(`${API}/auth/buyer/login`).send({ email: user.email, password: "Anything-12345" }).expect(401);
    expect(notYet.body.error.code).toBe("INVALID_CREDENTIALS");

    await h.app.get(AuthService).sendActivation({ id: user.id, email: user.email, name: user.name, organisationName: "MOROZ TOBACCO" });
    const mail = await h.prisma.outboxEmail.findFirstOrThrow({ where: { toEmail: user.email, kind: "account-activation" } });
    const token = /token=([\w-]+)/.exec(mail.bodyText)![1]!;
    await h.http().post(`${API}/auth/activate`).send({ token, password: "Welcome-Aboard-9" }).expect(204);
    const res = await h.http().post(`${API}/auth/buyer/login`).send({ email: user.email, password: "Welcome-Aboard-9" }).expect(200);
    expect(res.body.principal.roles).toEqual(["VIEWER"]);
  });

  it("change-password requires the current password and revokes other sessions", async () => {
    const t = await loginBuyer(h, "warehouse@moroz-demo.test");
    const bad = await h.http().post(`${API}/auth/change-password`).set("Authorization", bearer(t)).send({ currentPassword: "nope-nope-1", newPassword: "Fresh-Password-55" }).expect(400);
    expect(bad.body.error.code).toBe("WRONG_CURRENT_PASSWORD");
    await h.http().post(`${API}/auth/change-password`).set("Authorization", bearer(t)).send({ currentPassword: PASSWORD, newPassword: "Fresh-Password-55" }).expect(204);
    await h.http().post(`${API}/auth/refresh`).send({ refreshToken: t.refreshToken }).expect(401);
    await h.http().post(`${API}/auth/buyer/login`).send({ email: "warehouse@moroz-demo.test", password: "Fresh-Password-55" }).expect(200);
  });

  it("writes an audit trail, and the audit log cannot be edited or deleted", async () => {
    const rows = await h.prisma.auditLog.findMany({ where: { action: "auth.login" } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.buyerOrganisationId === h.seed.mzId && r.principalType === "BUYER")).toBe(true);
    const id = rows[0]!.id;
    await expect(h.prisma.$executeRawUnsafe(`UPDATE audit_logs SET action = 'tampered' WHERE id = '${id}'::uuid`)).rejects.toThrow(/immutable ledger/);
    await expect(h.prisma.$executeRawUnsafe(`DELETE FROM audit_logs WHERE id = '${id}'::uuid`)).rejects.toThrow(/immutable ledger/);
  });

  it("rate-limits repeated sign-in attempts from one address", async () => {
    process.env.THROTTLE_TEST = "1";
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 14; i++) statuses.push((await h.http().post(`${API}/auth/staff/login`).send({ email: "ghost@tobacco-erp.test", password: "x" })).status);
      expect(statuses).toContain(429);
    } finally {
      delete process.env.THROTTLE_TEST;
    }
  });
});

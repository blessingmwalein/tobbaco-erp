import { API, PASSWORD, bearer, boot, describeDb, loginBuyer, loginStaff, type Harness } from "./helpers";

describeDb("buyer companies and users (real HTTP + real database)", () => {
  let h: Harness;
  let staff: string;
  let mzAdmin: string;
  beforeAll(async () => {
    h = await boot();
    staff = bearer(await loginStaff(h));
    mzAdmin = bearer(await loginBuyer(h, "admin@moroz-demo.test"));
  });
  afterAll(async () => {
    await h?.close();
  });

  const mailFor = (to: string) => h.prisma.outboxEmail.findFirst({ where: { toEmail: to }, orderBy: { createdAt: "desc" } });
  const tokenFrom = (body: string) => /token=([A-Za-z0-9_-]+)/.exec(body)![1]!;

  describe("ERP staff creates a buyer company", () => {
    it("creates the company + first administrator, who activates by email link and signs in", async () => {
      const res = await h.http().post(`${API}/staff/buyer-organisations`).set("Authorization", staff).send({ code: "ab1", name: "ABC Leaf (Pvt) Ltd", admin: { name: "Ada Admin", email: "ada@abc-leaf.test" } }).expect(201);
      expect(res.body).toMatchObject({ code: "AB1", name: "ABC Leaf (Pvt) Ltd", status: "ACTIVE" });

      // cannot sign in before activating
      await h.http().post(`${API}/auth/buyer/login`).send({ email: "ada@abc-leaf.test", password: "Some-Password-123" }).expect(401);

      const mail = await mailFor("ada@abc-leaf.test");
      expect(mail?.kind).toBe("account-activation");
      await h.http().post(`${API}/auth/activate`).send({ token: tokenFrom(mail!.bodyText), password: "Ada-Strong-Pass-1" }).expect(204);
      const login = await h.http().post(`${API}/auth/buyer/login`).send({ email: "ada@abc-leaf.test", password: "Ada-Strong-Pass-1" }).expect(200);
      expect(login.body.principal).toMatchObject({ roles: ["BUYER_ADMINISTRATOR"], organisation: { code: "AB1" } });
      // the activation link works once
      await h.http().post(`${API}/auth/activate`).send({ token: tokenFrom(mail!.bodyText), password: "Another-Pass-123" }).expect(400);
    });

    it("rejects a duplicate buyer code and a duplicate email", async () => {
      await h.http().post(`${API}/staff/buyer-organisations`).set("Authorization", staff).send({ code: "MZ", name: "Another Moroz", admin: { name: "X Admin", email: "x@another.test" } }).expect(409);
      await h.http().post(`${API}/staff/buyer-organisations`).set("Authorization", staff).send({ code: "ZZ9", name: "Zed", admin: { name: "Dup", email: "admin@moroz-demo.test" } }).expect(409);
    });

    it("validates input with per-field messages", async () => {
      const res = await h.http().post(`${API}/staff/buyer-organisations`).set("Authorization", staff).send({ code: "!", name: "", admin: { name: "A", email: "not-an-email" } }).expect(422);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(["code", "name", "admin.name", "admin.email"]));
    });

    it("buyer users cannot call the staff endpoints, and staff cannot call buyer endpoints", async () => {
      await h.http().get(`${API}/staff/buyer-organisations`).set("Authorization", mzAdmin).expect(403);
      await h.http().get(`${API}/buyer/users`).set("Authorization", staff).expect(403);
    });

    it("deactivating a company ends its users' access immediately and refuses new sign-ins; reactivating restores it", async () => {
      const kt = bearer(await loginBuyer(h, "admin@kt-demo.test"));
      await h.http().get(`${API}/buyer/company`).set("Authorization", kt).expect(200);
      await h.http().post(`${API}/staff/buyer-organisations/${h.seed.ktId}/status`).set("Authorization", staff).send({ status: "INACTIVE" }).expect(422); // reason required
      await h.http().post(`${API}/staff/buyer-organisations/${h.seed.ktId}/status`).set("Authorization", staff).send({ status: "INACTIVE", reason: "Contract ended" }).expect(200);
      await h.http().get(`${API}/buyer/company`).set("Authorization", kt).expect(401); // the still-valid token is refused at once
      const refused = await h.http().post(`${API}/auth/buyer/login`).send({ email: "admin@kt-demo.test", password: PASSWORD }).expect(403);
      expect(refused.body.error.code).toBe("ACCOUNT_DISABLED");
      await h.http().post(`${API}/staff/buyer-organisations/${h.seed.ktId}/status`).set("Authorization", staff).send({ status: "ACTIVE" }).expect(200);
      await h.http().post(`${API}/auth/buyer/login`).send({ email: "admin@kt-demo.test", password: PASSWORD }).expect(200);
      const audit = await h.prisma.auditLog.findMany({ where: { entityType: "BuyerOrganisation", entityId: h.seed.ktId }, orderBy: { occurredAt: "asc" } });
      expect(audit.map((a) => a.action)).toEqual(["buyer.organisation.deactivated", "buyer.organisation.activated"]);
      expect(audit[0]!.reason).toBe("Contract ended");
    });
  });

  describe("a Buyer Administrator manages their own company's users", () => {
    let invitedId: string;

    it("invites a user: pending until activation, with roles; an email is sent", async () => {
      const res = await h.http().post(`${API}/buyer/users`).set("Authorization", mzAdmin).send({ name: "Tendai Stores", email: "Tendai@Moroz-Demo.test", roles: ["WAREHOUSE_MANAGER", "VIEWER"] }).expect(201);
      invitedId = res.body.id;
      expect(res.body).toMatchObject({ email: "tendai@moroz-demo.test", roles: ["WAREHOUSE_MANAGER", "VIEWER"], active: true, activated: false });
      expect((await mailFor("tendai@moroz-demo.test"))?.kind).toBe("account-activation");
      const audit = await h.prisma.auditLog.findFirst({ where: { action: "buyer.user.created", entityId: invitedId } });
      expect(audit).toMatchObject({ principalType: "BUYER", entityRef: "tendai@moroz-demo.test" });
    });

    it("lists only this company's users (searchable and paged)", async () => {
      const all = await h.http().get(`${API}/buyer/users`).set("Authorization", mzAdmin).expect(200);
      expect(all.body.items.map((u: { email: string }) => u.email)).toContain("tendai@moroz-demo.test");
      expect(all.body.items.some((u: { email: string }) => u.email.includes("kt-demo") || u.email.includes("ada@"))).toBe(false);
      const found = await h.http().get(`${API}/buyer/users?search=tendai&pageSize=5`).set("Authorization", mzAdmin).expect(200);
      expect(found.body).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    });

    it("role changes are audited and take effect on the very next request", async () => {
      const tendai = await h.http().post(`${API}/buyer/users`).set("Authorization", mzAdmin).send({ name: "Role Change", email: "rolechange@moroz-demo.test", roles: ["VIEWER"] }).expect(201);
      await h.prisma.buyerUser.update({ where: { id: tendai.body.id }, data: { passwordHash: (await h.prisma.buyerUser.findUniqueOrThrow({ where: { email: "viewer@moroz-demo.test" } })).passwordHash } });
      const token = bearer(await loginBuyer(h, "rolechange@moroz-demo.test"));
      await h.http().get(`${API}/buyer/users`).set("Authorization", token).expect(403); // a Viewer cannot manage users
      await h.http().patch(`${API}/buyer/users/${tendai.body.id}`).set("Authorization", mzAdmin).send({ roles: ["BUYER_ADMINISTRATOR"] }).expect(200);
      // the old session was revoked, but the access token itself is re-evaluated against the database on every call:
      await h.http().get(`${API}/buyer/users`).set("Authorization", token).expect(200);
      const audit = await h.prisma.auditLog.findFirst({ where: { action: "buyer.user.updated", entityId: tendai.body.id } });
      expect(audit?.previous).toMatchObject({ roles: ["VIEWER"] });
      expect(audit?.next).toMatchObject({ roles: ["BUYER_ADMINISTRATOR"] });
    });

    it("deactivating a user kills their access at once; reactivating restores it", async () => {
      const viewerToken = bearer(await loginBuyer(h, "viewer@moroz-demo.test"));
      const viewer = await h.prisma.buyerUser.findUniqueOrThrow({ where: { email: "viewer@moroz-demo.test" } });
      await h.http().get(`${API}/auth/me`).set("Authorization", viewerToken).expect(200);
      await h.http().patch(`${API}/buyer/users/${viewer.id}`).set("Authorization", mzAdmin).send({ active: false }).expect(200);
      await h.http().get(`${API}/auth/me`).set("Authorization", viewerToken).expect(401);
      const refused = await h.http().post(`${API}/auth/buyer/login`).send({ email: "viewer@moroz-demo.test", password: PASSWORD }).expect(403);
      expect(refused.body.error.code).toBe("ACCOUNT_DISABLED");
      await h.http().patch(`${API}/buyer/users/${viewer.id}`).set("Authorization", mzAdmin).send({ active: true }).expect(200);
      await h.http().post(`${API}/auth/buyer/login`).send({ email: "viewer@moroz-demo.test", password: PASSWORD }).expect(200);
    });

    it("protects the company: no self-lockout, never zero administrators", async () => {
      const me = await h.prisma.buyerUser.findUniqueOrThrow({ where: { email: "admin@moroz-demo.test" } });
      const self = await h.http().patch(`${API}/buyer/users/${me.id}`).set("Authorization", mzAdmin).send({ active: false }).expect(409);
      expect(self.body.error.code).toBe("CANNOT_MODIFY_SELF");
      await h.http().patch(`${API}/buyer/users/${me.id}`).set("Authorization", mzAdmin).send({ roles: ["VIEWER"] }).expect(409);

      // staff (not the admin themselves) tries to remove the only administrator of a company that has just one
      const ktAdmin = await h.prisma.buyerUser.findUniqueOrThrow({ where: { email: "admin@kt-demo.test" } });
      const last = await h.http().patch(`${API}/staff/buyer-organisations/${h.seed.ktId}/users/${ktAdmin.id}`).set("Authorization", staff).send({ active: false }).expect(409);
      expect(last.body.error.code).toBe("LAST_ADMINISTRATOR");
    });

    it("tenant isolation: another company's admin cannot see, edit or resend for these users", async () => {
      const kt = bearer(await loginBuyer(h, "admin@kt-demo.test"));
      await h.http().patch(`${API}/buyer/users/${invitedId}`).set("Authorization", kt).send({ active: false }).expect(404);
      await h.http().post(`${API}/buyer/users/${invitedId}/resend-activation`).set("Authorization", kt).expect(404);
      expect((await h.prisma.buyerUser.findUniqueOrThrow({ where: { id: invitedId } })).active).toBe(true);
      const list = await h.http().get(`${API}/buyer/users`).set("Authorization", kt).expect(200);
      expect(list.body.items.every((u: { email: string }) => u.email.endsWith("kt-demo.test"))).toBe(true);
    });

    it("re-sends an invitation only while the user is still pending", async () => {
      await h.http().post(`${API}/buyer/users/${invitedId}/resend-activation`).set("Authorization", mzAdmin).expect(204);
      const warehouse = await h.prisma.buyerUser.findUniqueOrThrow({ where: { email: "warehouse@moroz-demo.test" } });
      const res = await h.http().post(`${API}/buyer/users/${warehouse.id}/resend-activation`).set("Authorization", mzAdmin).expect(409);
      expect(res.body.error.code).toBe("ALREADY_ACTIVATED");
    });

    it("non-administrators are refused by the API itself (not just hidden in the UI)", async () => {
      const ops = bearer(await loginBuyer(h, "operations@moroz-demo.test"));
      const res = await h.http().post(`${API}/buyer/users`).set("Authorization", ops).send({ name: "Sneaky", email: "sneaky@moroz-demo.test", roles: ["BUYER_ADMINISTRATOR"] }).expect(403);
      expect(res.body.error.code).toBe("PERMISSION_DENIED");
    });
  });

  describe("company profile", () => {
    it("any buyer user can read it; only company managers can edit it; edits are audited", async () => {
      const viewer = bearer(await loginBuyer(h, "viewer@moroz-demo.test"));
      const read = await h.http().get(`${API}/buyer/company`).set("Authorization", viewer).expect(200);
      expect(read.body).toMatchObject({ code: "MZ", name: "MOROZ TOBACCO" });
      await h.http().patch(`${API}/buyer/company`).set("Authorization", viewer).send({ name: "Hacked" }).expect(403);

      const edited = await h.http().patch(`${API}/buyer/company`).set("Authorization", mzAdmin).send({ name: "MOROZ TOBACCO", phone: "+263 77 555 0000", address: "" }).expect(200);
      expect(edited.body).toMatchObject({ phone: "+263 77 555 0000", address: null });
      const audit = await h.prisma.auditLog.findFirst({ where: { action: "buyer.organisation.updated", entityId: h.seed.mzId } });
      expect(audit?.next).toMatchObject({ phone: "+263 77 555 0000" });
    });
  });
});

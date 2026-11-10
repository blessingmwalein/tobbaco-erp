import { describe, expect, it } from "vitest";
import { AppError } from "@tobacco/shared";
import { attempt, ctxFor, dbAt } from "../testing";
import { effectivePermissions } from "../ctx";
import {
  activateSeason,
  deleteBaleLocation,
  deleteRole,
  deleteTimbGrade,
  documentedSettingsDefaults,
  resetSettings,
  saveBaleLocation,
  saveRole,
  saveSeason,
  saveSellingPoint,
  saveSettings,
  saveTimbGrade,
  saveUser,
  saveWarehouse,
  setUserActive,
  setWarehouseActive,
  simulateScaleReading,
  type SaveUserInput,
} from "./admin";

const baseUser = (over: Partial<SaveUserInput> = {}): SaveUserInput => ({
  name: "Test Clerk",
  email: "test.clerk@demo.eport.test",
  roleIds: ["data-clerk"],
  sellingPointIds: [],
  grant: [],
  deny: [],
  active: true,
  ...over,
});

describe("users", () => {
  it("creates a user, audits it and rejects duplicates / bad input", () => {
    const db = dbAt("PROCESSED");
    const ctx = ctxFor(db, "system-admin");
    const before = db.audit.length;
    const u = saveUser(ctx, baseUser());
    expect(u.id).toBe("user-test-clerk");
    expect(db.users.find((x) => x.id === u.id)?.roleIds).toEqual(["data-clerk"]);
    expect(db.audit.length).toBe(before + 1);
    expect(db.audit[0]).toMatchObject({ action: "user.create", entityType: "User", userName: "Administrator" });

    expect(() => saveUser(ctx, baseUser({ name: "Other", email: "TEST.CLERK@demo.eport.test" }))).toThrow(/already uses/);
    expect(() => saveUser(ctx, baseUser({ name: "", email: "x@y.zz" }))).toThrow(/Name is required/);
    expect(() => saveUser(ctx, baseUser({ email: "not-an-email" }))).toThrow(/valid email/);
    expect(() => saveUser(ctx, baseUser({ name: "No Role", email: "n@r.zz", roleIds: [] }))).toThrow(/at least one role/);
    expect(() => saveUser(ctx, baseUser({ name: "Bad Role", email: "b@r.zz", roleIds: ["nope"] }))).toThrow(/Unknown role/);
    expect(() =>
      saveUser(ctx, baseUser({ name: "Both", email: "both@r.zz", grant: ["sales.view"], deny: ["sales.view"] })),
    ).toThrow(/both granted and denied/);
  });

  it("denies users without admin.users (server-side guard, not just hidden buttons)", () => {
    const db = dbAt("FRESH");
    expect(() => saveUser(ctxFor(db, "receiving-clerk"), baseUser())).toThrowError(AppError);
    expect(() => saveUser(ctxFor(db, "receiving-clerk"), baseUser())).toThrow(/admin\.users/);
  });

  it("cannot deactivate yourself", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    expect(() => setUserActive(ctx, { id: "user-system-admin", active: false })).toThrow(/your own account/);
  });

  it("cannot deactivate or demote the last active System Administrator", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    // A second person who can manage users but is not a System Administrator.
    const manager = saveUser(ctx, baseUser({ name: "User Manager", email: "um@demo.eport.test", roleIds: ["supervisor"], grant: ["admin.users"] }));
    const mctx = ctxFor(db, "supervisor");
    mctx.actor = manager;
    expect(() => setUserActive(mctx, { id: "user-system-admin", active: false })).toThrow(/At least one active System Administrator/);
    const admin = db.users.find((u) => u.id === "user-system-admin")!;
    expect(() =>
      saveUser(mctx, { id: admin.id, name: admin.name, email: admin.email, roleIds: ["supervisor"], sellingPointIds: [], grant: [], deny: [], active: true }),
    ).toThrow(/At least one active System Administrator/);

    // With a second active admin the first can be deactivated.
    saveUser(ctx, baseUser({ name: "Admin Two", email: "a2@demo.eport.test", roleIds: ["system-admin"] }));
    expect(setUserActive(mctx, { id: "user-system-admin", active: false }).active).toBe(false);
    expect(db.audit[0]).toMatchObject({ action: "user.deactivate", entityId: "user-system-admin" });
  });

  it("cannot remove your own user-administration access", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    const me = db.users.find((u) => u.id === "user-system-admin")!;
    expect(() =>
      saveUser(ctx, { id: me.id, name: me.name, email: me.email, roleIds: me.roleIds, sellingPointIds: [], grant: [], deny: ["admin.users"], active: true }),
    ).toThrow(/own user-administration access/);
  });

  it("effective permissions = role permissions + grants − denies; inactive users have none", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    const u = saveUser(ctx, baseUser({ roleIds: ["receiving-clerk"], grant: ["tickets.view"], deny: ["receiving.add-grower"] }));
    const perms = effectivePermissions(db, u);
    expect(perms.has("receiving.capture-bale")).toBe(true); // from role
    expect(perms.has("tickets.view")).toBe(true); // granted
    expect(perms.has("receiving.add-grower")).toBe(false); // denied wins
    setUserActive(ctx, { id: u.id, active: false });
    expect(effectivePermissions(db, db.users.find((x) => x.id === u.id)).size).toBe(0);
  });
});

describe("roles", () => {
  it("creates, edits and deletes a custom role; audits each step", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    const role = saveRole(ctx, { name: "Batch Clerk", description: "Second price capture", permissions: ["batch.view", "batch.capture-price"] });
    expect(role.id).toBe("custom-batch-clerk");
    expect(role.isSystem).toBe(false);
    expect(role.permissions).toEqual(expect.arrayContaining(["batch.view", "batch.capture-price"]));
    saveRole(ctx, { id: role.id, name: "Batch Clerk", description: "Second price capture", permissions: ["batch.view", "batch.capture-price", "batch.post"] });
    expect(db.roles.find((r) => r.id === role.id)?.permissions).toContain("batch.post");
    expect(() => saveRole(ctx, { name: "batch clerk", description: "", permissions: [] })).toThrow(/already exists/);
    deleteRole(ctx, { id: role.id });
    expect(db.roles.some((r) => r.id === role.id)).toBe(false);
    expect(db.audit.slice(0, 3).map((a) => a.action)).toEqual(["role.delete", "role.update", "role.create"]);
  });

  it("refuses to delete assigned, system or demo roles", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    const role = saveRole(ctx, { name: "Temp Role", description: "", permissions: ["sales.view"] });
    saveUser(ctx, baseUser({ roleIds: [role.id] }));
    expect(() => deleteRole(ctx, { id: role.id })).toThrow(/still assigned/);
    expect(() => deleteRole(ctx, { id: "supervisor" })).toThrow(/Only custom roles/);
    expect(() => deleteRole(ctx, { id: "demo-operator" })).toThrow(/Only custom roles/);
  });

  it("system roles are protected until explicitly confirmed; System Administrator keeps admin access", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    const sup = db.roles.find((r) => r.id === "supervisor")!;
    const perms = sup.permissions.filter((p) => p !== "sales.view");
    expect(() => saveRole(ctx, { id: sup.id, name: sup.name, description: sup.description, permissions: perms })).toThrow(/System roles are protected/);
    saveRole(ctx, { id: sup.id, name: sup.name, description: sup.description, permissions: perms, confirmSystemEdit: true });
    expect(db.roles.find((r) => r.id === "supervisor")?.permissions).not.toContain("sales.view");
    expect(db.audit[0]).toMatchObject({ action: "role.update", reason: expect.stringContaining("explicit confirmation") });

    const admin = db.roles.find((r) => r.id === "system-admin")!;
    expect(() =>
      saveRole(ctx, { id: admin.id, name: admin.name, description: admin.description, permissions: admin.permissions.filter((p) => p !== "admin.roles"), confirmSystemEdit: true }),
    ).toThrow(/must keep user and role administration/);
  });

  it("requires admin.roles", () => {
    const db = dbAt("FRESH");
    expect(() => saveRole(ctxFor(db, "supervisor"), { name: "Nope Role", description: "", permissions: [] })).toThrow(/admin\.roles/);
  });
});

describe("settings", () => {
  const valid = () => ({ ...documentedSettingsDefaults() });

  it("saves valid settings, normalises codes and records only the changed keys in the audit", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    saveSettings(ctx, { ...valid(), localCurrencyCode: "zwg", rejectedSaleCodes: ["ro", "RH", "co", "ro"], unbookedPolicy: "BLOCK" });
    expect(db.settings.localCurrencyCode).toBe("ZWG");
    expect(db.settings.rejectedSaleCodes).toEqual(["RO", "RH", "CO"]);
    expect(db.settings.unbookedPolicy).toBe("BLOCK");
    const entry = db.audit[0]!;
    expect(entry.action).toBe("settings.update");
    expect(Object.keys(entry.next as object).sort()).toEqual(["localCurrencyCode", "unbookedPolicy"]);
    expect(entry.reason).toMatch(/ZWL → ZWG/);
  });

  it("rejects invalid values", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    expect(() => saveSettings(ctx, { ...valid(), localCurrencyCode: "ZW" })).toThrow(/three letters/);
    expect(() => saveSettings(ctx, { ...valid(), rejectedSaleCodes: [] })).toThrow(/at least one rejected sale code/);
    expect(() => saveSettings(ctx, { ...valid(), companyName: " " })).toThrow(/Company name/);
    expect(() => saveSettings(ctx, { ...valid(), debitAccount: "" })).toThrow(/Debit account/);
  });

  it("does not write an audit entry when nothing changed, and resets to documented defaults", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    const n = db.audit.length;
    saveSettings(ctx, valid());
    expect(db.audit.length).toBe(n);
    saveSettings(ctx, { ...valid(), companyName: "Changed Co", requireDifferentBatchUser: true });
    resetSettings(ctx);
    expect(db.settings.companyName).toBe(documentedSettingsDefaults().companyName);
    expect(db.settings.requireDifferentBatchUser).toBe(false);
    expect(db.audit[0]?.action).toBe("settings.reset");
  });

  it("requires admin.settings", () => {
    const db = dbAt("FRESH");
    expect(() => saveSettings(ctxFor(db, "supervisor"), valid())).toThrow(/admin\.settings/);
  });
});

describe("reference data", () => {
  it("warehouses: unique code, buyer sync, deactivate", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    expect(() => saveWarehouse(ctx, { code: "CURVERID", name: "Dup", buyerCodes: [], active: true })).toThrow(/already exists/);
    expect(() => saveWarehouse(ctx, { code: "NEWWH", name: "New", buyerCodes: ["ZZ"], active: true })).toThrow(/Unknown buyer/);
    saveWarehouse(ctx, { code: "NEWWH", name: "New warehouse", buyerCodes: ["KT"], active: true });
    expect(db.buyers.find((b) => b.code === "KT")?.packingWarehouseCode).toBe("NEWWH");
    saveWarehouse(ctx, { originalCode: "NEWWH", code: "NEWWH", name: "New warehouse", buyerCodes: [], active: true });
    expect(db.buyers.find((b) => b.code === "KT")?.packingWarehouseCode).toBeUndefined();
    expect(setWarehouseActive(ctx, { code: "NEWWH", active: false }).active).toBe(false);
    expect(db.audit[0]?.action).toBe("warehouse.deactivate");
  });

  it("selling points: cannot deactivate the current one; code is immutable", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    const el = db.sellingPoints[0]!;
    expect(() => saveSellingPoint(ctx, { id: el.id, code: "EL", name: el.name, saleRooms: ["A"], floorRows: 12, active: false })).toThrow(/current selling point/);
    expect(() => saveSellingPoint(ctx, { id: el.id, code: "XX", name: el.name, saleRooms: ["A"], floorRows: 12, active: true })).toThrow(/cannot be changed/);
    const sp = saveSellingPoint(ctx, { code: "ab", name: "Second Floor", saleRooms: ["a", "b"], floorRows: 8, active: true });
    expect(sp).toMatchObject({ id: "AB", saleRooms: ["A", "B"] });
  });

  it("seasons: activating one moves the current season", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    expect(() => saveSeason(ctx, { year: 2026 })).toThrow(/already exists/);
    saveSeason(ctx, { year: 2027 });
    activateSeason(ctx, { id: "season-2027" });
    expect(db.seasons.filter((s) => s.active).map((s) => s.year)).toEqual([2027]);
    expect(db.settings.seasonYear).toBe(2027);
  });

  it("bale locations and TIMB grades cannot be deleted while referenced", () => {
    const db = dbAt("PROCESSED");
    const ctx = ctxFor(db, "system-admin");
    expect(() => deleteBaleLocation(ctx, { code: "A" })).toThrow(/used by delivery notes/);
    saveBaleLocation(ctx, { code: "c", description: "Receiving row C" });
    deleteBaleLocation(ctx, { code: "C" });
    expect(db.baleLocations.some((l) => l.code === "C")).toBe(false);
    expect(() => deleteTimbGrade(ctx, { code: "A10" })).toThrow(/used by captured bales/);
    saveTimbGrade(ctx, { code: "q1x", description: "Test", isReason: false });
    expect(db.timbGrades.some((g) => g.code === "Q1X")).toBe(true);
    deleteTimbGrade(ctx, { code: "Q1X" });
    expect(db.timbGrades.some((g) => g.code === "Q1X")).toBe(false);
  });

  it("requires admin.reference-data", () => {
    const db = dbAt("FRESH");
    expect(() => saveSeason(ctxFor(db, "supervisor"), { year: 2030 })).toThrow(/admin\.reference-data/);
  });
});

describe("devices (simulation)", () => {
  it("simulated weigh events continue the scale barcode sequence and are labelled", () => {
    const db = dbAt("FRESH");
    const ctx = ctxFor(db, "system-admin");
    const r = simulateScaleReading(ctx);
    expect(r.scaleBarcode).toBe("2609170006");
    expect(r.isDemo).toBe(true);
    const r2 = simulateScaleReading(ctx, { mass: 101 });
    expect(r2.scaleBarcode).toBe("2609170007");
    expect(r2.mass).toBe(101);
    expect(db.audit[0]?.reason).toMatch(/no physical scale/);
    expect(() => simulateScaleReading(ctx, { mass: 0 })).toThrow(/Mass must be/);
  });

  it("operations are atomic when run through attempt()", () => {
    const db = dbAt("FRESH");
    expect(() => attempt(db, "system-admin", (c) => saveUser(c, baseUser({ email: "bad" })))).toThrow();
    expect(db.users.some((u) => u.email === "bad")).toBe(false);
  });
});

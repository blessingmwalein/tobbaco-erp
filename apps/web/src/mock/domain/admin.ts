import { ALL_PERMISSIONS, yymmdd, type AppUser, type MockDb, type Permission, type RoleDef, type Settings } from "@tobacco/shared";
import { createSeedDb } from "@tobacco/shared/fixtures";
import { audit, effectivePermissions, failText, nextSeq, padNum, requirePermission, type Ctx } from "../ctx";

/**
 * Administration (brief Part 4/11): users, roles & permissions, settings, reference data, device simulation.
 * Everything here is configuration the System Administrator changes WITHOUT touching source code, and every change is audited.
 * (Backend enforcement arrives in Phase 2; here the same guards run inside the mock transaction.)
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const isPermission = (p: string): p is Permission => (ALL_PERMISSIONS as string[]).includes(p);

// ── Users ───────────────────────────────────────────────────────
export interface SaveUserInput {
  id?: string;
  name: string;
  email: string;
  roleIds: string[];
  /** Empty = all selling points. */
  sellingPointIds: string[];
  grant: Permission[];
  deny: Permission[];
  active: boolean;
}

function activeAdmins(db: MockDb, exceptId?: string): AppUser[] {
  return db.users.filter((u) => u.active && u.id !== exceptId && u.roleIds.includes("system-admin"));
}

const userSnapshot = (u: AppUser) => ({
  name: u.name,
  email: u.email,
  roles: u.roleIds,
  sellingPoints: u.sellingPointIds,
  grant: u.permissionOverrides.grant,
  deny: u.permissionOverrides.deny,
  active: u.active,
});

export function saveUser(ctx: Ctx, input: SaveUserInput): AppUser {
  requirePermission(ctx, "admin.users");
  const { db } = ctx;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) failText("Name is required");
  if (!EMAIL.test(email)) failText("Enter a valid email address");
  if (input.roleIds.length === 0) failText("Assign at least one role");
  for (const r of input.roleIds) if (!db.roles.some((x) => x.id === r)) failText(`Unknown role: ${r}`);
  for (const s of input.sellingPointIds) if (!db.sellingPoints.some((x) => x.id === s)) failText(`Unknown selling point: ${s}`);
  for (const p of [...input.grant, ...input.deny]) if (!isPermission(p)) failText(`Unknown permission: ${p}`);
  const overlap = input.grant.filter((p) => input.deny.includes(p));
  if (overlap.length > 0) failText(`A permission cannot be both granted and denied: ${overlap.join(", ")}`);
  if (db.users.some((u) => u.id !== input.id && u.email.toLowerCase() === email)) failText(`Another user already uses ${email}`);

  const existing = input.id ? db.users.find((u) => u.id === input.id) : undefined;
  if (input.id && !existing) failText("User not found");

  const next: AppUser = {
    ...(existing ?? { id: "", name, email, roleIds: [], active: true, sellingPointIds: [], permissionOverrides: { grant: [], deny: [] } }),
    name,
    email,
    roleIds: [...new Set(input.roleIds)],
    sellingPointIds: [...new Set(input.sellingPointIds)],
    permissionOverrides: { grant: [...new Set(input.grant)], deny: [...new Set(input.deny)] },
    active: input.active,
  };

  if (existing) {
    const wasAdmin = existing.active && existing.roleIds.includes("system-admin");
    const stillAdmin = next.active && next.roleIds.includes("system-admin");
    if (existing.id === ctx.actor.id && !next.active) failText("You cannot deactivate your own account");
    if (wasAdmin && !stillAdmin && activeAdmins(db, existing.id).length === 0)
      failText("At least one active System Administrator must remain");
    if (existing.id === ctx.actor.id && !effectivePermissions(db, next).has("admin.users"))
      failText("You cannot remove your own user-administration access");
    const previous = userSnapshot(existing);
    Object.assign(existing, next);
    audit(ctx, { action: "user.update", entityType: "User", entityId: existing.id, entityRef: existing.email, previous, next: userSnapshot(existing) });
    return existing;
  }

  let id = `user-${slug(name)}`;
  while (db.users.some((u) => u.id === id)) id = `user-${slug(name)}-${nextSeq(db, "generic")}`;
  next.id = id;
  db.users.push(next);
  audit(ctx, { action: "user.create", entityType: "User", entityId: id, entityRef: email, next: userSnapshot(next) });
  return next;
}

export function setUserActive(ctx: Ctx, input: { id: string; active: boolean; reason?: string }): AppUser {
  requirePermission(ctx, "admin.users");
  const user = ctx.db.users.find((u) => u.id === input.id);
  if (!user) failText("User not found");
  if (user.active === input.active) return user;
  if (!input.active) {
    if (user.id === ctx.actor.id) failText("You cannot deactivate your own account");
    if (user.roleIds.includes("system-admin") && activeAdmins(ctx.db, user.id).length === 0)
      failText("At least one active System Administrator must remain");
  }
  const previous = { active: user.active };
  user.active = input.active;
  audit(ctx, {
    action: input.active ? "user.reactivate" : "user.deactivate",
    entityType: "User",
    entityId: user.id,
    entityRef: user.email,
    previous,
    next: { active: user.active },
    reason: input.reason,
  });
  return user;
}

// ── Roles ───────────────────────────────────────────────────────
export interface SaveRoleInput {
  id?: string;
  name: string;
  description: string;
  permissions: Permission[];
  /** Required to change a system role (protected by default). */
  confirmSystemEdit?: boolean;
}

export const isCustomRole = (r: RoleDef) => !r.isSystem && !r.isDemoOnly;

export function saveRole(ctx: Ctx, input: SaveRoleInput): RoleDef {
  requirePermission(ctx, "admin.roles");
  const { db } = ctx;
  const name = input.name.trim();
  if (name.length < 3) failText("Role name must be at least 3 characters");
  for (const p of input.permissions) if (!isPermission(p)) failText(`Unknown permission: ${p}`);
  if (db.roles.some((r) => r.id !== input.id && r.name.toLowerCase() === name.toLowerCase())) failText(`A role named “${name}” already exists`);
  const permissions = ALL_PERMISSIONS.filter((p) => input.permissions.includes(p));

  const existing = input.id ? db.roles.find((r) => r.id === input.id) : undefined;
  if (input.id && !existing) failText("Role not found");

  if (existing) {
    if (existing.isSystem && !input.confirmSystemEdit)
      failText("System roles are protected. Confirm explicitly that you want to change a system role.");
    if (existing.id === "system-admin" && !(permissions.includes("admin.users") && permissions.includes("admin.roles")))
      failText("The System Administrator role must keep user and role administration, or nobody could fix access.");
    const previous = { name: existing.name, description: existing.description, permissions: existing.permissions };
    const before = { ...existing };
    existing.name = name;
    existing.description = input.description.trim();
    existing.permissions = permissions;
    // Never let an administrator lock themselves out of role administration.
    if (!effectivePermissions(db, ctx.actor).has("admin.roles")) {
      Object.assign(existing, before);
      failText("That change would remove your own role-administration access");
    }
    audit(ctx, {
      action: "role.update",
      entityType: "Role",
      entityId: existing.id,
      entityRef: existing.name,
      previous,
      next: { name: existing.name, description: existing.description, permissions: existing.permissions },
      reason: existing.isSystem ? "System role changed with explicit confirmation" : undefined,
    });
    return existing;
  }

  let id = `custom-${slug(name)}`;
  while (db.roles.some((r) => r.id === id)) id = `custom-${slug(name)}-${nextSeq(db, "generic")}`;
  const role: RoleDef = {
    id,
    name,
    description: input.description.trim(),
    permissions,
    isSystem: false,
    source: "Custom role",
  };
  db.roles.push(role);
  audit(ctx, { action: "role.create", entityType: "Role", entityId: id, entityRef: name, next: { name, permissions } });
  return role;
}

export function deleteRole(ctx: Ctx, input: { id: string }): void {
  requirePermission(ctx, "admin.roles");
  const role = ctx.db.roles.find((r) => r.id === input.id);
  if (!role) failText("Role not found");
  if (!isCustomRole(role)) failText("Only custom roles can be deleted. System and demo roles are protected.");
  const holders = ctx.db.users.filter((u) => u.roleIds.includes(role.id));
  if (holders.length > 0) failText(`Role is still assigned to ${holders.length} user(s): ${holders.map((u) => u.name).join(", ")}`);
  ctx.db.roles = ctx.db.roles.filter((r) => r.id !== role.id);
  audit(ctx, { action: "role.delete", entityType: "Role", entityId: role.id, entityRef: role.name, previous: { name: role.name, permissions: role.permissions } });
}

// ── Settings ────────────────────────────────────────────────────
export type EditableSettings = Pick<
  Settings,
  | "localCurrencyCode"
  | "rejectedSaleCodes"
  | "unbookedPolicy"
  | "requireDifferentBatchUser"
  | "approvalRequiredFor"
  | "companyName"
  | "debitAccount"
  | "bankCsvTransactionType"
>;

/** Actions that may require an approval instead of executing directly (brief Module 8 examples; triggers are UQ-06). */
export const APPROVABLE_ACTIONS: Array<{ key: string; label: string }> = [
  { key: "bale.correction", label: "Bale corrections (eject bale)" },
  { key: "sale.balance-exception", label: "Sale balancing exceptions" },
  { key: "sale.reverse", label: "Sale reversal" },
  { key: "financial.adjustment", label: "Financial adjustments" },
  { key: "payment.override", label: "Payment-related overrides" },
  { key: "dispatch.cancel", label: "Dispatch cancellation" },
];

const EDITABLE_KEYS: Array<keyof EditableSettings> = [
  "localCurrencyCode",
  "rejectedSaleCodes",
  "unbookedPolicy",
  "requireDifferentBatchUser",
  "approvalRequiredFor",
  "companyName",
  "debitAccount",
  "bankCsvTransactionType",
];

export function pickEditable(s: Settings): EditableSettings {
  return Object.fromEntries(EDITABLE_KEYS.map((k) => [k, s[k]])) as unknown as EditableSettings;
}

export function documentedSettingsDefaults(): EditableSettings {
  return pickEditable(createSeedDb().settings);
}

export function saveSettings(ctx: Ctx, input: EditableSettings): Settings {
  requirePermission(ctx, "admin.settings");
  const cur = ctx.db.settings.localCurrencyCode;
  const code = input.localCurrencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) failText("Local currency code must be three letters (e.g. ZWL)");
  const rejected = [...new Set(input.rejectedSaleCodes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (rejected.length === 0) failText("Keep at least one rejected sale code (documented: RO, RH, CO)");
  if (rejected.some((c) => !/^[A-Z0-9]{1,4}$/.test(c))) failText("Sale codes are 1–4 letters or digits");
  if (input.unbookedPolicy !== "WARN" && input.unbookedPolicy !== "BLOCK") failText("Unbooked policy must be WARN or BLOCK");
  const company = input.companyName.trim();
  if (!company) failText("Company name is required (used in the bank CSV)");
  const debit = input.debitAccount.trim();
  if (!debit) failText("Debit account is required (used in the bank CSV)");
  const txType = input.bankCsvTransactionType.trim();
  if (!txType) failText("Bank CSV Transaction_Type is required");
  const approvals = [...new Set(input.approvalRequiredFor.map((a) => a.trim()).filter(Boolean))];

  const next: EditableSettings = {
    localCurrencyCode: code,
    rejectedSaleCodes: rejected,
    unbookedPolicy: input.unbookedPolicy,
    requireDifferentBatchUser: input.requireDifferentBatchUser,
    approvalRequiredFor: approvals,
    companyName: company,
    debitAccount: debit,
    bankCsvTransactionType: txType,
  };
  const previous = pickEditable(ctx.db.settings);
  const changed = EDITABLE_KEYS.filter((k) => JSON.stringify(previous[k]) !== JSON.stringify(next[k]));
  Object.assign(ctx.db.settings, next);
  if (changed.length > 0) {
    audit(ctx, {
      action: "settings.update",
      entityType: "Settings",
      entityId: "settings",
      entityRef: changed.join(", "),
      previous: Object.fromEntries(changed.map((k) => [k, previous[k]])),
      next: Object.fromEntries(changed.map((k) => [k, next[k]])),
      reason: cur !== code ? `Local currency changed ${cur} → ${code}` : undefined,
    });
  }
  return ctx.db.settings;
}

export function resetSettings(ctx: Ctx): Settings {
  requirePermission(ctx, "admin.settings");
  const previous = pickEditable(ctx.db.settings);
  Object.assign(ctx.db.settings, documentedSettingsDefaults());
  audit(ctx, { action: "settings.reset", entityType: "Settings", entityId: "settings", previous, next: pickEditable(ctx.db.settings), reason: "Reset to documented defaults" });
  return ctx.db.settings;
}

// ── Reference data ──────────────────────────────────────────────
const refPerm = (ctx: Ctx) => requirePermission(ctx, "admin.reference-data");

export function saveSeason(ctx: Ctx, input: { year: number }) {
  refPerm(ctx);
  const year = Math.trunc(input.year);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) failText("Season year must be between 2000 and 2100");
  if (ctx.db.seasons.some((s) => s.year === year)) failText(`Season ${year} already exists`);
  const season = { id: `season-${year}`, year, active: false };
  ctx.db.seasons.push(season);
  audit(ctx, { action: "season.create", entityType: "Season", entityId: season.id, entityRef: String(year), next: season });
  return season;
}

/** Exactly one season is active; activating one deactivates the rest and points the current season setting at it. */
export function activateSeason(ctx: Ctx, input: { id: string }) {
  refPerm(ctx);
  const season = ctx.db.seasons.find((s) => s.id === input.id);
  if (!season) failText("Season not found");
  const previous = { active: ctx.db.seasons.filter((s) => s.active).map((s) => s.year), seasonYear: ctx.db.settings.seasonYear };
  for (const s of ctx.db.seasons) s.active = s.id === season.id;
  ctx.db.settings.seasonYear = season.year;
  audit(ctx, { action: "season.activate", entityType: "Season", entityId: season.id, entityRef: String(season.year), previous, next: { active: [season.year], seasonYear: season.year } });
  return season;
}

export interface SaveSellingPointInput {
  /** Present when editing (the code is the key and cannot change). */
  id?: string;
  code: string;
  name: string;
  saleRooms: string[];
  floorRows: number;
  active: boolean;
}

export function saveSellingPoint(ctx: Ctx, input: SaveSellingPointInput) {
  refPerm(ctx);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,4}$/.test(code)) failText("Selling point code is 2–4 letters or digits (e.g. EL)");
  const name = input.name.trim();
  if (!name) failText("Selling point name is required");
  const rooms = [...new Set(input.saleRooms.map((r) => r.trim().toUpperCase()).filter(Boolean))];
  if (rooms.length === 0) failText("Add at least one sale room (e.g. A)");
  const rows = Math.trunc(input.floorRows);
  if (!Number.isFinite(rows) || rows < 1 || rows > 200) failText("Floor rows must be between 1 and 200");
  const existing = input.id ? ctx.db.sellingPoints.find((s) => s.id === input.id) : undefined;
  if (input.id && !existing) failText("Selling point not found");
  if (existing && existing.code !== code) failText("The selling point code cannot be changed");
  if (!existing && ctx.db.sellingPoints.some((s) => s.code === code)) failText(`Selling point ${code} already exists`);
  if (existing && !input.active && existing.id === ctx.db.settings.sellingPointId) failText("The current selling point cannot be deactivated");

  if (existing) {
    const previous = { name: existing.name, saleRooms: existing.saleRooms, floorRows: existing.floorRows, active: existing.active };
    Object.assign(existing, { name, saleRooms: rooms, floorRows: rows, active: input.active });
    audit(ctx, { action: "selling-point.update", entityType: "SellingPoint", entityId: existing.id, entityRef: code, previous, next: { name, saleRooms: rooms, floorRows: rows, active: input.active } });
    return existing;
  }
  const sp = { id: code, code, name, active: input.active, saleRooms: rooms, floorRows: rows };
  ctx.db.sellingPoints.push(sp);
  audit(ctx, { action: "selling-point.create", entityType: "SellingPoint", entityId: sp.id, entityRef: code, next: sp });
  return sp;
}

export function saveBaleLocation(ctx: Ctx, input: { originalCode?: string; code: string; description: string }) {
  refPerm(ctx);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,3}$/.test(code)) failText("Location code is 1–3 letters or digits (e.g. A)");
  const description = input.description.trim();
  if (!description) failText("Description is required");
  const existing = input.originalCode ? ctx.db.baleLocations.find((l) => l.code === input.originalCode) : undefined;
  if (input.originalCode && !existing) failText("Bale location not found");
  if (existing && existing.code !== code) failText("The location code cannot be changed");
  if (!existing && ctx.db.baleLocations.some((l) => l.code === code)) failText(`Location ${code} already exists`);
  if (existing) {
    const previous = { description: existing.description };
    existing.description = description;
    audit(ctx, { action: "bale-location.update", entityType: "BaleLocation", entityId: code, entityRef: code, previous, next: { description } });
    return existing;
  }
  const loc = { code, description };
  ctx.db.baleLocations.push(loc);
  audit(ctx, { action: "bale-location.create", entityType: "BaleLocation", entityId: code, entityRef: code, next: loc });
  return loc;
}

export function deleteBaleLocation(ctx: Ctx, input: { code: string }) {
  refPerm(ctx);
  const used =
    ctx.db.deliveryNotes.some((d) => d.location === input.code) ||
    ctx.db.transporterNotes.some((t) => t.growers.some((g) => g.location === input.code));
  if (used) failText(`Location ${input.code} is used by delivery notes and cannot be deleted`);
  const loc = ctx.db.baleLocations.find((l) => l.code === input.code);
  if (!loc) failText("Bale location not found");
  ctx.db.baleLocations = ctx.db.baleLocations.filter((l) => l.code !== input.code);
  audit(ctx, { action: "bale-location.delete", entityType: "BaleLocation", entityId: loc.code, entityRef: loc.code, previous: loc });
}

export interface SaveWarehouseInput {
  originalCode?: string;
  code: string;
  name: string;
  buyerCodes: string[];
  active: boolean;
}

export function saveWarehouse(ctx: Ctx, input: SaveWarehouseInput) {
  refPerm(ctx);
  const { db } = ctx;
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(code)) failText("Warehouse code is 3–12 letters or digits (e.g. CURVERID)");
  const name = input.name.trim();
  if (!name) failText("Warehouse name is required");
  for (const b of input.buyerCodes) if (!db.buyers.some((x) => x.code === b)) failText(`Unknown buyer: ${b}`);
  const existing = input.originalCode ? db.warehouses.find((w) => w.code === input.originalCode) : undefined;
  if (input.originalCode && !existing) failText("Warehouse not found");
  if (existing && existing.code !== code) failText("The warehouse code cannot be changed");
  if (!existing && db.warehouses.some((w) => w.code === code)) failText(`Warehouse ${code} already exists`);

  // Keep each buyer's packing warehouse in step (dispatch checks the bale's buyer against the destination).
  const buyerCodes = [...new Set(input.buyerCodes)];
  for (const buyer of db.buyers) {
    if (buyerCodes.includes(buyer.code)) buyer.packingWarehouseCode = code;
    else if (buyer.packingWarehouseCode === code) buyer.packingWarehouseCode = undefined;
  }
  if (existing) {
    const previous = { name: existing.name, buyerCodes: existing.buyerCodes, active: existing.active };
    Object.assign(existing, { name, buyerCodes, active: input.active });
    audit(ctx, { action: "warehouse.update", entityType: "Warehouse", entityId: code, entityRef: code, previous, next: { name, buyerCodes, active: input.active } });
    return existing;
  }
  const wh = { code, name, buyerCodes, active: input.active };
  db.warehouses.push(wh);
  audit(ctx, { action: "warehouse.create", entityType: "Warehouse", entityId: code, entityRef: code, next: wh });
  return wh;
}

export function setWarehouseActive(ctx: Ctx, input: { code: string; active: boolean }) {
  refPerm(ctx);
  const wh = ctx.db.warehouses.find((w) => w.code === input.code);
  if (!wh) failText("Warehouse not found");
  const previous = { active: wh.active };
  wh.active = input.active;
  audit(ctx, { action: input.active ? "warehouse.activate" : "warehouse.deactivate", entityType: "Warehouse", entityId: wh.code, entityRef: wh.code, previous, next: { active: wh.active } });
  return wh;
}

export function saveTimbGrade(ctx: Ctx, input: { originalCode?: string; code: string; description?: string; isReason: boolean }) {
  refPerm(ctx);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(code)) failText("Grade code is 2–6 letters or digits (e.g. A10)");
  const existing = input.originalCode ? ctx.db.timbGrades.find((g) => g.code === input.originalCode) : undefined;
  if (input.originalCode && !existing) failText("Grade not found");
  if (existing && existing.code !== code) failText("The grade code cannot be changed");
  if (!existing && ctx.db.timbGrades.some((g) => g.code === code)) failText(`Grade ${code} already exists`);
  const description = input.description?.trim() || undefined;
  if (existing) {
    const previous = { description: existing.description, isReason: existing.isReason };
    existing.description = description;
    existing.isReason = input.isReason;
    audit(ctx, { action: "timb-grade.update", entityType: "TimbGrade", entityId: code, entityRef: code, previous, next: { description, isReason: input.isReason } });
    return existing;
  }
  const grade = { code, description, isReason: input.isReason, isDemo: true as const };
  ctx.db.timbGrades.push(grade);
  audit(ctx, { action: "timb-grade.create", entityType: "TimbGrade", entityId: code, entityRef: code, next: grade });
  return grade;
}

export function deleteTimbGrade(ctx: Ctx, input: { code: string }) {
  refPerm(ctx);
  if (ctx.db.bales.some((b) => b.timbGrade === input.code)) failText(`Grade ${input.code} is used by captured bales and cannot be deleted`);
  const grade = ctx.db.timbGrades.find((g) => g.code === input.code);
  if (!grade) failText("Grade not found");
  ctx.db.timbGrades = ctx.db.timbGrades.filter((g) => g.code !== input.code);
  audit(ctx, { action: "timb-grade.delete", entityType: "TimbGrade", entityId: grade.code, entityRef: grade.code, previous: grade });
}

// ── Devices (simulation only) ───────────────────────────────────
/**
 * Create a SIMULATED scale reading — no physical scale is connected. Scale barcodes are `YYMMDD` + 4-digit sequence
 * (as in the documented 2609170001…). Mass is a deterministic demo value unless given.
 */
export function simulateScaleReading(ctx: Ctx, input: { mass?: number } = {}) {
  requirePermission(ctx, "admin.settings");
  const seq = nextSeq(ctx.db, "scaleBarcode");
  const scaleBarcode = `${yymmdd(ctx.today)}${padNum(seq, 4)}`;
  const mass = input.mass !== undefined ? Math.round(input.mass) : 85 + ((seq * 37) % 55);
  if (!Number.isFinite(mass) || mass <= 0 || mass > 400) failText("Mass must be between 1 and 400 kg");
  const reading = { scaleBarcode, mass, weighedAt: ctx.now, scaleId: "SCALE-1", isDemo: true as const };
  ctx.db.scaleReadings.push(reading);
  audit(ctx, { action: "device.simulate-weigh", entityType: "ScaleReading", entityId: scaleBarcode, entityRef: scaleBarcode, next: reading, reason: "Simulated weigh event — no physical scale connected" });
  return reading;
}

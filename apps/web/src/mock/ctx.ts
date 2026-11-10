import {
  AppError,
  type AppUser,
  type MessageKey,
  type MockDb,
  type Permission,
  type RoleDef,
} from "@tobacco/shared";

/**
 * Operation context passed to every mock "server-side" operation.
 * `db` is a DRAFT clone — mutate it freely; it is committed only if the operation returns without throwing.
 */
export interface Ctx {
  db: MockDb;
  actor: AppUser;
  /** Local-naive ISO timestamp on the demo sale day (e.g. 2026-09-17T09:41:22). */
  now: string;
  /** The demo "today" (the documented test sale day). */
  today: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Demo date + real wall-clock time, local-naive. */
export function mockNow(db: MockDb): string {
  const t = new Date();
  return `${db.settings.demoToday}T${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}`;
}

export function rolesOf(db: MockDb, user: AppUser): RoleDef[] {
  return user.roleIds.map((id) => db.roles.find((r) => r.id === id)).filter((r): r is RoleDef => Boolean(r));
}

/** Role permissions + overrides.grant − overrides.deny. Inactive users have none. */
export function effectivePermissions(db: MockDb, user: AppUser | undefined): Set<Permission> {
  const set = new Set<Permission>();
  if (!user || !user.active) return set;
  for (const role of rolesOf(db, user)) for (const p of role.permissions) set.add(p);
  for (const p of user.permissionOverrides.grant) set.add(p);
  for (const p of user.permissionOverrides.deny) set.delete(p);
  return set;
}

export function can(ctx: Ctx, permission: Permission): boolean {
  return effectivePermissions(ctx.db, ctx.actor).has(permission);
}

/** The mock equivalent of a backend guard. The real backend enforces this server-side (Phase 2). */
export function requirePermission(ctx: Ctx, permission: Permission): void {
  if (!can(ctx, permission)) throw new AppError("PERMISSION_DENIED", { permission });
}

export function userName(db: MockDb, userId: string | undefined): string {
  if (!userId) return "—";
  return db.users.find((u) => u.id === userId)?.name ?? userId;
}

// ── References ──────────────────────────────────────────────────
export type SeqKey = keyof MockDb["meta"]["seq"];

/** Increment and return the next number for a counter. */
export function nextSeq(db: MockDb, key: SeqKey): number {
  db.meta.seq[key] += 1;
  return db.meta.seq[key];
}

export const padNum = (n: number, width: number) => String(n).padStart(width, "0");

/** "TDN" + 2 → TDN0000002 */
export function docNo(prefix: string, n: number, width = 7): string {
  return `${prefix}${padNum(n, width)}`;
}

export function genericId(db: MockDb, prefix: string): string {
  return `${prefix}-${nextSeq(db, "generic")}`;
}

// ── Audit & notifications ───────────────────────────────────────
export interface AuditInput {
  action: string;
  entityType: string;
  entityId: string;
  entityRef?: string;
  previous?: unknown;
  next?: unknown;
  reason?: string;
  meta?: Record<string, unknown>;
}

/** Every transition and privileged action writes an audit entry (brief Part 9/11). */
export function audit(ctx: Ctx, input: AuditInput): void {
  const n = nextSeq(ctx.db, "audit");
  ctx.db.audit.unshift({
    id: `aud-${padNum(n, 4)}`,
    at: ctx.now,
    userId: ctx.actor.id,
    userName: ctx.actor.name,
    ...input,
  });
}

export function notify(
  ctx: Ctx,
  n: { level: "info" | "success" | "warning" | "error"; title: string; body: string; href?: string },
): void {
  ctx.db.notifications.unshift({
    id: genericId(ctx.db, "ntf"),
    at: ctx.now,
    read: false,
    ...n,
  });
}

export function fail(key: MessageKey, params: Record<string, string | number> = {}, field?: string): never {
  throw new AppError(key, params, field);
}

/** Throw a plain, non-catalogue error (rare — prefer catalogue messages). */
export function failText(message: string): never {
  throw new Error(message);
}

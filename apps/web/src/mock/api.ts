import type { AppUser, MockDb } from "@tobacco/shared";
import { useSession } from "@/lib/session";
import { mockNow, type Ctx } from "./ctx";
import { getDb, transact } from "./store";

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function resolveActor(db: MockDb): AppUser {
  const id = useSession.getState().userId;
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new Error("You are not signed in. Choose a demo user on the login page.");
  return user;
}

/**
 * Run a mock WRITE operation: artificial latency, then an atomic transaction.
 * The operation throws `AppError` (verbatim catalogue messages) to reject; nothing is committed in that case.
 * Use `latency` to keep rapid scanning snappy.
 */
export async function runAction<T>(fn: (ctx: Ctx) => T, opts: { latency?: number } = {}): Promise<T> {
  const latency = opts.latency ?? getDb().settings.latencyMs;
  if (latency > 0) await delay(latency);
  return transact((db) => fn({ db, actor: resolveActor(db), now: mockNow(db), today: db.settings.demoToday }));
}

/** Run a mock READ: artificial latency, then a selector over the current snapshot. */
export async function runQuery<T>(selector: (db: MockDb) => T, opts: { latency?: number } = {}): Promise<T> {
  const db = getDb();
  const latency = opts.latency ?? Math.round(db.settings.latencyMs * 0.8);
  if (latency > 0) await delay(latency);
  return selector(getDb());
}

/** Synchronous operation against the live DB (used by tests and scenario builders — no latency, no actor lookup). */
export function runSync<T>(actorId: string, fn: (ctx: Ctx) => T): T {
  return transact((db) => {
    const actor = db.users.find((u) => u.id === actorId);
    if (!actor) throw new Error(`Unknown actor ${actorId}`);
    return fn({ db, actor, now: mockNow(db), today: db.settings.demoToday });
  });
}

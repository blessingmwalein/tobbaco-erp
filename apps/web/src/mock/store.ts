import { MOCK_DB_VERSION, createSeedDb } from "@tobacco/shared/fixtures";
import type { MockDb } from "@tobacco/shared";

/**
 * MOCK database: one in-memory object persisted to localStorage.
 * Phase 1 only — the NestJS backend replaces this entirely and is authoritative (docs/architecture/adr-0002).
 *
 * Every write goes through `transact`: clone → mutate the clone → commit on success, discard on throw.
 * That gives atomic "all or nothing" operations and immutable snapshots (old references never change),
 * which keeps React and TanStack Query structural sharing happy.
 */
const STORAGE_KEY = "tobacco-erp-mock-db";

let current: MockDb | null = null;
const listeners = new Set<() => void>();
const serverSnapshot = createSeedDb();

function load(): MockDb {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDb;
        if (parsed?.meta?.version === MOCK_DB_VERSION) return parsed;
      }
    } catch {
      /* corrupt or unavailable storage → reseed */
    }
  }
  return createSeedDb();
}

export function getDb(): MockDb {
  current ??= load();
  return current;
}

/** Stable snapshot for server rendering / hydration. */
export function getServerDb(): MockDb {
  return serverSnapshot;
}

function persist(db: MockDb) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage may be full or blocked; the in-memory state still works */
  }
}

export function setDb(next: MockDb) {
  current = next;
  persist(next);
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Run a mutation atomically. Throwing inside `fn` discards every change. */
export function transact<T>(fn: (db: MockDb) => T): T {
  const draft = structuredClone(getDb());
  const result = fn(draft);
  setDb(draft);
  return result;
}

export function resetDb(): MockDb {
  const fresh = createSeedDb();
  setDb(fresh);
  return fresh;
}

export function clearPersistedDb() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

import type { MockDb, ScenarioId } from "@tobacco/shared";
import type { Ctx } from "./ctx";
import { buildScenario } from "./scenarios";

/**
 * Helpers for unit-testing mock domain operations WITHOUT React, localStorage or latency.
 *
 *   const db = dbAt("TICKETS_CONFIRMED");
 *   const ctx = ctxFor(db, "floor-summary-clerk");
 *   scanTicket(ctx, { row: 1, barcode: "1000001013" });   // mutates db in place
 *   expect(db.bales.find(...).floorRow).toBe(1);
 *
 * Operations mutate `ctx.db` directly (in the app it is a transaction draft). To assert atomicity, clone first:
 *   const before = structuredClone(db); expect(() => op(ctx, bad)).toThrow(); and compare — real transactions discard
 *   changes on throw, so tests of failure paths should call `attempt(db, roleId, fn)`.
 */
export function dbAt(scenario: ScenarioId = "FRESH"): MockDb {
  return buildScenario(scenario);
}

export function ctxFor(db: MockDb, roleId: string, at = "12:00:00"): Ctx {
  const actor = db.users.find((u) => u.id === `user-${roleId}`);
  if (!actor) throw new Error(`No demo user for role ${roleId}`);
  return { db, actor, now: `${db.settings.demoToday}T${at}`, today: db.settings.demoToday };
}

/** Run an operation the way the app does: on a clone, committing only if it returns. Returns the committed db. */
export function attempt<T>(db: MockDb, roleId: string, fn: (ctx: Ctx) => T): { db: MockDb; result: T } {
  const draft = structuredClone(db);
  const result = fn(ctxFor(draft, roleId));
  return { db: draft, result };
}

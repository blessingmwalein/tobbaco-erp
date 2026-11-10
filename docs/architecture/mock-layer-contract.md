# Mock layer contract (Phase 1)

Phase 1 is a complete UI on **mock data**. The mock layer is deliberately shaped like the future backend so that Phase 2 replaces `src/mock/` with an API client and nothing in the pages changes shape. The backend will be authoritative; nothing here is.

## Layers (apps/web/src)

| Layer | Files | Rule |
|---|---|---|
| Types, enums, permissions, roles, message catalogue, fixtures | `packages/shared` | Single source of truth. Money = integer cents; decimals via `decimal.js`. |
| Pure validators and Zod schemas | `packages/validation` | No I/O, no React. Messages come from the catalogue (verbatim e-Port text). |
| Mock DB | `mock/store.ts` | One object, persisted to localStorage; every write is `transact` (clone → mutate → commit, or discard on throw). |
| Operation context | `mock/ctx.ts` | `Ctx {db (draft), actor, now, today}`, `requirePermission`, `audit`, `notify`, `nextSeq`, `docNo`, `fail(MessageKey)`. |
| Domain operations ("server") | `mock/domain/<module>.ts` | `(ctx, input) => result`. Check permission FIRST, validate, mutate `ctx.db`, `audit(...)`. Throw `AppError` for rule failures. |
| Runner + hooks | `mock/api.ts`, `mock/hooks.ts` | `useDbQuery(key, selector)` (latency → skeletons), `useDb(selector)` (instant), `useAction(fn, opts)` → `run(input)` never rejects. |
| Scenario presets | `mock/scenarios.ts` | DB state at each sale-day stage, built directly from documented data. Defines what "state after stage X" looks like — operations must be compatible. |
| UI | `components/**`, `app/**` | No business rules in components. |

## Writing an operation

```ts
export function confirmTicketPrinting(ctx: Ctx, input: { gdnId: string }) {
  requirePermission(ctx, "tickets.confirm");          // 1. permission
  const note = ctx.db.deliveryNotes.find(d => d.id === input.gdnId) ?? failText("Delivery note not found");
  if (note.state !== "TICKETS_PRINTING") failText("…");   // 2. status guard
  // 3. prerequisites → fail("BALE_NO_BARCODE", { line: 2 })   (verbatim catalogue message)
  note.state = "CHECKED";                              // 4. mutate the draft
  audit(ctx, { action: "tickets.confirm", entityType: "DeliveryNote", entityId: note.id, entityRef: note.docNo,
               previous: { state: "TICKETS_PRINTING" }, next: { state: "CHECKED" } });   // 5. audit every transition
  return note;
}
```

Never decide state in a component. Components call `useAction(op)` and render the result or the thrown message.

## Writing a page

- Client component (`"use client"`), `PageHeader` (back office) or `WorkspaceHeader` (floor), wrapped in `RequirePermission`.
- Reads: `useDbQuery(["module","thing",param], db => selector)`; show `Skeleton`/`DataTable loading`, `EmptyState`, `ErrorState`.
- Writes: `PermissionButton permission="…"` + `useAction`; `ConfirmDialog` for consequential actions; toasts via `useAction({ success })`.
- Forms: React Hook Form + Zod schema from `@tobacco/validation`; inline errors; required markers; logical tab order.
- Status: `StatusBadge`. References: `entity-links.tsx`. Money: `formatUsd(cents)`; local currency via `convertCentsToLocal` + `formatLocal`.
- Anything not in the manuals: `DemoBadge` (invented data) or `UnverifiedBadge uq="UQ-nn"` (behaviour/value the manuals do not confirm) and an entry in `docs/research/unresolved-business-questions.md`.
- Floor workspaces: `components/floor/workspace.tsx` (`WorkspaceHeader`, `TallyCard`, `ScanPanel`, `SimulateScan`, `useScanFeed`). Scan handlers use `useAction(..., { latency: 30, silent: true })` and return `ScanOutcome` — no modal per scan, focus returns to the field.

## Route parameters

`id` of the entity (e.g. `/receiving/delivery-notes/gdn-0000005`, `/sales/sale-4`, `/batches/batch-4`, `/dispatch/<id>`), except growers (`/growers/V100060`) and pay batches (`/finance/payments/1001`).

## Honesty rules

No physical scanner, scale, printer, bank or CloudPay is connected. Simulated sources are labelled. CSV download never marks growers paid. Payment confirmation is an explicit audited entry. Real TIMB decryption is not implemented — the dev sample importer must say so.

## Testing

- Domain operations: Vitest, `src/mock/testing.ts` (`dbAt(scenario)`, `ctxFor(db, roleId)`, `attempt`).
- Flows: Playwright in `e2e/` using `e2e/helpers.ts` (`resetDemo`, `signInAs`, `jumpTo`, `go`). Each test gets a fresh browser context (fresh demo DB).
- Screenshots: add rows to `e2e/screens/<module>.screens.ts`.

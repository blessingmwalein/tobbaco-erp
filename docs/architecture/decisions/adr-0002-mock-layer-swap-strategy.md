# ADR-0002 — Mock layer with a clean swap path to the backend

- **Status:** Accepted
- **Date:** 2026-11-09

## Context
Phase 1 delivers the full UI on mocked data and must stop for approval before any backend exists. The mock must not become throw-away: swapping to the real API in Phase 2 should be a contained change, and business rules must not live in React components.

## Decision
- `packages/shared`: domain types, status enums, permission keys, verbatim message catalogue, seed fixtures (documented vs DEMO flagged).
- `packages/validation`: Zod schemas and pure validators (barcodes, group/lot, price, Start of Day rules) reusable by the future backend.
- `apps/web/src/mock/`: in-memory mock DB persisted to localStorage + `mockApi` (async with artificial latency) implementing every transition with guards, actor, timestamp and audit entry.
- TanStack Query hooks call a **service interface** (`SaleDayService`, `ReceivingService`, …); in Phase 1 the implementation is `mockApi`, in Phase 2 a fetch/OpenAPI client. Components only use hooks.
- Zustand holds UI-only shared state (demo role, filters, sidebar, scan history, sound toggle).
- Pure domain functions under `src/domain/` (guards, balancing preview); **never** in components.
- A client-only provider hydrates the mock DB after mount (no hydration mismatch) and provides real loading states.
- Scenario presets are produced by replaying `mockApi` actions (not hand-written snapshots), plus Reset Demo.
- The mock is visibly labelled "Simulated — backend will be authoritative"; the frontend never claims authority over financial values or workflow states.

## Consequences
+ Phase 2 replaces `mockApi` with real endpoints; hooks and components stay.
+ Validators and messages are shared, reducing drift.
− Duplicate guard logic exists temporarily in mock and backend; backend tests become the source of truth, mock updated to match.

Sources: brief Parts 12, 13, 14, 16.

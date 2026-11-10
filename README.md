# Tobacco ERP — Zimbabwe tobacco floor operations

A modern, role-aware operations system that reproduces the documented **e-Port** sale-day lifecycle — Daily Setup → TIMB booking import → Receiving → Ticket printing → Floor summary → Data capture → Batch processing → Balancing → Stop orders & deductions → Grower payment → Floor dispatch — with a much better interface, stronger access control and an audit trail.

> **Status: Phase 1 — complete UI on mocked data, awaiting approval.**
> There is no backend yet by design. Everything runs on a local mock database in the browser (the documented 17 September 2026 Ethical test day). No physical scanner, scale, printer, bank, CloudPay or real TIMB decryption is connected, and the UI says so wherever it matters. The NestJS/Neon backend starts only after the UI is approved.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000  — pick a demo role on the login page
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e            # Playwright (starts/reuses the dev server)
pnpm screens        # captures docs/review/screenshots/*.png
```

Requires Node ≥ 22 and pnpm 10. Open the user menu → **Demo controls** to jump to any stage of the sale day or reset the data.

## Layout

```
apps/web                Next.js (App Router) — back office (app) + floor workspaces (floor)
packages/shared         domain types, permissions, roles, verbatim message catalogue, fixtures
packages/validation     Zod schemas + pure business-rule validators (shared with the future API)
packages/ui             shadcn-style components customised into the design system
packages/design-system  design tokens (CSS variables, Tailwind v4 theme, TS constants)
packages/config         shared tsconfig presets
docs/                   research (manual analysis), architecture, workflows, security, design, review
```

`apps/api` (NestJS modular monolith, Prisma, Neon, Vercel) is deliberately **not** created yet.

## Read next

- `docs/README.md` — documentation index (research from the nine manuals, business rules, status transitions, unresolved questions)
- `docs/architecture/mock-layer-contract.md` — how the mock layer mirrors the future backend
- `docs/review/phase-1-ui-review.md` — screens, routes, journeys, gaps and the approval request
- `docs/progress.md` — phase checklist and decision log

## Principles

- The e-Port manuals are the source of truth. Anything they don't document is built configurable and marked **Unverified** or **Demo**, and logged in `docs/research/unresolved-business-questions.md`.
- Business rules live in pure functions and mock operations, never in React components. The backend will be authoritative.
- Money is integer cents / `decimal.js` — never floating point.
- Downloading a bank CSV never marks growers paid; payments are only marked paid by an explicit, audited confirmation.
# tobbaco-erp

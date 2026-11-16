# Tobacco ERP — Zimbabwe tobacco floor operations

A modern, role-aware operations system for the Zimbabwe tobacco floor, covering the full sale day — Daily Setup → TIMB booking import → Receiving → Ticket printing → Floor summary → Data capture → Batch processing → Balancing → Stop orders & deductions → Grower payment → Floor dispatch — with a clear, fast interface, granular access control and a full audit trail.

> **Status: Buyer Portal implemented — local development setup below.**
> The internal ERP screens retain their mocked data layer. The Buyer Portal has a NestJS/Prisma API with Neon PostgreSQL support, demo authentication, Flow Disk import, bale traceability and warehouse/processing workflows.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000 — internal ERP UI
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

`apps/api` is the NestJS modular monolith for the Buyer Portal. It uses Prisma with Neon PostgreSQL in development and stores demo mail in the database outbox.

## Run the Buyer Portal locally

1. Copy `apps/api/.env.example` to `apps/api/.env`, add your Neon **dev** branch `DATABASE_URL` and `DIRECT_URL`, and set a local `JWT_ACCESS_SECRET`. The database URLs stay in `.env` and must not be committed.
2. From the repository root run:

   ```bash
   pnpm --filter @tobacco/api env:init
   pnpm --filter @tobacco/api local:setup
   ```

   `local:setup` applies migrations, seeds the demo users/warehouses/processing companies, and writes the sample Flow Disk files.
3. Start the API and web app in separate terminals:

   ```bash
   pnpm --filter @tobacco/api dev   # http://localhost:4000
   pnpm dev                         # http://localhost:3000
   ```

   Open `http://localhost:3000/buyer/login`. Demo users share the `SEED_PASSWORD` from `apps/api/.env` (default: `Demo-Tobacco-2026`):

   - `admin@moroz-demo.test`
   - `warehouse@moroz-demo.test`
   - `operations@moroz-demo.test`
   - `finance@moroz-demo.test`
   - `viewer@moroz-demo.test`

   Staff login: `admin@tobacco-erp.test`.

The generated files are `apps/api/samples/flowdisk/MZ_20260522.V` and `.csv`, based on the supplied invoice PDF and its 43-bale extracted fixture. The original PDF is available as the test fixture at `apps/api/test/fixtures/rptDetailBuyerInvoice22.pdf`.

## Read next

- `docs/README.md` — documentation index (research from the nine manuals, business rules, status transitions, unresolved questions)
- `docs/architecture/mock-layer-contract.md` — how the mock layer mirrors the future backend
- `docs/review/phase-1-ui-review.md` — screens, routes, journeys, gaps and the approval request
- `docs/progress.md` — phase checklist and decision log

## Principles

- The operating manuals are the source of truth. Anything they don't document is built configurable and marked **Unverified** or **Demo**, and logged in `docs/research/unresolved-business-questions.md`.
- Business rules live in pure functions and mock operations, never in React components. The backend will be authoritative.
- Money is integer cents / `decimal.js` — never floating point.
- Downloading a bank CSV never marks growers paid; payments are only marked paid by an explicit, audited confirmation.
# tobbaco-erp

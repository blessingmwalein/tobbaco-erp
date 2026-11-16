# Buyer Portal — engineering guide

How every Buyer Portal module is built. The **reference implementation** is `apps/api/src/modules/buyer-admin/` (API) with its contracts in `packages/shared/src/buyer/dto/buyer-admin.ts` and `packages/validation/src/buyer/buyer-admin.ts`, and its tests in `apps/api/test/buyer-admin.e2e-spec.ts`. Read those first and copy their shape.

Requirements live in [FEATURE-BRIEF.md](./FEATURE-BRIEF.md) (the owner's brief, verbatim). Overall plan: stages 0–7.

## Ground rules

1. **Never commit, push or stash.** The sample invoice and derived data are real business data.
2. **Stay inside the files you own** (named in your task). Shared files — `prisma/schema.prisma`, `prisma/migrations/**`, `modules/ledger/**`, `modules/auth/**`, `common/**`, `database/**`, `lib/api/**`, `components/buyer/buyer-shell.tsx`, `lib/buyer-nav.ts`, `packages/ui/**`, the internal ERP (`app/(app)`, `app/(floor)`, `mock/**`) — belong to the integrator. If you need a change there, work around it inside your files and say so in your report.
3. **The schema is final.** It already contains every table you need. If you believe a column or constraint is missing, do not edit the schema or migrations (other agents run migrations at the same time): note it in your report.
4. **Do not redesign or break the internal ERP.** Buyer pages use the same `@tobacco/ui` components and design tokens.
5. Business rules are enforced **on the server**. The UI only helps.
6. Report faithfully: what you built, what you ran (with the real results), what is not done, and any assumption you made.

## API module recipe (`apps/api/src/modules/<name>/`)

* **Files:** `<name>.module.ts` (already registered in `modules/feature-modules.ts`; fill in controllers/providers — do not touch `feature-modules.ts`), `<name>.controller(s).ts`, `<name>.service.ts`, pure helpers in their own files with unit specs (`*.spec.ts`).
* **Providers use explicit `@Inject(Class)`** in constructors (no emitted decorator metadata — the code runs under tsx/esbuild/Vercel).
* **Routes:** buyer-facing endpoints are `/buyer/<resource>`; staff-only are `/staff/<resource>`. Global prefix `/api/v1`. Swagger tags with `@ApiTags`.
* **Auth is secure by default** (global `AuthGuard`). Decorate every buyer route with `@RequireBuyerPermission("buyer.…")` (permission keys: `packages/shared/src/buyer/permissions.ts`) — class- or method-level. `@CurrentBuyer()` gives the principal; its `organisationId` is the ONLY source of tenant identity. **Never accept an organisation id from the URL/body for buyer routes.**
* **Validation:** Zod schemas live in `packages/validation/src/buyer/<name>.ts` (shared with the web forms; export from `packages/validation/src/buyer/index.ts` — add one line). Controllers use `new ZodValidationPipe(schema)` for body, query and `uuidSchema` for `:id` params. Lists use `pageQuerySchema`/`pageArgs`/`toPage`/`orderBy` (`common/pagination.ts`; sort fields are whitelisted).
* **Wire types (DTOs):** `packages/shared/src/buyer/dto/<name>.ts` (stub already exported). Dates are ISO strings; money and weights are **decimal strings** (`Prisma.Decimal#toString()` / `toFixed`), never JS floats. Services return DTOs, never raw Prisma rows.
* **Tenancy:** every buyer-owned table carries `buyerOrganisationId`. Use `this.prisma.forOrganisation(orgId)` for reads and `this.prisma.tenantTransaction(orgId, async (tx) => …)` for state changes — the Prisma extension injects/validates the organisation. A row of another company simply is not found → **404, not 403**. "Wrong buyer" scans must reveal no detail about another company's bale.
* **State changes:** one `tenantTransaction` per business action; the **audit row is written inside the same transaction** (`AuditService.record(tx, principal, entry, meta)`); validate preconditions inside the transaction; use conditional `updateMany({ where: { id, status: "…" } })` + `count` check when two requests could race. Fixed errors: `AppError.badRequest/notFound/conflict/unprocessable(code, message)` with stable machine codes (409 for state conflicts, 422 for failed business validation).
* **Inventory:** never write `Bale.status` / current location, `BaleMovement` or `BaleEvent` directly. Use `LedgerService` (`modules/ledger/ledger.service.ts`): `resolveLocation`, `receive`, `place`, `dispatchOut`, `returnIn`, `reidentify`, `appendEvent`, `makeLedgerCtx(tx, principal)`. It keeps the projection, the movement ledger and the timeline consistent in one transaction. `LedgerService.reconcileProjection(orgId)` must return `[]` after any flow you build — assert it in your tests.
* **References** (dispatch, receiving, …): `nextSequence` / `formatReference` in `common/reference.ts` (atomic per organisation).
* **Documents:** `DocumentStorage` (`storage/`), metadata in the `Document` table (sha256, size, mime, organisation).
* **Immutable tables:** `BaleEvent`, `BaleMovement`, `AuditLog` reject UPDATE/DELETE at the database level. Corrections are new rows.
* **Barcodes:** 10 characters = 9 digits + a Code 39 mod-43 check character, which **may be a space** — never `trim()` a barcode. Use `checkBaleBarcode` from `@tobacco/shared`.
* **Flow Disk v0:** `modules/flowdisk/flowdisk.parser.ts` accepts the representative pipe-delimited `.V` format and the invoice-shaped CSV export. It preserves raw barcode whitespace, reports row-level validation issues (including duplicate barcodes and mass/value mismatches), and excludes invalid rows from preview totals. `formatVerified` remains false until the format is confirmed against an official sample.

## API tests

* Unit specs: `src/**/*.spec.ts` → `pnpm --filter @tobacco/api test`.
* Integration specs: `test/*.e2e-spec.ts` → real HTTP (Supertest) against a real PostgreSQL. Use `describeDb`, `boot()`, `loginBuyer`, `bearer` from `test/helpers.ts`, and `makePurchase` / `makeBale` from `test/fixtures.ts`. `boot()` **truncates the whole database** and re-seeds the demo accounts, so each agent has its **own scratch database** (given in your task):

  ```bash
  cd apps/api
  TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/<your_db> \
    npx jest --config jest.integration.config.cjs --runInBand <name-pattern>
  ```
* Seed accounts (password `Test-Password-2026` in tests): `admin|warehouse|operations|finance|viewer@moroz-demo.test` (company MZ) and `admin@kt-demo.test` (company KT — use it for every cross-tenant test).
* Every module's integration suite must cover: **happy path, validation errors (422), each role that must be refused (403 `PERMISSION_DENIED`), cross-tenant access (404 and nothing leaked), and the module's own invariants** (duplicates, double actions, rollback on failure, concurrency where it matters).
* Typecheck with `npx tsc --noEmit` in `apps/api` and in every package you touched.

## Web recipe (`apps/web`)

* Pages live in `src/app/(buyer)/buyer/<area>/…` (the layout already provides `BuyerShell`, auth gate and navigation: `src/lib/buyer-nav.ts` lists the routes the sidebar links to — **build the pages for the routes in your area**). Feature components go in `src/components/buyer/<area>/`.
* Data: `buyerApi` / `useBuyerQuery(path, query)` / `useBuyerMutation(fn, { invalidate, success })` from `@/lib/api`. Errors are `ApiError` (`code`, `message`, `fieldErrors` for 422). Uploads: `buyerApi.upload(path, formData)`; files: `buyerApi.download(path)` + `saveBlob`.
* Permissions: wrap pages in `<RequireBuyerPermission permission="…">`; gate buttons with `useBuyerGuard(permission)` (disable with the explanatory reason, don't hide silently). The API is authoritative.
* UI: reuse `@tobacco/ui` (`PageHeader`, `DataTable`, `StatCard`, `Badge`, `Callout`, `EmptyState`, `ErrorState`, `Skeleton`, `Field`, dialogs, tabs …) and the tokens in `globals.css`; look at `apps/web/src/app/(app)/**` and `apps/web/src/components/**` for the established look (dense, restrained tables; clear status badges; every list has loading / empty / error states). For scanning use `BarcodeScannerInput` from `@tobacco/ui` and the patterns in `components/floor/workspace.tsx`. No generic dashboard templates, no gradients/glassmorphism.
* Forms: React Hook Form + `zodResolver(<schema from @tobacco/validation>)`; show server `fieldErrors`; `method="post"` is not needed for in-portal forms but never put secrets in URLs.
* Accessibility: labelled controls, `aria-*` on status, keyboard operable, colour is never the only signal (the repo runs an axe sweep). Add `data-testid` on key actions for Playwright.
* Browser journeys live in `apps/web/e2e/buyer/*.spec.ts` (`pnpm --filter @tobacco/web e2e:buyer`, real API + database; helpers in `e2e/buyer/helpers.ts`; wait for hydration with `gotoAuthPage`/visible shell before interacting; use short action timeouts). Write them, but the integrator runs the browser suite — do not start long-running dev servers on port 3000/3100/4000.
* Typecheck/lint: `npx tsc --noEmit` and `npx eslint <your files>` in `apps/web`.

## Definition of done for a module

Typecheck clean (api + web + packages touched); unit + integration tests written and passing; role matrix and cross-tenant tests included; no `any` shortcuts hiding type problems; no TODOs for core behaviour; the web pages for the area exist with loading/empty/error states; and a report listing files, endpoints, tests run (with counts) and open questions.

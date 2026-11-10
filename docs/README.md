# Tobacco ERP — Documentation Index

Zimbabwe tobacco-floor ERP reproducing the documented e-Port sale-day lifecycle. **Current status: Phase 0 complete (docs); Phase 1 (complete UI on mocked data) built and awaiting owner approval; Dribbble design fusion pending the reference images. No backend until the UI is approved.** See [progress.md](progress.md).

**Start here:** [MASTER-PROMPT.md](MASTER-PROMPT.md) — the full, current project prompt (phase gates: UI first on mocked data → owner approval → backend and integrations). Then [review/phase-1-ui-review.md](review/phase-1-ui-review.md) for what was built.

## Research (source of truth = the nine e-Port manuals)
- [existing-system-overview.md](research/existing-system-overview.md)
- Manuals: [01 Daily Setup](research/manual-01-daily-setup.md) · [02 TIMB Booking Import](research/manual-02-timb-booking-import.md) · [03 Receiving](research/manual-03-receiving.md) · [04 Ticket Printing](research/manual-04-ticket-printing.md) · [05 Floor Summary](research/manual-05-floor-summary.md) · [06 Data Capture & Balancing](research/manual-06-data-capture-balancing.md) · [07 Stop Orders & Deductions](research/manual-07-stop-orders-deductions.md) · [08 Grower Payment](research/manual-08-grower-payment.md) · [09 Floor Dispatch](research/manual-09-floor-dispatch.md)
- [role-permission-matrix.md](research/role-permission-matrix.md)
- [business-rules.md](research/business-rules.md)
- [status-transitions.md](research/status-transitions.md)
- [integration-requirements.md](research/integration-requirements.md)
- [system-messages.md](research/system-messages.md) (verbatim catalogue → `packages/shared/src/messages.ts`)
- [unresolved-business-questions.md](research/unresolved-business-questions.md) (UQ-01 … UQ-28)
- [demo-dataset.md](research/demo-dataset.md) (17 Sep 2026 scenario: documented vs DEMO)

## Architecture
- [mock-layer-contract.md](architecture/mock-layer-contract.md) — how the Phase 1 mock layer mirrors the future backend
- [module-map.md](architecture/module-map.md) · [route-map.md](architecture/route-map.md) · [entity-map.md](architecture/entity-map.md) · [integration-boundaries.md](architecture/integration-boundaries.md) · [deployment-constraints.md](architecture/deployment-constraints.md)
- ADRs: [0001 monorepo + modular monolith](architecture/decisions/adr-0001-monorepo-and-modular-monolith.md) · [0002 mock layer swap](architecture/decisions/adr-0002-mock-layer-swap-strategy.md) · [0003 two shells](architecture/decisions/adr-0003-two-application-shells.md) · [0004 money & currency](architecture/decisions/adr-0004-money-decimals-and-currency-config.md) · [0005 device adapters](architecture/decisions/adr-0005-scanner-scale-printer-adapters.md) · [0006 testing stack](architecture/decisions/adr-0006-testing-stack.md)

## Workflows
- [sale-day-lifecycle.md](workflows/sale-day-lifecycle.md) · [stage-flows.md](workflows/stage-flows.md)

## Security
- [rbac-model.md](security/rbac-model.md) · [audit-events.md](security/audit-events.md)

## Design
- [design-tokens.md](design/design-tokens.md) · [components.md](design/components.md) · [app-shells.md](design/app-shells.md) · [scanner-workspace-guidelines.md](design/scanner-workspace-guidelines.md)
- [references/](design/references/README.md) — **drop the two Dribbble shots here** (Moverta TMS, Truck&Co TMS) so their look can be fused into the design

## Review (Phase 1 approval gate)
- [phase-1-ui-review.md](review/phase-1-ui-review.md) — generated: screens + screenshots, routes, components, journeys, mock data, gaps, questions, backend integration points (`node scripts/build-review-doc.mjs`)

## Reading order for newcomers
1. `research/existing-system-overview.md` → 2. `workflows/sale-day-lifecycle.md` → 3. `research/business-rules.md` and `status-transitions.md` → 4. `research/unresolved-business-questions.md` → 5. `architecture/*` → 6. `design/*`.

Conventions: documented facts vs **proposed** (brief/design) vs **unverified** items are always labelled; demo data is flagged **DEMO**. Never add a business rule without citing a manual.

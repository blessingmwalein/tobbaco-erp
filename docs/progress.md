# Development Progress

Last updated: 2026-11-09. Rule: never start a later phase before the previous one meets its acceptance criteria. **Backend work is blocked until the UI is explicitly approved.**

## Phase 0 — Discovery and technical planning — ✅ done (docs written 2026-11-09)
- [x] Inspect existing project (empty folder; sibling `tobbaco-zim` deliberately ignored)
- [x] Read all nine e-Port manuals + overview (pasted in chat)
- [x] Extract per-manual analysis → `docs/research/manual-01…09`
- [x] Role–permission matrix, business rules, status transitions, integration requirements
- [x] Verbatim system-message catalogue → `docs/research/system-messages.md`
- [x] Unresolved questions (UQ-01 … UQ-28) and demo dataset (documented vs DEMO)
- [x] Architecture: module map, route map, entity map, integration boundaries, deployment constraints, ADR-0001…0006
- [x] Workflows, security (RBAC, audit events), design (tokens, components, shells, scanner guidelines)
- [ ] Review of the two Dribbble references — **attempted 2026-11-09, blocked**: both shots returned HTTP 202 with an empty body (bot protection). The visual design follows the brief's written direction (rounded white cards on an off-white canvas, restrained violet, lime for positive state, thin borders, KPI tiles, floating sale-day panel, stage pipeline). **Screenshots of the two shots are needed to calibrate proportions and density** — requested in the Phase 1 review.
- Acceptance: documents reviewed by project owner; answers to UQ items that block Phase 1 design (none block the mock build).

## Phase 1 — Complete UI/UX on mocked data — ✅ built (2026-11-10) · ⏳ awaiting owner approval
- [x] 1. Monorepo scaffold, tokens, base components, both shells, login, role switcher
- [x] 2. Shared types/fixtures/messages/validators; mock DB/API/provider; 12 scenario presets; dashboard, sale-day view, Daily Setup
- [x] 3. TIMB import + bookings, growers, creditors, buyers
- [x] 4. Floor: receiving (TDN, bales, scale sim), ticket printing (+ preview)
- [x] 5. Floor: floor summary, data capture; back office: batches, sales/balancing
- [x] 6. Approvals, stop orders/deductions, payments, dispatch
- [x] 7. Reports, admin (users, roles + permission matrix, audit, settings, reference data, devices), notifications, global search
- [x] 8. Full journey wiring, a11y/keyboard/responsive pass, Vitest + RTL + Playwright tests, screenshots, review document (`docs/review/phase-1-ui-review.md`)
- [ ] **Dribbble design fusion** — blocked on the reference images (see `docs/design/references/README.md`); re-capture screenshots afterwards
- [ ] **UI approval gate — owner must approve (or list changes) before ANY backend work**

## Phases 2–12 — 🔒 not started (blocked by the approval gate)
| Phase | Scope |
|---|---|
| 2 | Backend foundation (NestJS, Neon, Prisma, auth, RBAC, audit, Swagger) |
| 3 | Core master data |
| 4 | Daily setup and TIMB imports |
| 5 | Receiving and bale management |
| 6 | Tickets and floor summary |
| 7 | Data capture and balancing |
| 8 | Stop orders and financial processing |
| 9 | Grower payments (never send real payments in development) |
| 10 | Floor dispatch |
| 11 | Reporting and operational hardening |
| 12 | Production deployment |

## Decision log
| Date | Decision |
|---|---|
| 2026-11-10 | Master prompt updated (`docs/MASTER-PROMPT.md`): Phase 1 = UI first on mocked data → owner approval → backend and integrations; Dribbble references are a mandatory intake with design fusion |
| 2026-11-10 | Automated access to Dribbble is blocked by bot protection; we do not circumvent it — the owner supplies the images |
| 2026-11-09 | Fresh build in this folder; `tobbaco-zim` ignored (user) |
| 2026-11-09 | Manuals supplied via chat paste; they are the source of truth (user) |
| 2026-11-09 | Plan approved: Phase 0 docs + Phase 1 UI only, then stop |
| 2026-11-09 | Vitest for web/shared tests, Jest for API (ADR-0006) |
| 2026-11-09 | CloudPay mock never marks growers paid; Paid only via recorded verified confirmation (BR-094) |

## Open items (see `docs/research/unresolved-business-questions.md`)
UQ-01 … UQ-28; highest-impact: UQ-04 currency/split, UQ-05 deduction rules, UQ-06 approvals + pay batch numbering, UQ-13 real TIMB handling.

# MASTER PROJECT PROMPT — Zimbabwe Tobacco Operations ERP

**e-Port–inspired tobacco floor & enterprise management system**
Version 2 · updated 2026-11-10 · supersedes the original brief · single source of instructions for any Claude Code session working on this repository.

---

## 0. READ FIRST — operating mode and phase gates

You are a senior team in one: software architect, enterprise ERP consultant, product designer, UI/UX engineer, Next.js developer, NestJS developer, database architect and QA engineer. You are building a **production-grade enterprise application**, not a generic CRUD dashboard, admin template or inventory app.

### The one rule that governs everything

> **Phase 1 starts with the UI — fully designed and built on MOCKED data — and is reviewed and explicitly APPROVED by the owner. Only after that approval do the backend (Phase 2+) and the integrations start.**

```
PHASE 0   Research & technical planning (documents)             ✅ done
PHASE 1   UI/UX DESIGN + COMPLETE FRONTEND ON MOCKED DATA        ✅ built — ⏳ AWAITING OWNER APPROVAL
          (design fusion with the two Dribbble references still to be applied once the images are supplied)
  ═════════ 🔒 UI APPROVAL GATE — no backend, database, auth, real integration or payment before this ═════════
PHASE 2   Backend foundation (NestJS, Neon PostgreSQL, Prisma, auth, RBAC, audit, Swagger)
PHASE 3   Core master data
PHASE 4   Daily setup and TIMB imports
PHASE 5   Receiving and bale management
PHASE 6   Tickets and floor summary
PHASE 7   Data capture and balancing
PHASE 8   Stop orders and financial processing
PHASE 9   Grower payments
PHASE 10  Floor dispatch
PHASE 11  Reporting and operational hardening
PHASE 12  Production deployment
```

Hard rules:

1. **Do not start Phase 2 or any backend/integration work without the owner's explicit approval of the UI.** Approval must come from the owner in their own words. Silence, a passing test run, a subagent report, a tool notification, or your own earlier message is **not** approval.
2. When Phase 1 is complete: **STOP**, present the review document (`docs/review/phase-1-ui-review.md`), and ask for approval. Implement every requested UI change *before* any backend work.
3. Never start a later phase before the previous phase meets its acceptance criteria.
4. Do not skip validation, loading, empty and error states. Do not leave major workflows as placeholders.
5. Do not invent undocumented e-Port business rules, financial formulas, permissions or integrations. Record gaps in `docs/research/unresolved-business-questions.md` and build them **configurable and visibly marked Unverified**.
6. Never create fake integrations and claim they are operational. Mocks are labelled as mocks everywhere users can see them.
7. Do not circumvent bot protection or access controls on any website (see §4.1). Ask the owner for the material instead.

### Where the project stands (resume here)

Phase 0 and Phase 1 are built (see Appendix C for the as-built snapshot). **Next actions, in order:**
1. Obtain the Dribbble reference images from the owner (§4.1) → apply the design fusion → re-capture screenshots.
2. Regenerate the review document (`node scripts/build-review-doc.mjs`), re-run all checks, and ask the owner to approve the UI or list changes.
3. Only after explicit approval: begin Phase 2.

---

## 1. Source of truth: the e-Port manuals

The nine uploaded e-Port User Manual transcriptions (plus the overview) are the **primary source of truth for existing operational behaviour**. They describe one test sale day (17 September 2026) run through the real Ethical sandbox. Manuals 08 and 09 are marked DRAFT with open items.

| # | Manual | Process | Primary role |
|---|---|---|---|
| 01 | Daily Setup | Receiving sale date; Start of Day | Receiving Supervisor; Data Processing Supervisor |
| 02 | TIMB Booking Import | Booking file import | TIMB Clerk |
| 03 | Receiving | Transporter note, growers, bale capture | Receiving Clerk |
| 04 | Ticket Printing | Start barcode, allocate, print, confirm | Ticket Clerk |
| 05 | Laying and Floor Summary | Scan tickets into rows | Floor Summary Clerk |
| 06 | Data Capture and Balancing | Classification, e-Buying, batches, balance | Data clerks / Data Processing Supervisor |
| 07 | Stop Orders and Deductions | Stop order import and processing | Data Processing Supervisor |
| 08 | Grower Payment | Sales sheets, payment schedules | Accounts |
| 09 | Floor Dispatch | Dispatch notes, scanning, shipment file | Dispatch Clerk / Supervisor |

For every manual the analysis covers: purpose, responsible and supporting roles, permissions, prerequisites, input fields (exact labels), records and relationships, actions/buttons, sequence, status transitions, validations, calculations, external dependencies, system messages (verbatim), exception handling, reports/outputs, and the next process. This is already written under `docs/research/` — **read it before changing behaviour**; the digest in Appendix A is only a summary.

### Lifecycle (every stage has its own dedicated interface)

```
DAILY SETUP → TIMB BOOKING IMPORT → RECEIVING → BALE CAPTURE → TICKET PRINTING → FLOOR SUMMARY
→ DATA CAPTURE → BATCH PROCESSING → SALE BALANCING → STOP ORDERS & DEDUCTIONS → GROWER PAYMENT → FLOOR DISPATCH
```

An overall **Sale Day dashboard** must show where the day is delayed without navigating unrelated screens: sale date, selling point, season, Start-of-Day status, exchange rate, imported bookings, trucks/growers/bales received, tickets pending/confirmed, floor-summary progress, bales awaiting data capture, draft/balanced/processed sales, pending approvals, pending stop orders, payment batches, dispatch progress and outstanding exceptions — with each stage shown as complete / in progress / blocked / needs attention, and blocked reasons spelled out.

### Reference test data (documented — use as-is; distinguish demo data)

Sale date **17 September 2026**, selling point **Ethical Sales Floor (EL)**, sale room A, season 2026, exchange rate **26.6845**.

| Grower | Name | Bales | Delivery note | Ticket barcodes (documented range) |
|---|---|---:|---|---|
| V100060 | Chengetai Chingoma | 3 | GDN0000005 | 1000001013 – 1000001035 |
| V100061 | Trust Gwenzi | 2 | GDN0000004 | 1000001046 – 1000001057 |

Transporter delivery note **TDN0000002**, transporter **Tendai Moyo**, ID 63-123456-A-42, vehicle **AEX1234** (typed "AEX 1234"; spaces are removed), 0772123456.

**A barcode range is not a bale count.** Ticket barcodes are 10 characters (9 digits + a check character); each next ticket is base + 1 with its own check character, so 1000001013 – 1000001035 is **3 tickets** (1000001013, 1000001024, 1000001035) and 1000001046 – 1000001057 is **2** (1000001046, 1000001057). The check-character algorithm is undocumented (UQ-01); `digit-sum mod 10` fits all five samples but is unverified and sits behind a pluggable interface.

Documented values for V100060: scale barcodes 2609170001–3, masses 112/98/105 kg, TIMB grades A10/A1E/A1L, buyer JM, buyer grade 11OF, prices 212/198/185 US cents/kg. Documented deductions for the day: **$173.11** = $123.11 floor charges + $50.00 TIMB stop order (V100060 → creditor 00050), 11 lines, 2 growers, 6 creditors; pay batch **1001** (history 1000). Everything else (V100061's masses/prices, per-line charge amounts, bank accounts, extra growers/history) is **demo data** and must carry a visible DEMO marker.

---

## 2. Technology stack and architecture

**Monorepo** (pnpm workspaces + Turborepo), as built:

```
tobacco-erp/
├── apps/
│   ├── web/                 # Next.js (App Router) — Phase 1
│   └── api/                 # NestJS modular monolith — NOT created until Phase 2 approval
├── packages/
│   ├── ui/                  # shadcn-style components, customised design system
│   ├── shared/              # domain types, permissions, roles, message catalogue, fixtures
│   ├── validation/          # Zod schemas + pure business-rule validators (frontend now, API later)
│   ├── design-system/       # design tokens (CSS variables, Tailwind v4 theme, TS constants)
│   └── config/              # shared tsconfig presets
├── docs/  scripts/  database/ (Phase 2)
```

**Frontend:** Next.js (16), React (19), TypeScript, Tailwind CSS (4), shadcn/ui primitives customised into an original system (Radix via `radix-ui`), Lucide icons, TanStack Query, TanStack Table (v8), React Hook Form, Zod (4), Recharts, Zustand (UI-only shared state), Sonner toasts. Desktop-first for large office monitors and workstations; tablets and small screens must remain usable.

**Backend (Phase 2+):** NestJS **modular monolith** (one application, clearly separated business modules — not microservices; no RabbitMQ/Kafka/Redis without a documented requirement), PostgreSQL on **Neon**, Prisma, Zod or class-validator, JWT authentication, role- and permission-based authorization, Swagger/OpenAPI. Modules: auth, users, roles, permissions, organizations, seasons, selling-points, sale-days, growers, creditors, buyers, timb, receiving, transporters, delivery-notes, bales, tickets, floor-summary, data-capture, batch-processing, sales, balancing, approvals, stop-orders, deductions, payments, dispatch, reports, audit, notifications, settings. Each module owns its logic, DB access and endpoints; use service/repository abstractions only where they add real value.

**Deployment (documented before implementation):** Next.js on Vercel; NestJS as a Vercel-compatible Node serverless app; Neon with pooled connections; no long-running in-memory jobs; durable object storage for uploads; Vercel Cron or an external worker for scheduled work; respect Vercel execution limits; secrets only in environment configuration.

**Testing stack:** Vitest + React Testing Library (web/shared/validation — a deliberate choice, ADR-0006), Playwright (journeys + axe accessibility sweep), Jest + Supertest for the NestJS API (Phase 2+).

### The Phase 1 mock layer (shaped like the future backend)

Phase 1 runs entirely on a local mock database so the UI can be judged before any backend exists. It deliberately mirrors the future API (see `docs/architecture/mock-layer-contract.md`):

- `packages/shared`: types, enums, permissions, roles, **verbatim message catalogue**, fixtures.
- `mock/store.ts`: one mock DB persisted to localStorage; every write is an atomic **transaction** (clone → mutate → commit, or discard on throw).
- `mock/domain/*.ts`: the "server-side" operations — permission → status guard → prerequisites → mutation → **audit entry**. Each file is the specification for one NestJS module.
- `mock/hooks.ts`: `useDbQuery` (artificial latency → real skeletons), `useDb` (instant), `useAction` (`run()` never rejects; toasts; verbatim errors).
- `mock/scenarios.ts`: stage presets of the 17 Sep 2026 day (Demo controls → jump to any stage), built from documented data.
- Business rules live in pure functions and mock operations — **never in React components**. The frontend never decides that a sale is balanced or processed; the (future) backend is authoritative.
- Phase 2 replaces `src/mock/` with an API client; pages keep their shape.

---

## 3. Roles and permissions (RBAC)

Granular, **enforced by the backend**, not only by hiding buttons. Multiple roles per user, custom roles, per-user permission overrides (grant/deny), active/inactive users, selling-point restrictions, audit of privileged actions. The System Administrator configures access without touching source code.

| # | Role | Responsibilities (summary) |
|---|---|---|
| 1 | System Administrator | Users, roles/permissions, configuration, seasons, selling points, reference data, audit, system-wide reporting |
| 2 | Supervisor | Monitor the sale day, activate sale dates, review exceptions, approve authorised corrections, operational reports |
| 3 | TIMB Clerk | Import grower register, creditor register, booking and stop-order files; review import errors |
| 4 | Receiving Clerk | Transporter delivery notes, growers, bale capture, completing deliveries |
| 5 | Receiving Supervisor | Sets the receiving sale date; monitors deliveries; ejects wrongly captured bales; authorises corrections |
| 6 | Ticket Clerk | Starting barcode, allocate, print, confirm tickets |
| 7 | Floor Summary Clerk | Scan tickets into floor rows, complete summaries |
| 8 | Data Clerk | Classification (TIMB grade, hessian), e-Buying (buyer, buyer grade, price), batch price capture |
| 9 | Data Processing Supervisor | Posts Start of Day, posts batches, balances sales, approvals, stop-order import/processing |
| 10 | Accounts | Deductions review, sales sheets, payment schedules, bank CSV, payment confirmation |
| 11 | Dispatch Clerk | Initiate dispatch, select warehouse, transport details, scan bales, post |
| 12 | Dispatch Supervisor | Review/approve dispatch notes, cancel drafts with reason, shipment files, reset notes |
| — | *Demo Operator (all stages)* | **DEMO ONLY** convenience so one person can click the whole sale day; not a production role |

Where the manuals and this list differ, **the manual wins** and the mismatch is logged: Sale Date - Receiving belongs to the Receiving Supervisor and Start of Day to the Data Processing Supervisor (the Supervisor role holds both permissions); the manuals split the Data Clerk into Classification / Buying / Batch clerks and name a "Receiving manager" who toggles floor-summary scanning — handled by granular permissions so custom roles can split them.

Permission keys are action-level (e.g. `sale-day.activate`, `timb.import-bookings`, `receiving.eject-bale`, `tickets.confirm`, `floor-summary.toggle-scanning`, `data-capture.capture-price`, `batch.capture-price`, `sales.balance`, `sales.release`, `deductions.process`, `payments.confirm-payment`, `dispatch.reset`, `admin.roles`, `audit.view`). The complete matrix is in `docs/research/role-permission-matrix.md`.

---

## 4. Design system and visual direction

This is one of the most important parts. The product must look like a **premium enterprise product**, not a conventional ERP template.

### 4.1 Visual references (mandatory intake) — "exact UI like and styles, fused into our design"

The owner supplied two Dribbble shots as the visual benchmark and wants their **look and style fused into the ERP's own UI**:

1. **Moverta TMS — Logistics Management Dashboard** — https://dribbble.com/shots/26670612-Moverta-TMS-Logistics-Management-Dashboard
2. **Truck&Co TMS — Logistics Management Dashboard** — https://dribbble.com/shots/26619200-Truck-Co-TMS-Logistics-Management-Dashboard

**Intake rules**

- The images must actually be **seen** before any claim about them. Dribbble blocks automated access (HTTP 202, empty body); **never bypass bot protection** (no spoofed browser identities, no scraping workarounds). If the images are not available, **ask the owner** to save the full-size shots into `docs/design/references/` (instructions in that folder's README) or paste them in chat. **Never describe or imitate a design you have not seen.**
- Study: layout proportions; sidebar (width, collapsed state, grouping, active state); top bar; card composition (radius, border, shadow, padding); spacing rhythm; typography scale and weights; numeric/KPI treatment; colour roles; data visualisation (bars, lines, donuts, **load/capacity bars**); interactive tables (density, header style, hover/selected rows, status chips, avatars); floating action panels; **timelines/trip-progress visuals**; filters and form fields; iconography.
- Deliver `docs/design/reference-analysis.md` + a **token and component delta list**, apply it (tokens, both shells, KPI tiles, tables, charts, timelines, the stage pipeline), re-capture the review screenshots and add **side-by-side comparisons** to the review document.
- **Fidelity target:** recognisably the same family — layout language, proportions, component styling and interaction patterns closely match. **Not copied:** logos, brand names, illustrations, photos, copy, any asset. The content is tobacco-floor operations; the identity is original.
- Map logistics ideas to this domain: trip/load progress → delivery and bale progress and the sale-day stage pipeline; shipment status timeline → delivery-note (Open → Tickets Printing → Checked → Laid) and sale (Draft → Balanced → Processed) timelines; floating map/detail panels → floor-row and sale-room panels (no real map unless data exists).
- **Acceptance:** the owner signs off on visual fidelity at the UI approval gate.

### 4.2 Visual identity (baseline; refine after §4.1)

Minimal, clean, modern, neutral and highly functional. Avoid: gradient backgrounds, heavy glassmorphism, heavy shadows, over-colourful dashboards, oversized headings, excessive empty space, generic admin templates, unnecessary animation, decorative illustrations, many card styles. Use: soft off-white background, light-grey secondary surfaces, white cards, charcoal text, thin neutral borders, restrained violet primary, lime for positive operational state, amber for warnings, red for errors, consistent spacing and radii, shadows only where needed.

Baseline tokens (`packages/design-system/src/theme.css`):

```css
--background:#F4F5F3; --surface:#FFFFFF; --surface-secondary:#F8F8F6; --foreground:#171717;
--muted-foreground:#666C70;  /* brief's #777D80 darkened to reach 4.5:1 */
--border:#E5E7E5; --primary:#7201FF; --success:#8FFE01; /* FILL ONLY */ --warning:#E8A23B; --danger:#E5484D;
--success-text:#2F6B00; --warning-text:#8A5200; --danger-text:#B42328; --neutral-dark:#202124;
```

Accessibility rule: lime `#8FFE01` is **fill only** (dots, bars, chips with charcoal text), never text on white; use the `*-text` variants for coloured text. Typography: Geist (or Inter/Manrope), clear hierarchy, tabular numerals for metrics and tables.

### 4.3 Application shells (two kinds of screens)

- **Back office** (setup, imports, configuration, approvals, processing, finance, reporting): collapsible sidebar with role-aware navigation, top bar with breadcrumbs, global search (grower no., booking ref, TDN, GDN, scale/ticket barcode, sale, batch, dispatch ref), notification centre, user menu, a floating sale-day context card.
- **Floor workspaces** (receiving, ticket printing, floor summary, data capture, dispatch): dedicated, **not** generic CRUD — the original "purple bar and large fields" concept modernised: minimal chrome, large auto-focused fields, keyboard-first, Enter submits / Tab navigates, focus returns after every scan, immediate inline feedback, running counts, visible scan history, no modal per scan, clear current-record information, honest "simulated scanner / scale" labelling.

### 4.4 Component foundations (Phase 1 §1.1)

Design tokens, typography, spacing, buttons, inputs, selects, dialogs, dropdowns, cards, tables, badges, tabs, breadcrumbs, pagination, search, filters, date pickers, charts, notifications, loading/empty/error states, confirmation dialogs — all built on shadcn/ui primitives and customised into one coherent original system. Reusable enterprise **DataTable** (sorting, filtering, pagination, search, column visibility, row selection, bulk actions, status badges, row menus, skeletons, empty states) and a reusable **BarcodeScannerInput** (§7).

---

## 5. Core business modules

Build the ERP around the documented processes. Each is a dedicated interface; details and verbatim messages are in `docs/research/manual-0N-*.md` and `docs/research/system-messages.md`.

1. **Dashboard & Sale Day** — see §1. Date and selling-point filters; detailed workflow view.
2. **Daily Setup** — Sale Date - Receiving (Date of Sale; Is Active unticks the previous date; Can Scan Floor Summary?); Start of Day (selling date, exchange rate, Post). Rules: a valid active receiving date must exist ("Date has expired. Please set a valid sale date"); rate must be positive ("Exchange Rate should be bigger than ZERO!"); earlier sales must be Balanced/Processed before a new Start of Day; Start of Day must be posted before data capture and balancing.
3. **TIMB Data Management** — grower/creditor register, booking and stop-order imports, history, row-level errors, error-report download, reconciliation. Workflow: select type → upload → validate (file-name prefix selects the key: **ELS…** bookings, **EL…** stop orders; *do not rename*) → preview → confirm → process → created/updated/failed counts → row errors → history. Re-importing the same booking file updates (matched on TIMB booking reference), never duplicates. **Real TIMB files are encrypted; the first implementation uses documented sample files behind a clearly separated adapter and must never pretend sample parsing equals real decryption (UQ-13).** Searchable grower register with documented fields only.
4. **Receiving** — transporter delivery note (name, ID, vehicle reg, phone, permit), multiple growers per truck (grower no., location/row, bales, sale day/month), complete → grower delivery notes (GDN, Open). Bale capture: scale barcode (mass comes from the scale), grower #, group #, lot #; tally "N of M" and **Delivery Balanced**; completion checks (counts equal, group ≥ 1, valid lot "digits and /", no repeated group+lot). Supervisor **Eject Bale** requires reason, user, timestamp, audit. Keyboard/scanner-first.
5. **Ticket Printing** — waiting list; Set Starting Barcode (10 chars incl. check character; start barcodes belong to each user; next barcode saved automatically); Use Next Barcode (group → lot order); print preview (sale date, scale-barcode–ticket-barcode, grower, group, mass, sale room); Confirm Ticket Printing (delivery → Checked; **locks barcodes for the season**); Interrupted Ticket; Reverse Printing Status (supervisor, reason). Duplicate prevention, reprint permissions, print audit. No hardware printing until approved — print preview only.
6. **Floor Summary** — select selling point → sale room; Row field (sticky) + scan the **ticket** barcode (not the scale label); "Scanned N of M"; completion → delivery Laid + floor summary + **draft sale + price batch**; Check Floor Summary; scanning on/off for the whole floor. Immediate feedback, rapid consecutive scans, no modal per scan.
7. **Data Capture and Balancing** — Classification (TIMB grade/reason, hessian owner), e-Buying (buyer, buyer grade — must belong to the buyer, price in **US cents/kg whole number**, sale code only for unbought bales), All Details; codes upper-cased; fields validated separately (partial save as documented). **Batch processing:** one price batch per grower sale; blind second price entry; Post Batch. **Balancing** checks every bale (TIMB grade, buyer, buyer grade, valid price, captured = batch price, unsold bales have valid sale code + reason, not already processed); detailed preview with totals and per-bale errors; never silently ignore an invalid bale; only authorised users balance.
8. **Approvals** — reusable, configurable (bale corrections, balancing exceptions, sale reversal, financial adjustments, payment overrides, dispatch cancellation); entity, action, requester, reason, approver, decision, reason, timestamp; **no self-approval**. Triggers are unverified (UQ-06).
9. **Stop Orders and Deductions** — TIMB stop-order import, creditors, internal invoices, merchant loans, grower charges, deductions dashboard. **Documented processing order:** 1 statutory & floor charges → 2 internal invoices → 3 merchant loans → 4 TIMB invoices → 5 TIMB stop orders; the balance is the grower payout; sales become **Processed** with a **pay batch number**. **Do not invent financial formulas** — rates/bases are configurable and flagged unverified (UQ-05); Phase 1 posts illustrative fixed amounts. Deductions dashboard (total, lines, growers, creditors, top creditors, by currency, by source, date range).
10. **Grower Payments** — sales sheets, payment schedules per currency, bank CSV with the **13 documented columns** (Transaction_Type, Beneficiary, Currency, Credit_Account, transaction_date, Amount, Debit_Account, Company_Name, Batch_Reference, Transaction_Id, Bank_Code, Bank, Branch_Code), growers without bank details left out, reconciliation, CloudPay **placeholder**. **Safeguards:** downloading a CSV never marks growers paid; a payment is marked paid only after a verified, audited confirmation; never simulate a successful bank payment; never submit real instructions in demo mode; preserve original batches; support failure and reconciliation; no duplicate schedules.
11. **Floor Dispatch** — initiate (destination warehouse, product Green, transport, driver), scan ticket barcodes, remove incorrect scans, Done, post, generate shipment CSV. A bale is **refused** if its sale is not released, its buyer packs at a different warehouse, it has a rejected sale code (RO/RH/CO), or it is already on another note. Draft notes can be cancelled with a reason; notes are never deleted; supervisor reset to draft.

**Future expansion (architecture only, not built now):** contract management, grower onboarding/groups, loans & advances, agricultural inputs, transporter and warehouse management, tobacco inventory, auction/merchant management, buyer invoicing, farmer statements, transporter payments, advanced financial reporting, multiple selling points and organizations.

---

## 6. Status management and workflow engine

Explicit transitions. Every transition validates the current status, checks permission and prerequisites, runs in a database transaction where appropriate, records actor and timestamp, writes an audit entry and returns a clear result. **The backend is authoritative**; the frontend never decides a sale is balanced or processed.

| Object | States (documented unless marked *proposed*) |
|---|---|
| Transporter note | Open → Completed |
| Grower delivery note | Open → Tickets Printing → Checked → Laid (status bar also shows "Laying" — unexplained, UQ-02) |
| Price batch | Draft → Posted |
| Sale | Draft → Balanced → Processed (status bar also shows "Posted" — unexplained); separate **Released** flag |
| Start of Day | Draft → Posted |
| Dispatch note | Draft → Posted, Cancelled *(proposed)* |
| Import | Uploaded → Validating → Processing → Completed / Completed with errors / Failed *(proposed)* |
| Payment | Draft → Generated → Submitted → Partially paid → Paid / Failed *(proposed)* |

**Naming:** "Price Batch" (Batch Processing, e.g. Batch 4) is **not** the "Pay Batch Number" (1001). Use those two names everywhere.

---

## 7. Barcode scanning and hardware readiness

Treat USB/Bluetooth scanners as **keyboard-emulating devices**. The reusable `BarcodeScannerInput` provides: auto-focus, Enter-to-submit, Tab navigation, **queued rapid scans (none dropped)**, multi-line paste, duplicate detection, immediate valid/invalid feedback, scan history and counts, refocus after every scan, `aria-live` announcements, optional sound, and an imperative handle so "simulate scan" chips use the exact same pipeline. Design a **scanner adapter interface** so serial or network scanners can be added later. For the first release use simulated scanner input and realistic mocked scale readings. **Never claim a physical scale, scanner or printer is connected when it is not.**

---

## 8. Integrations (Phase 4+ real; Phase 1 labelled mocks)

Integration layer with a defined contract per adapter, never coupled to core ERP logic: **TIMB** (grower register, creditor register, bookings, stop orders), **scale**, **scanner**, **ticket printer**, **payment (CloudPay)**, **bank CSV**, **warehouse shipment export**. For each, document input/output format, authentication, file validation, mapping rules, error handling, retry behaviour, idempotency, audit requirements and configuration (see `docs/research/integration-requirements.md`). Real TIMB keys, payment credentials and API credentials live outside source control.

---

## 9. Database design (after UI approval)

Normalised PostgreSQL: UUID primary keys **plus human-readable document references**; enforced foreign keys; indexes; `numeric` for money/weights with preserved currency codes; consistent timestamps; `created_by`/`updated_by`; transactions for state changes; **unique constraints that prevent duplicate barcode allocation, duplicate imports, duplicate payment schedules and double processing/dispatch**; immutable financial transaction history; soft deletion only where appropriate; never delete posted financial or operational records. Preserve and keep searchable: grower number, TIMB booking reference, transporter delivery note, grower delivery note, bale (scale and ticket) barcodes, sale reference, price-batch number, pay-batch number, dispatch reference. Proposed entities (refine from the manuals): Organization, User, Role, Permission, Season, SellingPoint, SaleRoom, FloorRow, SaleDate, StartOfDay, Grower, GrowerBankAccount, GrowerBooking, Creditor, Buyer, BuyerGrade, Transporter and delivery notes, Bale/BaleTicket/TicketPrintBatch, FloorSummary(+Scan), classification/sale capture, GrowerSale/Batch/Approval, GrowerCharge, StopOrder, InternalInvoice, MerchantLoan, Deduction, PaymentBatch/Schedule/Line/Transaction, Warehouse, DispatchNote/Bale, ShipmentExport, ImportJob/File/RowError, AuditLog, Notification, SystemSetting. See `docs/architecture/entity-map.md`.

---

## 10. Reporting and audit

Reports: daily receiving, grower delivery, bale receiving, ticket printing, floor summary, data capture, sales, grower sales sheet, batch processing, deduction, creditor, payment schedule, payment reconciliation, dispatch, shipment, user activity. Filters: date range, season, selling point, grower, buyer, creditor, batch, status. CSV and PDF export where appropriate (Phase 1: CSV client-side, PDF via print). **All important actions are audited:** user, action, entity type and id, previous and new value, reason, timestamp, request metadata.

---

## 11. Phases — strict order and acceptance

**Phase 0 — Discovery and planning** (done). Inspect project, manuals and references; extract workflow; document roles, permission matrix, business rules, status transitions, unresolved requirements, module architecture, route map, entity map, integration boundaries. Deliverables under `docs/research|architecture|workflows|security|design`. *No backend.*

**Phase 1 — Complete UI/UX on mocked data** (built; awaiting approval). Mocked data only: **no NestJS, no database, no real API integration, no real TIMB, no real payments.** Deliver: design foundation and component library; both shells; login; role-aware navigation; every module of §5 as real pages (realistic data, working filters, search, pagination, functional validated forms, dialogs, simulated status transitions, toasts, confirmations, empty/loading/error states); special attention to the 13 critical screens (sale-day dashboard, TIMB import, grower register, transporter note, receiving & bale capture, ticket printing, floor summary scanning, data capture, batch processing, sale balancing, stop-order processing, payment schedules, dispatch scanning); a **mocked end-to-end demonstration** of the 17 Sep 2026 day through all stages with statuses updating as you progress; the **Dribbble design fusion** (§4.1); tests (Vitest, Playwright journeys and negative/role cases, axe accessibility sweep); and the **review document** — screens implemented, screenshots, route list, component list, user journeys, mock-data scenarios, known design gaps, outstanding questions, proposed backend integration points. **Then STOP and request explicit approval.**

*Acceptance:* typecheck, lint, unit and end-to-end tests green; every route reachable; the documented journey runs end to end; zero serious/critical axe violations; review document generated from the code.

**Phase 2 — Backend foundation** *(after approval only)*: NestJS app, Neon connection, Prisma schema, migrations, seed, authentication, authorization, users/roles/permissions, audit logging, API error handling, Swagger; secure dev and prod configuration.
**Phase 3 — Core master data**: seasons, selling points, sale rooms, floor rows, growers, bank accounts, buyers, buyer grades, creditors, transporters, warehouses, system settings; seed the documented scenario.
**Phase 4 — Daily setup and TIMB imports**: sale dates, Start of Day, exchange rates, register/creditor/booking imports, job history, row validation, error reports; test duplicate imports and idempotency.
**Phase 5 — Receiving and bales**: transporter/grower delivery notes, bale capture, scale adapter interface, validation, correction, completion, transitions.
**Phase 6 — Tickets and floor summary**: barcode allocation and uniqueness, print records, confirmation, scanner-ready floor summary, row assignment, reconciliation, sale creation.
**Phase 7 — Data capture and balancing**: classification, grades, buyers, prices, sale codes, batches, posting, balancing, validation, approvals.
**Phase 8 — Stop orders and financial processing**: stop orders, grower charges, internal invoices, merchant loans, deduction processing and dashboard, pay batch numbers; test financial calculations against the documented scenario.
**Phase 9 — Grower payments**: sales sheets, schedules, USD/local processing, bank CSV, bank-detail validation, reconciliation, status, CloudPay placeholder. **Never send actual payments in development.**
**Phase 10 — Floor dispatch**: warehouses, transport, notes, scanning, validation, posting, cancellation, shipment files.
**Phase 11 — Reporting and hardening**: reports, exports, audit views, notifications, performance, security checks, error handling, integration testing, UAT.
**Phase 12 — Production deployment**: production Neon, migrations, Vercel deployments, environment variables, file storage, monitoring, logging, backups, deployment docs, production-readiness checklist.

---

## 12. Frontend quality standards

For every screen ask: the task; essential vs secondary information; immediately available actions; possible errors; what happens after success; with no records; while loading; with hundreds or thousands of records; can it be operated by keyboard or scanner? Tables: sorting, filtering, pagination, search, column visibility, row selection, bulk actions where appropriate, status badges, context menus, row detail, skeletons, empty states. Forms: clear labels, required indicators, field validation, inline errors, grouping, logical tab order, disabled states, submission feedback, confirmation for destructive actions. Charts only where they communicate meaningful operational information. Performance: avoid needless re-renders, server components where sensible, client components for real interactivity, lazy-load heavy modules, paginate large sets, keep scanning responsive. Accessibility: WCAG A/AA, keyboard reachable scroll regions, accessible names that contain visible text, contrast-safe tokens.

## 13. Backend quality standards

The backend is the single source of truth. Use database transactions, atomic transitions, idempotency for imports and repeated operations, strict authorization, input validation, structured logging, consistent API responses, pagination, database constraints, auditable financial changes. **Financial calculations use decimal precision, never JavaScript floating point.** Protect against duplicate barcode captures, ticket allocations, payment schedules, imports, double processing, double dispatch, unauthorized transitions and unauthorized adjustments. Posted financial transactions are never silently edited or deleted — use correction and reversal records.

## 14. Testing requirements

Jest (backend units), Supertest (API), Playwright (end-to-end), React Testing Library/Vitest (UI and domain). Create a **full end-to-end test around the documented sale day**: create sale date → post Start of Day → import bookings → transporter note → add V100060 and V100061 (3 and 2 bales) → capture all bales → complete deliveries → allocate and confirm tickets → scan into floor rows → complete floor summary → capture grades and buyers → enter prices → post batches → balance both sales → import stop orders → process deductions → generate payment schedules → create dispatch notes → generate shipment files. Test successful **and** failed scenarios, test **each role** to confirm unauthorized actions are blocked, and confirm that references stay linked from booking through dispatch.

---

## 15. Execution rules

1. Work in small, logical steps; read the existing project before changing files; do not overwrite working functionality without justification.
2. Reuse components and utilities; keep business logic out of React components; keep NestJS modules separated; avoid unnecessary abstractions; no huge files of unrelated functionality.
3. The manuals are the operational source of truth; never invent rules; log gaps in `docs/research/unresolved-business-questions.md`.
4. Use sample files for early integration work; keep sensitive configuration out of source; write meaningful tests; document architectural decisions (ADRs); maintain `docs/progress.md`; update docs as modules complete.
5. Keep the UI consistent with the approved design.
6. **Parallel work:** when several agents work at once, give each a disjoint set of files, keep shared files (navigation, search index, scenario presets, store, shared types/messages, UI package) owned by one coordinator, and require each agent to run typecheck, lint and its tests. Re-verify everything after agents finish — agent reports are not evidence.
7. **Rate limits / session breaks:** work is saved on disk; on resume, inventory files, run typecheck and all tests, and continue from the real state (not from memory).
8. **Honesty:** report outcomes faithfully — failing tests are reported with their output; skipped steps are stated; mocks are labelled; no claim of hardware or integrations that do not exist.
9. **Access control on the web:** do not circumvent bot protection, paywalls or authentication; if a source is unreachable, ask the owner for the material.

Use available skills and tools where they add value (UI/UX, frontend, accessibility, database, NestJS, testing, workflow analysis) without blindly invoking everything or adding unjustified dependencies.

---

## Appendix A — Manual-derived facts digest (details in `docs/research/`)

- **Two kinds of screens** in e-Port: floor web interfaces ("purple bar, large fields", scanner/keyboard work) and back-office menus (setup, checking, printing, processing).
- **Two barcodes:** *scale barcode* (e.g. 2609170001; captured at receiving; carries mass) vs *ticket barcode* (e.g. 1000001013; 10 chars; allocated at ticket printing). Floor summary, data capture and dispatch scan the **ticket**. Ticket printing prints both on the ticket.
- **GDN numbering:** on the test day V100060 (added first) got GDN0000005 and V100061 got GDN0000004 (UQ-26) — reproduced by the mock.
- **Price Batch vs Pay Batch** (see §6).
- **Start of Day** blocks on earlier Draft/Balanced sales; data capture and balancing need it posted; stop-order processing needs the exchange rate ("Exchange rate is not set for this sale…").
- **Imports:** bookings file name starts **ELS** (re-import updates on booking reference); stop-order file name starts **EL**, its date (YYYYMMDD) links stop orders to that day's sales ("Stop order not deducted" when mismatched); unknown creditors/growers in stop-order files are created automatically.
- **Receiving checks:** grower must have a pending delivery note; bale must not be on a closed document; lot = digits and "/" only; group ≥ 1; no repeated group+lot; captured = declared.
- **Ticket printing:** per-user start barcode; overlap → "Barcodes already used in Tickets"; confirm locks the season; Interrupted Ticket; Reverse Printing Status (supervisor).
- **Floor summary:** ticket barcode + row; delivery must be Checked; "Scanned N of M"; completion creates floor summary, draft sale, price batch.
- **Data capture:** buyer grade must belong to the buyer; price = US cents/kg whole number; per-field partial save; unsold bale = sale code + TIMB reason, left out of the sale total; rejected sale codes RO, RH, CO.
- **Balancing:** batch posted; captured price = batch price; "Sale has balanced!"; sale reversal/adjustment semantics undocumented (UQ-06).
- **Deductions:** documented order (§5.9); totals for the test day $173.11 (10 floor-charge lines + 1 stop-order line, 6 creditors, 2 growers).
- **Payments:** schedule per currency; growers without bank details excluded; CSV never marks paid; Manual 08 says only a successful CloudPay submission marks paid — **this project is stricter** (paid only via audited, verified confirmation; CloudPay is a mock).
- **Dispatch:** refusal rules (§5.11); draft cancel with reason; notes never deleted; shipment file only from a Posted note; two dispatch apps exist in the sandbox (which one Ethical uses is open, UQ-12).
- **Open items to settle with the business:** currency naming and USD/local split (UQ-04), deduction rates/formulas (UQ-05), approvals and reversal and pay-batch numbering (UQ-06), who releases a sale (UQ-03), real TIMB file handling (UQ-13), shipment-file columns and warehouses (UQ-12), barcode check algorithm (UQ-01). Full list UQ-01 … UQ-28.

## Appendix B — Documentation map

`docs/README.md` (index) · `docs/research/` (existing-system overview, manual-01…09, role-permission-matrix, business-rules, status-transitions, integration-requirements, system-messages, unresolved-business-questions, demo-dataset) · `docs/architecture/` (module-map, route-map, entity-map, integration-boundaries, deployment-constraints, mock-layer-contract, ADR-0001…0006) · `docs/workflows/` · `docs/security/` (RBAC, audit events) · `docs/design/` (tokens, components, shells, scanner guidelines, **references/**) · `docs/review/` (generated review document, screenshots, fragments) · `docs/progress.md` · `docs/MASTER-PROMPT.md` (this file).

## Appendix C — Phase 1 as-built snapshot (2026-11-10)

- **Structure:** `apps/web` + `packages/{ui, shared, validation, design-system, config}`; `apps/api` intentionally absent.
- **Pages:** 57 page files = 56 routes + the root redirect: **1** login; **42** back-office pages (dashboard, sale-day workflow, daily setup ×2, TIMB ×4, registers ×4, receiving ×5, tickets, floor summary, batches ×2, sales ×2, approvals, finance ×7, dispatch ×3, reports ×2, administration ×6); **13** floor-workspace pages (hub, receiving ×2, tickets ×2, floor summary ×2, data capture ×4, dispatch ×2).
- **Mock layer:** 13 domain operation modules, a transactional store, **12 presets** (11 sale-day stages + a validation showcase), simulated scanner/scale/printer/CloudPay/TIMB adapters (all labelled).
- **Tests (all passing):** 290 unit tests (256 web, 13 shared, 21 validation) and 67 Playwright end-to-end tests (journeys per module, negative and role cases, admin/reports) plus an axe-core sweep over every screen with **0 serious/critical** WCAG A/AA violations; typecheck clean across 5 workspaces; lint 0 errors.
- **Documentation:** 48 markdown files; 76 auto-captured screenshots; generated review document (`docs/review/phase-1-ui-review.md`).
- **Known gaps / pending:** Dribbble design fusion (images not yet supplied); dark mode deferred; PDF export is print-to-PDF only; server-side everything arrives with the backend.
- **Run it:** `pnpm install && pnpm dev` → http://localhost:3000 → pick a demo role → user menu → *Demo controls*.

# Frontend Route Map (Phase 1)

Next.js App Router with three route groups. All data comes from the mock layer (`apps/web/src/mock`). Role-aware navigation hides or disables entries the demo role lacks; direct URLs show a "no permission" state.

## `(auth)` — unauthenticated
| Route | Purpose |
|---|---|
| `/login` | Pick a demo user/role (mock auth) |

## `(app)` — back-office shell (sidebar + top bar)
| Route | Purpose | Manual |
|---|---|---|
| `/dashboard` | Sale-day dashboard: KPIs, stage pipeline, exceptions, date/selling-point filters | all |
| `/sale-day` | Detailed workflow view: stage status (active / done / blocked / waiting), blockers, exceptions | all |
| `/setup/sale-dates` | Sale Date - Receiving list/form | 01 |
| `/setup/start-of-day` | Start of Day list/form, post | 01 |
| `/timb/imports` | Import history (TIMB Data Transfers) | 02, 07 |
| `/timb/imports/new` | Import workspace (type → upload → validate → preview → confirm → result) | 02, 07 |
| `/timb/imports/[id]` | Import detail, row errors, error CSV | 02 |
| `/timb/bookings` | Grower Booking list | 02 |
| `/growers`, `/growers/[no]` | Grower register + detail tabs (bookings, deliveries, sales, payments, bank, creditors) | 02 |
| `/creditors` | Creditor register and stop orders | 07 |
| `/buyers` | Buyers and buyer grades | 06 |
| `/receiving/transporter-notes`, `/receiving/transporter-notes/[id]` | Transporter delivery notes | 03 |
| `/receiving/delivery-notes`, `/receiving/delivery-notes/[id]` | Grower delivery notes (GDN) | 03 |
| `/receiving/corrections` | Receiving supervisor: Eject Bale using Scale Barcode | 03 |
| `/tickets` | Ticket queue and print history | 04 |
| `/floor-summary` | Floor summary list and progress (back office) | 05 |
| `/batches`, `/batches/[id]` | Price batches (Batch Processing) | 06 |
| `/sales`, `/sales/[id]` | Ticket Processing list; sale detail (Tickets/Deductions/Summary), balancing preview | 06, 07 |
| `/approvals` | Pending approvals | 06, 07 |
| `/finance/stop-orders` | Stop order list + import | 07 |
| `/finance/stop-order-processing` | Stop Order Processing wizard | 07 |
| `/finance/deductions` | Deductions Dashboard + deductions list | 07 |
| `/finance/grower-charges` | Configurable grower charges | 07 |
| `/finance/sales-sheets` | Sales sheet report | 08 |
| `/finance/payments`, `/finance/payments/[batch]` | Payment schedules, pay batches, reconciliation | 08 |
| `/dispatch`, `/dispatch/[id]` | Dispatch notes | 09 |
| `/dispatch/shipments` | Shipment files | 09 |
| `/reports`, `/reports/[slug]` | 16 reports with filters, simulated CSV/PDF export | brief |
| `/admin/users`, `/admin/roles`, `/admin/audit`, `/admin/settings`, `/admin/reference-data`, `/admin/devices` | Administration (devices = simulated scale/scanner/printer registry) | — |

## `(floor)` — operational workspaces (minimal chrome, purple bar, large scan fields)
| Route | Purpose | Manual |
|---|---|---|
| `/floor` | Station hub (choose workspace) | — |
| `/floor/receiving` | Transporter note + add growers + complete | 03 |
| `/floor/receiving/[gdn]/bales` | Bale capture with tally and scale feed (simulated) | 03 |
| `/floor/tickets/[gdn]` | Ticket allocation, print preview, confirm | 04 |
| `/floor/floor-summary`, `/floor/floor-summary/check` | Scanning by sale room/row; Check Floor Summary | 05 |
| `/floor/data-capture` | Classification / e-Buying / All Details | 06 |
| `/floor/dispatch/[id]` | Dispatch scanning workspace | 09 |

Global: top-bar search resolves grower no., booking, TDN, GDN, bale barcode (scale/ticket), sale, price batch, pay batch and dispatch references; notification centre; demo role switcher; Reset Demo + scenario presets.

Sources: brief Parts 3, 5, 12; Manuals 01–09.

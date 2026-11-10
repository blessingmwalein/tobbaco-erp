# Phase 1 UI review — Tobacco ERP

Generated 2026-11-10 by `scripts/build-review-doc.mjs` from the code. **Phase 1 delivers a complete, navigable frontend on mocked data. No backend, database, real integration or payment exists. Backend work (Phase 2+) starts only after you approve this UI.**

## 1. How to review

```bash
pnpm install && pnpm dev     # http://localhost:3000
```

1. Pick a demo role on the login page (each of the 12 roles from the brief, plus a DEMO-only all-stage operator).
2. Open the user menu → **Demo controls** to jump to any stage of the 17 September 2026 sale day, or reset.
3. User menu → **Switch demo user** to see how permissions change what is visible and enabled (buttons show *why* they are disabled).
4. Everything is local to your browser; nothing is sent anywhere. Look for **DEMO** (invented data) and **UNVERIFIED** (behaviour the manuals don't confirm) badges.

## 2. Screens implemented

76 captured screens (`pnpm screens` regenerates them). Roles shown are the demo role used for the shot.

| Screenshot | Route | Role | Stage preset |
|---|---|---|---|
| [00-login](screenshots/00-login.png) | `/login` | signed out | — |
| [01-dashboard-fresh](screenshots/01-dashboard-fresh.png) | `/dashboard` | demo-operator | FRESH |
| [02-dashboard-processed](screenshots/02-dashboard-processed.png) | `/dashboard` | demo-operator | PROCESSED |
| [03-sale-day-workflow](screenshots/03-sale-day-workflow.png) | `/sale-day` | demo-operator | FLOOR_SUMMARY_DONE |
| [04-sale-dates](screenshots/04-sale-dates.png) | `/setup/sale-dates` | receiving-supervisor | START_OF_DAY |
| [05-start-of-day](screenshots/05-start-of-day.png) | `/setup/start-of-day` | data-processing-supervisor | FRESH |
| [06-floor-hub](screenshots/06-floor-hub.png) | `/floor` | demo-operator | TICKETS_CONFIRMED |
| [10-buyers](screenshots/10-buyers.png) | `/buyers` | system-admin | FRESH |
| [10-creditor-drill-in](screenshots/10-creditor-drill-in.png) | `/creditors` | data-processing-supervisor | PROCESSED |
| [10-creditors](screenshots/10-creditors.png) | `/creditors` | supervisor | PROCESSED |
| [10-grower-bank-accounts](screenshots/10-grower-bank-accounts.png) | `/growers/V100074` | accounts | FRESH |
| [10-grower-detail-v100060](screenshots/10-grower-detail-v100060.png) | `/growers/V100060` | supervisor | PROCESSED |
| [10-growers-register](screenshots/10-growers-register.png) | `/growers` | supervisor | PROCESSED |
| [10-timb-bookings](screenshots/10-timb-bookings.png) | `/timb/bookings` | supervisor | BOOKINGS_IMPORTED |
| [10-timb-import-1-select-type](screenshots/10-timb-import-1-select-type.png) | `/timb/imports/new` | timb-clerk | START_OF_DAY |
| [10-timb-import-2-upload](screenshots/10-timb-import-2-upload.png) | `/timb/imports/new?type=GROWER_BOOKING` | timb-clerk | START_OF_DAY |
| [10-timb-import-3-validate-renamed](screenshots/10-timb-import-3-validate-renamed.png) | `/timb/imports/new?type=GROWER_BOOKING` | timb-clerk | START_OF_DAY |
| [10-timb-import-4-preview-with-errors](screenshots/10-timb-import-4-preview-with-errors.png) | `/timb/imports/new?type=GROWER_BOOKING` | timb-clerk | START_OF_DAY |
| [10-timb-import-6-result](screenshots/10-timb-import-6-result.png) | `/timb/imports/new?type=GROWER_BOOKING` | timb-clerk | START_OF_DAY |
| [10-timb-import-detail](screenshots/10-timb-import-detail.png) | `/timb/imports/import-0001` | supervisor | BOOKINGS_IMPORTED |
| [10-timb-imports-history](screenshots/10-timb-imports-history.png) | `/timb/imports` | timb-clerk | BOOKINGS_IMPORTED |
| [20-receiving-transporter-note](screenshots/20-receiving-transporter-note.png) | `/floor/receiving` | receiving-clerk | BOOKINGS_IMPORTED |
| [21-receiving-bale-capture](screenshots/21-receiving-bale-capture.png) | `/floor/receiving/gdn-0000005/bales` | receiving-clerk | RECEIVING_IN_PROGRESS |
| [22-delivery-notes](screenshots/22-delivery-notes.png) | `/receiving/delivery-notes` | receiving-supervisor | TICKETS_CONFIRMED |
| [23-delivery-note-detail](screenshots/23-delivery-note-detail.png) | `/receiving/delivery-notes/gdn-0000005` | receiving-supervisor | TICKETS_CONFIRMED |
| [24-transporter-notes](screenshots/24-transporter-notes.png) | `/receiving/transporter-notes` | receiving-supervisor | RECEIVED |
| [25-receiving-corrections](screenshots/25-receiving-corrections.png) | `/receiving/corrections` | receiving-supervisor | RECEIVED |
| [30-tickets-queue](screenshots/30-tickets-queue.png) | `/floor/tickets` | ticket-clerk | RECEIVED |
| [31-ticket-printing](screenshots/31-ticket-printing.png) | `/floor/tickets/gdn-0000005` | ticket-clerk | RECEIVED |
| [32-ticket-confirmed](screenshots/32-ticket-confirmed.png) | `/floor/tickets/gdn-0000005` | ticket-clerk | TICKETS_CONFIRMED |
| [33-tickets-overview](screenshots/33-tickets-overview.png) | `/tickets` | ticket-clerk | TICKETS_CONFIRMED |
| [40-floor-summary-select](screenshots/40-floor-summary-select.png) | `/floor/floor-summary` | floor-summary-clerk | TICKETS_CONFIRMED |
| [41-floor-summary-scanning](screenshots/41-floor-summary-scanning.png) | `/floor/floor-summary` | floor-summary-clerk | TICKETS_CONFIRMED |
| [42-floor-summary-check](screenshots/42-floor-summary-check.png) | `/floor/floor-summary/check` | floor-summary-clerk | FLOOR_SUMMARY_DONE |
| [43-floor-summary-list](screenshots/43-floor-summary-list.png) | `/floor-summary` | supervisor | FLOOR_SUMMARY_DONE |
| [50-data-capture-home](screenshots/50-data-capture-home.png) | `/floor/data-capture` | data-clerk | FLOOR_SUMMARY_DONE |
| [51-data-capture-ebuying-form](screenshots/51-data-capture-ebuying-form.png) | `/floor/data-capture/e-buying` | data-clerk | FLOOR_SUMMARY_DONE |
| [52-data-capture-last-bale](screenshots/52-data-capture-last-bale.png) | `/floor/data-capture/all-details` | data-clerk | FLOOR_SUMMARY_DONE |
| [53-batches-list](screenshots/53-batches-list.png) | `/batches` | demo-operator | FLOOR_SUMMARY_DONE |
| [54-batch-blind-entry](screenshots/54-batch-blind-entry.png) | `/batches/batch-4` | data-clerk | FLOOR_SUMMARY_DONE |
| [55-batch-posted](screenshots/55-batch-posted.png) | `/batches/batch-4` | demo-operator | READY_TO_BALANCE |
| [60-sales-list](screenshots/60-sales-list.png) | `/sales` | data-processing-supervisor | FLOOR_SUMMARY_DONE |
| [61-sale-ready-to-balance](screenshots/61-sale-ready-to-balance.png) | `/sales/sale-4` | data-processing-supervisor | READY_TO_BALANCE |
| [62-sale-validation-showcase](screenshots/62-sale-validation-showcase.png) | `/sales/sale-5` | data-processing-supervisor | VALIDATION_SHOWCASE |
| [63-sale-processed](screenshots/63-sale-processed.png) | `/sales/sale-4` | data-processing-supervisor | PROCESSED |
| [64-approvals-pending](screenshots/64-approvals-pending.png) | `/sales/sale-4` | data-processing-supervisor | BALANCED |
| [70-stop-order-processing-preview](screenshots/70-stop-order-processing-preview.png) | `/finance/stop-order-processing` | data-processing-supervisor | BALANCED |
| [71-stop-order-processing-result](screenshots/71-stop-order-processing-result.png) | `/finance/stop-order-processing` | data-processing-supervisor | BALANCED |
| [72-stop-orders](screenshots/72-stop-orders.png) | `/finance/stop-orders` | accounts | PROCESSED |
| [73-deductions-dashboard](screenshots/73-deductions-dashboard.png) | `/finance/deductions` | accounts | PROCESSED |
| [74-grower-charges](screenshots/74-grower-charges.png) | `/finance/grower-charges` | accounts | PROCESSED |
| [75-sales-sheet](screenshots/75-sales-sheet.png) | `/finance/sales-sheets` | accounts | PROCESSED |
| [76-payments](screenshots/76-payments.png) | `/finance/payments` | accounts | PROCESSED |
| [77-payments-generate-dialog](screenshots/77-payments-generate-dialog.png) | `/finance/payments` | accounts | PROCESSED |
| [78-pay-batch-detail](screenshots/78-pay-batch-detail.png) | `/finance/payments/1001` | accounts | PROCESSED |
| [80-dispatch-floor-initiate](screenshots/80-dispatch-floor-initiate.png) | `/floor/dispatch` | dispatch-clerk | READY_TO_DISPATCH |
| [81-dispatch-floor-scanning](screenshots/81-dispatch-floor-scanning.png) | `/floor/dispatch` | dispatch-clerk | READY_TO_DISPATCH |
| [82-dispatch-floor-refused](screenshots/82-dispatch-floor-refused.png) | `/floor/dispatch` | dispatch-clerk | READY_TO_DISPATCH |
| [83-dispatch-floor-posted](screenshots/83-dispatch-floor-posted.png) | `/floor/dispatch` | demo-operator | READY_TO_DISPATCH |
| [84-dispatch-notes-list](screenshots/84-dispatch-notes-list.png) | `/floor/dispatch` | demo-operator | READY_TO_DISPATCH |
| [85-dispatch-note-detail](screenshots/85-dispatch-note-detail.png) | `/floor/dispatch` | demo-operator | READY_TO_DISPATCH |
| [86-dispatch-shipment-files](screenshots/86-dispatch-shipment-files.png) | `/floor/dispatch` | demo-operator | READY_TO_DISPATCH |
| [87-dispatch-empty-list](screenshots/87-dispatch-empty-list.png) | `/dispatch` | dispatch-supervisor | READY_TO_DISPATCH |
| [90-reports-catalogue](screenshots/90-reports-catalogue.png) | `/reports` | supervisor | READY_TO_DISPATCH |
| [91-report-daily-receiving](screenshots/91-report-daily-receiving.png) | `/reports/daily-receiving` | supervisor | PROCESSED |
| [92-report-deductions](screenshots/92-report-deductions.png) | `/reports/deduction` | accounts | PROCESSED |
| [93-admin-users](screenshots/93-admin-users.png) | `/admin/users` | system-admin | PROCESSED |
| [94-admin-roles-matrix](screenshots/94-admin-roles-matrix.png) | `/admin/roles` | system-admin | FRESH |
| [95-admin-audit](screenshots/95-admin-audit.png) | `/admin/audit` | system-admin | PROCESSED |
| [96-admin-settings](screenshots/96-admin-settings.png) | `/admin/settings` | system-admin | FRESH |
| [97-admin-reference-data](screenshots/97-admin-reference-data.png) | `/admin/reference-data` | system-admin | FRESH |
| [98-admin-devices](screenshots/98-admin-devices.png) | `/admin/devices` | system-admin | FRESH |
| [99-tablet-bale-capture](screenshots/99-tablet-bale-capture.png) | `/floor/receiving/gdn-0000005/bales` | receiving-clerk | RECEIVING_IN_PROGRESS |
| [99-tablet-dashboard](screenshots/99-tablet-dashboard.png) | `/dashboard` | demo-operator | PROCESSED |
| [99-tablet-floor-summary](screenshots/99-tablet-floor-summary.png) | `/floor/floor-summary` | floor-summary-clerk | TICKETS_CONFIRMED |
| [99-tablet-sale](screenshots/99-tablet-sale.png) | `/sales/sale-5` | data-processing-supervisor | VALIDATION_SHOWCASE |

### 00-login

`/login` · signed out

![00-login](screenshots/00-login.png)

### 01-dashboard-fresh

`/dashboard` · demo-operator · preset FRESH

![01-dashboard-fresh](screenshots/01-dashboard-fresh.png)

### 02-dashboard-processed

`/dashboard` · demo-operator · preset PROCESSED

![02-dashboard-processed](screenshots/02-dashboard-processed.png)

### 03-sale-day-workflow

`/sale-day` · demo-operator · preset FLOOR_SUMMARY_DONE

![03-sale-day-workflow](screenshots/03-sale-day-workflow.png)

### 04-sale-dates

`/setup/sale-dates` · receiving-supervisor · preset START_OF_DAY

![04-sale-dates](screenshots/04-sale-dates.png)

### 05-start-of-day

`/setup/start-of-day` · data-processing-supervisor · preset FRESH

![05-start-of-day](screenshots/05-start-of-day.png)

### 06-floor-hub

`/floor` · demo-operator · preset TICKETS_CONFIRMED

![06-floor-hub](screenshots/06-floor-hub.png)

### 10-buyers

`/buyers` · system-admin · preset FRESH

![10-buyers](screenshots/10-buyers.png)

### 10-creditor-drill-in

`/creditors` · data-processing-supervisor · preset PROCESSED

![10-creditor-drill-in](screenshots/10-creditor-drill-in.png)

### 10-creditors

`/creditors` · supervisor · preset PROCESSED

![10-creditors](screenshots/10-creditors.png)

### 10-grower-bank-accounts

`/growers/V100074` · accounts · preset FRESH

![10-grower-bank-accounts](screenshots/10-grower-bank-accounts.png)

### 10-grower-detail-v100060

`/growers/V100060` · supervisor · preset PROCESSED

![10-grower-detail-v100060](screenshots/10-grower-detail-v100060.png)

### 10-growers-register

`/growers` · supervisor · preset PROCESSED

![10-growers-register](screenshots/10-growers-register.png)

### 10-timb-bookings

`/timb/bookings` · supervisor · preset BOOKINGS_IMPORTED

![10-timb-bookings](screenshots/10-timb-bookings.png)

### 10-timb-import-1-select-type

`/timb/imports/new` · timb-clerk · preset START_OF_DAY

![10-timb-import-1-select-type](screenshots/10-timb-import-1-select-type.png)

### 10-timb-import-2-upload

`/timb/imports/new?type=GROWER_BOOKING` · timb-clerk · preset START_OF_DAY

![10-timb-import-2-upload](screenshots/10-timb-import-2-upload.png)

### 10-timb-import-3-validate-renamed

`/timb/imports/new?type=GROWER_BOOKING` · timb-clerk · preset START_OF_DAY

![10-timb-import-3-validate-renamed](screenshots/10-timb-import-3-validate-renamed.png)

### 10-timb-import-4-preview-with-errors

`/timb/imports/new?type=GROWER_BOOKING` · timb-clerk · preset START_OF_DAY

![10-timb-import-4-preview-with-errors](screenshots/10-timb-import-4-preview-with-errors.png)

### 10-timb-import-6-result

`/timb/imports/new?type=GROWER_BOOKING` · timb-clerk · preset START_OF_DAY

![10-timb-import-6-result](screenshots/10-timb-import-6-result.png)

### 10-timb-import-detail

`/timb/imports/import-0001` · supervisor · preset BOOKINGS_IMPORTED

![10-timb-import-detail](screenshots/10-timb-import-detail.png)

### 10-timb-imports-history

`/timb/imports` · timb-clerk · preset BOOKINGS_IMPORTED

![10-timb-imports-history](screenshots/10-timb-imports-history.png)

### 20-receiving-transporter-note

`/floor/receiving` · receiving-clerk · preset BOOKINGS_IMPORTED

![20-receiving-transporter-note](screenshots/20-receiving-transporter-note.png)

### 21-receiving-bale-capture

`/floor/receiving/gdn-0000005/bales` · receiving-clerk · preset RECEIVING_IN_PROGRESS

![21-receiving-bale-capture](screenshots/21-receiving-bale-capture.png)

### 22-delivery-notes

`/receiving/delivery-notes` · receiving-supervisor · preset TICKETS_CONFIRMED

![22-delivery-notes](screenshots/22-delivery-notes.png)

### 23-delivery-note-detail

`/receiving/delivery-notes/gdn-0000005` · receiving-supervisor · preset TICKETS_CONFIRMED

![23-delivery-note-detail](screenshots/23-delivery-note-detail.png)

### 24-transporter-notes

`/receiving/transporter-notes` · receiving-supervisor · preset RECEIVED

![24-transporter-notes](screenshots/24-transporter-notes.png)

### 25-receiving-corrections

`/receiving/corrections` · receiving-supervisor · preset RECEIVED

![25-receiving-corrections](screenshots/25-receiving-corrections.png)

### 30-tickets-queue

`/floor/tickets` · ticket-clerk · preset RECEIVED

![30-tickets-queue](screenshots/30-tickets-queue.png)

### 31-ticket-printing

`/floor/tickets/gdn-0000005` · ticket-clerk · preset RECEIVED

![31-ticket-printing](screenshots/31-ticket-printing.png)

### 32-ticket-confirmed

`/floor/tickets/gdn-0000005` · ticket-clerk · preset TICKETS_CONFIRMED

![32-ticket-confirmed](screenshots/32-ticket-confirmed.png)

### 33-tickets-overview

`/tickets` · ticket-clerk · preset TICKETS_CONFIRMED

![33-tickets-overview](screenshots/33-tickets-overview.png)

### 40-floor-summary-select

`/floor/floor-summary` · floor-summary-clerk · preset TICKETS_CONFIRMED

![40-floor-summary-select](screenshots/40-floor-summary-select.png)

### 41-floor-summary-scanning

`/floor/floor-summary` · floor-summary-clerk · preset TICKETS_CONFIRMED

![41-floor-summary-scanning](screenshots/41-floor-summary-scanning.png)

### 42-floor-summary-check

`/floor/floor-summary/check` · floor-summary-clerk · preset FLOOR_SUMMARY_DONE

![42-floor-summary-check](screenshots/42-floor-summary-check.png)

### 43-floor-summary-list

`/floor-summary` · supervisor · preset FLOOR_SUMMARY_DONE

![43-floor-summary-list](screenshots/43-floor-summary-list.png)

### 50-data-capture-home

`/floor/data-capture` · data-clerk · preset FLOOR_SUMMARY_DONE

![50-data-capture-home](screenshots/50-data-capture-home.png)

### 51-data-capture-ebuying-form

`/floor/data-capture/e-buying` · data-clerk · preset FLOOR_SUMMARY_DONE

![51-data-capture-ebuying-form](screenshots/51-data-capture-ebuying-form.png)

### 52-data-capture-last-bale

`/floor/data-capture/all-details` · data-clerk · preset FLOOR_SUMMARY_DONE

![52-data-capture-last-bale](screenshots/52-data-capture-last-bale.png)

### 53-batches-list

`/batches` · demo-operator · preset FLOOR_SUMMARY_DONE

![53-batches-list](screenshots/53-batches-list.png)

### 54-batch-blind-entry

`/batches/batch-4` · data-clerk · preset FLOOR_SUMMARY_DONE

![54-batch-blind-entry](screenshots/54-batch-blind-entry.png)

### 55-batch-posted

`/batches/batch-4` · demo-operator · preset READY_TO_BALANCE

![55-batch-posted](screenshots/55-batch-posted.png)

### 60-sales-list

`/sales` · data-processing-supervisor · preset FLOOR_SUMMARY_DONE

![60-sales-list](screenshots/60-sales-list.png)

### 61-sale-ready-to-balance

`/sales/sale-4` · data-processing-supervisor · preset READY_TO_BALANCE

![61-sale-ready-to-balance](screenshots/61-sale-ready-to-balance.png)

### 62-sale-validation-showcase

`/sales/sale-5` · data-processing-supervisor · preset VALIDATION_SHOWCASE

![62-sale-validation-showcase](screenshots/62-sale-validation-showcase.png)

### 63-sale-processed

`/sales/sale-4` · data-processing-supervisor · preset PROCESSED

![63-sale-processed](screenshots/63-sale-processed.png)

### 64-approvals-pending

`/sales/sale-4` · data-processing-supervisor · preset BALANCED

![64-approvals-pending](screenshots/64-approvals-pending.png)

### 70-stop-order-processing-preview

`/finance/stop-order-processing` · data-processing-supervisor · preset BALANCED

![70-stop-order-processing-preview](screenshots/70-stop-order-processing-preview.png)

### 71-stop-order-processing-result

`/finance/stop-order-processing` · data-processing-supervisor · preset BALANCED

![71-stop-order-processing-result](screenshots/71-stop-order-processing-result.png)

### 72-stop-orders

`/finance/stop-orders` · accounts · preset PROCESSED

![72-stop-orders](screenshots/72-stop-orders.png)

### 73-deductions-dashboard

`/finance/deductions` · accounts · preset PROCESSED

![73-deductions-dashboard](screenshots/73-deductions-dashboard.png)

### 74-grower-charges

`/finance/grower-charges` · accounts · preset PROCESSED

![74-grower-charges](screenshots/74-grower-charges.png)

### 75-sales-sheet

`/finance/sales-sheets` · accounts · preset PROCESSED

![75-sales-sheet](screenshots/75-sales-sheet.png)

### 76-payments

`/finance/payments` · accounts · preset PROCESSED

![76-payments](screenshots/76-payments.png)

### 77-payments-generate-dialog

`/finance/payments` · accounts · preset PROCESSED

![77-payments-generate-dialog](screenshots/77-payments-generate-dialog.png)

### 78-pay-batch-detail

`/finance/payments/1001` · accounts · preset PROCESSED

![78-pay-batch-detail](screenshots/78-pay-batch-detail.png)

### 80-dispatch-floor-initiate

`/floor/dispatch` · dispatch-clerk · preset READY_TO_DISPATCH

![80-dispatch-floor-initiate](screenshots/80-dispatch-floor-initiate.png)

### 81-dispatch-floor-scanning

`/floor/dispatch` · dispatch-clerk · preset READY_TO_DISPATCH

![81-dispatch-floor-scanning](screenshots/81-dispatch-floor-scanning.png)

### 82-dispatch-floor-refused

`/floor/dispatch` · dispatch-clerk · preset READY_TO_DISPATCH

![82-dispatch-floor-refused](screenshots/82-dispatch-floor-refused.png)

### 83-dispatch-floor-posted

`/floor/dispatch` · demo-operator · preset READY_TO_DISPATCH

![83-dispatch-floor-posted](screenshots/83-dispatch-floor-posted.png)

### 84-dispatch-notes-list

`/floor/dispatch` · demo-operator · preset READY_TO_DISPATCH

![84-dispatch-notes-list](screenshots/84-dispatch-notes-list.png)

### 85-dispatch-note-detail

`/floor/dispatch` · demo-operator · preset READY_TO_DISPATCH

![85-dispatch-note-detail](screenshots/85-dispatch-note-detail.png)

### 86-dispatch-shipment-files

`/floor/dispatch` · demo-operator · preset READY_TO_DISPATCH

![86-dispatch-shipment-files](screenshots/86-dispatch-shipment-files.png)

### 87-dispatch-empty-list

`/dispatch` · dispatch-supervisor · preset READY_TO_DISPATCH

![87-dispatch-empty-list](screenshots/87-dispatch-empty-list.png)

### 90-reports-catalogue

`/reports` · supervisor · preset READY_TO_DISPATCH

![90-reports-catalogue](screenshots/90-reports-catalogue.png)

### 91-report-daily-receiving

`/reports/daily-receiving` · supervisor · preset PROCESSED

![91-report-daily-receiving](screenshots/91-report-daily-receiving.png)

### 92-report-deductions

`/reports/deduction` · accounts · preset PROCESSED

![92-report-deductions](screenshots/92-report-deductions.png)

### 93-admin-users

`/admin/users` · system-admin · preset PROCESSED

![93-admin-users](screenshots/93-admin-users.png)

### 94-admin-roles-matrix

`/admin/roles` · system-admin · preset FRESH

![94-admin-roles-matrix](screenshots/94-admin-roles-matrix.png)

### 95-admin-audit

`/admin/audit` · system-admin · preset PROCESSED

![95-admin-audit](screenshots/95-admin-audit.png)

### 96-admin-settings

`/admin/settings` · system-admin · preset FRESH

![96-admin-settings](screenshots/96-admin-settings.png)

### 97-admin-reference-data

`/admin/reference-data` · system-admin · preset FRESH

![97-admin-reference-data](screenshots/97-admin-reference-data.png)

### 98-admin-devices

`/admin/devices` · system-admin · preset FRESH

![98-admin-devices](screenshots/98-admin-devices.png)

### 99-tablet-bale-capture

`/floor/receiving/gdn-0000005/bales` · receiving-clerk · preset RECEIVING_IN_PROGRESS

![99-tablet-bale-capture](screenshots/99-tablet-bale-capture.png)

### 99-tablet-dashboard

`/dashboard` · demo-operator · preset PROCESSED

![99-tablet-dashboard](screenshots/99-tablet-dashboard.png)

### 99-tablet-floor-summary

`/floor/floor-summary` · floor-summary-clerk · preset TICKETS_CONFIRMED

![99-tablet-floor-summary](screenshots/99-tablet-floor-summary.png)

### 99-tablet-sale

`/sales/sale-5` · data-processing-supervisor · preset VALIDATION_SHOWCASE

![99-tablet-sale](screenshots/99-tablet-sale.png)

## 3. Route list

### Back office (42)

- `/admin/audit`
- `/admin/devices`
- `/admin/reference-data`
- `/admin/roles`
- `/admin/settings`
- `/admin/users`
- `/approvals`
- `/batches`
- `/batches/[id]`
- `/buyers`
- `/creditors`
- `/dashboard`
- `/dispatch`
- `/dispatch/[id]`
- `/dispatch/shipments`
- `/finance/deductions`
- `/finance/grower-charges`
- `/finance/payments`
- `/finance/payments/[batch]`
- `/finance/sales-sheets`
- `/finance/stop-order-processing`
- `/finance/stop-orders`
- `/floor-summary`
- `/growers`
- `/growers/[no]`
- `/receiving/corrections`
- `/receiving/delivery-notes`
- `/receiving/delivery-notes/[id]`
- `/receiving/transporter-notes`
- `/receiving/transporter-notes/[id]`
- `/reports`
- `/reports/[slug]`
- `/sale-day`
- `/sales`
- `/sales/[id]`
- `/setup/sale-dates`
- `/setup/start-of-day`
- `/tickets`
- `/timb/bookings`
- `/timb/imports`
- `/timb/imports/[id]`
- `/timb/imports/new`

### Floor workspaces (13)

- `/floor`
- `/floor/data-capture`
- `/floor/data-capture/all-details`
- `/floor/data-capture/classification`
- `/floor/data-capture/e-buying`
- `/floor/dispatch`
- `/floor/dispatch/[id]`
- `/floor/floor-summary`
- `/floor/floor-summary/check`
- `/floor/receiving`
- `/floor/receiving/[gdn]/bales`
- `/floor/tickets`
- `/floor/tickets/[gdn]`

### Authentication (1)

- `/login`

### Root (1)

- `/`

**57 routes** in total.

## 4. Component inventory

### Design-system components (`packages/ui`)

- **badge.tsx** — Badge, DemoBadge, UnverifiedBadge
- **barcode-scanner-input.tsx** — ScanFeedback, BarcodeScannerInput, ScanHistory
- **button.tsx** — Button
- **card.tsx** — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- **command.tsx** — Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem
- **data-table.tsx** — DataTable
- **dialog.tsx** — Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, SheetContent, Sheet, SheetTrigger, SheetTitle, SheetDescription, ConfirmDialog
- **dropdown-menu.tsx** — DropdownMenu, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuRadioGroup, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator
- **feedback.tsx** — Skeleton, Spinner, EmptyState, ErrorState, Callout, ProgressBar
- **form.tsx** — Input, DateInput, Textarea, NativeSelect, Label, Field, Checkbox, Switch, CheckField
- **layout.tsx** — Breadcrumbs, PageHeader, StatCard, KeyValue, Kbd, Separator, Timeline
- **popover.tsx** — Popover, PopoverTrigger, PopoverAnchor, PopoverContent, TooltipProvider, Tooltip
- **select.tsx** — Select, SelectValue, SelectTrigger, SelectContent, SelectItem
- **table.tsx** — Table, TableHeader, TableBody, TableRow, TableHead, TableCell
- **tabs.tsx** — Tabs, TabsList, TabsTrigger, TabsContent
- **toaster.tsx** — Toaster

### Application components (`apps/web/src/components`)

- **(root)/** — RequirePermission
- **admin/** — AdapterCard, AuditDetailDialog, JsonDiff, PermissionMatrix, PermissionPicker, PermissionChips, EffectivePermissions, ClearButton, RefFormDialog, SeasonsTab, SellingPointsTab, BaleLocationsTab, WarehousesTab, TimbGradesTab, RoleDialog, ScaleSimulator, ScannerTest, UserDialog
- **charts/** — BaleProgressChart, GrowerDeliveryChart
- **data-capture/** — CaptureStation, LastBaleDetails
- **dispatch/** — DispatchActionBar, DispatchBalesTable, InitiateDispatchCard, ReasonDialog, DispatchSimulateChips, BigNumberCard
- **domain/** — GrowerLink, TdnLink, GdnLink, SaleLink, BatchLink, DispatchLink, PayBatchLink, ImportLink, StageDot, StagePipeline, StatusBadge
- **finance/** — TopCreditorsChart, BreakdownList, GenerateScheduleDialog, ConfirmPaymentDialog, FailPaymentDialog, SaleDeductionsCard, SalesSheet
- **floor/** — WorkspaceHeader, TallyCard, SimulateScan, ScanPanel
- **floor-summary/** — FloorSummaryWorkspace
- **growers/** — BankAccountDialog, BuyerDialog
- **receiving/** — GrowerNoInput, AddGrowerForm, AuditTimeline, BaleCaptureWorkspace, DeliveryStatusBar, EjectBaleDialog, NewNoteView, NoteSummary, NoteView, TransporterForm
- **reports/** — ReportCell, ReportFilterBar, ReportView
- **sales/** — BalancePreviewPanel, SaleStatusBar
- **shell/** — AppShell, BrandMark, Brand, DemoControlsDialog, FloorShell, GlobalSearch, NotificationCenter, RequireSession, SidebarNav, SaleDayCard, DesktopSidebar, Topbar, UserMenu
- **tickets/** — SetStartBarcodeDialog, InterruptedTicketDialog, SplitSaleDialog, ReasonDialog, DeliveryQueue, BaleTicket, TicketSheet, TicketWorkspace
- **timb/** — IMPORT, DevFormatCallout, Stepper, CountTile, RowErrorsTable, DownloadErrorsButton

## 5. User journeys

### Journey 1 — The documented sale day (17 September 2026, Ethical Sales Floor)

Click it end to end as **Demo Operator**, or hand it between roles (the *Role* column) using **Switch demo user**. Start from **Demo controls → Fresh** and reset between runs.

| # | Stage (manual) | Role | Where | What you do | You should see |
|---|---|---|---|---|---|
| 1 | Daily setup (01) | Receiving Supervisor | `/setup/sale-dates` | New sale date, active, can scan | 17 Sep active; previous date deactivated |
| 2 | Daily setup (01) | Data Processing Supervisor | `/setup/start-of-day` | Post Start of Day at 26.6845 | "Start of Day Completed Successfully." |
| 3 | TIMB booking import (02) | TIMB Clerk | `/timb/imports/new?type=GROWER_BOOKING` | Use sample `ELS_ETHICAL_20260917.txt` → import | "Grower Booking Import complete: 2 created, 0 updated, 0 errors." Re-import → 0 created, 2 updated |
| 4 | Receiving (03) | Receiving Clerk | `/floor/receiving` | Transporter Tendai Moyo, AEX 1234 → add V100060 ×3 and V100061 ×2, location A → Complete | TDN0000002; GDN0000005 (V100060) and GDN0000004 (V100061) created |
| 5 | Bale capture (03) | Receiving Clerk | `/floor/receiving/[gdn]/bales` | Scan scale barcodes 2609170001–3, group 1, lots 1–3; complete | Tally 3 of 3 · Delivery Balanced · "Delivery Document #GDN0000005 for grower V100060 is closed" |
| 6 | Ticket printing (04) | Ticket Clerk | `/floor/tickets` | Set Starting Barcode 1000001013 → print preview → Confirm | Tickets 1000001013 / 1024 / 1035; delivery Checked; next barcode saved |
| 7 | Floor summary (05) | Floor Summary Clerk | `/floor/floor-summary` | Row 1, scan V100060's tickets; row 2 for V100061 | "Scanned 3 of 3"; deliveries Laid; draft sales 4 and 5 and batches created |
| 8 | Data capture (06) | Data Clerk | `/floor/data-capture` | Classification: grade A10/A1E/A1L; e-Buying: buyer JM, grade 11OF, prices 212/198/185 | Last Bale Details confirms each bale |
| 9 | Batch processing (06) | Data Clerk | `/batches` | Blind second price entry → Post Batch | Batch 4 Posted |
| 10 | Balancing (06) | Data Processing Supervisor | `/sales/sale-4` | Review the balancing preview → Balance Sale | "Sale has balanced!"; sale Balanced |
| 11 | Stop orders (07) | Data Processing Supervisor / TIMB Clerk | `/timb/imports/new?type=STOP_ORDER` then `/finance/stop-order-processing` | Import `EL_stoporders_20260917.txt`, run Stop Order Processing | Sales Processed, pay batch 1001; Deductions Dashboard $173.11 · 11 lines · 2 growers · 6 creditors |
| 12 | Grower payment (08) | Accounts | `/finance/payments` | Generate USD schedule for batch 1001; download CSV; record bank confirmation | Both growers listed; CSV download does **not** mark paid; Paid only after a recorded confirmation |
| 13 | Release (06/09) | Data Processing Supervisor | `/sales/sale-4` | Release the sale | Dispatch can accept its bales |
| 14 | Dispatch (09) | Dispatch Clerk | `/floor/dispatch` | Initiate for CURVERID, scan the five tickets, Post, Generate Shipment File | 5 bales · 512 kg; shipment file listed |

Every transition writes an audit entry (`/admin/audit`) and updates the dashboard (`/dashboard`, `/sale-day`).

### Journey 2 — Where is the day stuck?

Supervisors open `/dashboard`: the stage strip shows complete / in progress / blocked / needs attention, **blocked reasons are spelled out** (e.g. "Start of Day must be posted before data capture"), and the exceptions list links to the screen that fixes each one. `/sale-day` shows every stage with prerequisites and metrics.

### Journey 3 — Role-based access

Switch demo user and observe: the sidebar hides what a role cannot use; deep links show a no-access state; buttons that a role cannot press stay visible but disabled with the reason ("Your role (Receiving Clerk) lacks “sale-day.post”. Held by: Supervisor, Data Processing Supervisor…"). System Administrator manages users, roles (permission matrix) and settings at `/admin/*`.

### Journey 4 — Failure and exception paths (all with the manuals' verbatim messages)

- Renamed booking file → "Booking Decryption Keys for … is missing. Check filename of file"
- Start of Day with a zero rate, or with earlier Draft/Balanced sales
- Ticket printing with an overlapping start barcode → "Barcodes already used in Tickets"
- Bale tally mismatch, repeated group+lot, bale already on a closed document, lot with a leading "/"
- Floor-summary scanning turned off; scanning a ticket for an unconfirmed delivery; unknown barcode; duplicate scan
- Invalid buyer grade (belongs to another buyer), missing TIMB grade, price vs batch price mismatch (use the **Validation showcase** preset)
- Stop order file dated for another day → "Stop order not deducted"; pending approvals block processing
- Payment schedule with growers lacking bank details (they are left out and listed); CloudPay mock never marks paid
- Dispatch refusals: sale not released, wrong warehouse, rejected sale code (RO/RH/CO), bale already dispatched

## 6. Mock data scenarios

Stage presets (Demo controls) — built from the documented data; values the manuals don't give are DEMO-labelled.

| Preset | What it shows |
|---|---|
| Fresh — morning of 17 Sep | No sale date, no Start of Day, no bookings for today. Previous sales (11 Sep) are Processed. |
| 1 · Daily setup done | Receiving sale date active and Start of Day posted at 26.6845. |
| 2 · Bookings imported | ELS_ETHICAL_20260917.txt imported: V100060 × 3 and V100061 × 2 bales. |
| 2b · Receiving in progress (mid-tally) | TDN0000002 completed; GDN0000005 has 2 of 3 bales captured and GDN0000004 none — finish the tally to try Complete Delivery. |
| 3 · Received & captured | TDN0000002 completed; GDN0000005 / GDN0000004 closed with all 5 bales captured (Tickets Printing). |
| 4 · Tickets confirmed | Barcodes 1000001013–1000001035 and 1000001046–1000001057 printed and confirmed (Checked). |
| 5 · Floor summary done | All tickets scanned into rows 1 and 2; deliveries Laid; draft sales 4 and 5 and price batches created. |
| 6 · Captured, batches posted | Grades, buyer JM, buyer grade 11OF and prices captured; both price batches posted. Sales still Draft. |
| 7 · Sales balanced | Both sales Balanced. Stop order file not imported yet. |
| 8 · Deductions processed | Stop order imported; deductions ($173.11) taken; sales Processed with pay batch 1001. |
| 9 · Released, ready to dispatch | Processed sales released for dispatch (buyer JM → CURVERID). |
| Validation showcase (DEMO) | V100061 captured with deliberate errors (missing grade, invalid buyer grade, price mismatch) to show the balancing checks. |

**Documented in the manuals (used as-is):** sale date 17 Sep 2026; Ethical Sales Floor (EL), sale room A; exchange rate 26.6845; growers V100060 Chengetai Chingoma (3 bales, GDN0000005, tickets 1000001013 / 1000001024 / 1000001035, scale 2609170001–3, masses 112 / 98 / 105 kg, grades A10 / A1E / A1L, buyer JM, buyer grade 11OF, prices 212 / 198 / 185 US c/kg) and V100061 Trust Gwenzi (2 bales, GDN0000004, tickets 1000001046 / 1000001057); TDN0000002, Tendai Moyo, 63-123456-A-42, AEX1234, 0772123456; floor rows 1 and 2; sales 4 and 5, price batches 4 and 5; pay batch 1001 (history 1000); stop order $50.00 to creditor 00050; Deductions Dashboard totals ($173.11, 11 lines, 2 growers, 6 creditors); the 8 historical 11 Sep bookings and 3 Processed historical sales.

**Not in the manuals (DEMO-labelled):** V100061's masses, scale barcodes, grades, buyer and prices; per-line floor-charge amounts (only the $123.11 total is documented); grower bank accounts; the other growers/buyers/warehouses; the Validation-showcase sale; second-warehouse and extra reference data.

**Derived (illustrative):** gross value = Σ price × mass (V100060 = $625.73) — formula unverified (UQ-05); ticket check character = digit-sum mod 10 — fits all five documented tickets, unverified (UQ-01); local-currency value = USD × Start-of-Day rate (UQ-04).

## 7. Known design gaps

| # | Gap | Impact | Plan |
|---|---|---|---|
| 1 | **Dribbble design fusion not yet applied.** Both reference shots are unreachable to automated tools (bot protection); the current look follows the brief's written direction. | **High for visual sign-off** | Owner saves the two shots into `docs/design/references/`; then `reference-analysis.md`, token/component deltas, re-captured screenshots and side-by-side comparisons before approval |
| 2 | No real authentication — a demo role picker stands in for JWT sign-in; permissions are enforced by the mock only | Expected in Phase 1 | Phase 2: JWT, permission guards on every endpoint |
| 3 | Scanner, scale and printer are **simulated** (keyboard-wedge field, simulated weigh events, print preview). Nothing claims hardware is connected | Expected | Adapter interfaces are defined; real devices after approval |
| 4 | Real TIMB files are encrypted; the importer reads documented **dev sample** files only | Expected (UQ-13) | Separate encrypted-file adapter in Phase 4 once layouts/keys are supplied |
| 5 | Deduction amounts are illustrative fixed values; no charge formula is applied | Expected (UQ-05) | Needs Ethical/TIMB rates and rules |
| 6 | CloudPay is a mock and never marks growers paid; payment confirmation is a recorded, audited entry | Deliberate (stricter than Manual 08) | Real adapter in Phase 9 with idempotency and verified callbacks |
| 7 | PDF export is browser print-to-PDF; CSV is generated client-side | Minor | Server-side generation and object storage in Phase 11 |
| 8 | Dark mode and localisation (Shona/Ndebele) not built; English only | Minor | Out of scope for Phase 1 |
| 9 | Responsive checks: tablet widths verified on key screens; phone widths work but floor workspaces are designed for desktop/tablet | Minor | Phone-specific floor flows only if the business asks |
| 10 | Data volume: seeded with ~50 growers and one live day; tables paginate client-side | Minor | Server-side pagination and indexes in Phase 2+ |
| 11 | Two documented status-bar states ("Laying", sale "Posted") and several menu items (TRVs, Hessians, Laying, Intelliscale, Pending Issues, E-Marketing CSV, TIMB Files/Webservices, buyer invoicing) are not modelled | Needs business input (UQ-02, UQ-11) | Add when documented |
| 12 | "Split this Sale" and some other documented buttons are present but only audit-simulated (behaviour undocumented) | Needs business input (UQ-11, UQ-28) | Define with e-Port/Ethical |
| 13 | The mock DB lives in one browser's localStorage — two tabs/users do not share state | Expected | The backend is the shared source of truth |
| 14 | Notifications are in-app only (no email/SMS) | Minor | Notification module in Phase 11 |

## 8. Outstanding questions

The full list is in [`docs/research/unresolved-business-questions.md`](../research/unresolved-business-questions.md) (UQ-01 … UQ-28). Everything below is built configurable and marked **Unverified** in the UI. The ones that most affect the backend:

| ID | Question | Why it matters |
|---|---|---|
| UQ-05 | Grower-charge rates/basis, internal invoice and merchant-loan rules, gross-value formula and rounding | Deductions and net payout are money. Phase 1 posts illustrative fixed amounts only; nothing is calculated by an invented formula |
| UQ-04 | Local currency naming (ZWL vs ZWG vs RTGS) and how net payout splits between USD and local currency | Payment schedules and bank files |
| UQ-06 | What creates "Pending Approvals", who approves, what a sale reversal/adjustment does, pay-batch numbering | Approval workflow and financial reversal records |
| UQ-13 | Real TIMB file layouts, encryption and key store | The import adapter; Phase 1 uses a clearly separated development sample adapter |
| UQ-01 | Ticket barcode check-character algorithm | Barcode validation (digit-sum mod 10 fits all five documented tickets but is unverified) |
| UQ-03 | Who releases a sale and where | Dispatch cannot start until a sale is released |
| UQ-12 | Sales-sheet report source, bank details owner, CloudPay configuration, destination warehouses, shipment-file columns, which dispatch app | Payments and dispatch outputs |

**Also needed from the project owner:** screenshots of the two Dribbble reference shots (both pages returned empty content to automated fetching), so proportions and density can be calibrated against them.

## 9. Proposed backend integration points

The mock layer is shaped like the future API so that Phase 2 replaces `apps/web/src/mock/` with a typed client and the pages keep their shape. Each `mock/domain/*.ts` file is the specification for one NestJS module; each mock operation becomes a transactional service method with the same guard order (permission → status → prerequisites → mutation → audit).

| UI area | Mock operations (apps/web/src/mock/domain) | Future NestJS module / endpoints | Notes |
|---|---|---|---|
| Daily setup | `daily-setup.ts` | `sale-days` — `POST /sale-dates`, `PATCH /sale-dates/:id/activate`, `POST /start-of-day` | Posted SoD immutable; corrections via audited supervisor action (UQ-16) |
| TIMB imports | `timb.ts` | `timb` — `POST /imports` (multipart) → `ImportJob`; adapters per file type; idempotent on booking ref / file checksum | **Real encrypted-file adapter is separate and unimplemented (UQ-13)**; sample adapter stays for development |
| Growers / creditors / buyers | `timb.ts` (+ reference data) | `growers`, `creditors`, `buyers` | Bank details owner/source open (UQ-12) |
| Receiving | `receiving.ts` | `receiving`, `transporters`, `delivery-notes`, `bales` | Scale adapter interface supplies mass by scale barcode |
| Tickets | `tickets.ts` | `tickets` — allocate (unique constraint on barcode per season), print events, confirm | Barcode check algorithm pluggable (UQ-01); printer adapter |
| Floor summary | `floor-summary.ts` | `floor-summary` — scan in a transaction; completion creates summary + sale + batch atomically | Scanner adapter; duplicate detection is an addition (UQ-20) |
| Data capture, batches | `data-capture.ts`, `batches.ts` | `data-capture`, `batch-processing` | Per-field partial save semantics preserved |
| Sales / balancing | `sales.ts` | `sales`, `balancing` — `GET /sales/:id/balancing-preview`, `POST /sales/:id/balance` | Backend alone decides Balanced/Processed |
| Approvals | `approvals.ts` | `approvals` — generic request/decide with no self-approval | Triggers configurable (UQ-06) |
| Deductions | `stop-orders.ts` | `stop-orders`, `deductions` — decimal arithmetic in the database layer | **Rates/formulas must be supplied by Ethical/TIMB (UQ-05)**; processing order documented |
| Payments | `payments.ts` | `payments` — schedules, bank CSV, CloudPay adapter, reconciliation | Immutable `PaymentTransaction` history; paid only on verified confirmation |
| Dispatch | `dispatch.ts` | `dispatch` — notes, scans, post, cancel/reset, shipment export | Shipment file columns to be agreed (UQ-12) |
| Reports | `lib/reports/*` | `reports` — SQL read models, CSV/PDF generation, object storage | Print-to-PDF now, server PDF later |
| Admin / audit | `admin.ts` | `users`, `roles`, `permissions`, `settings`, `audit`, `organizations` | JWT + permission guards; audit written in the same transaction |
| Authentication | demo role picker | `auth` — JWT, refresh, permission claims | Phase 1 has **no real auth** |
| Search / notifications | `lib/search-index.ts`, notification ops | `GET /search`, `notifications` | Business references stay searchable |

**Cross-cutting for Phase 2:** UUID primary keys with human-readable document references; `numeric` for money/weights; unique constraints for barcodes, imports and payment schedules; idempotency keys on imports and payment submissions; soft deletion only where appropriate (never for posted records); Vercel-compatible serverless NestJS with pooled Neon connections; durable object storage for uploads.

## 10. Verification results

Run on 2026-11-10 against the code in this repository.

| Check | Result |
|---|---|
| `tsc --noEmit` — all 5 workspaces (web, ui, shared, validation, design-system) | ✅ clean |
| ESLint (web) | ✅ 0 errors · 8 warnings, all deliberate (React Hook Form `watch`, the latest-ref pattern in `useAction`, hydrate-after-mount in `MockProvider`) |
| Unit tests (Vitest) | ✅ **290 passing** — 256 web (domain operations for all 13 modules, scenario presets, dashboard model, scanner component via React Testing Library), 13 shared (barcodes, money), 21 validation (rules and schemas) |
| End-to-end (Playwright, Chromium) | ✅ **67 passing** — documented journeys per module, negative cases with the manuals' verbatim messages, role/permission cases, admin and reports |
| Accessibility (axe-core, WCAG 2.0/2.1 A + AA) over every captured screen at desktop and tablet widths | ✅ **0 serious or critical violations** |
| Screenshots | ✅ 76 regenerated by `pnpm screens` |

**Assertions that tie the build to the manuals** (all green): documented ticket barcodes and the "range ≠ bale count" rule; scale mass 112/98/105 kg; V100060 gross $625.73 (price × mass); GDN0000005/GDN0000004 numbering; documented historical values (`2,788.53`, `11,399.62`); Deductions Dashboard **$173.11 · 11 lines · 2 growers · 6 creditors** (= $123.11 + $50.00); pay batch 1001; net payouts $499.43 and $342.64 to the cent; CSV download never marks growers paid; CloudPay mock never marks paid; documented dispatch refusal rules.

**Bugs the verification found and that were fixed during this phase:** seed data shared between scenario builds; focus lost after saving a bale (broke keyboard-first capture); "simulate scan" chips skipped inline feedback; `Callout` dropped attributes; wide tables and `<pre>` blocks not keyboard-scrollable; whole-element opacity dimming failing contrast; unlabeled read-only inputs; stage strip clipping stages at tablet width; low-contrast text on the purple floor bar.

**Not verified (cannot be, yet):** the visual match to the two Dribbble references (images not supplied); any real hardware, bank, CloudPay or TIMB behaviour (none is connected); behaviour at production data volumes.

## 11. Approval

**Please review and either approve the UI or list the changes you want.** Per the project rules, no backend (NestJS, database, auth, real integrations) will be started until you explicitly approve. Any UI changes you request will be made first.

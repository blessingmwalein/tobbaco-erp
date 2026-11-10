# Module Map

The system is a **modular monolith**: one NestJS app (Phase 2+) organised into business modules; one Next.js app (Phase 1 now) organised into matching feature folders. Each backend module owns its logic, DB access and endpoints; modules talk through exported services, never through each other's tables. Phase 1 builds only the frontend feature modules against the mock layer.

## Business modules
| Module | Responsibility | Manual | Main entities | Key permissions | Frontend feature (Phase 1) |
|---|---|---|---|---|---|
| auth, users, roles, permissions | Login, JWT, RBAC, per-user overrides, selling-point restriction | — | User, Role, Permission, UserRole, RolePermission | users.manage, roles.manage | `/login`, `/admin/users`, `/admin/roles` |
| organizations, settings | Organisation, system settings, currencies, thresholds | — | Organization, SystemSetting | settings.manage | `/admin/settings` |
| seasons, selling-points | Season, selling point, sale rooms, floor rows, bale locations, packing warehouses | 01 | Season, SellingPoint, SaleRoom, FloorRow, BaleLocation, Warehouse | reference-data.manage | `/admin/reference-data` |
| sale-days | Receiving sale date, Start of Day, exchange rate | 01 | SaleDate, StartOfDay | sale-day.* | `/setup/*`, `/dashboard`, `/sale-day` |
| growers, creditors, buyers | Registers incl. bank accounts, buyer grades | 02, 06, 07 | Grower, GrowerBankAccount, Creditor, Buyer, BuyerGrade | growers.view | `/growers`, `/creditors`, `/buyers` |
| timb | Import adapters, import jobs, row errors, bookings | 02, 07 | ImportJob, ImportFile, ImportRowError, GrowerBooking | timb.* | `/timb/*` |
| receiving, transporters, delivery-notes, bales | Transporter notes, grower delivery notes, bale capture, corrections | 03 | Transporter, TransporterDeliveryNote, TransporterDeliveryGrower, GrowerDeliveryNote, Bale | receiving.* | `/floor/receiving`, `/receiving/*` |
| tickets | Barcode allocation, print batches, confirmation, reversal, per-user next barcode | 04 | BaleTicket, TicketPrintBatch, UserBarcodeSequence | tickets.* | `/floor/tickets`, `/tickets` |
| floor-summary | Floor scans, row assignment, completion → sale + price batch | 05 | FloorSummary, FloorSummaryScan | floor-summary.* | `/floor/floor-summary`, `/floor-summary` |
| data-capture | Classification and e-buying capture | 06 | BaleClassification, BaleSaleCapture | data-capture.* | `/floor/data-capture` |
| batch-processing | Price batches (second price capture), posting | 06 | GrowerSaleBatch | batch.* | `/batches` |
| sales, balancing | Sales (Salesmaster), tickets, balancing, release, reversal | 06, 07 | GrowerSale, SaleTicket | sales.* | `/sales` |
| approvals | Configurable approval requests/decisions | 06, 07 (referenced) | SaleApproval, ApprovalRequest | approvals.* | `/approvals` |
| stop-orders, deductions | Stop orders, grower charges, invoices, loans, deduction processing, dashboard | 07 | StopOrder, GrowerCharge, InternalInvoice, MerchantLoan, Deduction, DeductionBatch | deductions.*, timb.import-stop-orders | `/finance/stop-orders`, `/finance/deductions` |
| payments | Sales sheets, pay batches, schedules, bank CSV, confirmations | 08 | PayBatch, PaymentSchedule, PaymentScheduleLine, PaymentTransaction | payments.* | `/finance/payments` |
| dispatch | Dispatch notes, scanning, shipment files, warehouses config | 09 | DispatchNote, DispatchBale, ShipmentExport | dispatch.* | `/floor/dispatch`, `/dispatch` |
| reports | 16 reports, CSV/PDF export | all | (read models) | reports.* | `/reports` |
| audit, notifications | Audit log, notification centre | — | AuditLog, Notification | audit.view | `/admin/audit`, notification centre |

## Cross-cutting
- **Workflow engine** (state machines with guard/actor/audit) used by TDN, GDN, price batch, sale, dispatch, import, payment.
- **Integration layer** (adapters): TIMB, scale, scanner, printer, payment, warehouse export — see `integration-boundaries.md`.
- **Identity of records**: UUID primary keys + human-readable references (see `entity-map.md`).

## Future modules (architecture must not block; not built now)
Contracts, grower onboarding/groups, loans/advances, agricultural inputs, transporter management/payments, warehouse/tobacco inventory, auction & merchants, buyer invoicing (Accounts menu stubs seen in M08), farmer statements, advanced finance reporting, multiple selling points/organisations.

Sources: brief Parts 2, 5, 6; Manuals 01–09.

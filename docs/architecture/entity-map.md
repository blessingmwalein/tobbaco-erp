# Entity Map (proposed, refined from the manuals)

Proposed for the Phase 2 schema; not implemented. Conventions (brief): UUID primary keys, human-readable references, foreign keys, indexes, `numeric` for money/weights, currency codes preserved, UTC timestamps, `created_by`/`updated_by`, transactions on state changes, no deletion of posted records, soft delete only where appropriate.

## Entities by area
| Area | Entities |
|---|---|
| Identity | Organization, User, Role, Permission, UserRole, RolePermission, UserPermissionOverride, UserSellingPoint |
| Floor setup | Season, SellingPoint, SaleRoom, FloorRow (integer rows), BaleLocation (receiving "A"), SaleDate (receiving; isActive, canScanFloorSummary), StartOfDay (selling date, exchange rate, status), Warehouse (packing warehouse), TimbGrade (grade/reason), SaleCode, HessianOwner, District |
| Registers | Grower, GrowerBankAccount (currency), GrowerBooking (booked id, TIMB reference), Creditor, Buyer, BuyerGrade (belongs to a buyer) |
| Imports | ImportJob, ImportFile (original name, checksum, key prefix), ImportRowError |
| Receiving | Transporter (name, ID, phone), TransporterDeliveryNote (TDN…), TransporterDeliveryGrower, GrowerDeliveryNote (GDN…), Bale (scale barcode, mass, group, lot), ScaleReading |
| Tickets | BaleTicket (ticket barcode, base + check), TicketPrintBatch, UserBarcodeSequence (per-user next barcode), TicketReversal |
| Floor | FloorSummary (per delivery), FloorSummaryScan (ticket, row, scanned by/at) |
| Data capture & sale | BaleClassification (TIMB grade/reason, hessian), BaleSaleCapture (buyer, buyer grade, price cents/kg, sale code), GrowerSaleBatch (price batch; batch price per ticket), GrowerSale (Salesmaster; status, released, pay batch ref), SaleTicket (line), ApprovalRequest/SaleApproval |
| Deductions | GrowerCharge (config), StopOrder, InternalInvoice, MerchantLoan, Deduction (line: category/source, creditor, amount, currency, order), DeductionBatch |
| Payments | PayBatch (number e.g. 1001), PaymentSchedule (date, batch, currency), PaymentScheduleLine, PaymentTransaction (immutable), PaymentConfirmation |
| Dispatch | DispatchNote (FLDN…), DispatchBale, TransportCompany, Driver, ShipmentExport |
| Platform | AuditLog, Notification, SystemSetting |

## Relationships
```mermaid
erDiagram
  SellingPoint ||--o{ SaleRoom : has
  SellingPoint ||--o{ SaleDate : schedules
  SaleDate ||--o| StartOfDay : "same date"
  Grower ||--o{ GrowerBooking : books
  Grower ||--o{ GrowerBankAccount : has
  TransporterDeliveryNote ||--|{ TransporterDeliveryGrower : lists
  TransporterDeliveryGrower ||--|| GrowerDeliveryNote : "creates on completion"
  GrowerDeliveryNote ||--|{ Bale : contains
  Bale ||--o| BaleTicket : "gets ticket barcode"
  GrowerDeliveryNote ||--o| FloorSummary : "scanned into"
  FloorSummary ||--|{ FloorSummaryScan : records
  FloorSummary ||--|| GrowerSale : "creates draft"
  GrowerSale ||--|| GrowerSaleBatch : "price batch"
  GrowerSale ||--|{ SaleTicket : lines
  SaleTicket }o--|| BaleTicket : for
  SaleTicket }o--o| Buyer : "bought by"
  Buyer ||--o{ BuyerGrade : grades
  GrowerSale ||--o{ Deduction : "after processing"
  StopOrder }o--|| Creditor : to
  StopOrder }o--|| Grower : against
  GrowerSale }o--o| PayBatch : "assigned on Processed"
  PayBatch ||--o{ PaymentSchedule : "per currency"
  PaymentSchedule ||--|{ PaymentScheduleLine : lines
  PaymentScheduleLine ||--o{ PaymentTransaction : outcomes
  DispatchNote ||--|{ DispatchBale : scanned
  DispatchBale }o--|| SaleTicket : of
  DispatchNote }o--|| Warehouse : destination
  Buyer }o--o| Warehouse : packs_at
```

## Key business identifiers (must stay searchable everywhere)
| Identifier | Example | Where it appears | Note |
|---|---|---|---|
| Grower number | V100060, V100088A | register, bookings, deliveries, sales | Suffix letters exist; "V" prefix + digits |
| TIMB booking reference / Booked id | EL2609170001 | bookings | Floor + YYMMDD + sequence (inferred); import idempotency key |
| Transporter delivery note | TDN0000002 | receiving | |
| Grower delivery note | GDN0000005 | receiving → floor | |
| Scale barcode | 2609170001 | receiving, tickets | Carries mass |
| Ticket barcode | 1000001013 | tickets → dispatch | 9 digits + check; unique per season |
| Sale reference / Sale number | Sale 1; Salesmaster ID 4 | sales | "Sale" = per-grower-delivery sale (and sale room "Sale A" — distinct) |
| Price batch number | Batch 4 | batches | |
| Pay batch number | 1001 | processed sales, payments | Not the price batch |
| Dispatch reference | FLDN/2026/09/0001 | dispatch | |
| Import file name | ELS_ETHICAL_20260917.txt | imports | Never renamed; key prefix |

## Integrity requirements
Unique: scale barcode per open delivery (and across closed documents), ticket barcode per season, (delivery, group, lot), booking reference, pay batch per run, one dispatch note per bale at a time. Immutable: PaymentTransaction, AuditLog, posted Deduction. Idempotency: imports (booking reference / file date), payment schedules (pay batch+currency+date), processing runs.

Sources: brief Part 8; Manuals 01–09.

# Audit Events

Every important action produces an audit entry. Fields (brief Part 11): **user, action, entity type, entity ID, previous value, new value, reason, timestamp, request metadata** (IP, user agent, request ID, selling point). Audit rows are append-only and never edited or deleted. The Phase 1 mock writes the same shape to an in-memory log shown at `/admin/audit` and in each record's history.

Reason required: **R** = mandatory reason, **A** = may require approval (configurable; UQ-06), – = none.

| Module | Action key | Entity | Reason | Notes (source) |
|---|---|---|---|---|
| auth | auth.login, auth.login-failed, auth.logout | User | – | |
| users | user.create/update/deactivate, user.role-assign, user.permission-override | User | R for override/deactivate | brief |
| roles | role.create/update/permissions-change | Role | R | brief |
| settings | setting.update | SystemSetting | R | e.g. currency, rounding |
| seasons/selling-points | reference-data.create/update | Season/SellingPoint/Warehouse/… | – | |
| sale-days | sale-date.create, sale-date.activate, sale-date.deactivate | SaleDate | – | M01 |
| sale-days | start-of-day.post | StartOfDay | – | M01 (exchange rate in new value) |
| timb | import.upload, import.validate, import.process, import.complete/fail | ImportJob/ImportFile | – | counts created/updated/errors; M02, M07 |
| timb | import.error-report-download | ImportJob | – | proposed |
| growers | grower.update, grower.bank-account-change | Grower/GrowerBankAccount | R for bank change | affects payments |
| receiving | tdn.create, tdn.edit-transporter, tdn.add-grower, tdn.remove-grower, tdn.complete | TransporterDeliveryNote | – | M03 |
| receiving | bale.capture | Bale | – | scale barcode, group, lot, mass |
| receiving | delivery.complete | GrowerDeliveryNote | – | Open → Tickets Printing |
| receiving | bale.eject | Bale | **R** (A) | M03 supervisor; reason proposed |
| tickets | ticket.set-start-barcode, ticket.allocate | BaleTicket | – | per-user sequence |
| tickets | ticket.print | TicketPrintBatch | – | print history |
| tickets | ticket.confirm | GrowerDeliveryNote | – | locks barcodes (M04) |
| tickets | ticket.interrupt | TicketPrintBatch | R | last printed + new start |
| tickets | ticket.reverse-printing | GrowerDeliveryNote | **R** (A) | M04 supervisor |
| floor-summary | floor-scan.toggle | Floor | R | on/off for whole floor |
| floor-summary | floor-scan.scan, floor-scan.duplicate, floor-scan.invalid | FloorSummaryScan | – | duplicate/invalid are proposed |
| floor-summary | floor-summary.complete | FloorSummary | – | creates sale + batch |
| data-capture | classification.save, buyer-capture.save | BaleClassification/BaleSaleCapture | – | per-field result (partial save) |
| batch | batch.price-capture, batch.post | GrowerSaleBatch | – | M06 |
| sales | sale.balance | GrowerSale | – | check results stored |
| sales | sale.reverse, sale.adjust | GrowerSale | **R** (A) | M06 mechanism unknown |
| sales | sale.release | GrowerSale | R | UQ-03 |
| approvals | approval.request, approval.decide | ApprovalRequest | R for decision | approver ≠ requester |
| stop-orders | stop-order.import | ImportJob/StopOrder | – | M07 |
| deductions | deductions.process | DeductionBatch | – | sale → Processed, pay batch |
| deductions | grower-charge.update | GrowerCharge | R | formula/rates config |
| payments | sales-sheet.generate | PayBatch | – | |
| payments | schedule.generate, schedule.download | PaymentSchedule | – | download never marks paid |
| payments | payment.submit-gateway | PaymentSchedule | – | mock in demo |
| payments | payment.confirm, payment.fail, payment.reconcile | PaymentScheduleLine | R (reference) | immutable transactions |
| dispatch | dispatch.create, dispatch.scan-bale, dispatch.remove-bale | DispatchNote | – | M09 |
| dispatch | dispatch.post | DispatchNote | – | |
| dispatch | dispatch.cancel | DispatchNote | **R** | M09 |
| dispatch | dispatch.reset | DispatchNote | **R** (A) | M09 message |
| dispatch | shipment-file.generate | ShipmentExport | – | Posted only |
| reports | report.run, report.export | Report | – | user-activity report |

## Retention and access
`audit.view` for SA and Supervisor; reports "User activity" read from this log. Retain at least the season plus regulatory period (to be decided). Redact secrets; never log credentials or full bank account numbers (mask).

Sources: brief Part 11; Manuals 03, 04, 05, 06, 07, 08, 09.

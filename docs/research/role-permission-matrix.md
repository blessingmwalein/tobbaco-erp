# Role–Permission Matrix

Permissions are enforced by the backend (Phase 2+); in Phase 1 the mock layer enforces them in `mockApi` and the UI shows disabled controls with "Requires permission X". Roles are data, not code: the System Administrator can create custom roles, assign several roles to a user, add per-user permission overrides and restrict users to selling points.

Legend: ● granted by default · blank = not granted. **(P)** = proposed key not named in the manuals or the brief's example list. **(F)** = assignment is a flagged assumption (see "Where the manuals and the brief differ").

Role codes: **SA** System Administrator · **SUP** Supervisor · **TIMB** TIMB Clerk · **RCV** Receiving Clerk · **RSUP** Receiving Supervisor · **TKT** Ticket Clerk · **FS** Floor Summary Clerk · **DC** Data Clerk · **DPS** Data Processing Supervisor · **ACC** Accounts · **DSP** Dispatch Clerk · **DSUP** Dispatch Supervisor.

## 1. Roles: brief vs manuals
| Brief role | Manual role(s) it covers | Notes |
|---|---|---|
| System Administrator | (none; sandbox chatter shows "Administrator") | Admin/config/reporting/audit; no floor operations by default |
| Supervisor | "Supervisor" (Manual 01 header) | Brief: configure/activate sale dates, monitor, review exceptions, approve corrections |
| TIMB Clerk | TIMB clerk (M02) | Imports registers/bookings/stop orders |
| Receiving Clerk | Receiving clerk (M03) | TDN, growers, bales |
| Receiving Supervisor | Receiving supervisor (M01 sale date; M03 eject) | Also owns sale-date setup per M01 |
| Ticket Clerk | Ticket clerk (M04) | |
| Floor Summary Clerk | Floor summary clerk (M05) | |
| Data Clerk | Classification clerk, Buying clerk (M06) | **Batch clerk** (M06) is a third data-entry role; the brief has none |
| Data Processing Supervisor | Data processing supervisor (M01, M06, M07) | Also "Data processing" prints sales sheets (M08) |
| Accounts | Accounts (M07 review, M08) | |
| Dispatch Clerk | Dispatch clerk (M09) | |
| Dispatch Supervisor | Dispatch supervisor (M09) | |
| — (not a system user) | Scale operator (M03), Floor staff (M05) | Device/physical roles; scale operator "weighs"; no system permissions assumed |
| — (see F) | Receiving manager (M05) | Turns floor summary scanning on/off; mapped to SUP and RSUP (UQ-10 adjacent) |

## 2. Where the manuals and the brief differ
1. **Setup ownership:** M01 — Receiving supervisor creates Sale Date - Receiving; Data processing supervisor posts Start of Day. Brief gives both to "Supervisor". Decision: keep SUP with both permissions, grant `sale-day.create/activate` to RSUP and `sale-day.post` to DPS.
2. **Data Clerk split:** M06 names Classification, Buying and Batch clerks. Decision: keep one DC role with granular keys so a custom role can split them. `batch.capture-price` defaults to DPS (F) because the brief gives Batch processing only to DPS; a "Batch Clerk" custom role is expected. Optional setting: batch price must be entered by a different user than the captured price (default off, unverified — "second clerk" is implied by M06).
3. **Receiving manager** (M05) has no brief role. `floor-summary.toggle-scanning` is granted to SUP and RSUP (F).
4. **Reverse Printing Status** (M04): "only a supervisor should use it" — which supervisor is unstated; granted to SUP and RSUP (F).
5. **Stop order import:** M07 assigns it to the Data processing supervisor; the brief lists it under TIMB Clerk. Both hold `timb.import-stop-orders`.
6. **Sales sheets:** M08 says "Data processing prints grower sales sheets"; the brief says Accounts generates them. Both hold `payments.sales-sheet`.
7. **Dispatch post:** brief gives the clerk "submit dispatch notes"; M09 says the clerk posts. DSP and DSUP hold `dispatch.post`.
8. **Sale release:** who releases a sale is unstated (UQ-03); `sales.release` defaults to DPS (F).
9. **Approvals:** M07 references "Pending Approvals" without describing the workflow; `approvals.*` keys are proposed (P).

## 3. Permission keys and default grants
| Permission | SA | SUP | TIMB | RCV | RSUP | TKT | FS | DC | DPS | ACC | DSP | DSUP |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Sale day & setup** | | | | | | | | | | | | |
| sale-day.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| sale-day.create (Sale Date - Receiving) |   | ● |   |   | ● |   |   |   |   |   |   |   |
| sale-day.activate (active flag, scan flag) |   | ● |   |   | ● |   |   |   |   |   |   |   |
| sale-day.post (Post Start of Day) |   | ● |   |   |   |   |   |   | ● |   |   |   |
| **TIMB data** | | | | | | | | | | | | |
| timb.view | ● | ● | ● |   |   |   |   |   | ● |   |   |   |
| timb.import-growers |   |   | ● |   |   |   |   |   |   |   |   |   |
| timb.import-creditors |   |   | ● |   |   |   |   |   |   |   |   |   |
| timb.import-bookings |   |   | ● |   |   |   |   |   |   |   |   |   |
| timb.import-stop-orders |   |   | ● |   |   |   |   |   | ● |   |   |   |
| timb.view-import-errors (P) |   | ● | ● |   |   |   |   |   | ● |   |   |   |
| timb.download-error-report (P) |   |   | ● |   |   |   |   |   |   |   |   |   |
| **Growers** | | | | | | | | | | | | |
| growers.view (P) | ● | ● | ● | ● | ● |   |   |   | ● | ● |   |   |
| growers.manage-bank-accounts (P, F) | ● |   |   |   |   |   |   |   |   | ● |   |   |
| **Receiving** | | | | | | | | | | | | |
| receiving.view | ● | ● |   | ● | ● | ● | ● |   | ● |   |   |   |
| receiving.create-delivery |   |   |   | ● |   |   |   |   |   |   |   |   |
| receiving.edit-transporter (P) |   |   |   | ● |   |   |   |   |   |   |   |   |
| receiving.add-grower |   |   |   | ● |   |   |   |   |   |   |   |   |
| receiving.remove-grower (P) |   |   |   | ● |   |   |   |   |   |   |   |   |
| receiving.complete-transporter-note (P) |   |   |   | ● |   |   |   |   |   |   |   |   |
| receiving.capture-bale |   |   |   | ● |   |   |   |   |   |   |   |   |
| receiving.complete-delivery |   |   |   | ● |   |   |   |   |   |   |   |   |
| receiving.eject-bale |   |   |   |   | ● |   |   |   |   |   |   |   |
| **Tickets** | | | | | | | | | | | | |
| tickets.view | ● | ● |   |   | ● | ● | ● |   |   |   |   |   |
| tickets.set-start-barcode (P) |   |   |   |   |   | ● |   |   |   |   |   |   |
| tickets.allocate |   |   |   |   |   | ● |   |   |   |   |   |   |
| tickets.print |   |   |   |   |   | ● |   |   |   |   |   |   |
| tickets.confirm |   |   |   |   |   | ● |   |   |   |   |   |   |
| tickets.interrupt (P) |   |   |   |   |   | ● |   |   |   |   |   |   |
| tickets.split-sale (P, unverified) |   |   |   |   |   | ● |   |   |   |   |   |   |
| tickets.reverse-printing (P, F) |   | ● |   |   | ● |   |   |   |   |   |   |   |
| **Floor summary** | | | | | | | | | | | | |
| floor-summary.view | ● | ● |   |   | ● |   | ● |   | ● |   |   |   |
| floor-summary.scan |   |   |   |   |   |   | ● |   |   |   |   |   |
| floor-summary.complete |   |   |   |   |   |   | ● |   |   |   |   |   |
| floor-summary.check (P) |   | ● |   |   | ● |   | ● |   |   |   |   |   |
| floor-summary.toggle-scanning (P, F) |   | ● |   |   | ● |   |   |   |   |   |   |   |
| **Data capture & batches** | | | | | | | | | | | | |
| data-capture.view | ● | ● |   |   |   |   |   | ● | ● |   |   |   |
| data-capture.classify |   |   |   |   |   |   |   | ● |   |   |   |   |
| data-capture.capture-buyer |   |   |   |   |   |   |   | ● |   |   |   |   |
| data-capture.capture-price |   |   |   |   |   |   |   | ● |   |   |   |   |
| batch.view (P) | ● | ● |   |   |   |   |   |   | ● |   |   |   |
| batch.capture-price (P, F) |   |   |   |   |   |   |   |   | ● |   |   |   |
| batch.post (P) |   |   |   |   |   |   |   |   | ● |   |   |   |
| **Sales & approvals** | | | | | | | | | | | | |
| sales.view | ● | ● |   |   |   |   |   |   | ● | ● |   | ● |
| sales.balance |   |   |   |   |   |   |   |   | ● |   |   |   |
| sales.reverse |   |   |   |   |   |   |   |   | ● |   |   |   |
| sales.approve |   | ● |   |   |   |   |   |   | ● |   |   |   |
| sales.release (F) |   |   |   |   |   |   |   |   | ● |   |   |   |
| approvals.view (P) | ● | ● |   |   | ● |   |   |   | ● |   |   | ● |
| approvals.request (P) |   |   |   |   | ● |   |   |   | ● | ● |   | ● |
| approvals.decide (P) |   | ● |   |   |   |   |   |   | ● |   |   |   |
| **Deductions** | | | | | | | | | | | | |
| deductions.view | ● | ● |   |   |   |   |   |   | ● | ● |   |   |
| deductions.process |   |   |   |   |   |   |   |   | ● |   |   |   |
| deductions.manage-charges (P) | ● |   |   |   |   |   |   |   | ● |   |   |   |
| **Payments** | | | | | | | | | | | | |
| payments.view | ● | ● |   |   |   |   |   |   | ● | ● |   |   |
| payments.sales-sheet (P) |   |   |   |   |   |   |   |   | ● | ● |   |   |
| payments.generate-schedule |   |   |   |   |   |   |   |   |   | ● |   |   |
| payments.export |   |   |   |   |   |   |   |   |   | ● |   |   |
| payments.submit-gateway (P) |   |   |   |   |   |   |   |   |   | ● |   |   |
| payments.confirm-payment |   |   |   |   |   |   |   |   |   | ● |   |   |
| **Dispatch** | | | | | | | | | | | | |
| dispatch.view | ● | ● |   |   |   |   |   |   |   |   | ● | ● |
| dispatch.create |   |   |   |   |   |   |   |   |   |   | ● |   |
| dispatch.scan |   |   |   |   |   |   |   |   |   |   | ● |   |
| dispatch.post |   |   |   |   |   |   |   |   |   |   | ● | ● |
| dispatch.cancel |   |   |   |   |   |   |   |   |   |   |   | ● |
| dispatch.generate-shipment-file |   |   |   |   |   |   |   |   |   |   |   | ● |
| dispatch.reset (P) |   |   |   |   |   |   |   |   |   |   |   | ● |
| dispatch.configure (P) | ● |   |   |   |   |   |   |   |   |   |   | ● |
| **Reports, audit, administration** | | | | | | | | | | | | |
| reports.view (P) | ● | ● |   |   | ● |   |   |   | ● | ● |   | ● |
| reports.export (P) | ● |   |   |   |   |   |   |   | ● | ● |   | ● |
| audit.view (P) | ● | ● |   |   |   |   |   |   |   |   |   |   |
| users.manage (P) | ● |   |   |   |   |   |   |   |   |   |   |   |
| roles.manage (P) | ● |   |   |   |   |   |   |   |   |   |   |   |
| settings.manage (P) | ● |   |   |   |   |   |   |   |   |   |   |   |
| reference-data.manage (P) | ● |   |   |   |   |   |   |   |   |   |   |   |

## 4. Rules that cut across roles
- **Segregation:** no user approves their own approval request unless an explicit configured rule permits it (brief). Optional setting: batch price by a different user than captured price.
- **Selling-point restriction:** a user may be limited to one or more selling points (brief).
- **Privileged actions are audited** (eject bale, reverse printing status, sale reversal, release, cancel/reset dispatch, role/user changes, payment confirmation).

Sources: Overview; Manuals 01–09 ("Who" tables); brief Parts 4 and 5.

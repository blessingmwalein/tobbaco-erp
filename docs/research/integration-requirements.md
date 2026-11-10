# Integration Requirements

Each integration sits behind an adapter interface; core ERP logic never depends on a provider. In Phase 1 every adapter has a **clearly labelled mock**. Nothing here is operational, and the UI must never claim a device or provider is connected when it is not. Credentials/keys (TIMB decryption keys, payment credentials, API keys) are configured outside source code.

Documentation level: ● = documented in manuals, ○ = only a menu/name exists, ✗ = not documented.

## 1. TIMB files (import adapters)
All four are "encrypted TIMB files"; the decryption key is chosen by the **file name** (do not rename). Real decryption is deferred (UQ-13): Phase 1 uses sample CSV/JSON through a separate, labelled sample-file adapter and the UI says so.

| Aspect | Grower register | Creditor register | Grower booking | Stop orders |
|---|---|---|---|---|
| Legacy menu | Import Grower Register File ○ | Import Creditor Register File ○ | Import Grower Booking File ● | Import Stop Order File ● |
| Input | file (format ✗) | file (format ✗) | `ELS_ETHICAL_20260917.txt` ● | `EL_stoporders_20260917.txt` ● |
| Key selection | ✗ | ✗ | first 3 chars `ELS` ● | first 2 chars `EL` ● |
| Output / result | ✗ | ✗ | "N created, N updated, N errors" ● | "N created, N updated, N errors" ● |
| Mapping | grower fields (number, first name, surname, season, district?) | creditor number/name | grower no., sell date, bales booked, book date, booked id | grower no., creditor, Amount 1/2/3, priority, rec type, stop order #, percent |
| Validation | ✗ | ✗ | grower must exist; valid decryption key | valid records; key; date in name links to sale date |
| Errors | ✗ | ✗ | "Import complete with errors"; "Booking Decryption Keys for X is missing…" | "Uploaded file does not contain any valid records"; "Decryption Keys for X need to be added" |
| Idempotency | ✗ | ✗ | update matched on TIMB booking reference ● | same-prefix file replaces earlier import (ambiguous, UQ-07) |
| Retry | re-import after fixing cause ● | same | same ● | same ● |
| Audit | ImportJob + ImportFile + ImportRowError, uploader, checksum, counts | same | same | same |
| Authentication | file-based; none | none | none | none |
| Configuration | per-floor key store (keyed by filename prefix), outside source code | | | |

Contract (all TIMB adapters): `parse(file, ctx) → { rows[], errors[] }`, separate `decrypt(file)` step so a real decryptor can replace the sample reader; import service is idempotent and transactional; row errors never abort the whole file. Row-level error report downloadable (proposed). Also existing but undocumented: `TIMB Files`, `TIMB Webservices`, `TIMB Data Transfers`, `Import E-Marketing CSV` ○ (UQ-11).

## 2. Scale (Intelliscale)
| Aspect | Detail |
|---|---|
| Direction | Scale → system (weighing events) ● "scale is sending weights to the system" |
| Input | scale barcode + mass (kg) per bale (protocol ✗) |
| Output | mass shown in "Last Bale Details" |
| Validation | barcode non-blank/not too short; barcode not on a Closed document |
| Errors | "Please check barcode" |
| Retry / idempotency | scale barcode is unique; re-reading the same weighing must not duplicate |
| Auth / config | device registry ("Intelliscale Scales" ○), per-device endpoint config |
| Phase 1 | simulated weigh events keyed by scale barcode; "Not connected — simulated" badge |

## 3. Barcode scanner
Keyboard-emulating USB/Bluetooth devices assumed (brief; manual: "Scanning fills the barcode, Tab moves to the next field and Enter saves"). Contract `ScannerAdapter { subscribe(onScan), simulate(code) }`; scanner input component handles focus, Enter submit, duplicate detection (proposed), history. Future serial/network scanners implement the same interface. Phase 1: simulated scans (chips, rapid multi-line paste).

## 4. Ticket printer
Input: ticket records (sale date, scale barcode, ticket barcode, grower, group, mass, sale room — documented layout) ● ; Output: printed tickets; Phase 1: print preview only. Contract `PrinterAdapter.print(tickets[]) → PrintResult`; print audit history; reprint permission (proposed); hardware unknown ✗. Interrupted print handled by "Interrupted Ticket" (record last printed + new start).

## 5. Bank CSV export
| Aspect | Detail |
|---|---|
| Output | CSV, one line per grower payment, one file per currency ● |
| Columns (order) | Transaction_Type, Beneficiary, Currency, Credit_Account, transaction_date, Amount, Debit_Account, Company_Name, Batch_Reference, Transaction_Id, Bank_Code, Bank, Branch_Code ● |
| Mapping | Beneficiary/Credit_Account/Bank*/Branch_Code ← grower bank account; Amount/Currency ← net payout; Batch_Reference ← pay batch; Debit_Account/Company_Name/Transaction_Type values ✗ (config) |
| Validation | bank details present for grower+currency else excluded ● |
| Idempotency | one schedule per (pay batch, currency, date); regenerating preserves the original; Transaction_Id unique |
| Rule | Downloading does not mark paid ● |
| Audit | who generated/downloaded, row counts, totals |

## 6. CloudPay
Input: payment schedule; config keys `cloudpay.url`, `cloudpay.api_key` (not present on sandbox) ●; Output: submission result; Auth: API key (secret store); Retry/idempotency: idempotency key per schedule line. Source rule: only a successful submission marks growers paid ●; **our design**: payment becomes Paid only after verified confirmation recorded by a user. Phase 1: mock returns "SUBMITTED (mock — nothing sent)"; demo mode never sends instructions (BR-094/096). The "Payment Gateway" field on the schedule dialog is unexplained ✗.

## 7. Warehouse shipment export
Output: CSV for the destination warehouse generated from a **Posted** dispatch note ● (columns ✗, UQ-12). Idempotent regenerate; audit of generation; destination warehouse (e.g. CURVERID) config; mobile dispatch ("Mobile Created/User") ○.

## 8. Other reports/outputs (not external integrations)
Sales sheet Report (which report module Ethical uses is undecided, UQ-12); buyer disk file / invoice / stats (Accounts menu ○, future).

## Cross-cutting requirements (brief Part 10)
Document per adapter: input format, output format, authentication, file validation, mapping rules, error handling, retry behaviour, idempotency, audit, configuration — completed above where the manuals allow, otherwise left as ✗ and tracked in `unresolved-business-questions.md`.

Sources: Manuals 02, 03, 04, 05, 07, 08, 09; brief Part 10.

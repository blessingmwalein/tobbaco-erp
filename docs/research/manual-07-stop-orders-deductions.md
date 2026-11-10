# Manual 07 — Stop Orders and Deductions (v1.0, Sept 2026)

## Business purpose
Before a grower is paid, the floor takes the deductions owed from the sale: statutory levies, floor commission, internal invoices and the **stop orders TIMB sends for creditors** such as input suppliers. Stop Order Processing works these out for every Balanced sale, sets each sale to **Processed** and gives it a **pay batch number**.

## Responsible user and supporting roles
| Who | Does what | Where |
|---|---|---|
| Data processing supervisor | Imports the TIMB stop order file | TIMB Data → Import Stop Order File |
| Data processing supervisor | Runs Stop Order Processing | Stop Order Processing |
| Accounts | Reviews deductions | Stop Order Processing → Deductions Dashboard |

## Permissions needed
`timb.import-stop-orders`, `deductions.view`, `deductions.process`, `deductions.manage-charges` (proposed), `approvals.view`/`sales.approve` (pending approvals), `sales.view`.

## Prerequisites
- Start of Day posted for the sale date, with its exchange rate (Manual 01).
- Sales are Balanced (Manual 06).
- The day's stop order file from TIMB, **not renamed**: first two characters (`EL`) select the key; the date in the name (`…0917…`) links the stop orders to that day's sales.
- Grower charges are set up (Stop Order Processing → Grower Charges).

## Input fields
| Step | Field | Value |
|---|---|---|
| 1 | Stop Order File (dialog "Import Stop Orders from TIMB") | e.g. `EL_stoporders_20260917.txt`; button **Process Stop Order File** |
| 3 | Selling_Point (dialog "Stop Order Processing") | Ethical Sales Floor; button **Stop Order Processing** |
| 4 | Date range (Deductions Dashboard) | 09/17/2026 to 09/17/2026 |

## Existing records and relationships
- **Stop Order list** (Grower Creditors → Stop Orders): TIMB File…, Grower N…, Name, Creditor, Creditor…, Amount 1, Amount 2, Amount 3, Paid Amount, Priority, Rec Type, Stop Ord…, Percent…, Season, Created. Sample: `EL_STOP…`, V100060 Chingoma, creditor `00050 - Cr…`, code 00050, amounts `+0000000…` ×3, Paid Amount 0.00000000, Priority 1, Rec Type 06, Stop Order # 1, Percent 0, Season 2026, created Sep 17 4:18.
- Creditors and growers not yet in the system are **created automatically** by the import.
- Menus: Grower Creditors (Grower Creditors, Stop Orders, Grower Creditor - Cellphones); Stop Order Processing (Deductions Dashboard, Deductions, Grower Charges, RBZ Offset Creditors, Deduction Summaries).
- Salesmaster has a **Deductions** tab.

## Actions and buttons
Process Stop Order File; Stop Order Processing; Deductions Dashboard (date range, click a creditor to open its deductions).

## Process sequence
1. Import the TIMB stop order file → "Stop Order import complete — N created, N updated, N errors."
2. Check Grower Creditors → Stop Orders (Paid Amount fills in after processing).
3. Run Stop Order Processing for the selling point. For every Balanced sale deductions are taken **in this order**:
   1. Statutory charges and floor charges (grower charges)
   2. Internal invoices
   3. Merchant loans
   4. TIMB invoices
   5. TIMB stop orders
4. The balance becomes the grower's payout. The sale moves to **Processed** and gets a **pay batch number**.
5. Review the Deductions Dashboard.

## Status transitions
Sale: **Balanced → Processed** (+ pay batch number). Stop order: Paid Amount updated.

## Validation rules
- Exchange rate must exist for the sale date (posted Start of Day).
- Pending approvals must be cleared before processing.
- File must contain valid records; filename must keep original prefix.
- A stop order whose filename date ≠ sale date is **not deducted**.
- Importing a file "whose name starts with the same eight characters replaces that earlier import" (ambiguous — UQ-07).

## Calculations
- Order of deduction as above; net payout = gross sale − deductions (gross/net formulas not spelled out; UQ-05).
- Amounts and charge rates are **not documented**. Only the test-day totals are documented.

**Deductions Dashboard — 17 Sep 2026 (documented)**
| Item | Value |
|---|---|
| Total deducted | $173.11 (2026-09-17) |
| Deductions | 11 (lines in range) |
| Growers affected | 2 (distinct grower numbers) |
| Creditors | 6 (distinct creditor numbers) |
| Top 10 creditors chart (largest first) | Creditor 00050, Floor Commission, Weigh and Auction, Bank Charges, Govt Levy, Afforestation Levy (values not given) |
| By currency | USD $173.11 · 11 |
| By source | Internal USD invoices $123.11; TIMB USD Stop Orders $50.00 |
Narrative: the $50.00 TIMB stop order was taken from V100060; the $123.11 floor charges (commission, weigh and auction fees, bank charges and levies) cover both growers. Consistency check (derived): 5 floor-charge creditors × 2 growers = 10 lines + 1 stop-order line = 11 ✓.

## External dependencies
TIMB encrypted stop order file (decryption by filename prefix); real decryption out of scope (UQ-13).

## Common system messages (verbatim)
| Message | What it means | What to do |
|---|---|---|
| Exchange rate is not set for this sale… | No posted Start of Day for that sale date | Post Start of Day (Manual 01) |
| There are :: N :: Pending Approvals… | Sales still await approval | Approve them first |
| Uploaded file does not contain any valid records | Wrong or corrupted file | Ask TIMB to resend it. Don't edit the file |
| Decryption Keys for X need to be added | The file was renamed | Use the original name, which starts with EL |
| Stop order not deducted | The file-name date doesn't match the sale date | Import the file for the correct day, then process again |
| Stop Order import complete — 1 created, 0 updated, 0 errors. | Success | — |

## Exception handling
Wrong-day file → import the correct file and process again. Pending approvals → approve first. Corrupted file → ask TIMB to resend; never edit the file.

## Reports and outputs
Deductions Dashboard; Deductions list; Deduction Summaries; Stop Order list; Processed sale with pay batch number.

## Next process
Payment (Manual 08) and dispatch (Manual 09).

## Documented gaps
- What creates **pending approvals** and where they are approved (UQ-06).
- Stop order fields Amount 1/2/3, Rec Type (06), Percent, Priority semantics (UQ-07).
- Grower charge rules (rates/basis), internal invoices and merchant loans: where entered; "RBZ Offset Creditors" and "Deduction Summaries" are undescribed (UQ-05/UQ-11).
- How pay batch numbers are assigned (UQ-06).
- What happens when deductions exceed the sale value; partial stop-order payment ("Paid Amount") rules.
- Currency handling of local-currency deductions (UQ-04).

Sources: Manual 07.

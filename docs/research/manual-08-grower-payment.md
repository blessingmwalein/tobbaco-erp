# Manual 08 — Grower Payment (v1.0, Sept 2026 — **DRAFT**: see "Open items")

## Business purpose
When a sale is Processed, the grower is given a **sales sheet** and paid into their bank account. Accounts generates a **payment schedule** for the pay batch, one per currency. It is either uploaded to the bank or submitted through CloudPay.

## Responsible user and supporting roles
| Who | Does what | Where |
|---|---|---|
| Data processing | Prints grower sales sheets | Data Processing → Sales sheet Report |
| Accounts | Generates payment schedules | Accounts → Schedules → Generate Payment Schedule |

## Permissions needed
`payments.sales-sheet`, `payments.view`, `payments.generate-schedule`, `payments.export`, `payments.submit-gateway` (Pay with CloudPay, proposed key), `payments.confirm-payment`.

## Prerequisites
- Sales are Processed and the pay batch number is known (test day: **1001**).
- Each grower has bank account details in USD and/or ZWL. **Growers without them are left out of the schedule.**

## Input fields
**Sales sheet Report** (dialog): Sale Date (Sep 17), Selling Point (Ethical Sales Floor), REF# (0; one grower, optional), Batch # (0; optional). Buttons **Get Report** / Cancel.

**Generate Payment Schedule** (Accounts → Schedules):
| Field | What to enter |
|---|---|
| Invoices Date | The sale date |
| Selling Point | Ethical Sales Floor |
| Batch # | The pay batch, or **0 for every unpaid sale on that date** (screenshot: 1,001) |
| Currency | USD or ZWL; **run once per currency** |
| Payment Gateway | (blank, with help mark; meaning undocumented) |
Buttons **Generate Payment Schedule** (downloads bank CSV) / **Pay with CloudPay** / Cancel.

## Existing records and relationships
Processed sales (with pay batch number) → payment schedule lines per grower per currency → grower bank accounts. Accounts menu also lists My Dashboard, Schedules, Generate Buyer Disk File, Generate Buyer Invoice, Generate Buyer Invoice YTD, Generate Buyer Stats (undocumented). Sale form has "ZWG Payment Ref" and "USD Payment Ref".

## Actions and buttons
Get Report; Generate Payment Schedule; **Pay with CloudPay**.

## Process sequence
1. Print sales sheets: Sale Date + Selling Point (+ optional REF# or Batch #) → Get Report.
2. Accounts → Schedules → Generate Payment Schedule: date, selling point, batch (or 0), currency → CSV downloaded.
3. Upload CSV to the bank, or Pay with CloudPay.

## Status transitions
Not documented as states. Documented rule: **downloading the CSV doesn't mark growers as paid**; "only a successful Pay with CloudPay submission marks them paid" (source). Payment status values (DRAFT … PAID, FAILED) in `status-transitions.md` are **brief-proposed**.

## Validation rules
- A receiving sale date and a posted Start of Day must exist for the date.
- Only unpaid, Processed sales are scheduled; none → message.
- Growers without bank details for the currency are excluded.

## Calculations
Payment amount per grower per currency from the processed sale (net payout); how net payout splits between USD and local currency is **not documented** (UQ-04).

## External dependencies
Bank CSV upload; **CloudPay** (needs `cloudpay.url` and `cloudpay.api_key`, deliberately not copied to the sandbox). "Don't press it on a test system: it sends real payment instructions."

**Bank CSV columns (documented, in this order):** `Transaction_Type`, `Beneficiary`, `Currency`, `Credit_Account`, `transaction_date`, `Amount`, `Debit_Account`, `Company_Name`, `Batch_Reference`, `Transaction_Id`, `Bank_Code`, `Bank`, `Branch_Code`. One line per grower payment. Mapping/values for each column are **not documented**.

## Common system messages (verbatim)
| Message | What to do |
|---|---|
| Cannot Find the Sale Date in Receiving Department | Use a date that has a receiving sale date |
| Cannot Find the Start of Date in Data Processing | Post Start of Day for that date |
| No unpaid records found for this date and selling point | Check the batch number and that the sales are processed |

## Exception handling
Empty schedule → load grower banking details. Blank sales sheet → decide which report module Ethical uses. No unpaid records → check batch number / sales state.

## Reports and outputs
Grower sales sheet (report); payment schedule CSV per currency; CloudPay submission.

## Next process
Dispatch (Manual 09) runs in parallel for released sales.

## Documented gaps — open items found while testing (from the manual)
1. **Sales sheet printed blank** on the sandbox: the installed report comes from `premier_reports`; Ethical's own `ethical_reports` module is not installed — decide which report Ethical uses.
2. **Payment schedule was empty**: the test growers have no bank accounts; the CSV had only its header row — load grower banking details before the first payment run.
3. **CloudPay** needs `cloudpay.url` and `cloudpay.api_key` (not copied to the sandbox).

Additional gaps: payment confirmation/reconciliation process (how failures are recorded) is not documented; CSV column mapping; ZWL vs ZWG naming (UQ-04); who loads and edits grower bank details; what "Payment Gateway" field selects.

Sources: Manual 08.

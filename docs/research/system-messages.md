# System Messages Catalogue (verbatim from the e-Port manuals)

Source of truth for `packages/shared/src/messages.ts`. Text is copied **exactly** as printed in the manuals (including typos and ellipses). Where the manual shows `…` or `X`/`N`, the text is truncated or contains a placeholder in the source; the UI substitutes the value and keeps the rest verbatim.

Severity: `error` (action refused), `warning`, `success` (confirmation), `info` (status/progress text).
"Kind" column: `verbatim` = quoted message; `descriptive` = the manual gives a description, not the exact text (flagged — exact wording unknown).

## Manual 01 — Daily Setup (prefix MSG-SOD)

| ID | Kind | Text | What it means | What to do | Severity |
|---|---|---|---|---|---|
| MSG-SOD-001 | verbatim | Exchange Rate should be bigger than ZERO! | Start of Day posted without a positive rate | Enter the day's rate | error |
| MSG-SOD-002 | verbatim | You can not run Start of Day when there are Sales in Draft or Balanced state from Previous dates! | Earlier sales still Draft or Balanced | Finish balancing and processing the earlier sales first (Manuals 06 and 07) | error |
| MSG-SOD-003 | verbatim | Please set a sale date / Date has expired | No active receiving sale date, or the active one is in the past | Step 1 (create/activate today's Sale Date - Receiving) | error |
| MSG-SOD-004 | verbatim | Date has expired. Please set a valid sale date | Ticket printing refusal when the active sale date is in the past (Step 1 text) | Set a valid active sale date | error |
| MSG-SOD-005 | verbatim | Start of Day Completed Successfully. | Start of Day posted | — | success |

## Manual 02 — TIMB Booking Import (prefix MSG-TMB)

| ID | Kind | Text | What it means | What to do | Severity |
|---|---|---|---|---|---|
| MSG-TMB-001 | verbatim | Booking Decryption Keys for X is missing. Check filename of file | The file was renamed, or it belongs to another floor | Use the original file name, which starts with ELS | error |
| MSG-TMB-002 | verbatim | Import complete with errors | Some lines could not be read, for example an unknown grower | Import the grower register, then import the booking file again | warning |
| MSG-TMB-003 | verbatim | Grower Booking Import complete: 2 created, 0 updated, 0 errors. | Import result (counts vary: `N created, N updated, N errors`) | — | success |

## Manual 03 — Receiving (prefix MSG-RCV)

| ID | Kind | Text | What it means | What to do | Severity |
|---|---|---|---|---|---|
| MSG-RCV-001 | verbatim | The grower number does not have any pending delivery note | The grower isn't on a completed transporter note | Add the grower and complete the transporter note (Steps 2–3) | error |
| MSG-RCV-002 | verbatim | Please check format and validity of grower number | Not in the grower register | Check the number, or import the grower (Manual 02) | error |
| MSG-RCV-003 | verbatim | Please check barcode | Scale barcode blank or too short | Rescan | error |
| MSG-RCV-004 | verbatim | Please enter a valid lot number | Letters, or starts or ends with / | Use digits and / only | error |
| MSG-RCV-005 | verbatim | Bale is already associated with a Closed Document | This scale barcode was captured on another delivery | Supervisor checks and ejects it if wrong | error |
| MSG-RCV-006 | verbatim | The number of bales captured is less / greater than number of bales delivered | Tally doesn't match the declared bales | Capture the missing bale, or supervisor ejects the extra one | error |
| MSG-RCV-007 | verbatim | Repeated Group & Lot Number Combination in line N | Two bales have the same group and lot | Supervisor ejects one, and you recapture it | error |
| MSG-RCV-008 | verbatim | Document successfully closed | Transporter delivery note completed; GDNs created | — | success |
| MSG-RCV-009 | verbatim | Bale added | Bale saved | — | success |
| MSG-RCV-010 | verbatim | Delivery Balanced | Bale Tally reached the declared number (badge) | Complete Delivery for the grower | success |
| MSG-RCV-011 | verbatim | Delivery Document #GDN… for grower … is closed. | Grower delivery completed (example: `Delivery Document #GDN0000005 for grower V100060 is closed`) | — | success |
| MSG-RCV-012 | descriptive | Bale Tally: N of M | Running tally label (not an error) | — | info |
| MSG-RCV-013 | descriptive | Group number below 1 | Manual states group must be 1 or more; the error text is not quoted | Enter a whole number ≥ 1 | error |

## Manual 04 — Ticket Printing (prefix MSG-TKT)

| ID | Kind | Text | What it means | What to do | Severity |
|---|---|---|---|---|---|
| MSG-TKT-001 | verbatim | Barcodes already used in Tickets | Your start barcode overlaps tickets already printed this season | Step 2 with the first unused barcode on your roll | error |
| MSG-TKT-002 | verbatim | Please enter a valid barcode | Start barcode not 10 characters, or wrong check character | Type the full barcode exactly as printed on the ticket | error |
| MSG-TKT-003 | verbatim | There is no previously set barcode | You have never set a start barcode | Step 2 | error |
| MSG-TKT-004 | verbatim | Please set a sale date / Date has expired | No active sale date for today | Manual 01, Step 1 | error |
| MSG-TKT-005 | verbatim | Bale has no barcode in line N | Barcodes weren't allocated before confirming | Step 3, then confirm again | error |

## Manual 05 — Laying and Floor Summary (prefix MSG-FLR)

| ID | Kind | Text | What it means | What to do | Severity |
|---|---|---|---|---|---|
| MSG-FLR-001 | verbatim | Floor Summary scanning is currently off… | The manager turned scanning off (text truncated in source) | Ask the receiving manager to turn it on | error |
| MSG-FLR-002 | verbatim | Please Add a Current Sale Date,. | No active sale date for today (typo `,.` is in the source) | Manual 01, Step 1 | error |
| MSG-FLR-003 | verbatim | Please enter a Row Number / …an integer for Row Number | Row blank or not a number (two messages; second truncated) | Type the row number | error |
| MSG-FLR-004 | verbatim | Cannot find the bale:… | The barcode isn't a printed ticket (text truncated) | Rescan. Check you scanned the ticket, not the scale label | error |
| MSG-FLR-005 | verbatim | This bale is not supposed to be on the floor. Please check with supervisor | The delivery isn't Checked (tickets not confirmed) | Ticket clerk confirms printing (Manual 04) | error |
| MSG-FLR-006 | verbatim | This delivery is for … | The bale belongs to another selling point (text truncated) | Move the bale | error |
| MSG-FLR-007 | descriptive | Scanned N of M | Per-grower scan progress after each scan (example `Scanned 1 of 3`) | — | info |
| MSG-FLR-008 | descriptive | Scanned 3 of 3 | Count reached total: grower's floor summary complete; delivery → Laid; draft sale created | — | success |

## Manual 06 — Data Capture and Balancing (prefix MSG-DAT)

| ID | Kind | Text | What it means | What to do | Severity |
|---|---|---|---|---|---|
| MSG-DAT-001 | verbatim | Invalid Buyer: X | Unknown buyer | Check the code on the buyer's ticket | error |
| MSG-DAT-002 | verbatim | Invalid Buyer Grade: X | The grade doesn't belong to that buyer | Check the code on the buyer's ticket | error |
| MSG-DAT-003 | verbatim | Invalid TIMB Grade / Reason: X | Unknown grade | Check the grade code | error |
| MSG-DAT-004 | verbatim | Barcode already processed for Sales Sheet: X | The sale is already balanced or processed | Supervisor corrects it with a sale reversal or adjustment | error |
| MSG-DAT-005 | verbatim | The state of this barcode does not allow Data Capturing: X | No draft sale for this bale (floor summary incomplete) | Finish the floor summary (Manual 05) | error |
| MSG-DAT-006 | descriptive | Balancing stops on a price mismatch | Captured price and batch price differ (exact text not quoted) | Check the batch sheet and correct the wrong one | error |
| MSG-DAT-007 | verbatim | invalid Reason specified for this rejected bale! | Sale code without a valid reason | Enter a TIMB reason | error |
| MSG-DAT-008 | verbatim | Sale has balanced! | Balance Sale succeeded; sale → Balanced | — | success |
| MSG-DAT-009 | verbatim | Batch has been posted. | Price batch posted (shown in chatter) | — | success |

## Manual 07 — Stop Orders and Deductions (prefix MSG-STO)

| ID | Kind | Text | What it means | What to do | Severity |
|---|---|---|---|---|---|
| MSG-STO-001 | verbatim | Exchange rate is not set for this sale… | No posted Start of Day for that sale date (truncated) | Post Start of Day (Manual 01) | error |
| MSG-STO-002 | verbatim | There are :: N :: Pending Approvals… | Sales still await approval (truncated) | Approve them first | error |
| MSG-STO-003 | verbatim | Uploaded file does not contain any valid records | Wrong or corrupted file | Ask TIMB to resend it. Don't edit the file | error |
| MSG-STO-004 | verbatim | Decryption Keys for X need to be added | The file was renamed | Use the original name, which starts with EL | error |
| MSG-STO-005 | verbatim | Stop order not deducted | The file-name date doesn't match the sale date | Import the file for the correct day, then process again | warning |
| MSG-STO-006 | verbatim | Stop Order import complete — 1 created, 0 updated, 0 errors. | Import result | — | success |

## Manual 08 — Grower Payment (prefix MSG-PAY)

| ID | Kind | Text | What it means | What to do | Severity |
|---|---|---|---|---|---|
| MSG-PAY-001 | verbatim | Cannot Find the Sale Date in Receiving Department | No receiving sale date for the chosen date | Use a date that has a receiving sale date | error |
| MSG-PAY-002 | verbatim | Cannot Find the Start of Date in Data Processing | No Start of Day for the chosen date (typo "Start of Date" is in the source) | Post Start of Day for that date | error |
| MSG-PAY-003 | verbatim | No unpaid records found for this date and selling point | Nothing to schedule | Check the batch number and that the sales are processed | error |

## Manual 09 — Floor Dispatch (prefix MSG-DSP)

| ID | Kind | Text | What it means | What to do | Severity |
|---|---|---|---|---|---|
| MSG-DSP-001 | verbatim | Bale 'X' cannot be dispatched: its sale has not been released yet… | Sale not Released (truncated) | Release the sale first | error |
| MSG-DSP-002 | verbatim | …wrong warehouse… | Bale's buyer packs at a different warehouse (only a fragment is quoted) | The bale belongs on a truck to its buyer's warehouse | error |
| MSG-DSP-003 | verbatim | You can only remove bales from a draft dispatch note. | Note is not Draft | Reset the note to draft (supervisor) | error |
| MSG-DSP-004 | verbatim | You cannot delete dispatch notes. Please cancel them instead. | Delete attempted | Use Cancel Dispatch | error |
| MSG-DSP-005 | verbatim | The dispatch note must be in Posted state to generate a shipment file. | Note not Posted | Post the note first | error |
| MSG-DSP-006 | descriptive | Bale refused: rejected sale code (RO, RH or CO) | Manual lists this refusal; exact text not quoted | — | error |
| MSG-DSP-007 | descriptive | Bale refused: already on another dispatch note | Manual lists this refusal; exact text not quoted | — | error |

## Missing messages (no exact text in the manuals)
- Duplicate ticket scan at floor summary (brief requires duplicate detection; manual has no message) — proposed `MSG-FLR-P01`, flagged as an addition.
- Ticket scale barcode minimum length, group < 1, balance checks for missing buyer / buyer grade / TIMB grade / price on a purchased bale (Manual 06 lists the checks but no message text).

Sources: Manuals 01–09 ("Common messages" tables and screenshot captions).

# Business Rules

Numbered rules extracted from the manuals. **Status**: `Documented` (stated in a manual), `Derived` (arithmetic/obvious consequence of documented text), `Proposed` (from the brief or our design — not in the manuals), `Unverified` (documented fact with unknown details; built configurable, flagged in the UI). Never add a rule here without a source.

## Daily setup (Manual 01)
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-001 | Only one receiving sale date is active; activating a new one unticks the previous. | M01 | Documented |
| BR-002 | Ticket printing and floor summary require an active receiving sale date; if the active date is in the past, ticket printing refuses ("Date has expired. Please set a valid sale date"). | M01, M04, M05 | Documented |
| BR-003 | Floor summary scanning requires the sale date's "Can Scan Floor Summary?" flag and the floor scanning switch to be on. | M01, M05 | Documented (relationship of the two switches unverified) |
| BR-004 | Start of Day requires an exchange rate greater than zero. | M01 | Documented |
| BR-005 | Start of Day is refused while sales from previous dates are in Draft or Balanced state. | M01 | Documented |
| BR-006 | Start of Day must be posted before data capture, balancing and stop orders. | M01, M06, M07 | Documented |
| BR-007 | Payment schedule and stop-order processing require a receiving sale date and a posted Start of Day (exchange rate) for the date. | M07, M08 | Documented |

## TIMB imports (Manuals 02, 07)
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-010 | Booking file keeps its original name; first three characters (`ELS`) select the decryption key. | M02 | Documented |
| BR-011 | Stop order file keeps its original name; first two characters (`EL`) select the key; the date in the name links stop orders to that day's sales. | M07 | Documented |
| BR-012 | Every grower in the booking file must exist in the grower register; unknown growers are row errors. | M02 | Documented |
| BR-013 | Re-importing a booking file updates bookings matched on TIMB's booking reference; no duplicates. | M02 | Documented |
| BR-014 | An import reports created / updated / error counts. | M02, M07 | Documented |
| BR-015 | Stop order import auto-creates missing creditors and growers. | M07 | Documented |
| BR-016 | Importing a stop order file whose name starts with the same eight characters replaces the earlier import. | M07 | Unverified (UQ-07) |
| BR-017 | Receiving and balancing check delivered bales against bookings (block vs warn unknown). | M02 | Unverified (UQ-09) |
| BR-018 | Row-level import error reports can be downloaded; import history is preserved. | brief | Proposed |

## Receiving (Manual 03)
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-020 | Transporter note holds name, ID number, vehicle reg (spaces removed automatically), phone; permit number optional. | M03 | Documented |
| BR-021 | Several growers may be on one transporter note; a grower added by mistake can be removed (before completion). | M03 | Documented |
| BR-022 | Completing the transporter note creates one grower delivery note (GDN) per grower in state Open. | M03 | Documented |
| BR-023 | Grower number must exist in the grower register. | M03 | Documented |
| BR-024 | Bale capture requires the grower to have a pending delivery note (i.e. be on a completed transporter note). | M03 | Documented |
| BR-025 | Scale barcode must not be blank or too short; mass comes from the scale. | M03 | Documented (minimum length unknown) |
| BR-026 | A scale barcode already associated with a Closed document cannot be captured again. | M03 | Documented |
| BR-027 | Group # is a whole number ≥ 1. | M03 | Documented |
| BR-028 | Lot # contains digits and `/` only and neither starts nor ends with `/` (e.g. `3`, `12/3`). | M03 | Documented |
| BR-029 | A group + lot pair must not repeat within the delivery (error reports line N). | M03 | Documented |
| BR-030 | To complete a grower's delivery, captured bales must equal declared bales (Bale Tally "N of M"; "Delivery Balanced"). | M03 | Documented |
| BR-031 | Completing a grower's delivery moves the GDN to Tickets Printing. | M03 | Documented |
| BR-032 | Only a receiving supervisor can eject a bale (by scale barcode) so it can be recaptured. | M03 | Documented |
| BR-033 | Every correction (eject) records bale reference, reason, user, timestamp and an audit entry. | brief | Proposed (reason not in manual) |

## Ticket printing (Manual 04)
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-040 | Ticket barcode = 10 characters: 9 digits + 1 check character. A start barcode with the wrong length or check character is refused. | M04 | Documented (check algorithm unknown — UQ-01) |
| BR-041 | A start barcode overlapping tickets already printed in the season is refused. | M04 | Documented |
| BR-042 | Start barcodes belong to each user; after confirming a delivery the user's next barcode is saved automatically. | M04 | Documented |
| BR-043 | "Use Next Barcode" allocates consecutive barcodes sorted by group, then lot. | M04 | Documented |
| BR-044 | Setting the starting barcode also allocates barcodes to that delivery's bales. | M04 | Documented |
| BR-045 | Every bale needs a barcode before Confirm Ticket Printing. | M04 | Documented |
| BR-046 | Confirming marks bales printed, moves the delivery to Checked and uses up the barcodes for the season. | M04 | Documented |
| BR-047 | After confirmation only Reverse Printing Status is available, and only to a supervisor. | M04 | Documented |
| BR-048 | The numeric span of a barcode range is not the bale count (base+1 per bale, check character appended). | M04 + demo data | Derived |
| BR-049 | Barcode allocations are unique per season and cannot be double-allocated. | brief | Proposed |

## Floor summary (Manual 05)
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-050 | Floor summary scans the ticket barcode, not the scale barcode. | M05 | Documented |
| BR-051 | Row must be an integer; it stays filled until changed. | M05 | Documented |
| BR-052 | Only a delivery in Checked state may be scanned ("not supposed to be on the floor"). | M05 | Documented |
| BR-053 | A bale from another selling point is refused. | M05 | Documented |
| BR-054 | A barcode that is not a printed ticket is refused ("Cannot find the bale"). | M05 | Documented |
| BR-055 | When scanned = delivered, the grower's floor summary completes: delivery → Laid; draft sale and price batch created. | M05 | Documented |
| BR-056 | The receiving manager can turn scanning off/on for the whole floor. | M05 | Documented |
| BR-057 | A ticket already scanned is flagged as a duplicate scan. | brief | Proposed (not in manual) |

## Data capture and balancing (Manual 06)
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-060 | Data capture requires Start of Day and a Draft sale for the bale; processed/balanced barcodes are refused. | M06 | Documented |
| BR-061 | Classification captures TIMB Grade / Reason and Hessian owner. | M06 | Documented |
| BR-062 | e-Buying captures Buyer, Buyer Grade, Price (US cents/kg, whole number); Sale Code only for a bale not bought. | M06 | Documented |
| BR-063 | Codes are converted to capitals automatically. | M06 | Documented |
| BR-064 | Fields are validated separately: an invalid buyer grade is not saved but a valid price on the same form is. | M06 | Documented |
| BR-065 | Buyer grade must belong to the selected buyer; TIMB grade/reason must exist. | M06 | Documented |
| BR-066 | Batch price is a second, blind capture from the buyer's batch sheet; Post Batch moves the price batch Draft → Posted. | M06 | Documented |
| BR-067 | Balance Sale requires every purchased bale to have buyer, buyer grade, TIMB grade and price. | M06 | Documented |
| BR-068 | Captured price must equal batch price; a mismatch stops balancing. | M06 | Documented |
| BR-069 | Unsold bale: Sale Code + TIMB reason; no buyer/price; excluded from sale total; a sale code without a valid reason is refused. | M06 | Documented |
| BR-070 | A balanced/processed sale is corrected by sale reversal or adjustment (supervisor). | M06 | Documented (mechanism unknown — UQ-06) |
| BR-071 | Balancing never silently ignores an invalid bale; every failed check is listed. | brief | Proposed |
| BR-072 | The user entering batch prices differs from the user who captured prices. | M06 implication ("second clerk") | Unverified (setting, default off) |

## Stop orders and deductions (Manual 07)
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-080 | Deductions per Balanced sale are taken in order: (1) statutory + floor charges, (2) internal invoices, (3) merchant loans, (4) TIMB invoices, (5) TIMB stop orders. | M07 | Documented |
| BR-081 | Stop Order Processing runs per selling point over every Balanced sale. | M07 | Documented |
| BR-082 | Processing is blocked while there are pending approvals. | M07 | Documented (source of approvals unknown) |
| BR-083 | An exchange rate (posted Start of Day) must exist for the sale date. | M07 | Documented |
| BR-084 | The balance after deductions is the grower's payout; the sale moves to Processed and receives a pay batch number. | M07 | Documented |
| BR-085 | A stop order whose file-name date differs from the sale date is not deducted. | M07 | Documented |
| BR-086 | Stop order Paid Amount fills in after processing. | M07 | Documented |
| BR-087 | Deduction amounts/formulas are configurable; any unverified formula is shown with an "unverified" marker. | brief | Proposed |

## Payments (Manual 08)
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-090 | Payment schedule is generated per pay batch (or 0 = all unpaid sales on the date) and per currency (USD, ZWL), one run per currency. | M08 | Documented |
| BR-091 | Growers without bank account details (for the currency) are left out of the schedule. | M08 | Documented |
| BR-092 | Downloading the CSV does not mark growers as paid. | M08 | Documented |
| BR-093 | Source system: only a successful "Pay with CloudPay" submission marks growers paid. | M08 | Documented |
| BR-094 | Design override: a payment is Paid only after verified confirmation recorded by a user (reference + amount); mock CloudPay returns "SUBMITTED (mock — nothing sent)" and never marks paid. | brief | Proposed |
| BR-095 | Bank CSV columns are fixed (13). | M08 | Documented |
| BR-096 | Never submit real payment instructions in demo/test; keep original batches; support failure and reconciliation. | M08, brief | Documented / Proposed |

## Dispatch (Manual 09)
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-100 | A bale is refused if its sale is not released. | M09 | Documented |
| BR-101 | A bale is refused if its buyer packs at a different warehouse than the destination. | M09 | Documented |
| BR-102 | A bale with rejected sale code RO, RH or CO is refused. | M09 | Documented |
| BR-103 | A bale already on another dispatch note is refused. | M09 | Documented |
| BR-104 | Bales can only be removed from a draft dispatch note. | M09 | Documented |
| BR-105 | Dispatch notes cannot be deleted; a draft is cancelled with a reason. | M09 | Documented |
| BR-106 | A shipment file can be generated only for a Posted note. | M09 | Documented |
| BR-107 | "No Transportation Details" may be ticked only when there is no truck to record. | M09 | Documented |
| BR-108 | Dispatch note reference format `FLDN/YYYY/MM/NNNN` (example FLDN/2026/09/0001). | M09 | Documented (example only) |

## General
| ID | Rule | Source | Status |
|---|---|---|---|
| BR-120 | Posted financial/operational records are never deleted; corrections use reversal/adjustment records. | brief | Proposed |
| BR-121 | The backend is authoritative for workflow states and financial values; the frontend never decides a sale is balanced/processed. | brief | Proposed |
| BR-122 | All money/weight arithmetic uses decimals, never floating point; currency codes preserved. | brief | Proposed |

Sources: Manuals 01–09; brief Parts 4–14.

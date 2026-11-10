# Manual 06 — Data Capture and Balancing (v1.0, Sept 2026)

## Business purpose
During the sale each bale is classified by TIMB and bought by a buyer at a price. Data clerks capture these on the floor. A **second clerk re-enters every price from the buyer's batch sheet** as a check. When the two agree and every bale is complete, the supervisor balances the sale.

## Responsible user and supporting roles
| Who | Does what | Where |
|---|---|---|
| Data processing supervisor | Posts Start of Day, balances sales | Data Processing |
| Classification clerk | TIMB grade and hessian owner | Web station → Classification |
| Buying clerk | Buyer, buyer grade, price | Web station → e-Buying |
| Batch clerk | Second price capture | Data Processing → Processing → Batch Processing |

## Permissions needed
`data-capture.view`, `data-capture.classify`, `data-capture.capture-buyer`, `data-capture.capture-price`; `batch.view`, `batch.capture-price`, `batch.post`; `sales.view`, `sales.balance`; (corrections) `sales.reverse`.

## Prerequisites
- Start of Day posted for today (Manual 01 Step 2).
- The grower's floor summary is complete, so the sale exists in Draft (Manual 05).
- Buyer codes and buyer grades set up for the buyers on the floor.

## Input fields
**Station choice** (`/data/`): Classification, e-Buying, All Details; Log Out of System.

**Classification** — scan ticket barcode → Scan. Header confirms: Sale Date, No. of Bales, Barcode, Grower, Mass, SEQ, Group, Lot.
| Field | Notes |
|---|---|
| TIMB Grade / Reason | e.g. A10 (also A1E, A1L in the sample) |
| Hessian | "-- Select Hessian Owner --" dropdown (value "N/A" in Last Bale Details) |
Button **Save Details**.

**e-Buying** — scan ticket barcode ("Scan Barcode - buy") → Scan.
| Field | Notes |
|---|---|
| Buyer | code, e.g. `JM` |
| Buyer Grade | e.g. `11OF` — must belong to the buyer |
| Price | **US cents per kg, whole number** (e.g. 212) |
| Sale Code | Only for a bale that wasn't bought |
Button **Save Details**; page returns to scan screen and shows **Last Bale Details** (Barcode, Grower, Mass, TIMB Grade, Buyer, Buyer Grade, Price, Sale Code, Hessian).

**Batch Processing** — list columns: Grower No., First name, Sale, Selling Date, Selling Point, Status, Last Updated by. Batch form: Grower No., First name, Surname, Sale, Selling Date (GDN), Selling Point; **Tickets** tab columns Barcode, Group, Lot No., Batch Price (editable cell), Mass. Buttons: **Post Batch** (then confirm).

**Ticket Processing** (sales list) columns: Grower No., First name, Surname, Sale, Floor Code, Sale Date, R.., S/Status, ID, Batch No., US Value, RTGS Value, ZW Paid, ZW Bank, ZW Account…; Salesmaster form: Grower No., First name, Surname, Last Updated on, Released (checkbox), Sale, Sale Date, Sale Point, Floor Code, Delivery Note, ZWG Payment Ref, USD Payment Ref; tabs **Tickets / Deductions / Summary**; Tickets columns: Barcode, Group, Lot No., Sale Code, Buyer, Hessian Owner, Buyer Grade, TIMB Grade / Reason, US Price, Mass, Released. Button **Balance Sale**; status bar: Draft · Posted · Balanced · Processed.

## Existing records and relationships
One sale (Salesmaster) and one price batch per grower delivery (Batch 4 ↔ Sale ID 4 ↔ V100060 ↔ GDN0000005). Tickets (bales) belong to the sale. Buyer 1—N Buyer Grades. TIMB Grade lookup (Floor Maintenance → TIMB Grade).
Sample V100060 data: tickets 1000001013 (1,1) mass 112, grade A10, buyer JM, buyer grade 11OF, price 212, batch price 212; 1000001024 (1,2) 98, A1E, JM, 11OF, 198 / 198; 1000001035 (1,3) 105, A1L, JM, 11OF, 185 / 185.
Historical processed sales (Sep 11): ID 3 V100043 Simba Chingoma, US Value 193.70, pay batch 1,000; ID 2 V100058 US Value 104.50; ID 1 V100058 US Value 427.20 (RTGS 11,399.6184…; ZW Paid etc.).

## Actions and buttons
Scan; Save Details; Post Batch; Balance Sale; (corrections) sale reversal / adjustment (referenced, not described).

## Process sequence
1. Open capture station (Classification, e-Buying, or All Details).
2. Classification: scan → TIMB grade/reason + hessian owner → Save Details.
3. e-Buying: scan → buyer, buyer grade, price (sale code if not bought) → Save Details → check Last Bale Details.
4. Batch Processing: open batch → enter Batch Price per ticket from the buyer's batch sheet (**without looking at captured prices**) → Post Batch → confirm → batch Posted.
5. Supervisor: Data Processing → Processing → Ticket Processing (Draft sales shown in red) → open sale, check Tickets tab → **Balance Sale** → "Sale has balanced!" → sale Balanced.

## Status transitions
- Price batch: **Draft → Posted**.
- Sale: **Draft → Balanced** (Balance Sale) → Processed (Manual 07). Screens also show a "Posted" step (UQ-02) and a separate Released flag.

## Validation rules
- Codes converted to capitals automatically.
- Each field is validated separately: an invalid buyer grade isn't saved but a valid price on the same form is.
- Buyer grade must belong to the buyer; TIMB grade/reason must exist.
- Data capture only on a Draft sale ("state of this barcode does not allow Data Capturing"); already balanced/processed barcodes refused.
- Balance Sale requires, for every bale: buyer, buyer grade, TIMB grade, and price; captured price must equal batch price (mismatch stops balancing).
- **Bale not bought:** Sale Code + TIMB reason instead of a grade; needs no buyer or price; left out of the sale total; balancing refuses a sale code without a valid reason.

## Calculations
- Price unit: US cents per kg (whole number) per ticket; mass per ticket in kg.
- US Value (sale total) is shown in the list; the formula is not stated. Illustrative reading: Σ(price/100 × mass) (UQ-05).
- RTGS Value matches `US Value × exchange rate` for 2 of 3 historical rows (UQ-04).

## External dependencies
Scanner; (the "Import E-Marketing CSV" menu exists but is undocumented); buyer batch sheets (paper).

## Common system messages (verbatim)
| Message | What it means | What to do |
|---|---|---|
| Invalid Buyer: X / Invalid Buyer Grade: X | Unknown buyer, or the grade doesn't belong to that buyer | Check the code on the buyer's ticket |
| Invalid TIMB Grade / Reason: X | Unknown grade | Check the grade code |
| Barcode already processed for Sales Sheet: X | The sale is already balanced or processed | Supervisor corrects it with a sale reversal or adjustment |
| The state of this barcode does not allow Data Capturing: X | No draft sale for this bale (floor summary incomplete) | Finish the floor summary (Manual 05) |
| Balancing stops on a price mismatch | Captured price and batch price differ | Check the batch sheet and correct the wrong one |
| invalid Reason specified for this rejected bale! | Sale code without a valid reason | Enter a TIMB reason |
| Sale has balanced! / Batch has been posted. | Success | — |

## Exception handling
Mismatch → correct the wrong price (captured or batch). Already processed → sale reversal or adjustment by supervisor. Incomplete floor summary → complete Manual 05 first.

## Reports and outputs
Batch Processing list; Ticket Processing list and Salesmaster (Tickets, Deductions, Summary); Sales Dashboard (menu only).

## Next process
Manual 07 — Stop Orders and Deductions (sale is Balanced).

## Documented gaps
- Valid sale-code list (only RO, RH, CO known as rejected — Manual 09); full list of TIMB grades/reasons; hessian owner semantics (UQ-08).
- The exact checks/messages for missing buyer/grade/price at balancing are listed as checks but have no message text.
- How sale reversal/adjustment works and who approves (UQ-06).
- Whether the same user may enter both price captures (segregation of duties — "second clerk" implied; UQ-06/role matrix).
- "Posted" sale state and "Released" flag (UQ-02/03); "Sales Dashboard".
- Column meanings ZW Paid / ZW Bank / ZW Account (UQ-04).

Sources: Manual 06.

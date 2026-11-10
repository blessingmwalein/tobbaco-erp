# Manual 03 — Receiving: Delivery Notes and Bale Capture (v1.1, Sept 2026)

## Business purpose
Receiving is where a grower's tobacco first enters the system. A truck arrives; the clerk records the transporter and the growers on board. Each bale is weighed, captured against its grower, and the grower's delivery is completed once every bale is in.

## Responsible user and supporting roles
| Who | Does what | Where |
|---|---|---|
| Receiving clerk | Transporter note, growers, bale capture, completing deliveries | Receiving web interface |
| Scale operator | Weighs each bale; the scale gives it a scale barcode and mass | Scale |
| Receiving supervisor | Corrections: eject a bale | Web interface → Receiving Supervisor |

## Permissions needed
`receiving.create-delivery`, `receiving.edit-transporter`, `receiving.add-grower`, `receiving.remove-grower`, `receiving.complete-transporter-note`, `receiving.capture-bale`, `receiving.complete-delivery`, `receiving.view`; supervisor: `receiving.eject-bale`.

## Prerequisites
- Today's receiving sale date is active (Manual 01).
- The day's bookings are imported (Manual 02).
- The scale is sending weights to the system.

## Input fields
**Step 1 — Create the transporter delivery note** (menu ≡ → Transporters → Create New Transporter Delivery Note)
| Field | What to enter |
|---|---|
| Transporter Name | The driver's name |
| ID Number | The driver's national ID (example `63-123456-A-42`) |
| Vehicle Reg | Number plate (spaces removed automatically: `AEX 1234` → `AEX1234`) |
| Phone Number | The driver's cellphone (example `0772123456`) |
Button: **Create Transporter Delivery Note** → note gets a number (e.g. `TDN0000002`) and opens. The note also shows **Permit No.** (blank in the example) and **Edit Transporter Details**.

**Step 2 — Add each grower**
| Field | What to enter |
|---|---|
| Grower No. | e.g. V100060 |
| Location | The receiving row, e.g. A |
| Number of Bales | Count off the truck; the delivery must balance to this exact number |
| Sale Day / Sale Month | Filled with today's sale date (17 / 9); change only if told |
Button **Add Grower** once per grower; **Remove** takes out a grower added by mistake. Note header shows Last Grower, State, Number of Growers, Total Bales.

**Step 4 — Capture bales** (menu ≡ → Grower Delivery Note)
| Field | What to enter |
|---|---|
| Bale Barcode | Scan the **scale** barcode (e.g. `2609170001`) |
| Grower # | The number after the V (e.g. `100060`); stays filled for the next bale |
| Group # | A whole number, 1 or more |
| Lot # | Digits and `/` only, e.g. `3` or `12/3` |
Button **Save Bale Details**. Panel "Last Bale Details": Mass, Barcode, Group #, Lot #, Document No.

**Step 5 — Complete the grower's delivery:** field **Grower Number** (e.g. V 100060) + button **Complete Delivery**.

## Existing records and relationships
- Transporter Delivery Note (TDN…) 1—N growers; each completed grower → Grower Delivery Note (GDN…), e.g. V100060 → GDN0000005, V100061 → GDN0000004 (D/Note column).
- GDN 1—N bales (scale barcode, group, lot, mass); GDN ↔ booking (grower, sell date).
- Back-office lists: Receiving → Grower Delivery Notes (columns: Document, Grower No., Grower Name, Selling Date, Selling Point, Season, Location, Row #, Number…, H…, Number…, Sales Sheet…, State, Last Updated, Created on), Transporter Delivery Notes, Bookings.

## Actions and buttons
Create Transporter Delivery Note; Add Grower; Remove; Edit Transporter Details; **Complete Delivery** (transporter note) → **Confirm Delivery Complete** / Cancel; Save Bale Details; Complete Delivery (grower); Create New Transporter Delivery Note; supervisor: **Eject Bale using Scale Barcode**.
Keyboard: scanning fills the barcode, Tab moves to the next field, Enter saves.

## Process sequence
1. Truck arrives → create transporter note (name, ID, vehicle reg, phone).
2. Add each grower (number, location/row, bales).
3. Complete Delivery → check list → Confirm Delivery Complete → "Document successfully closed"; each grower gets a GDN in state Open.
4. Each bale weighed (scale barcode, mass) → captured with grower #, group, lot → Save Bale Details → "Bale added", Bale Tally N of M.
5. At tally = declared → "Delivery Balanced".
6. Enter grower number → Complete Delivery → "Delivery Document #GDN… for grower … is closed" → delivery moves to Tickets Printing.

## Status transitions
- Transporter note: **Open → Completed** (State shown "Open" before, "Completed" after).
- Grower delivery note: **Open → Tickets Printing** (on grower Complete Delivery) → Checked (Manual 04) → Laid (Manual 05).

## Validation rules
- Grower must exist in the register ("Please check format and validity of grower number").
- Grower must have a pending delivery note, i.e. be on a **completed** transporter note.
- Scale barcode must not be blank/too short.
- Bale must not already be associated with a Closed document.
- Group # whole number ≥ 1; Lot # digits and `/` only, not starting or ending with `/`.
- No repeated group + lot pair within the delivery (message includes line N).
- Captured bales must exactly equal declared bales.

## Calculations
Bale Tally = captured bales of M declared. Transporter note totals: Number of Growers, Total Bales (sum of declared bales).

## External dependencies
Scale (Intelliscale) sends weights/scale barcodes to the system; the clerk scans the scale barcode and the system associates the mass. Scale protocol undocumented.

## Common system messages (verbatim)
| Message | What it means | What to do |
|---|---|---|
| The grower number does not have any pending delivery note | The grower isn't on a completed transporter note | Add the grower and complete the transporter note (Steps 2–3) |
| Please check format and validity of grower number | Not in the grower register | Check the number, or import the grower (Manual 02) |
| Please check barcode | Scale barcode blank or too short | Rescan |
| Please enter a valid lot number | Letters, or starts or ends with / | Use digits and / only |
| Bale is already associated with a Closed Document | This scale barcode was captured on another delivery | Supervisor checks and ejects it if wrong |
| The number of bales captured is less / greater than number of bales delivered | Tally doesn't match the declared bales | Capture the missing bale, or supervisor ejects the extra one |
| Repeated Group & Lot Number Combination in line N | Two bales have the same group and lot | Supervisor ejects one, and you recapture it |
| Document successfully closed / Bale added / Delivery Balanced / Delivery Document #GDN… for grower … is closed. | Success confirmations | — |

## Exception handling
- Wrong bale captured → receiving supervisor uses **Eject Bale using Scale Barcode** so it can be captured again.
- Duplicate scale barcode across deliveries → supervisor checks and ejects.
- Wrong grower added → Remove (before completing).

## Reports and outputs
Receiving → Grower Delivery Notes list; Transporter Delivery Notes; GDN numbers per grower. Receiving list screenshot rows (small photo, approximate): processed deliveries for 11 Sep with State Laid.

## Next process
Manual 04 — Ticket Printing (delivery shows Tickets Printing).

## Documented gaps
- Whether Eject needs a reason / approval (brief requires reason + audit — **proposed**; manual only says it removes the bale so it can be recaptured).
- Minimum scale barcode length; scale barcode format (the YYMMDD+sequence reading is an inference).
- Booking vs delivered check (UQ-09); the "Permit No." rules; allowed Sale Day/Month overrides.
- Back-office menu items TRVs, Hessians, Laying, Intelliscale Scales (UQ-11); GDN list columns "H…", "Number…", "Sales Sheet…".
- Whether the transporter note can be edited or cancelled after Completed.
- Relationship between "Location" (receiving row A), sale room (A) and floor row (UQ-10).

Sources: Manual 03.

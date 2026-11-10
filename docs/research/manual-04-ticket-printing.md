# Manual 04 — Ticket Printing (v1.0, Sept 2026)

## Business purpose
Every bale needs a barcoded ticket before it can be sold. The ticket clerk gives the grower's bales a run of barcodes from their roll of ticket stock, prints the tickets, attaches them and confirms. **Confirming locks the barcodes for the season.**

## Responsible user and supporting roles
Ticket clerk (Ticket Printing app): start barcode, allocate barcodes, print, confirm. Supervisor: Reverse Printing Status.

## Permissions needed
`tickets.view`, `tickets.set-start-barcode`, `tickets.allocate`, `tickets.print`, `tickets.confirm`, `tickets.interrupt`, `tickets.split-sale` (unverified); supervisor: `tickets.reverse-printing`.

## Prerequisites
- Today's receiving sale date is active (Manual 01).
- The delivery was completed at receiving and shows **Tickets Printing**.
- The clerk knows the first barcode on their roll of ticket stock.

## Input fields
| Field | Notes |
|---|---|
| Start Barcode (dialog "Change Start Barcode") | Full 10-character barcode printed on the first ticket: 9 digits + check character (e.g. `1000001013`); button **Set Start Barcode** |
Delivery form (read-only context): Grower Name, Grower Number, Season, Location, Number of Bales, Start Barcode, Lot Number - Highest, Lot Number - Lowest, Floor Sale, Created on, Selling Date, Selling Point. **Tobacco Bales** tab columns: Barcode, Group, Lot No., Ticket Date, Mass, Scale Barcode, Lot Num….

## Existing records and relationships
- "Waiting to Print" list (Ticket Printing → Ticket Printing): Selling Point, Grower Name, Grower Number, Location, Number…, State (Tickets Printing), Season, Created on, ID. Rows: V100060 Chengetai Chingoma (3, ID 4) and V100061 Trust Gwenzi (2, ID 5), both Sep 17 4:02 PM.
- Delivery GDN0000005 bales (before printing): (group 1, lot 1) mass 112 scale 2609170001; (1, 2) 98 scale 2609170002; (1, 3) 105 scale 2609170003.
- Start barcodes belong to each **user**; after confirming a delivery the user's next barcode is saved automatically.

## Actions and buttons
Set Starting Barcode; Use Next Barcode; Print (Print → Bale Tickets); Confirm Ticket Printing; Reverse Printing Status (after confirm; supervisor only); **Interrupted Ticket** (printer jammed / stock ran out part-way: record the last barcode printed and the new starting barcode); **Split this Sale** (grower's bales going to more than one sale).
Status bar of the delivery: Open · Checked · Laid · Tickets Printing · Laying.

## Process sequence
1. Open Ticket Printing → Ticket Printing; select the delivery (list filtered "Waiting to Print").
2. First run of day / new roll: **Set Starting Barcode** → enter 10-char barcode → Set Start Barcode. The system also gives this delivery's bales their barcodes.
3. Later deliveries: **Use Next Barcode** — bales get the next barcodes on the roll, **sorted by group then lot**.
4. Print → Bale Tickets; attach each ticket to its bale.
5. **Confirm Ticket Printing** — bales marked printed; delivery → Checked.

## Status transitions
Grower delivery note: **Tickets Printing → Checked** on confirmation; **Checked → (Tickets Printing) via Reverse Printing Status** (supervisor; target state implied, not stated).

## Validation rules
- Start barcode must be 10 characters with the correct check character.
- Start barcode must not overlap tickets already printed this season.
- A start barcode must have been set at least once for the user ("There is no previously set barcode").
- Every bale needs a barcode before confirming.
- An active (non-expired) sale date is required.

## Calculations
Barcode allocation: next 9-digit base +1 per bale in group/lot order, with check character appended. Worked sample: V100060 base 100000101..103 → tickets 1000001013, 1000001024, 1000001035; V100061 continues with 100000104..105 → 1000001046, 1000001057. Check algorithm **undocumented** (UQ-01).

## External dependencies
Ticket printer / ticket stock roll (hardware, undocumented). Printed ticket layout:

```
1 · 09/17/2026
2609170001 - 1000001013 · 1
V100060 · 1 · 112
A
```
= (first line) ticket sequence marker and sale date; scale barcode - ticket barcode; grower, group, mass; sale room. Fields per manual: sale date, scale barcode, ticket barcode, grower, group, mass, sale room.

## Common system messages (verbatim)
| Message | What it means | What to do |
|---|---|---|
| Barcodes already used in Tickets | Your start barcode overlaps tickets already printed this season | Step 2 with the first unused barcode on your roll |
| Please enter a valid barcode | Start barcode not 10 characters, or wrong check character | Type the full barcode exactly as printed on the ticket |
| There is no previously set barcode | You have never set a start barcode | Step 2 |
| Please set a sale date / Date has expired | No active sale date for today | Manual 01, Step 1 |
| Bale has no barcode in line N | Barcodes weren't allocated before confirming | Step 3, then confirm again |

## Exception handling
Printer jam/stock out → Interrupted Ticket. Wrongly confirmed → supervisor Reverse Printing Status. "Confirming uses up the barcodes for the season. Only confirm when the tickets are physically printed and correct."

## Reports and outputs
Printed bale tickets; Ticket Printing lists. (A "Pending Issues" menu exists, undocumented.)

## Next process
Manual 05 — lay the bales on the floor and scan them.

## Documented gaps
- Check-character algorithm (UQ-01); behaviour of Interrupted Ticket and Split this Sale beyond one-line descriptions (UQ-11).
- Whether Reverse Printing Status releases the locked barcodes and returns state to Tickets Printing.
- Whether reprinting (without reversing) is possible; audit of prints.
- "Lot Number - Highest/Lowest" and "Floor Sale" fields' purpose.
- The "Pending Issues" menu.

Sources: Manual 04.

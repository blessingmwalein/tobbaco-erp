# Manual 01 — Daily Setup (v1.0, Sept 2026)

## Business purpose
Two records must exist every sale day. Without them, receiving and data capture fail later with messages that are hard to trace back to the cause.

| Record | Needed by | Who |
|---|---|---|
| Sale Date - Receiving (active, today) | Ticket printing, floor summary | Receiving supervisor |
| Start of Day (posted, with exchange rate) | Data capture, balancing, stop orders | Data processing supervisor |

One-time floor configuration (selling point, sale rooms, rows, buyers, grades, grower charges) is covered in a separate document ("Setting up the e-Port System — Part 1: System Configuration") that we **do not have**.

## Responsible user and supporting roles
- Receiving supervisor — Step 1 (Sale Date - Receiving).
- Data processing supervisor — Step 2 (Start of Day).
- (Brief role "Supervisor" is mapped to both permissions; see `role-permission-matrix.md`.)

## Permissions needed
`sale-day.create`, `sale-day.activate` (Step 1); `sale-day.post` (Step 2); `sale-day.view`.

## Prerequisites
- Selling point **Ethical Sales Floor (EL)** is active and has sale room **A**.
- Receiving rows (Bale Locations) exist.
- Yesterday's sales are all Balanced or Processed (Start of Day refuses while earlier sales are Draft or Balanced).

## Input fields
**Step 1 — Floor Maintenance → Sale Date - Receiving → New**
| Field | What to enter |
|---|---|
| Date of Sale | Today's date |
| Is Active | Ticked. Unticks the previous date |
| Can Scan Floor Summary? | Ticked, so floor summary scanning is allowed |

(Screenshot also shows an "Active" tick box next to Is Active — meaning unexplained.) The record saves automatically when you leave the form.

**Step 2 — Data Processing → Start of Day → New**
| Field | What to enter |
|---|---|
| Selling Date | The sale date |
| Exchange Rate | The day's rate (e.g. 26.68450000, 8 decimal places shown) |

## Existing records and relationships
- Start of Day list (screenshot): Selling Date 2026-09-11 and 2026-09-10, Exchange Rate 26.68450000, Created by Administrator (pager 1–2 / 2).
- Sale Date - Receiving ↔ Selling Point / Season (Seasons, Selling Points under Floor Maintenance).
- Start of Day ↔ sales of that date (stop-order processing reads the exchange rate; Manual 07).

## Actions and buttons
New (Sale Date - Receiving); New (Start of Day); **Post Start of Day**.

## Process sequence
1. Receiving supervisor creates the receiving Sale Date, ticks Is Active and Can Scan Floor Summary?.
2. Data processing supervisor creates Start of Day, picks Selling Date, enters Exchange Rate.
3. Click Post Start of Day → "Start of Day Completed Successfully."

## Status transitions
- Sale Date - Receiving: new active date unticks the previous one (only one active).
- Start of Day: **Draft → Posted** (form header "Status: Draft > Posted").

## Validation rules
- A positive exchange rate is required.
- Start of Day is refused when earlier sales are still Draft or Balanced.
- If the active receiving date is in the past, ticket printing refuses with "Date has expired. Please set a valid sale date".

## Calculations
None.

## External dependencies
None (exchange rate entered manually; source of the rate is not documented).

## Common system messages (verbatim)
| Message | What to do |
|---|---|
| Exchange Rate should be bigger than ZERO! | Enter the day's rate |
| You can not run Start of Day when there are Sales in Draft or Balanced state from Previous dates! | Finish balancing and processing the earlier sales first (Manuals 06 and 07) |
| Please set a sale date / Date has expired | Step 1 |
| Start of Day Completed Successfully. | (success) |

## Exception handling
- Earlier sales still open → complete Manuals 06 and 07 for them first.
- Past active date → create/activate a new Sale Date - Receiving.

## Reports and outputs
Start of Day list (Selling Date, Exchange Rate, Created by).

## Next process
Manual 02 — TIMB Booking Import.

## Documented gaps
- Meaning of the second "Active" tick box on the sale-date form.
- Who may edit/un-post a posted Start of Day; whether the rate can be corrected (not documented).
- Source of the exchange rate; local currency code (UQ-04).
- One-time configuration document is not available (selling points, sale rooms, rows, buyers, grades, grower charges).
- Whether "Can Scan Floor Summary?" at sale-date level and "Turn Off/Turn On Floor Summary Scanning" (Manual 05) are the same switch (UQ-10 adjacent).

Sources: Manual 01.

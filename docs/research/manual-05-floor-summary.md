# Manual 05 — Laying and Floor Summary (v1.0, Sept 2026)

## Business purpose
Ticketed bales are laid out in rows on the sale floor. The floor summary clerk scans every ticket and records the row. When the last bale of a delivery is scanned, the system builds that grower's floor summary and **creates the sale and the (price) batch** that data capture works on.

## Responsible user and supporting roles
| Who | Does what | Where |
|---|---|---|
| Floor staff | Lay bales in rows, in group and lot order | Sale floor (not a system role) |
| Floor summary clerk | Scan tickets with the row number | Web interface → Floor Summary |
| Receiving manager | Turn floor summary scanning on or off | Web interface → Floor Summary |

## Permissions needed
`floor-summary.view`, `floor-summary.scan`, `floor-summary.complete`, `floor-summary.check`; manager: `floor-summary.toggle-scanning`.

## Prerequisites
- Delivery shows **Checked** (Manual 04).
- Today's sale date is active and **Can Scan Floor Summary?** is ticked (Manual 01).
- Bales are laid and each grower's row is known.

## Input fields
| Field | Notes |
|---|---|
| Selling point | e.g. Ethical Sales Floor - EL (pick) |
| Sale (room) | e.g. Sale A (pick) |
| Row | Integer; stays filled until changed |
| Barcode | The **ticket** barcode (not the scale barcode) |
Button **Scan to Summary**. After each scan: "Scanned N of M" plus Last Grower, Last Barcode, Lot, Group.

**Check Floor Summary** (menu ≡): Selling Date (e.g. 09/17/2026), Grower Number (V…), button **Search Floor Summary for Grower**; result: Row(s), Groups, Total Bales, Selling Time (blank until sold?), button Back to Receiving.

## Existing records and relationships
Back office Receiving → Floor Summary list columns: Selling Time, Grower Number, First Name, Surname, Selling Point, Selling Date, District, Season, Delivery Note, Row, Group - (first), Group - (last), Total Bales, Unbook…

| Grower | Date | District | Delivery Note | Row | Groups | Total bales | Unbooked | Selling Time |
|---|---|---|---|---|---|---|---|---|
| V100061 Trust Gwenzi | Sep 17 | 32 | GDN0000004 | 2 | 1–1 | 2 | 0 | (blank) |
| V100060 Chengetai Chingoma | Sep 17 | 14 | GDN0000005 | 1 | 1–1 | 3 | 0 | (blank) |
| V100043 Simba Chingoma | Sep 11 | 28 | GDN0000002 | 3 | 1–1 | 3 | 0 | 07:30:25 |
| V100058 Simba Mhlanga | Sep 11 | 7 | GDN0000003 | 2 | 1–1 | 2 | 0 | 07:30:15 |
| V100058 Simba Mhlanga | Sep 11 | 7 | GDN0000001 | 1 | 1–1 | 3 | 0 | 07:30:00 |

(Selling Time is the first column; in the transcription each time value precedes its row, so the two Sep 17 rows have no selling time yet — reading inferred from layout.) A single scan does not create a separate scan record in the documentation; per-scan history is a design addition.

## Actions and buttons
Choose selling point; choose sale room; Scan to Summary; Check Floor Summary → Search Floor Summary for Grower; Back to Receiving; **Turn Off/Turn On Floor Summary Scanning** (stops/restarts scanning for the whole floor).

## Process sequence
1. Menu ≡ → Floor Summary → choose selling point → choose sale room (Sale A).
2. Type Row; scan ticket; click Scan to Summary.
3. Page shows "Scanned N of M"; repeat.
4. At total (Scanned 3 of 3) the grower's floor summary is complete: delivery → **Laid**, **draft sale created** for data capture.

## Status transitions
Grower delivery note: **Checked → Laid** (when scanned = delivered). Sale: created in **Draft**. Price batch created (Draft).

## Validation rules
- Scanning must be on (global switch) and today's sale date must be active with Can Scan Floor Summary ticked.
- Row must be a number (integer).
- Barcode must be a printed ticket; delivery must be Checked; bale must belong to this selling point.

## Calculations
Scanned count per grower vs total bales (N of M). Floor-summary row groups/total bales per grower.

## External dependencies
Barcode scanner (keyboard-emulating assumed; hardware undocumented).

## Common system messages (verbatim)
| Message | What it means | What to do |
|---|---|---|
| Floor Summary scanning is currently off… | The manager turned scanning off | Ask the receiving manager to turn it on |
| Please Add a Current Sale Date,. | No active sale date for today | Manual 01, Step 1 |
| Please enter a Row Number / …an integer for Row Number | Row blank or not a number | Type the row number |
| Cannot find the bale:… | The barcode isn't a printed ticket | Rescan. Check you scanned the ticket, not the scale label |
| This bale is not supposed to be on the floor. Please check with supervisor | The delivery isn't Checked (tickets not confirmed) | Ticket clerk confirms printing (Manual 04) |
| This delivery is for … | The bale belongs to another selling point | Move the bale |

## Exception handling
Wrong scan target → rescan the ticket. Unchecked delivery → ticket clerk confirms. Other selling point → move the bale. A grower asking where their bales are → Check Floor Summary.

## Reports and outputs
Floor Summary list (back office); Check Floor Summary result (row, groups, total bales).

## Next process
Manual 06 — Data Capture and Balancing (sale is in Draft).

## Documented gaps
- **Duplicate scans**: no message or behaviour documented (brief requires detection → flagged addition).
- Whether a scan can be undone/moved to another row; what happens to rows across a grower's bales (a grower may span rows?).
- Meaning of "Selling Time" and "District"; "Unbook…" column (unbooked bales?).
- Relationship of Row (integer) vs Location (A) vs Sale room (A) (UQ-10).
- Whether "Can Scan Floor Summary?" flag and the Turn Off/On button are one switch.
- "Laying" menu and delivery state (UQ-02/UQ-11).

Sources: Manual 05.

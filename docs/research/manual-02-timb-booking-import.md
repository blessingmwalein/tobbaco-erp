# Manual 02 — TIMB Booking Import (v1.0, Sept 2026)

## Business purpose
Growers book their delivery with TIMB. TIMB sends the floor an **encrypted booking file** listing each grower, the sell date and the number of bales booked. It is imported before receiving starts: "receiving and balancing check the bales delivered against these bookings".

## Responsible user and supporting roles
| Who | Does what | Where (legacy) |
|---|---|---|
| TIMB clerk | Imports the booking file | TIMB Data → Import Grower Booking File |
| Supervisor | Checks the bookings | Growers → Grower Booking |

## Permissions needed
`timb.import-bookings`, `timb.view`, `growers.view` (booking list).

## Prerequisites
- The file exactly as TIMB sent it — **do not rename**. The first three characters (`ELS`) select the floor's decryption key.
- Every grower in the file already exists in the grower register; otherwise import the grower register first (TIMB Data → Import Grower Register File).

## Input fields
| Field | Value |
|---|---|
| Grower Booking File (upload) | e.g. `ELS_ETHICAL_20260917.txt` |

## Existing records and relationships
Grower Booking list (Growers → Grower Booking), columns: **Booked id, Sell Date, Season, Grower, First Name, Surname, Book Date, Bales Booked, Source B…, Floor, Booked By, Last Updated on**.

| Booked id | Sell Date | Season | Grower | First | Surname | Book Date | Bales | Source B… | Floor | Booked By |
|---|---|---|---|---|---|---|---|---|---|---|
| EL2609170001 | Sep 17 | 2026 | V100060 | Chengetai | Chingoma | Sep 16 | 3 | 0 | EL | TIMB Online |
| EL2609170002 | Sep 17 | 2026 | V100061 | Trust | Gwenzi | Sep 16 | 2 | 0 | EL | TIMB Online |
| EL2609100001 | Sep 11 | 2026 | V100043 | Simba | Chingoma | Sep 11 | 3 | 0 | EL | TIMB Online |
| EL2609100002 | Sep 11 | 2026 | V100058 | Simba | Mhlanga | Sep 11 | 5 | 0 | EL | TIMB Online |
| EL2609100003 | Sep 11 | 2026 | V100060 | Chengetai | Chingoma | Sep 11 | 8 | 0 | EL | TIMB Online |
| EL2609100004 | Sep 11 | 2026 | V100061 | Trust | Gwenzi | Sep 11 | 6 | 0 | EL | TIMB Online |
| EL2609100005 | Sep 11 | 2026 | V100074 | Farai | Ngapasare | Sep 11 | 12 | 0 | EL | TIMB Online |
| EL2609100007 | Sep 11 | 2026 | V100088A | Mavis | Chinyepe | Sep 11 | 10 | 0 | EL | TIMB Online |
| EL2609100006 | Sep 11 | 2026 | V100079 | Chengetai | Zacharia | Sep 11 | 4 | 0 | EL | TIMB Online |
| EL2609100008 | Sep 11 | 2026 | V100097 | Tapiwa | Nyamande | Sep 11 | 7 | 0 | EL | TIMB Online |

(Pager 1–10 / 10; the manual warns some digits in the photo are hard to read — check ids against the original.) Booked id pattern: floor code `EL` + `YYMMDD` + 4-digit sequence (inferred from the data, not stated). Line "Last Updated on": Sep 17, 3:55 PM for today's two bookings.

## Actions and buttons
Upload field; **Import Grower Bookings File**; Cancel.

## Process sequence
1. TIMB sends encrypted booking file (`ELS_…_YYYYMMDD.txt`).
2. TIMB Data → Import Grower Booking File → upload → Import Grower Bookings File.
3. System reports created / updated / error counts.
4. If errors: fix (file name prefix; grower not registered) and re-import.
5. Check bookings in Growers → Grower Booking → proceed to Receiving (Manual 03).

## Status transitions
None documented for the import itself (outcome is a result message). Import-job states (UPLOADED … FAILED) are **brief-proposed**.

## Validation rules
- File name prefix selects the decryption key; renamed file or another floor's file fails.
- Grower must exist in the register.
- Re-importing the same file **updates** bookings matched on **TIMB's booking reference** and does not duplicate them.

## Calculations
None.

## External dependencies
TIMB encrypted booking file; per-floor decryption keys (filename prefix → key). Real decryption is out of scope for Phase 1 (UQ-13).

## Common system messages (verbatim)
| Message | What it means | What to do |
|---|---|---|
| Booking Decryption Keys for X is missing. Check filename of file | The file was renamed, or it belongs to another floor | Use the original file name, which starts with ELS |
| Import complete with errors | Some lines could not be read, for example an unknown grower | Import the grower register, then import the booking file again |
| Grower Booking Import complete: 2 created, 0 updated, 0 errors. | Success result | — |

## Exception handling
Unknown grower → import the grower register file, then re-import the bookings.

## Reports and outputs
Import result message; Grower Booking list. (TIMB Data Transfers menu exists — presumably import history — not described.)

## Next process
Manual 03 — Receiving.

## Documented gaps
- Booking file layout (fields, delimiter) is not documented; encrypted.
- Grower register and creditor register file formats/processes have no manual of their own.
- "Source B…" column (value 0) meaning (UQ-09).
- Whether receiving/balancing **blocks or only warns** when delivered ≠ booked (UQ-09).
- "Sell Date" vs "Book Date" semantics and whether multiple bookings for the same grower/date are allowed (V100060 and V100061 have bookings on both Sep 11 and Sep 17).

Sources: Manual 02.

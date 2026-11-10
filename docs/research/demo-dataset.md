# Demo Dataset — 17 September 2026, Ethical Sales Floor (EL)

Rule: **Documented** values come from the manuals and are shown as such. **DEMO** values are invented to make screens realistic; every demo record carries a DEMO flag/badge in the UI and fixtures. Derived values are labelled *illustrative*.

## Context (documented)
Selling point Ethical Sales Floor (EL); sale room A; receiving location/row A; season 2026; sale date 2026-09-17; exchange rate 26.6845 (also used for 2026-09-10 and 2026-09-11); Start of Day for 09-10 and 09-11 already posted (created by Administrator).

## Growers, bookings, delivery notes
| Item | Value | Status |
|---|---|---|
| V100060 | Chengetai Chingoma, 3 bales, GDN0000005, booking EL2609170001 (booked Sep 16, TIMB Online), floor-summary row 1, district 14 | Documented |
| V100061 | Trust Gwenzi, 2 bales, GDN0000004, booking EL2609170002 (booked Sep 16), floor-summary row 2, district 32 | Documented |
| Transporter note | TDN0000002; Tendai Moyo; ID `63-123456-A-42`; vehicle AEX 1234 → `AEX1234`; phone 0772123456; Permit No. blank; 2 growers, 5 bales; growers on location A | Documented |
| Delivery (GDN) IDs (internal) | GDN0000005 → ID 4; GDN0000004 → ID 5 (Ticket Printing list); Salesmaster ID 4 = V100060; Price Batch 4 = V100060 | Documented |
| Historical bookings (Sep 11) | V100043 ×3 (EL2609100001 … see manual-02 table), V100058 ×5, V100060 ×8, V100061 ×6, V100074 ×12, V100088A ×10, V100079 ×4, V100097 ×7 | Documented |
| Historical deliveries/sales (Sep 11) | GDN0000001 V100058 (3 bales, row 1), GDN0000002 V100043 (3, row 3), GDN0000003 V100058 (2, row 2); sales ID 1 (V100058, US 427.20), ID 2 (V100058, US 104.50), ID 3 (V100043, US 193.70); all Processed, pay batch 1,000 | Documented (RTGS/ZW columns partially legible) |
| Other growers (names only) | Farai Ngapasare V100074, Mavis Chinyepe V100088A, Chengetai Zacharia V100079, Tapiwa Nyamande V100097, Simba Mhlanga V100058, Simba Chingoma V100043 | Documented (names) / DEMO (any extra details) |

## Bales for V100060 (GDN0000005) — documented
| Scale barcode | Group | Lot | Mass (kg) | Ticket barcode | TIMB grade | Buyer | Buyer grade | Price (US c/kg) | Batch price |
|---|---|---|---|---|---|---|---|---|---|
| 2609170001 | 1 | 1 | 112 | 1000001013 | A10 | JM | 11OF | 212 | 212 |
| 2609170002 | 1 | 2 | 98 | 1000001024 | A1E | JM | 11OF | 198 | 198 |
| 2609170003 | 1 | 3 | 105 | 1000001035 | A1L | JM | 11OF | 185 | 185 |

Start Barcode on the delivery: 1000001013; ticket sheet "Lot Number - Highest 3, Lowest 1; Floor Sale 1". Ticket clerk's next barcode after confirm: base 100000104 (derived).

## Bales for V100061 (GDN0000004)
| Item | Value | Status |
|---|---|---|
| Ticket barcodes | 1000001046, 1000001057 (2 tickets; range 1046–1057) | Documented |
| Scale barcodes | 2609170004, 2609170005 | **DEMO** (continuing sequence; not documented) |
| Group / lot | 1/1, 1/2 | **DEMO** |
| Mass, TIMB grades, buyer, buyer grade, prices | e.g. 101 kg, 94 kg; grades A10, A1E; buyer JM / 11OF; 205 and 190 c/kg | **DEMO** |

## Ticket barcode check-digit table (UQ-01 — algorithm unverified)
| Base | Check | Ticket | Notes |
|---|---|---|---|
| 100000101 | 3 | 1000001013 | V100060 #1 (digit sum 3) |
| 100000102 | 4 | 1000001024 | V100060 #2 (digit sum 4) |
| 100000103 | 5 | 1000001035 | V100060 #3 (digit sum 5) |
| 100000104 | 6 | 1000001046 | V100061 #1 (digit sum 6) |
| 100000105 | 7 | 1000001057 | V100061 #2 (digit sum 7) |

Range ≠ bale count: V100060 range 1013–1035 = **3 tickets** (not 23); V100061 range 1046–1057 = **2 tickets** (not 12).

## V100060 gross sale value — *illustrative*
Assumes value per ticket = price (US cents/kg) ÷ 100 × mass (kg); rounding unknown (UQ-05).
| Ticket | Calculation | Value (USD) |
|---|---|---|
| 1000001013 | 112 × 2.12 | 237.44 |
| 1000001024 | 98 × 1.98 | 194.04 |
| 1000001035 | 105 × 1.85 | 194.25 |
| **Total** | 315 kg | **625.73** |
V100061's value follows from the DEMO inputs above (101 × 2.05 + 94 × 1.90 = 207.05 + 178.60 = 385.65, *illustrative*).

## Deductions — documented totals vs DEMO line split
| Item | Documented | DEMO |
|---|---|---|
| Totals for 17 Sep | $173.11 deducted; 11 lines; 2 growers; 6 creditors; USD only; source split Internal USD invoices $123.11 + TIMB USD Stop Orders $50.00 | — |
| Stop order | V100060, creditor 00050 (name truncated "Cr…"), Priority 1, Rec Type 06, Stop Order # 1, Season 2026, Paid Amount 0 before processing; $50.00 taken from V100060 | Creditor display name (e.g. "Creditor 00050") |
| Floor-charge creditors | Floor Commission, Weigh and Auction, Bank Charges, Govt Levy, Afforestation Levy (5 × 2 growers = 10 lines) | Per-line amounts summing to $123.11 (e.g. split across growers by value), rates not implied |
| Order | (1) charges, (2) internal invoices, (3) merchant loans, (4) TIMB invoices, (5) TIMB stop orders | — |
Consistency: 10 floor-charge lines + 1 stop order = 11 ✓; 5 + creditor 00050 = 6 creditors ✓.

## Payment and dispatch
| Item | Value | Status |
|---|---|---|
| Pay batch | 1001 (test day); historical 1000 | Documented |
| Currencies | USD (and ZWL/ZWG — UQ-04) | Documented / unverified |
| Grower bank accounts | any | **DEMO**; one grower with no bank details to show exclusion (manual: test growers had none) |
| Payment schedule CSV | header-only if no banks; 13 documented columns | Documented |
| Buyer / warehouse | Buyer JM → packing warehouse CURVERID | Documented |
| Dispatch note reference | FLDN/2026/09/0001 (example) | Documented (example) |
| Driver / truck for dispatch | any | **DEMO** |
| Released flag | unticked on test sales | Documented; the demo release action is a flagged assumption (UQ-03) |

## Scenario presets (generated by replaying mock actions)
Start of day · Bookings imported · Received · Tickets confirmed · Floor summary done · Ready to balance · Processed · Ready to dispatch · Validation showcase (DEMO sale with missing buyer grade, price mismatch and invalid sale-code reason to exercise every check).

Sources: Overview; Manuals 01–09.

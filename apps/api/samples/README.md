# Sample Test Files

These files let you walk through the buyer portal import workflow end-to-end without needing live external data.

## Workflow overview

```
Flow Disk import → Invoice created → Purchase created → Shipment import → Receiving → Reconciliation
```

---

## Quick start: small test (10 bales)

Use these three files to test a full purchase cycle with a manageable dataset.

### Step 1 — Import Flow Disk

Upload **`flowdisk/MZ_20260528_test_10.csv`** at `/buyer/imports/new`.

- 10 bales, buyer MZ (Moroz Tobacco), sale date 2026-05-28
- Total: 783 kg / US$2,079.06
- Confirm the import → system creates the invoice and purchase

### Step 2 — Import Shipment Part 1

Upload **`shipments/shipment_mz_20260528_part1.json`** at `/buyer/shipments` (import).

- 5 bales (first half of the purchase), dispatched 2026-05-29
- Truck: ABC 1234, driver: John Mpofu
- Confirm → 5 bales move to IN_TRANSIT

### Step 3 — Import Shipment Part 2

Upload **`shipments/shipment_mz_20260528_part2.json`**.

- Remaining 5 bales, dispatched 2026-05-30
- Truck: XYZ 5678, driver: Sarah Banda
- Confirm → all 10 bales now in transit

### Step 4 — Mark arrivals and receive

For each shipment:
1. Set status to **ARRIVED** at `/buyer/shipments/:id/arrive`
2. Open a receiving session at `/buyer/receiving`
3. Scan each barcode → system marks bales as RECEIVED

### Step 5 — Reconcile

Navigate to `/buyer/reconciliation`, find the purchase, and close it.
All 10 bales must be received before the reconciliation can be closed.

---

## Full purchase test (43 bales)

Use the existing full invoice and the matching single-shipment file.

| Step | File |
|------|------|
| Flow Disk import | `flowdisk/MZ_20260522.csv` (43 bales, 3,314 kg, US$7,396.77) |
| Shipment import  | `shipments/shipment_mz_20260522_full.json` (all 43 bales, truck TRK 9900) |

Same steps as above — import Flow Disk, confirm, import shipment, confirm, receive, reconcile.

---

## File reference

### Flow Disk files (`flowdisk/`)

| File | Bales | Sale date | Purpose |
|------|-------|-----------|---------|
| `MZ_20260522.csv` | 43 | 2026-05-22 | Full real-data purchase |
| `MZ_20260522.V` | 43 | 2026-05-22 | Same purchase, pipe-delimited (.V) format |
| `MZ_20260523_test_10.csv` | 10 | 2026-05-23 | Generated test set |
| `MZ_20260524_test_10.csv` | 10 | 2026-05-24 | Generated test set |
| `MZ_20260525_test_10.csv` | 10 | 2026-05-25 | Generated test set |
| `MZ_20260526_test_10.csv` | 10 | 2026-05-26 | Generated test set |
| `MZ_20260527_test_15.csv` | 15 | 2026-05-27 | Generated test set |
| `MZ_20260528_test_10.csv` | 10 | 2026-05-28 | Small workflow test (matches shipment parts 1 & 2) |

### Shipment files (`shipments/`)

| File | Bales | Matches Flow Disk | Notes |
|------|-------|-------------------|-------|
| `shipment_45.json` | 1 | — | Minimal single-bale example |
| `shipment_mz_20260528_part1.json` | 5 | `MZ_20260528_test_10.csv` | First 5 bales, truck ABC 1234 |
| `shipment_mz_20260528_part2.json` | 5 | `MZ_20260528_test_10.csv` | Last 5 bales, truck XYZ 5678 |
| `shipment_mz_20260522_full.json` | 43 | `MZ_20260522.csv` | All 43 bales in one shipment |

---

## Barcode format notes

- Barcodes are exactly **10 characters**: 9 digits followed by a Code 39 mod-43 check character.
- The check character can be a **space** — two bales in the MZ 2026-05-22 dataset have a trailing space:
  - `"111089477 "` (grower 398887)
  - `"111089747 "` (grower 358097)
- **Never trim barcode strings.** Trimming will break validation and barcode matching.

## USD value formula

Every row must satisfy: `usdValue = mass × uscPerKg / 100` within ±$0.02 tolerance.
The parser rejects rows where the printed value does not match the calculated value.

## Shipment JSON format

The parser requires:
- `format` must be exactly `"leaflogix-shipment"`
- `shipment` object must be present
- `bales` must be a non-empty array
- Each bale needs `barcode` (string) and `mass` (positive numeric string)

Barcodes in the shipment are matched against the purchase bale manifest.
Bales not found in any purchase will appear as validation issues on the import preview.

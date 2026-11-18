# Buyer Portal — reports, dashboard and dates

How the reports are defined, what every figure means, and how to check them. The report list lives in one place —
[`packages/shared/src/buyer/reports-catalogue.ts`](../../packages/shared/src/buyer/reports-catalogue.ts) — and is used by both the API
(which builds the rows) and the web workbench (which draws the filters, columns and tabs).

## Where things are

| | |
|---|---|
| Pages | `/buyer/reports/purchases`, `/buyer/reports/receiving`, `/buyer/reports/inventory` (each has one tab per report) |
| API | `GET /api/v1/buyer/reports/:reportId` (one page + key figures + totals) and `GET /api/v1/buyer/reports/:reportId/export?format=pdf\|xlsx\|csv` (every matching row) |
| Permissions | `buyer.reports.view` **and** the permission of the data shown (see the table). Exporting also needs `buyer.reports.export` (Viewers can read but not download). |
| Audit | every export writes a `report.exported` audit entry (report, filters, format, rows, file name) |
| Limits | a screen page is at most 100 rows; an export holds up to 50,000 rows, otherwise `422 EXPORT_TOO_LARGE` asks to narrow the filters |

Filters live in the page URL (`?report=…&from=…&to=…&q=…&page=…&sort=…`), so any view can be bookmarked or shared. A filter that a report
does not declare is ignored by the API.

## Reports

### Purchase Reports
| Report | Needs | One row per | Notes |
|---|---|---|---|
| **Purchase Register** | purchases | purchase | bales, kg, value, payable US$/ZiG, shipment count, receiving and reconciliation status |
| **Invoices & Charges** | purchases + invoices | invoice | tobacco value, government levy, TTA levy, floor clearing (US$ and ZiG), payable |
| **Purchases by Grade** | purchases | buyer grade | bales, kg, value, average USc/kg, share of bales |
| **Flow Disk Import Register** | purchases | import | file, status, valid/invalid rows, linked purchase, parser (flagged *unverified format*) |

*Payable* is the sum of invoice **section B** (the US$/ZiG split plus levies and floor clearing). Section A, the tobacco value, is informational.
On the real MOROZ sample: US$ 5,177.74 + 11.60 = **US$ 5,189.34** and ZiG 58,408.45 + 2,920.43 + 130.84 + 735.69 = **ZiG 62,195.41**.

### Receiving Reports
| Report | Needs | One row per | Notes |
|---|---|---|---|
| **Purchase vs Shipment vs Received** | purchases + receiving | purchase | the three-way comparison, below |
| **Shipment Register** | receiving | shipment | truck, driver, destination, expected vs received, days in transit, status |
| **Receiving Sessions** | receiving | session | who, when, duration, scanned vs expected, exceptions |
| **Bale Discrepancies** | receiving | bale | outstanding / missing / unexpected / wrong / invalid, with explanations |

**Purchase vs Shipment vs Received** — for each purchase:

* **Purchased** = the invoice / Flow Disk (`Purchase.totalBales`, `totalMassKg`).
* **Dispatched** = the shipment manifests the floor sent (`BuyerShipment.expectedBales/expectedMassKg`; *cancelled shipments are excluded*).
* **Received** = manifest lines whose status is `RECEIVED` or `ALLOCATED` (scanned in).
* **Not yet dispatched** = purchased − dispatched (never below 0). **Outstanding** = dispatched − received (never below 0).
* **Mass variance** = Σ scanned weight − Σ manifest weight, **only over bales that were weighed at receiving**. The *Weighed* column shows
  "weighed / received" (e.g. `4 / 6`). A bale scanned without a weight is not part of the variance — the report never invents one.
* *Only with differences* keeps purchases where not-yet-dispatched, outstanding or mass variance is not zero, worst (most outstanding) first.

**Bale Discrepancies** — `OUTSTANDING`: dispatched and not received while the shipment is still in transit / arrived / receiving.
`MISSING`: the same, once the shipment has been confirmed or stored, or the purchase reconciliation is closed. These are *derived*: the system
never writes a `MISSING` status on a manifest line today. `UNEXPECTED`, `WRONG_PURCHASE`, `WRONG_BUYER`, `INVALID_BARCODE`, `DUPLICATE_SCAN`,
`EXCEPTION` come from receiving exceptions, with the explanation (and resolution) that was recorded. For wrong-buyer scans only the scanned
barcode and your own explanation are shown — nothing about another company's stock.

### Inventory Reports
| Report | Needs | One row per | Notes |
|---|---|---|---|
| **Stock by Warehouse & Location** | warehouse | warehouse › bay › row | bales, kg, value, capacity, occupancy % (empty rows optional) |
| **Stock by Grade** | warehouse | grade × warehouse | includes *Received, not yet stored* |
| **Inventory Position** | warehouse | bale | location, received date, age in days, ageing buckets as key figures |
| **Warehouse Movements** | warehouse | movement | the ledger with readable from/to locations, user and reference |

*On hand* = bales that are `IN_STOCK`, `RETURNED` (from processing) or `EXCEPTION`. A scanned bale is `IN_STOCK` with **no location** until it is
allocated; the stock-by-location report counts those separately as *Received, not yet stored*. *Age* is whole business days since the bale was received.

## Exports

* **PDF** — A4 landscape, company header band, report title, the applied filters, key-figure tiles, the table with a repeating header row,
  status pills, a totals row, notes, and "Page i of n" on every page. Text Helvetica cannot encode (e.g. emoji) is replaced rather than failing.
* **Excel** — a *Summary* sheet (title, company, generated time, filters, key figures, notes) plus a formatted data sheet: frozen and styled header,
  filter arrows, **real numbers and dates** (`#,##0.0` kg, `#,##0.00` money, `dd mmm yyyy`), totals row, landscape print setup.
* **CSV** — UTF-8 with BOM (so Excel reads accents correctly), CRLF, raw unformatted values (decimals as given, dates `yyyy-mm-dd`), totals row.
  Text that a spreadsheet would run as a formula (`= + - @`) is prefixed with `'`; values with leading/trailing spaces (a barcode may end in a blank)
  are always quoted.

## Dates, time zones and the date pickers

* All date filters are **calendar dates** (`yyyy-mm-dd`). The date pickers (`packages/ui` → `DatePicker`, `DateRangePicker`) emit local calendar
  dates and never go through `toISOString()`, which would shift a date by a day at UTC+2.
* The business day is **Africa/Harare (UTC+2, no daylight saving)**; the end day of a range is **inclusive**
  ([`apps/api/src/common/date-range.ts`](../../apps/api/src/common/date-range.ts)). A scan at 01:30 Harare time on the 18th is 23:30 UTC on the 17th and
  counts as the **18th**. `@db.Date` columns (sale date, dispatch date) compare directly.
* The documents print instants in Harare time ("generated … (Harare time)"). Excel stores that wall-clock time so the sheet shows what the portal showed.

## Dashboard

The date range and floor select **purchases by sale date**; purchase, receiving, levy and payable figures describe those purchases.
The *live* block — shipments in transit / arrived / being received / awaiting storage, open receiving sessions, open exceptions and stock in
warehouses — is the position **right now**: it ignores the dates and honours only the floor filter.

| Figure | Definition |
|---|---|
| Total purchases | number of purchases in the selection; the card shows the sale dates they cover |
| Received / still to receive | bales of those purchases with a received date; purchased − received |
| In warehouses now | bales on hand **with a location** (EXPECTED and in-transit bales are not stock) |
| Levies & payable | levies = section B excluding the USD/ZiG split line; payable = invoice payable totals (no more double-counting the tobacco value) |
| Shipment stages | In transit → Arrived (gate, not started) → Being received (a session is scanning) → Awaiting storage (fully scanned); cancelled shipments are in none |

## Checking it yourself

```bash
# a disposable database only (it is TRUNCATED), then the deterministic scenario:
ALLOW_DB_RESET=yes DATABASE_URL=<disposable db> pnpm --filter @tobacco/api e2e:scenario
# API integration tests (reports, dashboard, …) — TEST_DATABASE_URL must NOT be your development database:
TEST_DATABASE_URL=<disposable db> pnpm --filter @tobacco/api test:integration
# browser journeys against the real API (own web instance: NEXT_DIST_DIR keeps it apart from your dev server):
NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 pnpm --filter @tobacco/web exec next dev --port 3100
PORT=3100 pnpm --filter @tobacco/web e2e:buyer
```

The scenario (`apps/api/test/scenario.ts`) has three purchases, three shipments (one in transit), a receiving session with a 1.0 kg mass variance,
an open and a resolved exception, 8 bales on hand across two warehouses (one not yet stored) and eight movements, so every number above can be asserted exactly.

## Known behaviours the reports work around

* `BuyerShipment.status = RECONCILIATION_REQUIRED`, `STORAGE_IN_PROGRESS`, `CANCELLED` and `BuyerShipmentBale.status = MISSING` are not written by the
  current flows; the reports treat missing / outstanding as *derived* and do not rely on them.
* A duplicate scan is rejected before a scan row is written, so duplicate scans are not countable from the database.
* Mass is optional on a receiving scan; mass variance therefore covers weighed bales only.

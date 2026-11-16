# Buyer Portal Workflow

This guide explains the buyer workflow from importing a Flow Disk invoice through bale receiving, reconciliation, warehouse allocation, inventory, and traceability.

## 1. Buyer login

Open:

```text
/buyer/login
```

The buyer authenticates and receives an access token used for Buyer Portal API requests.

## 2. Upload a Flow Disk

Open:

```text
/buyer/imports
```

Upload a Flow Disk CSV, for example:

```text
apps/api/samples/flowdisk/MZ_20260524_test_10.csv
```

The system:

- Shows upload progress.
- Validates the file format.
- Reads invoice metadata.
- Reads invoice charges.
- Reads grade summaries.
- Reads every bale.
- Validates barcode check characters.
- Calculates totals.
- Detects duplicate files, invoices, and barcodes.

The import initially receives the `STAGED` status.

## 3. Preview the import

The preview displays:

- Buyer and floor
- Invoice dates
- Exchange rate
- Tobacco value
- Payable totals
- Invoice charges
- Grade summaries
- Bale count and mass
- Complete bale manifest
- Validation issues

A staged import can be deleted if it is incorrect.

## 4. Confirm the import

When the preview is correct, select **Confirm import**.

The system creates:

- A buyer invoice
- Invoice charges
- A purchase record
- Bale records
- The imported bale manifest

The import changes to `COMPLETED`.

The purchase begins with receiving status:

```text
NOT_STARTED
```

Duplicate bales and duplicate invoices are rejected before confirmation.

## 5. Review the invoice

Open:

```text
/buyer/invoices
```

The invoice list supports:

- Date range filtering
- Floor filtering
- Searching
- Sorting
- Pagination

An invoice detail shows:

- Invoice header
- Buyer information
- Sale dates
- Exchange rate
- Charges
- Grade summaries
- Payable totals
- Every imported bale
- Barcode, grade, grower, lot, mass, price, and TIMB grade

Flow Disk represents the purchased tobacco only. It does **not** mean that every purchased bale has arrived.

## 6. Create and confirm a dispatch shipment

Open:

```text
/buyer/shipments
```

Import a separate Dispatch File containing `Barcode` and `MassKg` columns plus the dispatch reference, purchase reference, truck, driver, transporter, and destination warehouse. The system checks that every barcode belongs to the purchase and is not already assigned to another shipment. A valid import creates an `IN_TRANSIT` shipment and marks only those bales as dispatched. One purchase may have multiple shipments and partial dispatches.

Select **Mark arrived** for an in-transit shipment and confirm the receiving warehouse, actual truck registration, and arrival notes. The shipment becomes `ARRIVED`; scanning is blocked before arrival.

## 7. Start a receiving session

Open:

```text
/buyer/receiving
```

Select the arrived shipment using the searchable selector and choose **Start session**.

Rules:

- Only one receiving session can be open for a shipment.
- An existing open session must be continued.
- A new session cannot be created while another session for the shipment is open.

The session starts with:

```text
OPEN
```

## 8. Scan the bales

Scan or enter each bale barcode.

For a valid barcode, the system verifies:

- Barcode format
- Buyer ownership
- Purchase membership and shipment membership
- Bale existence
- Whether it was already scanned
- Whether it belongs to the imported invoice

Successful scans show:

- Barcode
- Buyer grade
- TIMB grade
- Grower number
- Lot number
- Mass
- Purchase value

Invalid scans create visible exceptions, including:

- Invalid barcode
- Unexpected bale
- Wrong buyer
- Wrong purchase
- Duplicate scan

A bale cannot be scanned twice.

## 9. Open reconciliation

Open:

```text
/buyer/receiving/reconciliation
```

Select the receiving session to open its right-side detail drawer.

The drawer compares:

- Dispatched shipment manifest bales
- Successfully scanned bales
- Missing bales
- Scan disputes
- Open exceptions

The session cannot be confirmed until:

- Every dispatched shipment bale is received.
- No scan disputes remain.
- All exceptions are resolved.

Exceptions can be resolved with a resolution note.

## 10. Confirm reconciliation

When everything matches, select:

```text
Confirm reconciliation
```

This confirms that:

- All expected bales were scanned.
- The manifest and scans reconcile.
- No unresolved receiving problems remain.

The session status becomes:

```text
CONFIRMED
```

At this point, the bales have been received but are not yet assigned to a final warehouse location.

## 11. Finalise warehouse allocation

For a `CONFIRMED` session, the drawer shows:

```text
Finalise reconciliation and assign warehouse
```

Select:

1. Warehouse
2. Bay
3. Starting row

The system assigns bales sequentially:

- Starting from the selected row
- Using the row capacity
- Continuing into later rows when required

If there is not enough capacity, finalisation is blocked.

After successful allocation, the session becomes:

```text
ALLOCATED
```

The system updates:

- Bale warehouse
- Bale bay
- Bale row
- Warehouse inventory
- Bale movement ledger
- Traceability events
- Purchase receiving status to `PARTIALLY_RECEIVED` until every dispatched shipment is allocated
- Purchase receiving status to `COMPLETE` only after all purchased bales across all shipments are allocated

## 12. View warehouse inventory

Open:

```text
/buyer/inventory
```

Filter by:

- Warehouse
- Bay
- Row
- Received date range
- Search text

The table shows:

- Barcode
- Grade
- Grower
- Lot
- Mass
- Bought price
- Received date
- Status

Clicking a bale opens its detail drawer.

## 13. View bale traceability

The bale detail drawer shows:

- Import and purchase reference
- Invoice sale date
- Buyer and TIMB grades
- Grower and lot
- Weight
- Bought price
- Receiving details
- Current warehouse
- Current bay
- Current row
- Warehouse movement history
- Scan and ledger events

The standalone traceability page is:

```text
/buyer/traceability
```

## Status summary

### Flow Disk import

```text
STAGED → COMPLETED
```

### Receiving session

```text
OPEN → CONFIRMED → ALLOCATED
```

### Incoming shipment

```text
IN_TRANSIT → ARRIVED → RECEIVING → RECONCILIATION_REQUIRED → CONFIRMED → ALLOCATED
```

### Purchase receiving

```text
NOT_STARTED → PARTIALLY_DISPATCHED → IN_PROGRESS → PARTIALLY_RECEIVED → COMPLETE
```

### Bale

```text
EXPECTED → IN_STOCK
```

## Important distinction

- `CONFIRMED` means all bales were scanned and reconciliation passed.
- `ALLOCATED` means the bales were assigned to a warehouse, bay, and row.
- A purchase can be partially dispatched and can have more than one incoming shipment.

# Manual 09 — Floor Dispatch (v1.0, Sept 2026 — **DRAFT**: setup required before it can be tested)

## Business purpose
Sold bales leave the floor on trucks for the buyer's packing warehouse. The dispatch clerk opens a dispatch note for the truck, scans each bale onto it and posts it. The system then produces the dispatch report and the **shipment file** the warehouse receives against.

## Responsible user and supporting roles
| Who | Does what | Where |
|---|---|---|
| Dispatch clerk | Opens the dispatch note, scans bales, posts | Floor Dispatch → Dispatch |
| Dispatch supervisor | Shipment file, cancellations | Floor Dispatch → Dispatch Notes / Reports |

## Permissions needed
`dispatch.view`, `dispatch.create`, `dispatch.scan`, `dispatch.post`; supervisor: `dispatch.cancel`, `dispatch.generate-shipment-file`, `dispatch.reset` (proposed key for "reset to draft"), `dispatch.configure` (proposed, Configurations).

## Prerequisites
- The bales' sale is **released**.
- Destination warehouses are set up (Floor Dispatch → Configurations) and each buyer has its packing warehouse.
- Transport companies and drivers are set up.

## Input fields — Initiate Dispatch (Floor Dispatch → Dispatch → Initiate Dispatch)
| Field | What to enter |
|---|---|
| Destination Warehouse | The buyer's packing warehouse |
| Product | Green (unprocessed) |
| No Transportation Details | Tick only if there's no truck to record |
| Transport Name / Truck Reg Number / Driver | The truck and driver taking the load |
| Driver National ID, Driver Cellphone | (shown on the dialog) |
Button **Create & Add Bales** → dispatch note reference like `FLDN/2026/09/0001`.
Scanning: ticket barcode → **Save Bale**; **Remove Bale**; **Done** when loaded.
Dispatch Notes list columns: Reference, Destination, Truck Reg N…, Driver Natio…, Driver Cellp…, Total Bales, Total Mass, State, Created on, Dispatch D…, Mobile Crea…, Mobile User.

## Existing records and relationships
Dispatch note 1—N bales (ticket barcodes) → sale (Released) → buyer → packing warehouse (e.g. buyer **JM** → warehouse **CURVERID**). Warehouses, transport companies, drivers in Configurations.

## Actions and buttons
Initiate Dispatch; Create & Add Bales; Save Bale; Remove Bale; Done; **Post**; **Generate Shipment File** (warehouse CSV); **Cancel Dispatch** (with reason); supervisor reset to draft.

## Process sequence
1. Sale released.
2. Initiate Dispatch: destination, product, truck, driver.
3. Scan bales: Save Bale / Done.
4. Open note in Dispatch Notes, check bale count and mass, click Post.
5. Generate Shipment File — warehouse receives.

## Status transitions
Dispatch note: **Draft → Posted**; draft can be **Cancelled** with a reason; "Reset the note to draft (supervisor)" is referenced in a message. Notes cannot be deleted. (State names Draft/Posted/Cancelled are inferred from the text; the State column values are not shown.)

## Validation rules — a bale is refused if:
- its sale isn't released;
- its buyer packs at a different warehouse;
- it has a rejected sale code (**RO, RH or CO**);
- it's already on another dispatch note.
Also: bales can only be removed from a draft note; shipment file only for Posted notes; no deletion (cancel instead).

## Calculations
Total Bales and Total Mass per dispatch note.

## External dependencies
Warehouse receiving the shipment CSV (columns undocumented); mobile dispatch app (list has "Mobile Created"/"Mobile User" columns).

## Common system messages (verbatim)
| Message | What to do |
|---|---|
| Bale 'X' cannot be dispatched: its sale has not been released yet… | Release the sale first |
| …wrong warehouse… | The bale belongs on a truck to its buyer's warehouse |
| You can only remove bales from a draft dispatch note. | Reset the note to draft (supervisor) |
| You cannot delete dispatch notes. Please cancel them instead. | Use Cancel Dispatch |
| The dispatch note must be in Posted state to generate a shipment file. | Post the note first |

## Exception handling
Wrong scan → Remove Bale (draft). Wrong note → Cancel Dispatch with reason. Wrongly posted → supervisor resets to draft (rules undocumented). Never delete.

## Reports and outputs
Dispatch report; shipment file (CSV) for the warehouse; Dispatch Notes list (empty state text: "Create your first Dispatch Note! Dispatch Notes help you track the movement of bales from source to destination warehouses.").

## Next process
End of the sale-day lifecycle (warehouse receives against the shipment file).

## Documented gaps — open items found while testing (from the manual)
1. **No destination warehouses exist on the sandbox**: buyer JM's packing warehouse is CURVERID but the wizard's destination list is empty, so no bale can be dispatched.
2. **The test sales are not released**; dispatch refuses unreleased sales — confirm who releases a sale at Ethical and where (UQ-03).
3. **Two dispatch apps** on the sandbox: Floor Dispatch (`floor_dispatch`) and Dispatch (`dispatch_boka`, truck/grower/TIMB dispatch notes) — confirm which Ethical uses; this manual covers Floor Dispatch.
Remaining screenshots (scanning, posted note, shipment file) were not captured. Additional gaps: shipment file columns; whether a posted note can be reset after the shipment file is generated; the Reports/Configurations menus; mobile dispatch; whether Product has values other than "Green (unprocessed)".

Sources: Manual 09.

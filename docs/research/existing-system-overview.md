# Existing System Overview — e-Port

## What the manuals describe
The e-Port manuals take a grower's tobacco through the system from the TIMB booking to payment and dispatch. Each manual covers one process: who does it, a flow diagram, what to check before starting, numbered steps (with screenshots from the Ethical sandbox), and common messages. One test sale day (**17 September 2026**) was run through the real screens; two growers delivered on one truck.

## Legacy platform terms (not to be copied)
The existing system is described as an **Odoo-style back office** ("the Odoo app menus along the top") plus a separate **web interface** for the floor. Module names that appear in the manuals: `premier_reports`, `ethical_reports` (not installed), `floor_dispatch`, `dispatch_boka`. These are implementation details of the legacy platform; our ERP reproduces the *processes*, not the Odoo structure.

| Screen kind | Looks like | Used for |
|---|---|---|
| Web interface (`/receiving/…`, `/data/…`) | Purple bar and large fields, opened from the menu (≡) | Fast scanner-and-keyboard work on the floor |
| Back office | App menus along the top | Setup, checking, printing, processing |

The web interface is the model for our **floor workspaces**; the back office is the model for our **back-office shell** (see `docs/design/app-shells.md`).

## The whole day (one sale day, manual by manual)
| # | Manual | Who | Where (legacy) |
|---|---|---|---|
| 01 | Daily Setup | Supervisor (Receiving supervisor for sale date; Data processing supervisor for Start of Day) | Floor Maintenance · Data Processing |
| 02 | TIMB Booking Import | TIMB clerk | TIMB Data |
| 03 | Receiving | Receiving clerk | Receiving web interface |
| 04 | Ticket Printing | Ticket clerk | Ticket Printing app |
| 05 | Floor Summary | Floor summary clerk | Receiving web interface |
| 06 | Data Capture and Balancing | Data clerks, supervisor | Data capture web stations · Data Processing |
| 07 | Stop Orders and Deductions | Data processing supervisor | TIMB Data · Stop Order Processing |
| 08 | Grower Payment | Accounts | Data Processing · Accounts |
| 09 | Floor Dispatch | Dispatch clerk | Floor Dispatch |

## How a delivery's state changes
| Stage | Delivery note | Sale |
|---|---|---|
| Growers added, bales being captured | Open | — |
| Delivery completed | Tickets Printing | — |
| Tickets confirmed | Checked | — |
| Floor summary complete | Laid | Draft |
| Batch posted, sale balanced | Laid | Balanced |
| Stop orders processed | Laid | Processed (pay batch number) |

Additional states seen on screens but **not explained**: delivery-note status bar shows "Open · Checked · Laid · Tickets Printing · Laying"; sale status bar shows "Draft · Posted · Balanced · Processed". See UQ-02.

## Naming split — two different "batches"
| Name we use | Legacy name | Meaning |
|---|---|---|
| **Price Batch** | Batch Processing (e.g. "Batch 4 - V100060") | One per grower sale; holds the second (blind) price capture; Draft → Posted |
| **Pay Batch** (Pay Batch Number) | "Batch No." / Batch # (e.g. 1001; historical 1000) | Assigned when stop-order processing marks a sale Processed; used to generate payment schedules |

The UI must never use bare "Batch" without one of these qualifiers.

## Two different barcodes
| Barcode | Example | Created | Used for |
|---|---|---|---|
| Scale barcode | `2609170001` (10 digits; looks like YYMMDD + 4-digit sequence — not stated) | By the scale; carries the mass | Receiving bale capture; eject bale |
| Ticket barcode | `1000001013` — 10 characters = 9 digits + check character | Allocated at ticket printing | Floor summary, data capture, dispatch |

### Check-character observation (UNVERIFIED — see UQ-01)
Documented ticket barcodes (V100060: 1013, 1024, 1035; V100061: 1046, 1057) are `base + check`, where `base` increases by 1 per ticket:

| Base (9 digits) | Check | Ticket barcode | Digit sum of base |
|---|---|---|---|
| 100000101 | 3 | 1000001013 | 3 |
| 100000102 | 4 | 1000001024 | 4 |
| 100000103 | 5 | 1000001035 | 5 |
| 100000104 | 6 | 1000001046 | 6 |
| 100000105 | 7 | 1000001057 | 7 |

"Digit sum mod 10" fits all five samples, but many other algorithms do too. The real algorithm is **not documented**. Consequence: the numeric span of a barcode range (1013–1035) is **not** the number of bales (3).

## Menus mentioned in the manuals
| Menu | Items |
|---|---|
| Floor Maintenance | Sale Date - Receiving, Seasons, Bale Locations, Selling Points, Packing Warehouses, Floor Sales, TIMB Grade |
| Data Processing | Sales Dashboard, Start of Day, Sales sheet Report, Processing (Batch Processing, Ticket Processing), Import E-Marketing CSV, TIMB Files, TIMB Webservices |
| TIMB Data | TIMB Data Transfers, Import Grower Register File, Import Creditor Register File, Import Grower Booking File, Import Stop Order File |
| Growers | Grower Booking |
| Receiving (back office) | Grower Delivery Notes, TRVs, Transporter Delivery Notes, Bookings, Intelliscale Scales, Hessians, Laying, Floor Summary |
| Web interface menu (≡) | Transporters → Create New Transporter Delivery Note; Grower Delivery Note; Receiving Supervisor; Floor Summary; Check Floor Summary |
| Data capture web (`/data/`) | Classification, e-Buying, All Details, Log Out of System |
| Ticket Printing | Ticket Printing, Pending Issues |
| Grower Creditors | Grower Creditors, Stop Orders, Grower Creditor - Cellphones |
| Stop Order Processing | Deductions Dashboard, Deductions, Grower Charges, RBZ Offset Creditors, Deduction Summaries (+ the Stop Order Processing wizard) |
| Accounts | My Dashboard, Schedules, Generate Buyer Disk File, Generate Buyer Invoice, Generate Buyer Invoice YTD, Generate Buyer Stats |
| Floor Dispatch | Dispatch (Initiate Dispatch, Dispatch Notes), Reports, Configurations |

Several of these are undocumented beyond their names — see UQ-11.

## Reference sale-day scenario
Selling point **Ethical Sales Floor (EL)**, sale room **A**, season **2026**, sale date **17 Sep 2026**, exchange rate **26.6845**. Growers V100060 Chengetai Chingoma (3 bales, GDN0000005, tickets 1000001013–1000001035) and V100061 Trust Gwenzi (2 bales, GDN0000004, tickets 1000001046–1000001057); transporter note TDN0000002 (Tendai Moyo, AEX1234); pay batch 1001. Full fixture list: `demo-dataset.md`.

Sources: Overview ("About these manuals", "The whole day", "Two kinds of screens", "How a delivery's state changes"), Manuals 01–09.

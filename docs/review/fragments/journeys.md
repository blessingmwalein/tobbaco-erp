### Journey 1 — The documented sale day (17 September 2026, Ethical Sales Floor)

Click it end to end as **Demo Operator**, or hand it between roles (the *Role* column) using **Switch demo user**. Start from **Demo controls → Fresh** and reset between runs.

| # | Stage (manual) | Role | Where | What you do | You should see |
|---|---|---|---|---|---|
| 1 | Daily setup (01) | Receiving Supervisor | `/setup/sale-dates` | New sale date, active, can scan | 17 Sep active; previous date deactivated |
| 2 | Daily setup (01) | Data Processing Supervisor | `/setup/start-of-day` | Post Start of Day at 26.6845 | "Start of Day Completed Successfully." |
| 3 | TIMB booking import (02) | TIMB Clerk | `/timb/imports/new?type=GROWER_BOOKING` | Use sample `ELS_ETHICAL_20260917.txt` → import | "Grower Booking Import complete: 2 created, 0 updated, 0 errors." Re-import → 0 created, 2 updated |
| 4 | Receiving (03) | Receiving Clerk | `/floor/receiving` | Transporter Tendai Moyo, AEX 1234 → add V100060 ×3 and V100061 ×2, location A → Complete | TDN0000002; GDN0000005 (V100060) and GDN0000004 (V100061) created |
| 5 | Bale capture (03) | Receiving Clerk | `/floor/receiving/[gdn]/bales` | Scan scale barcodes 2609170001–3, group 1, lots 1–3; complete | Tally 3 of 3 · Delivery Balanced · "Delivery Document #GDN0000005 for grower V100060 is closed" |
| 6 | Ticket printing (04) | Ticket Clerk | `/floor/tickets` | Set Starting Barcode 1000001013 → print preview → Confirm | Tickets 1000001013 / 1024 / 1035; delivery Checked; next barcode saved |
| 7 | Floor summary (05) | Floor Summary Clerk | `/floor/floor-summary` | Row 1, scan V100060's tickets; row 2 for V100061 | "Scanned 3 of 3"; deliveries Laid; draft sales 4 and 5 and batches created |
| 8 | Data capture (06) | Data Clerk | `/floor/data-capture` | Classification: grade A10/A1E/A1L; e-Buying: buyer JM, grade 11OF, prices 212/198/185 | Last Bale Details confirms each bale |
| 9 | Batch processing (06) | Data Clerk | `/batches` | Blind second price entry → Post Batch | Batch 4 Posted |
| 10 | Balancing (06) | Data Processing Supervisor | `/sales/sale-4` | Review the balancing preview → Balance Sale | "Sale has balanced!"; sale Balanced |
| 11 | Stop orders (07) | Data Processing Supervisor / TIMB Clerk | `/timb/imports/new?type=STOP_ORDER` then `/finance/stop-order-processing` | Import `EL_stoporders_20260917.txt`, run Stop Order Processing | Sales Processed, pay batch 1001; Deductions Dashboard $173.11 · 11 lines · 2 growers · 6 creditors |
| 12 | Grower payment (08) | Accounts | `/finance/payments` | Generate USD schedule for batch 1001; download CSV; record bank confirmation | Both growers listed; CSV download does **not** mark paid; Paid only after a recorded confirmation |
| 13 | Release (06/09) | Data Processing Supervisor | `/sales/sale-4` | Release the sale | Dispatch can accept its bales |
| 14 | Dispatch (09) | Dispatch Clerk | `/floor/dispatch` | Initiate for CURVERID, scan the five tickets, Post, Generate Shipment File | 5 bales · 512 kg; shipment file listed |

Every transition writes an audit entry (`/admin/audit`) and updates the dashboard (`/dashboard`, `/sale-day`).

### Journey 2 — Where is the day stuck?

Supervisors open `/dashboard`: the stage strip shows complete / in progress / blocked / needs attention, **blocked reasons are spelled out** (e.g. "Start of Day must be posted before data capture"), and the exceptions list links to the screen that fixes each one. `/sale-day` shows every stage with prerequisites and metrics.

### Journey 3 — Role-based access

Switch demo user and observe: the sidebar hides what a role cannot use; deep links show a no-access state; buttons that a role cannot press stay visible but disabled with the reason ("Your role (Receiving Clerk) lacks “sale-day.post”. Held by: Supervisor, Data Processing Supervisor…"). System Administrator manages users, roles (permission matrix) and settings at `/admin/*`.

### Journey 4 — Failure and exception paths (all with the manuals' verbatim messages)

- Renamed booking file → "Booking Decryption Keys for … is missing. Check filename of file"
- Start of Day with a zero rate, or with earlier Draft/Balanced sales
- Ticket printing with an overlapping start barcode → "Barcodes already used in Tickets"
- Bale tally mismatch, repeated group+lot, bale already on a closed document, lot with a leading "/"
- Floor-summary scanning turned off; scanning a ticket for an unconfirmed delivery; unknown barcode; duplicate scan
- Invalid buyer grade (belongs to another buyer), missing TIMB grade, price vs batch price mismatch (use the **Validation showcase** preset)
- Stop order file dated for another day → "Stop order not deducted"; pending approvals block processing
- Payment schedule with growers lacking bank details (they are left out and listed); CloudPay mock never marks paid
- Dispatch refusals: sale not released, wrong warehouse, rejected sale code (RO/RH/CO), bale already dispatched

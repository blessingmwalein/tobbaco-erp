<!-- Verbatim feature brief supplied by the owner. Source of truth for requirements. -->

# Feature Development: External Tobacco Buyer Portal & Bale Traceability

## 1. Objective

The existing ERP interface and current implementation are working well. We now need to introduce the final major component: an **External Buyer Portal**.

This portal will be used by registered tobacco buyers who purchase tobacco bales at the auction floors.

The portal must integrate with the existing ERP backend and inventory infrastructure while providing buyers with their own secure workspace to manage purchased tobacco, import Flow Disk files, receive and scan bales, manage warehouse locations, dispatch tobacco to processing companies, track processing activities and reconcile returned bales.

This is not a standalone application. It is an additional external-facing portal within the existing ERP ecosystem.

**Important:** Preserve the current ERP UI, branding, design system, navigation patterns, components and established interaction behaviours. Do not redesign existing internal ERP modules.

The new Buyer Portal should follow the same design quality while having a distinct external-user experience.

---

# 2. Buyer Portal Access & Authentication

Create a dedicated external buyer login experience.

### Buyer authentication

- Buyers must have individual accounts.
- Each buyer account must be associated with a registered buyer/company.
- Secure login and logout.
- Password reset.
- Account activation and deactivation by ERP administrators.
- Buyer users must only access information belonging to their own company.
- Support multiple users under one buyer organisation.
- Enforce role-based permissions within the buyer organisation.

### Suggested buyer roles

| Role | Permissions |
|---|---|
| Buyer Administrator | Full access to company purchases, inventory, users and operations |
| Warehouse Manager | Receive bales, scan, manage warehouse locations and transfers |
| Operations Officer | Dispatch bales to processing companies and manage returns |
| Finance Officer | View purchases, invoices and financial summaries |
| Viewer | Read-only access to permitted information |

Create a modern external login page consistent with the existing ERP branding.

---

# 3. Buyer Dashboard

After logging in, buyers should land on a dedicated dashboard showing their tobacco purchasing and inventory position.

### Dashboard KPI cards

- Total Bales Purchased
- Bales Received
- Pending Receipts
- Bales in Buyer Warehouses
- Bales Dispatched to Processors
- Bales Under Processing
- Bales Returned from Processing
- Outstanding Reconciliation

### Dashboard sections

**Recent Purchases**
- Purchase date
- Floor
- Buyer invoice number
- Number of bales
- Total mass
- Purchase value
- Receiving status

**Warehouse Overview**
- Warehouse
- Bay
- Row
- Number of bales
- Total mass

**Processing Overview**
- Processing company
- Dispatch date
- Number of bales sent
- Number returned
- Outstanding bales

**Recent Activity**
- Flow Disk imports
- Bale receiving sessions
- Warehouse movements
- Processing dispatches
- Processing returns

Include useful charts for:
- Purchased versus received bales.
- Warehouse inventory distribution.
- Tobacco dispatched versus returned.
- Bale movement history over time.

Use realistic demo data and functional filters.

---

# 4. Flow Disk Import & Buyer Invoice Management

This is one of the most important features of the portal.

When a buyer purchases tobacco bales at the auction floor, they receive a Flow Disk containing information about the bales purchased, together with their buyer invoice.

The portal must allow buyers to import their purchase information and establish an expected inventory record against which physical bale receipts can be verified.

### Import workflow

1. Buyer navigates to Purchases / Flow Disk Imports.
2. Selects Import Flow Disk.
3. Uploads the supplied Flow Disk file.
4. System reads and validates the file.
5. Displays a preview of the imported bales.
6. Buyer reviews the information.
7. Buyer confirms the import.
8. System creates a purchase record and expected bale manifest.

Also support uploading the associated buyer invoice PDF.

### Important file requirements

I will provide a sample buyer invoice PDF showing the information supplied by the auction floor.

Use this document as the reference for creating realistic demonstration data and designing the invoice import and preview experience.

I will also provide a sample Flow Disk file or its format/reference document.

Do not assume the Flow Disk file structure. Inspect the supplied sample and implement the correct parser and field mapping.

For the demonstration, generate a representative Flow Disk file using the bale information from the supplied invoice and use that file to test the complete import workflow.

Do not simply upload the invoice PDF and pretend that it is a Flow Disk file. These are separate documents with separate purposes.

### Import data fields

The system must capture the following bale-level information:

| Field | Description |
|---|---|
| Buyer Grade | Grade assigned to the purchased bale |
| Grower Number | Grower identification number |
| Lot Number | Grower lot number |
| Mass | Bale weight |
| USC/Kg | Unit cost per kilogram |
| US$ Value | Total bale value |
| Barcode | Unique bale barcode |
| TIMB Grade | TIMB tobacco grade |

Each imported bale must become an individual traceable inventory record.

### Buyer invoice information

Capture the invoice-level information as well:

- Invoice number.
- Buyer name.
- Floor name.
- Sale date.
- Invoice date.
- From and To dates.
- Exchange rate.
- Prepared by.
- Total number of bales.
- Total mass.
- Average price per kilogram.
- Total tobacco value.
- Currency split.
- Government levy.
- TTA levy.
- Floor clearing charges.
- Total invoice charges.

Preserve the original invoice as an attached document.

### Import validation

Before confirming an import, display:

- Total records detected.
- Valid bale records.
- Invalid records.
- Duplicate barcodes.
- Missing barcodes.
- Missing grower or lot numbers.
- Invalid weights or values.
- Total expected mass.
- Total expected purchase value.

Allow the buyer to inspect invalid records and correct supported fields before confirmation.

Prevent duplicate imports and duplicate bale registrations.

Maintain an import history containing the uploaded file, buyer, date, invoice reference, number of records and import status.

---

# 5. Bale Receiving & Physical Verification

Once the purchase information has been imported, buyers must be able to receive the physical tobacco bales.

The imported Flow Disk is the expected bale manifest.

The receiving process must verify whether the physical bales arriving at the buyer's warehouse match the bales purchased at the auction floor.

### Receiving workflow

1. Buyer opens the relevant purchase or receiving session.
2. System displays the expected bale manifest.
3. Buyer starts a receiving session.
4. Warehouse operator scans the barcode of each physically received bale.
5. System looks up the barcode against the imported purchase records.
6. System confirms whether the bale belongs to the buyer and purchase.
7. The system records the receiving result.
8. The operator assigns the bale to a warehouse, bay and row.
9. The operator confirms the receiving session.
10. The system generates a reconciliation report.

### Barcode scanning

Provide a dedicated scanning interface that supports:

- USB barcode scanners acting as keyboard input.
- Manual barcode entry as a fallback.
- Continuous scanning without repeatedly opening a form.
- Immediate scan feedback.
- Sound or visual confirmation for successful scans.
- Clear warnings for invalid or unexpected barcodes.

### Bale verification statuses

| Status | Meaning |
|---|---|
| Expected | Present in the imported manifest but not physically received |
| Received | Successfully scanned and verified |
| Unexpected | Scanned but not found in the expected purchase |
| Duplicate Scan | Barcode already scanned in the current or previous receiving session |
| Wrong Buyer | Bale belongs to another buyer |
| Wrong Purchase | Bale exists but belongs to another purchase |
| Exception | Requires investigation |

Never silently accept unexpected or duplicate bales.

Allow authorised operators to flag exceptions and record explanations.

### Receiving reconciliation

After receiving, generate a reconciliation showing:

- Total bales purchased.
- Total bales physically received.
- Total expected but not received.
- Unexpected bales.
- Duplicate scans.
- Total purchased mass.
- Total received mass.
- Mass variance.

Generate a downloadable reconciliation report.

The system must retain the original purchase manifest and the actual receiving results.

---

# 6. Buyer Warehouse & Bale Location Management

Once bales have been received, they become part of the buyer's warehouse inventory.

The portal must allow buyers to manage where each bale is physically stored.

### Warehouse structure

Use a hierarchical location structure:

**Buyer → Warehouse → Bay → Row → Bale**

Each buyer should be able to manage their registered warehouse locations.

Example:

- Warehouse: Buyer Main Warehouse
- Bay: BAY-01
- Row: ROW-A
- Bale: 111000937M

### Warehouse management functionality

- View all buyer warehouses.
- View bays and rows.
- View bale counts per location.
- Search by barcode.
- Search by grower number.
- Search by lot number.
- Search by grade.
- Search by purchase or invoice.
- View individual bale location history.

### Bale inventory record

Each bale must retain:

- Barcode.
- Buyer grade.
- TIMB grade.
- Grower number.
- Lot number.
- Mass.
- Purchase value.
- Purchase reference.
- Receiving date.
- Current warehouse.
- Current bay.
- Current row.
- Current inventory status.

### Warehouse movements

Allow authorised users to:

- Move bales between bays.
- Move bales between rows.
- Transfer bales between buyer warehouses.
- Record movement reasons.
- Record the operator responsible.
- View movement history.

Every movement must be recorded in an auditable inventory movement ledger.

A bale must only have one active physical location at a time.

---

# 7. Dispatch to Tobacco Processing Companies

Buyers must be able to send purchased tobacco bales to processing companies for further processing.

This introduces another important stage in the bale lifecycle.

### Processing company management

Create a Processing Companies section where buyers can manage their approved processing partners.

Capture:

- Company name.
- Company registration/reference.
- Physical address.
- Contact person.
- Contact number.
- Email.
- Active/inactive status.

Processing companies should be associated with the buyer that sends them tobacco.

### Dispatch workflow

1. Buyer opens Warehouse Inventory.
2. Selects bales to dispatch.
3. System validates that selected bales are physically available.
4. Buyer selects the processing company.
5. Buyer records the dispatch date.
6. Buyer specifies the reason or processing instruction.
7. Buyer confirms the dispatch.
8. System generates a dispatch reference and dispatch document.
9. Selected bales change status to In Transit / Dispatched to Processor.
10. System records the source warehouse, bay and row.

### Dispatch information

Capture:

- Dispatch reference.
- Buyer.
- Processing company.
- Dispatch date.
- Selected bale barcodes.
- Number of bales.
- Total mass.
- Source warehouse.
- Source bay.
- Source row.
- Reason for dispatch.
- Dispatch notes.
- Authorised operator.
- Dispatch status.

### Important inventory rule

Dispatched bales must no longer appear as available stock in the buyer's warehouse.

However, their original purchase, receiving and warehouse movement history must remain accessible.

The system must know exactly which warehouse and bay each bale was dispatched from.

---

# 8. Processing Returns & Receiving Back Processed Tobacco

After processing, tobacco bales are returned to the buyer.

The portal must support receiving returned tobacco and reconciling it against the original dispatch.

### Processing return workflow

1. Buyer opens the relevant processing dispatch.
2. Selects Receive Processed Tobacco.
3. System displays the original dispatched bale manifest.
4. Operator scans the returned bale barcodes.
5. System validates the barcodes against the dispatch.
6. Operator records the returned bales.
7. System captures any changes to bale identification, grade or mass where applicable.
8. Operator assigns returned bales to the buyer's processing warehouse.
9. Buyer confirms the return.
10. System generates a processing return reconciliation.

### Return scenarios

Support:

- All dispatched bales returned.
- Partial returns.
- Bales still outstanding at the processor.
- Damaged bales.
- Missing bales.
- Unexpected bales.
- Regraded or reidentified bales.
- Mass differences.

Do not assume that all returned bales must have identical barcodes or weights without checking the processing documentation.

Where processing changes bale identity, capture the original barcode and the new barcode in a linked traceability record.

### Processing return reconciliation

Display:

- Original dispatched bale count.
- Total bales returned.
- Outstanding bales.
- Unexpected returned bales.
- Original dispatched mass.
- Actual returned mass.
- Mass variance.
- Processing company.
- Dispatch reference.
- Return reference.

Require explanations for discrepancies.

---

# 9. Processing Warehouse & Storage Locations

Returned processed tobacco must be stored in a separate warehouse inventory area.

Create a dedicated Processing Warehouse structure.

Example:

Buyer
→ Processing Warehouse
→ Bay
→ Row
→ Processed Bale

The warehouse interface should allow buyers to:

- View returned processed bales.
- Scan barcodes.
- Assign warehouse bays and rows.
- Move bales between locations.
- View stock by grade.
- View stock by processing company.
- View stock by original purchase.
- Track bale processing history.

Each returned bale must retain its relationship to:

- Original purchase.
- Original Flow Disk.
- Original barcode.
- Original receiving record.
- Original warehouse location.
- Processing dispatch.
- Processing company.
- Processing return.
- New barcode, if changed.
- Current processing warehouse location.

The buyer should be able to open any bale and see its complete lifecycle.

---

# 10. Bale Traceability & Movement History

This is a core requirement.

Every bale must have an individual traceability timeline.

For example:

1. Purchased at Ethical Sales Floor.
2. Recorded under Buyer Invoice.
3. Imported through Flow Disk.
4. Physically received and barcode verified.
5. Stored in Main Warehouse, BAY-01, ROW-A.
6. Dispatched to Processing Company X.
7. Received back from processing.
8. Stored in Processing Warehouse, BAY-02, ROW-B.

Every event must record:

- Event type.
- Date and time.
- Responsible user.
- Source location.
- Destination location.
- Related purchase, receiving, dispatch or return reference.
- Supporting notes or documents.

The buyer should be able to search for a barcode and immediately understand where the bale is, where it has been and what has happened to it.

---

# 11. Buyer Reports & Documents

Create a Reports section with the following reports:

1. Purchase Register.
2. Flow Disk Import Register.
3. Buyer Invoice Register.
4. Bale Receiving Report.
5. Purchase vs Receiving Reconciliation.
6. Warehouse Inventory Report.
7. Warehouse Location Report.
8. Warehouse Movement Report.
9. Processing Dispatch Register.
10. Processing Return Register.
11. Processing Reconciliation Report.
12. Outstanding Bales Report.
13. Individual Bale Traceability Report.

Reports should support:
- Date filters.
- Purchase filters.
- Invoice filters.
- Warehouse filters.
- Processing company filters.
- Grade filters.
- Barcode search.
- PDF export.
- Excel export where appropriate.

---

# 12. Suggested Buyer Portal Navigation

Create a clean navigation structure:

**Overview**
- Dashboard

**Purchases**
- Buyer Invoices
- Flow Disk Imports
- Purchase Register
- Bale Manifests

**Operations**
- Bale Receiving
- Receiving Reconciliation
- Warehouse Inventory
- Warehouse Movements

**Processing**
- Processing Companies
- Dispatches
- Processing Returns
- Processing Reconciliation

**Inventory**
- Buyer Warehouses
- Warehouse Bays & Rows
- Processing Warehouses
- Bale Traceability

**Reports**
- Purchase Reports
- Receiving Reports
- Inventory Reports
- Processing Reports

**Administration**
- Buyer Users
- Company Profile
- Account Settings

---

# 13. Sample Data & Demonstration Requirements

Use the supplied Ethical Leaf Tobacco buyer invoice as the reference for the demonstration.

The invoice is for:

- Floor: Ethical Sales Floor.
- Buyer: MOROZ TOBACCO - MZ.
- Sale date: 22 May 2026.
- Exchange rate: 26.3216.
- Total bales: 43.
- Total mass: 3,314 kg.
- Total tobacco value: US$7,396.77.

The sample invoice contains two grade groups:

- L4OMA: 42 bales, 3,242 kg, US$7,263.57.
- L4R: 1 bale, 72 kg, US$133.20.

Use the actual 43 bale records supplied in the invoice for the demonstration Flow Disk dataset.

Preserve the original bale-level fields, including buyer grade, grower number, lot number, mass, USC/Kg, US$ value, barcode and TIMB grade.

The invoice also contains the financial charges and currency split. Capture these in the buyer invoice record.

### Demonstration scenario

Build a complete working demonstration using the sample purchase:

1. Log in as MOROZ TOBACCO.
2. Import the generated sample Flow Disk.
3. Upload and view the sample buyer invoice.
4. Review the 43 expected bales.
5. Start a receiving session.
6. Scan sample barcodes.
7. Demonstrate successful scans, duplicate scans and unexpected barcodes.
8. Complete the receiving reconciliation.
9. Store received bales in warehouse bays and rows.
10. Select a number of bales for dispatch to a processing company.
11. Generate a dispatch reference.
12. Receive processed tobacco back.
13. Demonstrate partial returns and reconciliation.
14. Store returned bales in the processing warehouse.
15. Open an individual bale and view its complete movement history.

Use realistic but clearly identified demonstration data for the subsequent processing activities.

---

# 14. UI/UX Requirements

The current ERP UI is already working and should be treated as the design reference.

Do not introduce generic AI-generated dashboard designs.

The Buyer Portal must have a polished, modern enterprise interface suitable for a commercial tobacco inventory and warehouse management system.

### Design direction

- Preserve existing brand colours and design tokens.
- Use the established typography and spacing system.
- Maintain consistency with existing buttons, tables, forms, dialogs and dropdowns.
- Use well-designed data tables with sorting, filtering and search.
- Use clear status indicators.
- Provide dedicated barcode scanning interfaces.
- Create modern warehouse location visualisations.
- Use responsive layouts.
- Provide meaningful empty, loading, success and error states.
- Use realistic data density rather than oversized empty dashboard cards.
- Avoid unnecessary gradients, generic glassmorphism and default template styling.

Prioritise the usability of operational workflows, especially barcode scanning and receiving.

The receiving and dispatch interfaces should minimise the number of clicks required to process multiple bales.

---

# 15. Technical & Integration Requirements

Before implementation, inspect the existing ERP architecture.

Determine:
- Existing authentication implementation.
- Existing user and organisation models.
- Existing role and permission system.
- Existing inventory structures.
- Existing barcode handling.
- Existing warehouse models.
- Existing document storage.
- Existing API conventions.
- Existing audit log infrastructure.

Reuse existing infrastructure wherever possible.

Do not create duplicate implementations of existing functionality.

### Data integrity requirements

- A barcode must uniquely identify a bale within the appropriate business scope.
- Every bale must be associated with a buyer and purchase.
- A bale cannot be received twice without an authorised correction.
- A bale cannot be dispatched if it is not available in the buyer's warehouse.
- A bale cannot be allocated to two active warehouse locations.
- Dispatch and return operations must be transactional.
- Every stock movement must be auditable.
- Buyers must never access another buyer's data.
- All inventory balances must be calculated from valid inventory events and movements.
- Preserve historical records rather than deleting completed transactions.

Implement proper backend validation. Frontend-only validation is insufficient.

---

# 16. Implementation Instructions

Work in the existing project, not a new standalone demo.

First inspect the current application and identify where the Buyer Portal should integrate.

Then implement the functionality in logical stages:

**Stage 1:** Buyer authentication, company access and dashboard.

**Stage 2:** Flow Disk import, invoice management and purchase manifests.

**Stage 3:** Barcode receiving, validation and reconciliation.

**Stage 4:** Buyer warehouses, bays, rows and inventory movements.

**Stage 5:** Processing companies and tobacco dispatch.

**Stage 6:** Processing returns, reconciliation and processing warehouse inventory.

**Stage 7:** Bale traceability, reports and audit history.

Do not stop at static UI screens. Implement working interactions, API integration, database persistence and realistic demonstration workflows.

Use the supplied sample invoice and generated Flow Disk data to test the complete lifecycle.

Do not break or modify existing internal ERP functionality unnecessarily.

## Definition of Done

The feature is considered complete when an external buyer can independently:

- Log into their buyer portal.
- Import a Flow Disk.
- View their buyer invoice and purchased bales.
- Verify physically received bales by scanning barcodes.
- Reconcile purchased and received tobacco.
- Allocate bales to warehouse bays and rows.
- Move bales between warehouse locations.
- Dispatch tobacco to processing companies.
- Receive processed tobacco back.
- Reconcile returned and outstanding bales.
- Store processed tobacco in processing warehouse locations.
- View the complete history of any bale.
- Generate and export operational reports.

The final result must be a functional, integrated Buyer Portal, not just a visual prototype.
</pasted_content id="1b46">

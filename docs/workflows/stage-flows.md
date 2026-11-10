# Stage Flows

One short flow per manual (mermaid). Failure branches use the verbatim messages (see `docs/research/system-messages.md`).

## 01 Daily Setup
```mermaid
flowchart LR
  S1[Receiving supervisor: new Sale Date - Receiving<br/>Date of Sale · Is Active · Can Scan Floor Summary?] --> S2[Data processing supervisor: Start of Day<br/>Selling Date · Exchange Rate]
  S2 --> D{Rate > 0 and no Draft/Balanced earlier sales?}
  D -- no --> E[MSG-SOD-001 / MSG-SOD-002]
  D -- yes --> P[Post Start of Day → Posted]
```

## 02 TIMB Booking Import
```mermaid
flowchart LR
  F[Original file ELS_…_YYYYMMDD.txt] --> U[Upload → Import Grower Bookings File]
  U --> K{Key found from file name?}
  K -- no --> E1[MSG-TMB-001]
  K -- yes --> R{Growers registered?}
  R -- some unknown --> E2[MSG-TMB-002: import complete with errors → import register → re-import]
  R -- all known --> OK[MSG-TMB-003: N created, N updated, N errors]
```

## 03 Receiving
```mermaid
flowchart LR
  T[Create TDN] --> G[Add growers: no. · location · bales]
  G --> C[Complete → Confirm: GDNs Open]
  C --> B[Capture bales: scale barcode · grower · group · lot]
  B --> Y{Tally = declared?}
  Y -- no --> B
  Y -- yes --> D[Complete Delivery → Tickets Printing]
  B -. error .-> X[Supervisor: Eject Bale using Scale Barcode]
```

## 04 Ticket Printing
```mermaid
flowchart LR
  L[Waiting to Print] --> V{Valid start barcode set?}
  V -- no --> SB[Set Starting Barcode 10 chars]
  V -- yes --> N[Use Next Barcode: group → lot]
  SB --> P[Print Bale Tickets]
  N --> P
  P --> CF[Confirm Ticket Printing → Checked; barcodes locked for season]
  P -. jam .-> I[Interrupted Ticket]
  CF -. supervisor .-> R[Reverse Printing Status]
```

## 05 Floor Summary
```mermaid
flowchart LR
  SP[Selling point → Sale room] --> RW[Type Row] --> SC[Scan ticket barcode → Scan to Summary]
  SC --> V{Valid ticket, delivery Checked, same selling point, scanning on?}
  V -- no --> E[MSG-FLR-001…006]
  V -- yes --> CNT[Scanned N of M]
  CNT --> Z{N = M?}
  Z -- no --> SC
  Z -- yes --> L[Delivery Laid · draft sale + price batch created]
```

## 06 Data Capture and Balancing
```mermaid
flowchart LR
  CL[Classification: TIMB grade · hessian] --> BY[e-Buying: buyer · buyer grade · price cents/kg · sale code]
  BY --> BP[Batch Processing: blind batch price → Post Batch]
  BP --> BS[Balance Sale]
  BS --> CK{Every purchased bale complete and captured price = batch price?}
  CK -- no --> FIX[Fix grade/buyer/price; invalid reason → MSG-DAT-007] --> BS
  CK -- yes --> BAL[Sale has balanced! → Balanced]
```

## 07 Stop Orders and Deductions
```mermaid
flowchart LR
  I[Import stop order file EL_…] --> CHK[Check Grower Creditors → Stop Orders]
  CHK --> RUN[Stop Order Processing by selling point]
  RUN --> G{Rate set? approvals cleared?}
  G -- no --> E[MSG-STO-001 / MSG-STO-002]
  G -- yes --> D[Deduct in order: charges → internal invoices → merchant loans → TIMB invoices → TIMB stop orders]
  D --> PR[Processed + pay batch number]
```

## 08 Grower Payment
```mermaid
flowchart LR
  SS[Sales sheet Report] --> GS[Generate Payment Schedule: date · batch or 0 · currency]
  GS --> BK{Bank details for grower + currency?}
  BK -- no --> EX[Grower excluded]
  BK -- yes --> CSV[Bank CSV 13 columns]
  CSV --> UP[Upload to bank] --> CONF[Record verified confirmation → Paid]
  GS --> CP[Pay with CloudPay (mock: SUBMITTED, nothing sent)] --> CONF
```
Downloading the CSV never marks growers paid.

## 09 Floor Dispatch
```mermaid
flowchart LR
  IN[Initiate Dispatch: warehouse · product · truck · driver] --> SCN[Scan bale tickets: Save Bale / Remove Bale]
  SCN --> V{Released? right warehouse? not RO/RH/CO? not on another note?}
  V -- no --> E[MSG-DSP-001…007]
  V -- yes --> DONE[Done → Draft note]
  DONE --> POST[Post] --> SF[Generate Shipment File (Posted only)]
  DONE -. wrong .-> CAN[Cancel Dispatch (reason)]
```

Sources: Manuals 01–09.

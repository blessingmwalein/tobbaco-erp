# ADR-0005 — Scanner, scale and printer adapters

- **Status:** Accepted
- **Date:** 2026-11-09

## Context
Operations depend on barcode scanners, a scale that sends weights, and ticket printers. The manuals show scanning behaviour only ("Scanning fills the barcode, Tab moves to the next field and Enter saves"); hardware, protocols and printer models are undocumented. The brief forbids claiming hardware is connected when it is not.

## Decision
- Treat scanners as **keyboard-emulating devices** by default. A reusable `BarcodeScannerInput` component provides auto-focus, Enter-to-submit, Tab navigation, duplicate detection (proposed addition), immediate valid/invalid feedback, scan history and counts. Conceptual contract: `<BarcodeScannerInput autoFocus placeholder onScan onInvalid />`.
- Define adapter interfaces `ScannerPort`, `ScalePort`, `PrinterPort` (see `integration-boundaries.md`). Phase 1 mocks: simulated scan (chips, rapid multi-line paste), simulated weigh events keyed by scale barcode, print preview only.
- Every device status in the UI shows an honest badge ("Simulated", "Not connected").
- Real serial/network scanners, Intelliscale scales and printers implement the same ports later.
- Floor workspaces keep focus on the scan field after every scan and give inline feedback instead of modals.

## Consequences
+ UI is hardware-ready from day one; hardware integration is isolated.
− Real devices may require browser APIs (WebSerial/WebUSB) or a local bridge — to be decided when hardware is known.

Sources: Manuals 03, 04, 05; brief Part 7.

# Integration Boundaries

Principle: the ERP core talks only to **ports** (TypeScript interfaces owned by the core); each external provider is an **adapter** behind a port. No core module imports a provider SDK, file layout or device protocol. Phase 1 ships only labelled mock adapters.

```
 ERP core (modules)  ──►  Ports (interfaces)  ──►  Adapters  ──►  External world
 receiving/tickets/…       TimbFilePort             Sample-file adapter (Phase 1)   TIMB files (encrypted; future)
 floor-summary/…           ScalePort                Simulated scale                 Intelliscale scales (future)
                           ScannerPort              Keyboard-wedge + simulator      USB/BT/serial/network scanners
                           PrinterPort              Print preview                   Ticket printers
                           PaymentPort              CloudPay mock                   CloudPay / bank files
                           WarehouseExportPort      CSV generator                   Warehouse systems
```

## Ports (contracts, indicative)
| Port | Methods | Notes |
|---|---|---|
| `TimbFilePort` | `decrypt(file, key) → bytes`, `parse(kind, bytes) → { rows, errors }` for kinds `grower-register`, `creditor-register`, `booking`, `stop-order` | Key chosen by filename prefix (`ELS`/`EL`); idempotent import service sits above the port; Phase 1 sample adapter reads CSV/JSON and labels itself "not real TIMB decryption" |
| `ScalePort` | `onWeigh(handler)`, `lastReading(scaleBarcode) → { barcode, massKg }` | Mass keyed by scale barcode; "Not connected — simulated" |
| `ScannerPort` | `onScan(handler)`, `simulate(code)` | Keyboard-emulating default; duplicate detection in the UI layer |
| `PrinterPort` | `preview(tickets)`, `print(tickets) → PrintResult` | Print audit history; Phase 1 preview only |
| `PaymentPort` | `buildSchedule(lines, currency) → CsvFile`, `submit(schedule) → SubmissionResult`, `confirm(lineId, evidence)` | CSV download never changes paid state; mock submit returns `SUBMITTED (mock — nothing sent)` |
| `WarehouseExportPort` | `buildShipmentFile(dispatchNote) → CsvFile` | Posted notes only |

## Rules for every adapter
1. **Contract-tested**: a shared test suite runs against every implementation of a port.
2. **Idempotent** operations with explicit idempotency keys (file checksum + business key).
3. **Audited**: every call records actor, input reference, result, duration (no secrets).
4. **Errors are data**: parse/validation problems become `ImportRowError` rows; provider outages become retryable failures — never silent success.
5. **Honest labelling**: mock adapters self-identify in UI and logs; a physical device is never shown as connected unless a real adapter reports it.
6. **Secrets outside source** (TIMB keys, CloudPay URL/API key, bank credentials) via environment/secret store; selected per environment.
7. **No long-running in-memory work**: large imports processed in chunks/jobs (Vercel limits; see `deployment-constraints.md`).

## Boundaries between internal modules
- Workflow transitions are performed only by the owning module's service (e.g. `sales.balance()` in `sales`, called by the API controller); the frontend never decides a state.
- Cross-module reads go through exported query services; no cross-module table writes.
- Reports read from read models/views, not from write paths.

Sources: brief Parts 2, 10; Manuals 02, 03, 04, 07, 08, 09.

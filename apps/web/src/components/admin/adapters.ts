/**
 * Adapter registry shown on /admin/devices. Summarises docs/architecture/integration-boundaries.md.
 * Phase 1 ships ONLY labelled mock adapters — nothing here is connected to real hardware, banks or TIMB.
 */
export type AdapterMode = "SIMULATED" | "MOCK" | "SAMPLE FILES" | "CSV GENERATOR" | "PREVIEW ONLY";

export interface AdapterInfo {
  id: string;
  name: string;
  /** Port interface owned by the ERP core. */
  port: string;
  mode: AdapterMode;
  /** One-line honest status. */
  status: string;
  summary: string;
  /** What a real integration needs. */
  needs: string[];
  /** Contract summary (methods and rules). */
  contract: string[];
  /** Secrets/config that must live outside source code. */
  config: Array<{ key: string; note: string }>;
  manual: string;
}

export const ADAPTERS: AdapterInfo[] = [
  {
    id: "scanner",
    name: "Barcode scanner",
    port: "ScannerPort",
    mode: "SIMULATED",
    status: "No physical scanner connected",
    summary: "Most USB/Bluetooth scanners act as keyboards: they type the barcode and press Enter. The demo accepts typed/pasted input and “simulate scan” chips.",
    needs: ["Keyboard-wedge scanners need no driver or adapter.", "Serial or network scanners need a ScannerPort adapter (device protocol, port/IP)."],
    contract: ["onScan(handler) · simulate(code)", "Enter submits, Tab never intercepted, focus returns after each scan", "Duplicate and invalid scans are handled in the UI layer with immediate feedback"],
    config: [{ key: "SCANNER_MODE", note: "wedge | serial | network (future)" }],
    manual: "Manuals 03, 05, 06, 09",
  },
  {
    id: "scale",
    name: "Scale (Intelliscale-style)",
    port: "ScalePort",
    mode: "SIMULATED",
    status: "Not connected — simulated weigh events",
    summary: "The scale gives each bale a scale barcode and mass; receiving looks the mass up by scale barcode (Manual 03). The demo generates weigh events instead.",
    needs: ["Vendor protocol/API for the floor's scales and network access", "A scale registry (the manuals mention an “Intelliscale Scales” menu — undocumented, UQ-11)"],
    contract: ["onWeigh(handler)", "lastReading(scaleBarcode) → { barcode, massKg }", "Mass keyed by scale barcode; never trust a client-supplied mass in Phase 2"],
    config: [{ key: "SCALE_ENDPOINT", note: "address of the scale service (future)" }],
    manual: "Manual 03",
  },
  {
    id: "printer",
    name: "Ticket printer",
    port: "PrinterPort",
    mode: "PREVIEW ONLY",
    status: "Print preview only — nothing is sent to a printer",
    summary: "Tickets render as an on-screen/print-dialog preview. Confirming printing locks the barcodes for the season.",
    needs: ["Printer model and language (e.g. label printer commands or PDF)", "A print service reachable from the API (Vercel functions cannot reach local printers directly)"],
    contract: ["preview(tickets)", "print(tickets) → PrintResult", "Every print/reprint/confirm/reverse is audited"],
    config: [{ key: "PRINTER_TARGET", note: "queue or device name (future)" }],
    manual: "Manual 04",
  },
  {
    id: "payment",
    name: "Payment gateway (CloudPay)",
    port: "PaymentPort",
    mode: "MOCK",
    status: "Mock — nothing is ever sent to a bank",
    summary: "“Pay with CloudPay” in the demo returns SUBMITTED (mock — nothing sent). Growers become Paid only through an explicit, audited confirmation entry.",
    needs: ["CloudPay URL and API key (Manual 08: cloudpay.url / cloudpay.api_key, deliberately not copied to the sandbox)", "Agreed confirmation/callback format and failure handling"],
    contract: ["buildSchedule(lines, currency) → CsvFile", "submit(schedule) → SubmissionResult", "confirm(lineId, evidence)", "Downloading the CSV never marks a grower paid"],
    config: [
      { key: "CLOUDPAY_URL", note: "secret store / environment — never in source" },
      { key: "CLOUDPAY_API_KEY", note: "secret store / environment — never in source" },
    ],
    manual: "Manual 08",
  },
  {
    id: "timb",
    name: "TIMB file import",
    port: "TimbFilePort",
    mode: "SAMPLE FILES",
    status: "Dev sample files only — not real TIMB decryption",
    summary: "Real TIMB files are encrypted; the key is chosen by the file-name prefix (ELS… bookings, EL… stop orders). The demo reads plain-text samples.",
    needs: ["Real decryption keys for each prefix, held outside source code", "The real record layouts (not in the manuals)", "Chunked/idempotent import jobs for Vercel limits"],
    contract: ["decrypt(file, key) → bytes", "parse(kind, bytes) → { rows, errors }", "Idempotent on file checksum + business key; row errors are data, never silent"],
    config: [{ key: "TIMB_KEYS", note: "per-prefix decryption keys (ELS, EL …) — secret store only" }],
    manual: "Manuals 02, 07",
  },
  {
    id: "warehouse",
    name: "Warehouse shipment export",
    port: "WarehouseExportPort",
    mode: "CSV GENERATOR",
    status: "Generates a demo CSV layout — no warehouse system connected",
    summary: "A posted dispatch note produces the shipment file the warehouse receives against. The real columns are not documented (UQ-12).",
    needs: ["The warehouse's required file layout", "Delivery method (download, SFTP, API) and credentials"],
    contract: ["buildShipmentFile(dispatchNote) → CsvFile", "Only for notes in Posted state", "Generation is audited and files are retained"],
    config: [{ key: "WAREHOUSE_EXPORT_TARGET", note: "delivery target (future)" }],
    manual: "Manual 09",
  },
];

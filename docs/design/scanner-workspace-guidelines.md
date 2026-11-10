# Scanner Workspace Guidelines

For all floor workspaces (receiving bale capture, floor summary, data capture, dispatch, ticket start barcode). Scanners are assumed **keyboard-emulating** (type the code, then Enter). Manual 03: "Scanning fills the barcode, Tab moves to the next field and Enter saves, so you never need the mouse."

## Interaction rules
1. **Focus:** the scan field is auto-focused on load and re-focused after every successful or failed scan/save and after closing any popover.
2. **Submit:** Enter submits; scanner suffix Enter is treated as submit. Tab moves to the next field (barcode → grower # → group # → lot # in receiving). Shift+Tab goes back.
3. **Sticky fields:** values the clerk reuses stay filled (grower # at bale capture; Row at floor summary; sale code vs buyer fields as appropriate) — documented behaviour.
4. **Rapid scans:** inputs are queued; processing is sequential and never drops a scan. Pasting multiple lines processes each line (simulation of rapid wedge input).
5. **Feedback within ~100 ms:** valid → green check + short text; invalid → red icon + verbatim message; duplicate → amber icon + "already scanned"; optional beep (toggle in the header, off by default).
6. **No modal per scan.** Confirmation/reason dialogs only for exceptional actions (eject, reverse, cancel, reset).
7. **Counts always visible:** "Scanned N of M" (floor summary), "Bale Tally N of M" + "Delivery Balanced" (receiving), total bales/mass (dispatch), batch progress (data capture).
8. **Last scan panel:** after each scan show last grower, barcode, lot, group (and mass/price as relevant) — documented "Last Bale Details" / "Last Grower".
9. **History:** scrollable recent scans (barcode, result, time, user) with virtualisation for thousands of rows; invalid and duplicate scans listed separately with counts.
10. **Correct barcode type:** the UI states which barcode to scan ("ticket barcode — not the scale label" at floor summary, data capture and dispatch; "scale barcode" at receiving) and rejects the wrong kind with the documented message.
11. **Validation** is per-field, inline, with verbatim messages; a failed field does not block valid fields where the documentation says so (data capture partial save).
12. **Keyboard shortcuts** (proposed): `F2` toggle scan field/filters, `Ctrl+Enter` complete/post, `Esc` clear current field, `Alt+H` history. Shown in a footer legend.

## Component contract (conceptual)
```tsx
<BarcodeScannerInput
  autoFocus
  kind="ticket" // | "scale"
  placeholder="Scan bale ticket barcode..."
  onScan={handleScan}      // (code) => ScanResult
  onInvalid={handleInvalid}
/>
```
Returns a `ScanResult { code, status: 'ok'|'invalid'|'duplicate', message, record? }`; the host workspace owns domain logic via service hooks.

## Phase 1 simulation
- `ScanSimulator`: chips with the day's expected barcodes (scale or ticket) — click to inject; "paste many" box; deliberate bad/duplicate examples for demos.
- Mock scale emits weigh events (scale barcode + mass); badge "Not connected — simulated".
- Printer: print preview only.
Never imply hardware is connected.

## Accessibility
Labels on every field, `aria-live="polite"` for scan results (assertive for errors), colour never the only signal, large touch/click targets, visible focus, respects reduced motion, readable at arm's length (≥ 16 px; scan field 28–36 px).

## Test cases to cover
Wrong barcode kind, blank/short barcode, duplicate scan, scan after completion, scan during scanning-off, 50 scans in 5 seconds, keyboard-only completion of a whole delivery, focus after dialog close.

Sources: Manuals 03, 05, 06, 09; brief Part 7.

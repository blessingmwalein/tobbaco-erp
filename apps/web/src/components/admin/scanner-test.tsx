"use client";

import { useCallback, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { BarcodeScannerInput, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, ScanHistory, type ScanHistoryEntry, type ScanOutcome } from "@tobacco/ui";
import { checkTicketBarcode, isValidScaleBarcode } from "@tobacco/shared";
import { useUi } from "@/lib/ui-store";

function describe(value: string): string {
  const t = checkTicketBarcode(value);
  if (t.valid) return `${value.length} characters · valid ticket barcode (10 chars, check character OK — algorithm unverified)`;
  if (isValidScaleBarcode(value)) return `${value.length} characters · looks like a scale barcode`;
  return `${value.length} characters received as keyboard input`;
}

/** Proves keyboard-wedge handling (Enter submits, rapid scans queue, paste of several lines works). No hardware is involved. */
export function ScannerTest() {
  const sound = useUi((s) => s.sound);
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);

  const onScan = useCallback((value: string): ScanOutcome => {
    const message = describe(value);
    setEntries((e) => [{ id: `t-${Date.now()}-${e.length}`, value, ok: true, message, at: new Date().toLocaleTimeString("en-GB") }, ...e].slice(0, 20));
    return { ok: true, message };
  }, []);

  return (
    <Card data-testid="scanner-test">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <ScanBarcode className="size-4 text-primary" aria-hidden /> Scanner test
          </CardTitle>
          <CardDescription>Check how a keyboard-wedge scanner would behave in the floor workspaces.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Callout tone="warning" title="No physical scanner is connected">
          A USB or Bluetooth scanner that emulates a keyboard would type a barcode here and press Enter. In this demo, type or paste a code and press Enter to
          simulate it. Pasting several lines at once simulates a burst of rapid scans — none are dropped.
        </Callout>
        <BarcodeScannerInput size="lg" label="Scanner test field" placeholder="Type or paste a barcode, then Enter…" autoFocus={false} sound={sound} onScan={onScan} data-testid="scanner-test-input" />
        <ScanHistory entries={entries} emptyLabel="Nothing received yet" />
      </CardContent>
    </Card>
  );
}

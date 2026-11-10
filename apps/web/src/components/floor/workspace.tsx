"use client";

import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { Eraser, ScanBarcode } from "lucide-react";
import {
  BarcodeScannerInput,
  Button,
  Card,
  ProgressBar,
  ScanHistory,
  cn,
  type BarcodeScannerInputProps,
  type ScanController,
  type ScanOutcome,
} from "@tobacco/ui";
import { useUi } from "@/lib/ui-store";

/**
 * Shared building blocks for the floor workspaces (receiving, tickets, floor summary, data capture, dispatch).
 * Design rules (docs/design/scanner-workspace-guidelines.md): big fields, keyboard first, focus returns after each scan,
 * immediate inline feedback, no modal per scan, running counts, visible history, honest "simulated" labelling.
 */

/** Title row for a floor workspace: what am I doing, for whom, and the actions. */
export function WorkspaceHeader({
  title,
  subtitle,
  chips,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {chips}
        </div>
        {subtitle ? <p className="mt-1 text-base text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Big "N of M" tally with a progress bar (bale tally, scanned count, ticket count…). */
export function TallyCard({
  label,
  value,
  total,
  doneLabel = "Complete",
  className,
}: {
  label: string;
  value: number;
  total: number;
  doneLabel?: string;
  className?: string;
}) {
  const done = total > 0 && value === total;
  const over = value > total;
  return (
    <Card className={cn("flex flex-col gap-3 p-5", done && "border-success-text/30", over && "border-danger/40", className)} data-testid="tally-card">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {done ? <span className="rounded-full bg-success px-2.5 py-0.5 text-xs font-semibold text-success-foreground">{doneLabel}</span> : null}
        {over ? <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger-text">Over declared</span> : null}
      </div>
      <p className="tabular text-5xl font-semibold leading-none tracking-tight" aria-live="polite">
        {value} <span className="text-2xl font-medium text-muted-foreground">of {total}</span>
      </p>
      <ProgressBar value={Math.min(value, total)} max={total} tone={over ? "danger" : done ? "success" : "primary"} label={label} />
    </Card>
  );
}

/** Shared scan-history feed (per workspace scope) + helper that records every scan outcome. */
export function useScanFeed(scope: string) {
  const entries = useUi((s) => s.scanHistory[scope]);
  const push = useUi((s) => s.pushScan);
  const clear = useUi((s) => s.clearScans);
  const sound = useUi((s) => s.sound);

  /** Wrap a scan handler so its outcome is recorded in the history. */
  const track = useCallback(
    (handler: (value: string) => ScanOutcome | Promise<ScanOutcome>) =>
      async (value: string): Promise<ScanOutcome> => {
        const outcome = await handler(value);
        push(scope, { value, ok: outcome.ok, message: outcome.message });
        return outcome;
      },
    [push, scope],
  );

  return useMemo(
    () => ({
      entries: entries ?? [],
      track,
      clear: () => clear(scope),
      sound,
      accepted: (entries ?? []).filter((e) => e.ok).length,
      rejected: (entries ?? []).filter((e) => !e.ok).length,
    }),
    [entries, track, clear, scope, sound],
  );
}

/**
 * "Simulate scan" chips: since no physical scanner is connected in the demo, click a barcode to inject it exactly
 * as a keyboard-wedge scanner would (through the same handler). Clearly labelled as simulation.
 */
export function SimulateScan({
  barcodes,
  onScan,
  label = "Simulate scan",
  max = 12,
  disabled,
}: {
  barcodes: Array<{ value: string; hint?: string }>;
  onScan: (value: string) => void | Promise<unknown>;
  label?: string;
  max?: number;
  disabled?: boolean;
}) {
  if (barcodes.length === 0) return null;
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface-secondary p-3" data-testid="simulate-scan">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ScanBarcode className="size-3.5" aria-hidden /> {label} <span className="font-normal">(no scanner connected — demo only)</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {barcodes.slice(0, max).map((b) => (
          <button
            key={b.value}
            type="button"
            disabled={disabled}
            onClick={() => void onScan(b.value)}
            title={b.hint}
            className="rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-xs transition-colors hover:border-primary hover:bg-primary-soft disabled:opacity-50"
          >
            {b.value}
          </button>
        ))}
        {barcodes.length > max ? <span className="self-center text-xs text-muted-foreground">+{barcodes.length - max} more</span> : null}
      </div>
    </div>
  );
}

/** Scanner field + simulate chips + history in one standard layout. */
export function ScanPanel({
  scope,
  onScan,
  simulate,
  placeholder,
  label,
  submitLabel,
  validate,
  disabled,
  size,
  extra,
  historyClassName,
}: {
  scope: string;
  onScan: BarcodeScannerInputProps["onScan"];
  simulate?: Array<{ value: string; hint?: string }>;
  placeholder?: string;
  label?: string;
  submitLabel?: string;
  validate?: BarcodeScannerInputProps["validate"];
  disabled?: boolean;
  size?: BarcodeScannerInputProps["size"];
  /** Extra fields rendered above the scanner (e.g. the row number). */
  extra?: ReactNode;
  historyClassName?: string;
}) {
  const feed = useScanFeed(scope);
  const handler = useMemo(() => feed.track(async (v) => (await onScan(v)) ?? { ok: true }), [feed, onScan]);
  const controller = useRef<ScanController>(null);

  return (
    <div className="flex flex-col gap-4">
      {extra}
      <BarcodeScannerInput
        label={label}
        placeholder={placeholder}
        submitLabel={submitLabel}
        validate={validate}
        disabled={disabled}
        size={size}
        sound={feed.sound}
        onScan={handler}
        controllerRef={controller}
      />
      {/* Chips go through the scanner itself, so queueing, inline feedback and refocus behave exactly like a real scan. */}
      {simulate ? <SimulateScan barcodes={simulate} onScan={(v) => controller.current?.scan(v)} disabled={disabled} /> : null}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {feed.accepted} accepted · {feed.rejected} rejected this session
        </p>
        <Button variant="ghost" size="sm" onClick={feed.clear} disabled={feed.entries.length === 0}>
          <Eraser /> Clear history
        </Button>
      </div>
      <ScanHistory entries={feed.entries} className={historyClassName} />
    </div>
  );
}

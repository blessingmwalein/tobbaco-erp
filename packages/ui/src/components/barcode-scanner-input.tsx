"use client";

import * as React from "react";
import { CheckCircle2, ScanBarcode, XCircle } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { Input } from "./form";

/**
 * Reusable scanner input.
 *
 * Most USB/Bluetooth scanners are keyboard-wedge devices: they type the barcode quickly and finish with Enter.
 * This component therefore: auto-focuses, submits on Enter, never intercepts Tab (so Tab can move between fields),
 * queues rapid consecutive scans (none are dropped), accepts multi-line paste (simulated bursts), refocuses after
 * every scan, and announces results to assistive tech. It does NOT claim any hardware is connected — that is the
 * job of a scanner adapter (see docs/architecture/integration-boundaries.md).
 */
export interface ScanOutcome {
  ok: boolean;
  message?: string;
}

/** Imperative handle: lets "simulate scan" chips inject a value through the exact same pipeline as a real scan. */
export interface ScanController {
  scan: (value: string) => void;
  focus: () => void;
}

export interface BarcodeScannerInputProps {
  /** Receives a handle to inject scans programmatically (used by simulate-scan chips). */
  controllerRef?: React.Ref<ScanController>;
  onScan: (value: string) => ScanOutcome | void | Promise<ScanOutcome | void>;
  /** Return a reason to reject the value before `onScan` is called. */
  validate?: (value: string) => string | null;
  onInvalid?: (value: string, reason: string) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  size?: "md" | "lg" | "xl";
  /** Refocus the field after each scan (default true). */
  refocus?: boolean;
  /** Short beep on success / error (default false). */
  sound?: boolean;
  /** Show the last-scan banner (default true). */
  feedback?: boolean;
  /** Render an explicit submit button with this label. */
  submitLabel?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

interface LastFeedback {
  ok: boolean;
  value: string;
  message?: string;
  key: number;
}

let audioCtx: AudioContext | null = null;
function beep(kind: "ok" | "error") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = kind === "ok" ? 880 : 220;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + (kind === "ok" ? 0.08 : 0.25));
  } catch {
    /* audio is optional */
  }
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

export function ScanFeedback({ feedback, className }: { feedback: LastFeedback | null; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic className={cn("min-h-[3.25rem]", className)} data-testid="scan-feedback">
      {feedback ? (
        <div
          key={feedback.key}
          data-result={feedback.ok ? "ok" : "error"}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm animate-in fade-in-0 slide-in-from-top-1",
            feedback.ok
              ? "border-success-text/25 bg-success-soft text-success-text"
              : "border-danger/30 bg-danger-soft text-danger-text",
          )}
        >
          {feedback.ok ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : <XCircle className="size-5 shrink-0" aria-hidden />}
          <span className="font-mono text-[13px] font-semibold">{feedback.value}</span>
          {feedback.message ? <span className="min-w-0 flex-1 truncate font-medium">{feedback.message}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function BarcodeScannerInput({
  onScan,
  validate,
  onInvalid,
  placeholder = "Scan barcode…",
  label,
  autoFocus = true,
  disabled,
  size = "xl",
  refocus = true,
  sound = false,
  feedback: showFeedback = true,
  submitLabel,
  inputRef,
  controllerRef,
  id,
  name,
  className,
  ...rest
}: BarcodeScannerInputProps) {
  const innerRef = React.useRef<HTMLInputElement>(null);
  const queueRef = React.useRef<Promise<void>>(Promise.resolve());
  const keyRef = React.useRef(0);
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(0);
  const [last, setLast] = React.useState<LastFeedback | null>(null);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  const focus = React.useCallback(() => {
    if (!refocus) return;
    // After state flush so the cleared field is focused (works with rapid scans).
    requestAnimationFrame(() => innerRef.current?.focus());
  }, [refocus]);

  const runOne = React.useCallback(
    async (raw: string) => {
      const v = raw.trim();
      if (!v) return;
      const reason = validate?.(v) ?? null;
      if (reason) {
        setLast({ ok: false, value: v, message: reason, key: ++keyRef.current });
        onInvalid?.(v, reason);
        if (sound) beep("error");
        return;
      }
      try {
        const out = await onScan(v);
        const ok = out ? out.ok : true;
        setLast({ ok, value: v, message: out?.message, key: ++keyRef.current });
        if (sound) beep(ok ? "ok" : "error");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Scan failed";
        setLast({ ok: false, value: v, message, key: ++keyRef.current });
        if (sound) beep("error");
      }
    },
    [onScan, validate, onInvalid, sound],
  );

  const enqueue = React.useCallback(
    (values: string[]) => {
      const clean = values.map((s) => s.trim()).filter(Boolean);
      if (clean.length === 0) return;
      setPending((p) => p + clean.length);
      for (const v of clean) {
        queueRef.current = queueRef.current
          .then(() => runOne(v))
          .finally(() => setPending((p) => Math.max(0, p - 1)));
      }
    },
    [runOne],
  );

  React.useImperativeHandle(
    controllerRef,
    () => ({
      scan: (v: string) => {
        enqueue([v]);
        focus();
      },
      focus: () => innerRef.current?.focus(),
    }),
    [enqueue, focus],
  );

  const submit = () => {
    const v = value;
    setValue("");
    enqueue([v]);
    focus();
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ScanBarcode className="size-4 text-primary" aria-hidden />
          {label}
        </label>
      ) : null}
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <Input
            id={inputId}
            name={name}
            ref={mergeRefs(innerRef, inputRef)}
            size={size}
            value={value}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            disabled={disabled}
            placeholder={placeholder}
            aria-label={rest["aria-label"] ?? (label ? undefined : placeholder)}
            data-testid={rest["data-testid"] ?? "scanner-input"}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (/[\r\n]/.test(text)) {
                e.preventDefault();
                enqueue(text.split(/[\r\n]+/));
                setValue("");
                focus();
              }
            }}
          />
          {pending > 0 ? (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden>
              {pending} queued
            </span>
          ) : null}
        </div>
        {submitLabel ? (
          <Button size={size === "xl" ? "xl" : size === "lg" ? "lg" : "md"} onClick={submit} disabled={disabled} className="self-stretch">
            {submitLabel}
          </Button>
        ) : null}
      </div>
      {showFeedback ? <ScanFeedback feedback={last} /> : null}
    </div>
  );
}

export interface ScanHistoryEntry {
  id: string;
  value: string;
  ok: boolean;
  message?: string;
  at: string;
}

export function ScanHistory({
  entries,
  className,
  max = 50,
  emptyLabel = "No scans yet",
}: {
  entries: ScanHistoryEntry[];
  className?: string;
  max?: number;
  emptyLabel?: string;
}) {
  const okCount = entries.filter((e) => e.ok).length;
  const failCount = entries.length - okCount;
  return (
    <div className={cn("flex flex-col rounded-2xl border border-border bg-surface", className)} data-testid="scan-history">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Scan history</p>
        <p className="tabular text-xs text-muted-foreground">
          <span className="font-medium text-success-text">{okCount} ok</span>
          {" · "}
          <span className={cn("font-medium", failCount ? "text-danger-text" : "")}>{failCount} rejected</span>
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {entries.slice(0, max).map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              {e.ok ? (
                <CheckCircle2 className="size-4 shrink-0 text-success-text" aria-label="accepted" />
              ) : (
                <XCircle className="size-4 shrink-0 text-danger-text" aria-label="rejected" />
              )}
              <span className="font-mono text-[13px]">{e.value}</span>
              <span className={cn("min-w-0 flex-1 truncate text-xs", e.ok ? "text-muted-foreground" : "text-danger-text")}>
                {e.message}
              </span>
              <time className="tabular shrink-0 text-xs text-muted-foreground">{e.at}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

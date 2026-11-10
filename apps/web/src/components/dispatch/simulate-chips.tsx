"use client";

import { ScanBarcode } from "lucide-react";
import { cn } from "@tobacco/ui";
import type { DispatchCandidate } from "@/mock/domain/dispatch";

/** A ticket that is not in the system at all — lets reviewers try the "Cannot find the bale" message. */
const UNKNOWN_TICKET = "1000009999";

/**
 * "Simulate scan" chips for dispatch. Each chip injects a barcode through the SAME handler a keyboard-wedge scanner
 * would use. Chips are split by what THIS note would do, so reviewers can try the four documented refusal rules:
 * sale not released, wrong warehouse, rejected sale code (RO/RH/CO), already on a dispatch note.
 */
export function DispatchSimulateChips({
  candidates,
  onScan,
  disabled,
  max = 12,
}: {
  candidates: DispatchCandidate[];
  onScan: (value: string) => void | Promise<unknown>;
  disabled?: boolean;
  max?: number;
}) {
  const accepted = candidates.filter((c) => c.ok);
  const refused = candidates.filter((c) => !c.ok);

  const chip = (c: { barcode: string; hint?: string }, tone: "ok" | "refused") => (
    <button
      key={c.barcode}
      type="button"
      disabled={disabled}
      onClick={() => void onScan(c.barcode)}
      title={c.hint}
      data-testid={`chip-${c.barcode}`}
      className={cn(
        "rounded-lg border bg-surface px-2.5 py-1 font-mono text-xs transition-colors disabled:opacity-50",
        tone === "ok" ? "border-border hover:border-primary hover:bg-primary-soft" : "border-danger/40 text-danger-text hover:bg-danger-soft",
      )}
    >
      {c.barcode}
    </button>
  );

  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface-secondary p-3" data-testid="simulate-scan">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ScanBarcode className="size-3.5" aria-hidden /> Simulate scan <span className="font-normal">(no scanner connected — demo only)</span>
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-success-text">Would be accepted by this note ({accepted.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {accepted.length === 0 ? <span className="text-xs text-muted-foreground">None left to load for this destination.</span> : null}
            {accepted.slice(0, max).map((c) => chip({ barcode: c.barcode, hint: `${c.growerNo} — accepted` }, "ok"))}
            {accepted.length > max ? <span className="self-center text-xs text-muted-foreground">+{accepted.length - max} more</span> : null}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-danger-text">Would be refused — try them to see the message ({refused.length + 1})</p>
          <div className="flex flex-wrap gap-1.5">
            {refused.slice(0, max).map((c) => chip({ barcode: c.barcode, hint: c.reason }, "refused"))}
            {refused.length > max ? <span className="self-center text-xs text-muted-foreground">+{refused.length - max} more</span> : null}
            {chip({ barcode: UNKNOWN_TICKET, hint: "Not a ticket in the system" }, "refused")}
          </div>
        </div>
      </div>
    </div>
  );
}

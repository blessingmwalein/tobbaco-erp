import { Check } from "lucide-react";
import { cn } from "@tobacco/ui";
import type { SaleState } from "@tobacco/shared";

const STEPS: Array<{ id: SaleState; label: string }> = [
  { id: "DRAFT", label: "Draft" },
  { id: "BALANCED", label: "Balanced" },
  { id: "PROCESSED", label: "Processed" },
];

/** Sale status bar: Draft · Balanced · Processed (the manual's status bar also shows "Posted" — UQ-02, not modelled). */
export function SaleStatusBar({ status }: { status: SaleState }) {
  const idx = STEPS.findIndex((s) => s.id === status);
  return (
    <ol className="flex items-center gap-2" aria-label="Sale status" data-testid="sale-status-bar" data-status={status}>
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.id} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                active && s.id === "DRAFT" && "bg-danger-soft text-danger-text",
                active && s.id === "BALANCED" && "bg-warning-soft text-warning-text",
                active && s.id === "PROCESSED" && "bg-success-soft text-success-text",
                done && "bg-surface-tertiary text-foreground",
                !done && !active && "text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : null}
              {s.label}
            </span>
            {i < STEPS.length - 1 ? <span className="h-px w-6 bg-border-strong" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

import { Check } from "lucide-react";
import { cn } from "@tobacco/ui";
import { DELIVERY_NOTE_STATES, DELIVERY_NOTE_STATE_LABEL, type DeliveryNoteState } from "@tobacco/shared";

/**
 * Open · Tickets Printing · Checked · Laid — the grower delivery note's documented states.
 * (The manuals' status bar also shows "Laying"; whether it is a real state is unresolved, UQ-02 — not modelled.)
 */
export function DeliveryStatusBar({ state, className }: { state: DeliveryNoteState; className?: string }) {
  const current = DELIVERY_NOTE_STATES.indexOf(state);
  return (
    <ol className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Delivery note status" data-testid="delivery-status-bar" data-state={state}>
      {DELIVERY_NOTE_STATES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={s}
            aria-current={active ? "step" : undefined}
            data-active={active || undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              active ? "bg-primary text-primary-foreground" : done ? "bg-success-soft text-success-text" : "bg-surface-tertiary text-muted-foreground",
            )}
          >
            {done ? <Check className="size-3" aria-hidden /> : null}
            {DELIVERY_NOTE_STATE_LABEL[s]}
          </li>
        );
      })}
    </ol>
  );
}

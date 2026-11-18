"use client";

import * as React from "react";
import { CalendarDays, X } from "lucide-react";
import { cn } from "../lib/cn";
import { formatPickerDate, parseIsoDate, toIsoDate, type IsoDate } from "../lib/date";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/** Trigger styling shared with `Input` so pickers sit comfortably next to other filter controls. */
export const pickerTriggerClass =
  "flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-border-strong bg-surface px-3 text-left text-sm text-foreground transition-colors hover:bg-surface-secondary focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary/30 disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-muted-foreground aria-[invalid=true]:border-danger data-[size=sm]:h-8 data-[size=sm]:rounded-lg data-[size=sm]:px-2.5 data-[size=sm]:text-xs";

export interface DatePickerProps {
  /** "yyyy-mm-dd", or "" / undefined for no date. */
  value?: IsoDate | null;
  /** Called with "yyyy-mm-dd", or "" when cleared. */
  onChange: (value: IsoDate) => void;
  placeholder?: string;
  /** Earliest / latest selectable day ("yyyy-mm-dd"). */
  min?: IsoDate;
  max?: IsoDate;
  disabled?: boolean;
  clearable?: boolean;
  id?: string;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "data-testid"?: string;
}

/** Single-date picker: a popover calendar (shadcn style). Replaces the browser's native date input. */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  min,
  max,
  disabled,
  clearable = true,
  id,
  size = "md",
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "data-testid": testId,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseIsoDate(value);
  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);
  const label = formatPickerDate(value);

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel ? `${ariaLabel}: ${label || placeholder}` : undefined}
            aria-invalid={ariaInvalid}
            data-size={size}
            data-testid={testId}
            className={cn(pickerTriggerClass, clearable && selected && "pr-9")}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className={cn("tabular truncate", !label && "text-muted-foreground")}>{label || placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? maxDate ?? undefined}
            onSelect={(date) => {
              onChange(date ? toIsoDate(date) : "");
              setOpen(false);
            }}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {clearable && selected && !disabled ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={ariaLabel ? `Clear ${ariaLabel}` : "Clear date"}
          className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-tertiary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

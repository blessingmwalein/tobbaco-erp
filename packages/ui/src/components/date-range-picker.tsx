"use client";

import * as React from "react";
import { CalendarDays, X } from "lucide-react";
import { cn } from "../lib/cn";
import {
  DEFAULT_RANGE_PRESETS,
  formatPickerRange,
  nextRange,
  parseIsoDate,
  toIsoDate,
  type IsoDateRange,
  type RangePreset,
} from "../lib/date";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { pickerTriggerClass } from "./date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DateRangePickerProps {
  /** `{ from, to }` as "yyyy-mm-dd" strings; either may be missing. */
  value: IsoDateRange;
  onChange: (value: IsoDateRange) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** Quick ranges (Today, Last 7 days, This month …). Pass `false` to hide, or your own list. */
  presets?: boolean | RangePreset[];
  id?: string;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

/** Shows two months from `md` up and one on phones. */
function useTwoMonths(): boolean {
  const [wide, setWide] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

/**
 * Date-range picker (shadcn style): one control for "from – to". Click a start day then an end day; the range is
 * only committed once both ends are chosen (or a preset / Clear is used), so filters never flicker half-set.
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Any date",
  min,
  max,
  disabled,
  clearable = true,
  presets = true,
  id,
  size = "md",
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<IsoDateRange>(value);
  const twoMonths = useTwoMonths();
  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);
  const list = presets === false ? [] : presets === true ? DEFAULT_RANGE_PRESETS : presets;
  const hasValue = Boolean(value.from || value.to);

  const commit = (range: IsoDateRange) => {
    onChange(range);
    setOpen(false);
  };

  const shown = open ? draft : value;
  const selected = { from: parseIsoDate(shown.from), to: parseIsoDate(shown.to) };

  return (
    <div className={cn("relative", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(value); // start from what is applied
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            // the accessible name must CONTAIN the visible text (WCAG 2.5.3), so it is "<label>: <what is shown>"
            aria-label={ariaLabel ? `${ariaLabel}: ${formatPickerRange(value, placeholder)}` : undefined}
            data-size={size}
            data-testid={testId}
            className={cn(pickerTriggerClass, clearable && hasValue && "pr-9")}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className={cn("tabular truncate", !hasValue && "text-muted-foreground")}>{formatPickerRange(value, placeholder)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1.5rem)] p-0">
          <div className="flex flex-col md:flex-row">
            {list.length ? (
              <ul aria-label="Quick ranges" className="flex flex-row flex-wrap gap-1 border-b border-border p-2 md:w-40 md:flex-col md:flex-nowrap md:border-b-0 md:border-r">
                {list.map((preset) => (
                  <li key={preset.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start font-normal"
                      data-testid={`range-preset-${preset.id}`}
                      onClick={() => {
                        const r = preset.range(new Date());
                        commit({ from: toIsoDate(r.from), to: toIsoDate(r.to) });
                      }}
                    >
                      {preset.label}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div>
              <Calendar
                mode="range"
                numberOfMonths={twoMonths ? 2 : 1}
                selected={selected}
                defaultMonth={selected.from ?? maxDate ?? undefined}
                // our own two-click logic (see nextRange): the first click only starts a range
                onDayClick={(day) => {
                  const next = nextRange(draft, toIsoDate(day));
                  setDraft(next);
                  if (next.from && next.to) commit(next);
                }}
                disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
                autoFocus
              />
              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                <span className="tabular text-xs text-muted-foreground" aria-live="polite">
                  {draft.from && !draft.to ? "Now pick the end date" : "Pick a start date, then an end date"}
                </span>
                <Button type="button" variant="ghost" size="sm" data-testid="range-clear" onClick={() => commit({})}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {clearable && hasValue && !disabled ? (
        <button
          type="button"
          onClick={() => onChange({})}
          aria-label={ariaLabel ? `Clear ${ariaLabel}` : "Clear date range"}
          className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-tertiary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

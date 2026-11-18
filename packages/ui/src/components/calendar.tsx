"use client";

import * as React from "react";
import { DayPicker, getDefaultClassNames, type DayButtonProps, type DayPickerProps } from "react-day-picker";
import { enGB } from "react-day-picker/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button";

export type CalendarProps = DayPickerProps;

/** One day cell. Selection state is exposed as data attributes so Tailwind can style single / range ends / range middle. */
function CalendarDayButton({ className, day, modifiers, ...props }: DayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      type="button"
      data-today={modifiers.today || undefined}
      data-outside={modifiers.outside || undefined}
      data-selected-single={(modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle) || undefined}
      data-range-start={modifiers.range_start || undefined}
      data-range-end={modifiers.range_end || undefined}
      data-range-middle={modifiers.range_middle || undefined}
      className={cn(
        "tabular inline-flex size-9 items-center justify-center rounded-xl text-sm font-normal transition-colors",
        "hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40",
        "data-[today]:font-semibold data-[today]:text-primary data-[outside]:text-muted-foreground/60",
        "data-[selected-single]:bg-primary data-[selected-single]:text-primary-foreground data-[selected-single]:hover:bg-primary-hover",
        "data-[range-start]:bg-primary data-[range-start]:text-primary-foreground data-[range-start]:hover:bg-primary-hover",
        "data-[range-end]:bg-primary data-[range-end]:text-primary-foreground data-[range-end]:hover:bg-primary-hover",
        "data-[range-middle]:rounded-none data-[range-middle]:bg-transparent data-[range-middle]:text-primary-soft-foreground data-[range-middle]:hover:bg-primary/15",
        className,
      )}
      {...props}
    />
  );
}

/**
 * shadcn-style calendar (react-day-picker v9) wearing the design-system tokens.
 * Weeks start on Monday and month/day names are en-GB. Prefer `DatePicker` / `DateRangePicker` in screens.
 */
export function Calendar({ className, classNames, showOutsideDays = true, components, ...props }: CalendarProps) {
  const defaults = getDefaultClassNames();
  return (
    <DayPicker
      locale={enGB}
      weekStartsOn={1}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4 sm:flex-row", defaults.months),
        month: cn("flex w-full flex-col gap-3", defaults.month),
        nav: cn("absolute inset-x-0 top-0 flex h-8 w-full items-center justify-between", defaults.nav),
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "p-0 aria-disabled:opacity-40", defaults.button_previous),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "p-0 aria-disabled:opacity-40", defaults.button_next),
        month_caption: cn("flex h-8 items-center justify-center", defaults.month_caption),
        caption_label: cn("text-sm font-semibold", defaults.caption_label),
        month_grid: "w-full border-collapse",
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn("w-9 select-none text-center text-xs font-medium text-muted-foreground", defaults.weekday),
        week: cn("mt-1 flex w-full", defaults.week),
        day: cn("relative size-9 select-none p-0 text-center", defaults.day),
        range_start: cn("rounded-l-xl bg-primary-soft", defaults.range_start),
        range_middle: cn("bg-primary-soft", defaults.range_middle),
        range_end: cn("rounded-r-xl bg-primary-soft", defaults.range_end),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", chevronClass)} />
          ) : (
            <ChevronRight className={cn("size-4", chevronClass)} />
          ),
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

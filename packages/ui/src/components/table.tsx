import * as React from "react";
import { cn } from "../lib/cn";

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    // Focusable so keyboard users can scroll wide tables (WCAG 2.1.1 / axe scrollable-region-focusable).
    <div
      data-slot="table-container"
      tabIndex={0}
      role="region"
      aria-label={props["aria-label"] ? `${props["aria-label"]} (scrollable)` : "Scrollable table"}
      className="relative w-full overflow-x-auto focus-visible:outline-offset-[-2px]"
    >
      <table data-slot="table" className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-surface-secondary [&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-border transition-colors data-[state=selected]:bg-primary-soft/60", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-muted-foreground first:pl-5 last:pr-5",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td className={cn("px-3 py-2.5 align-middle first:pl-5 last:pr-5", className)} {...props} />
  );
}

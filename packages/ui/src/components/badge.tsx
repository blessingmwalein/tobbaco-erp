import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-5",
  {
    variants: {
      tone: {
        neutral: "bg-surface-tertiary text-foreground",
        primary: "bg-primary-soft text-primary-soft-foreground",
        success: "bg-success-soft text-success-text",
        warning: "bg-warning-soft text-warning-text",
        danger: "bg-danger-soft text-danger-text",
        dark: "bg-neutral-dark text-neutral-dark-foreground",
        outline: "border border-border-strong bg-surface text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const dotColor: Record<string, string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
  success: "bg-success ring-1 ring-success-text/40",
  warning: "bg-warning",
  danger: "bg-danger",
  dark: "bg-neutral-dark-foreground",
  outline: "bg-muted-foreground",
};

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", dotColor[tone ?? "neutral"])} /> : null}
      {children}
    </span>
  );
}

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

/** Marks records that are NOT in the e-Port manuals. */
export function DemoBadge({ className, children = "DEMO" }: { className?: string; children?: React.ReactNode }) {
  return (
    <span
      title="Demo data — not taken from the e-Port manuals"
      className={cn(
        "inline-flex items-center rounded-md border border-dashed border-warning-text/50 bg-warning-soft px-1.5 py-px text-[10px] font-semibold tracking-wide text-warning-text",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Marks behaviour/values the manuals do not confirm (see unresolved-business-questions.md). */
export function UnverifiedBadge({ className, uq }: { className?: string; uq?: string }) {
  return (
    <span
      title="Unverified — the manuals do not document this. See docs/research/unresolved-business-questions.md"
      className={cn(
        "inline-flex items-center rounded-md border border-border-strong bg-surface-secondary px-1.5 py-px text-[10px] font-semibold tracking-wide text-muted-foreground",
        className,
      )}
    >
      UNVERIFIED{uq ? ` · ${uq}` : ""}
    </span>
  );
}

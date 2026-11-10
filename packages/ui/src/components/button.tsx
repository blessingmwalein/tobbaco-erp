"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";
import { Tooltip } from "./popover";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "border border-border-strong bg-surface text-foreground hover:bg-surface-secondary",
        subtle: "bg-surface-tertiary text-foreground hover:bg-border",
        ghost: "text-foreground hover:bg-surface-tertiary",
        danger: "bg-danger text-danger-foreground hover:bg-[#c93a3f]",
        success: "bg-success text-success-foreground hover:brightness-95",
        dark: "bg-neutral-dark text-neutral-dark-foreground hover:bg-black",
        link: "h-auto rounded-md px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        xl: "h-16 rounded-2xl px-8 text-lg [&_svg]:size-5",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** When the button is disabled because of permissions/prerequisites, explain why on hover/focus. */
  disabledReason?: string;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  disabledReason,
  children,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const isDisabled = disabled || loading;
  const button = (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {children}
        </>
      )}
    </Comp>
  );
  if (isDisabled && disabledReason) {
    return (
      <Tooltip content={disabledReason}>
        <span tabIndex={0} className="inline-flex" data-testid="disabled-reason">
          {button}
        </span>
      </Tooltip>
    );
  }
  return button;
}

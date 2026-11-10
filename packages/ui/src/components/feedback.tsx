import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-surface-tertiary", className)} {...props} />;
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn("size-4 animate-spin text-muted-foreground", className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center justify-center gap-2 px-6 py-14 text-center", className)}
    >
      {Icon ? (
        <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-surface-tertiary text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger-text">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

const calloutStyles = {
  info: { icon: Info, box: "border-primary/20 bg-primary-soft text-primary-soft-foreground" },
  success: { icon: CheckCircle2, box: "border-success-text/25 bg-success-soft text-success-text" },
  warning: { icon: AlertTriangle, box: "border-warning/40 bg-warning-soft text-warning-text" },
  danger: { icon: AlertCircle, box: "border-danger/30 bg-danger-soft text-danger-text" },
} as const;

/** Inline message block: explanations, validation summaries, "simulated" notices. */
export function Callout({
  tone = "info",
  title,
  children,
  className,
  action,
  ...rest
}: {
  tone?: keyof typeof calloutStyles;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
} & Omit<React.ComponentProps<"div">, "title" | "children" | "className">) {
  const { icon: Icon, box } = calloutStyles[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", box, className)}
      {...rest}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "text-[13px] leading-5")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Linear progress / tally bar. `value` and `max` are counts. */
export function ProgressBar({
  value,
  max,
  tone = "primary",
  className,
  label,
}: {
  value: number;
  max: number;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
  label?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const fill = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-tertiary", className)}
    >
      <div className={cn("h-full rounded-full transition-all duration-300", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

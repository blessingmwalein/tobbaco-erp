import * as React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumbs render links through `renderLink` so the app can supply next/link. */
export function Breadcrumbs({
  items,
  renderLink,
  className,
}: {
  items: Crumb[];
  renderLink?: (item: Crumb, children: React.ReactNode) => React.ReactNode;
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !last ? (
                renderLink ? (
                  renderLink(item, item.label)
                ) : (
                  <a href={item.href} className="hover:text-foreground">
                    {item.label}
                  </a>
                )
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "font-medium text-foreground")}>
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight className="size-3" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  badges,
  breadcrumbs,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3", className)}>
      {breadcrumbs}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {badges}
          </div>
          {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

const toneBox = {
  neutral: "bg-surface-tertiary text-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success text-success-foreground",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
} as const;

/** KPI tile: clear numeric metric, restrained. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  footer,
  className,
  ...props
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof toneBox;
  footer?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"div">, "children">) {
  return (
    <div
      data-slot="stat-card"
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-xl", toneBox[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <div>
        <p className="tabular text-2xl font-semibold leading-none tracking-tight text-foreground">{value}</p>
        {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {footer}
    </div>
  );
}

/** Definition list for record details. */
export function KeyValue({
  items,
  columns = 2,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const cols = { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid gap-x-8 gap-y-3", cols, className)}>
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{it.label}</dt>
          <dd className="text-sm font-medium text-foreground">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-md border border-border-strong bg-surface-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={cn("shrink-0 bg-border", vertical ? "h-full w-px" : "h-px w-full", className)}
    />
  );
}

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  body?: React.ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  const dot = {
    neutral: "bg-border-strong",
    primary: "bg-primary",
    success: "bg-success ring-1 ring-success-text/40",
    warning: "bg-warning",
    danger: "bg-danger",
  } as const;
  return (
    <ol className={cn("relative flex flex-col gap-4 border-l border-border pl-5", className)}>
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className={cn("absolute -left-[26px] top-1.5 size-2.5 rounded-full", dot[item.tone ?? "neutral"])} aria-hidden />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            {item.meta ? <p className="text-xs text-muted-foreground">{item.meta}</p> : null}
          </div>
          {item.body ? <div className="mt-0.5 text-sm text-muted-foreground">{item.body}</div> : null}
        </li>
      ))}
    </ol>
  );
}

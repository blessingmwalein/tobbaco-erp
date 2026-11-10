import { Leaf } from "lucide-react";
import { cn } from "@tobacco/ui";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground", className)}>
      <Leaf className="size-5" aria-hidden />
    </span>
  );
}

export function Brand({ collapsed, inverted }: { collapsed?: boolean; inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className={inverted ? "bg-primary-foreground text-primary" : undefined} />
      {collapsed ? null : (
        <div className="leading-tight">
          <p className={cn("text-sm font-semibold tracking-tight", inverted ? "text-primary-foreground" : "text-foreground")}>
            Tobacco ERP
          </p>
          <p className={cn("text-[11px]", inverted ? "text-primary-foreground/85" : "text-muted-foreground")}>
            Floor operations
          </p>
        </div>
      )}
    </div>
  );
}

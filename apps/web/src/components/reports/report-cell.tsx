import { cn } from "@tobacco/ui";
import { GrowerLink } from "@/components/domain/entity-links";
import { StatusBadge } from "@/components/domain/status-badge";
import { displayValue, type ReportColumn, type ReportRow } from "@/lib/reports";

/** Renders one report cell: status badges, grower links, monospace references, tabular numbers. */
export function ReportCell({ col, row }: { col: ReportColumn; row: ReportRow }) {
  const raw = row[col.key];
  if (raw === null || raw === undefined || raw === "") return <span className="text-muted-foreground">—</span>;
  if (col.format === "status" && col.statusKind) return <StatusBadge kind={col.statusKind} value={String(raw)} />;
  if (col.key === "grower") return <GrowerLink growerNo={String(raw)} />;
  const text = displayValue(col, row);
  const numeric = col.format === "int" || col.format === "mass" || col.format === "amount";
  return (
    <span className={cn(col.format === "mono" && "font-mono text-[13px]", numeric && "tabular", col.format === "amount" && Number(raw) < 0 && "text-danger-text")}>
      {text}
    </span>
  );
}

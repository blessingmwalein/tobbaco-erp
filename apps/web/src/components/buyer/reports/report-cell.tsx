import { Badge } from "@tobacco/ui";
import { formatCell, humanizeStatus, statusTone, type ReportCell, type ReportColumnDto } from "@tobacco/shared";

/** A barcode's 10th character may be a BLANK (it is a real check character). Show it instead of letting it vanish. */
function VisibleBlank({ value }: { value: string }) {
  const trailing = /\s+$/.exec(value)?.[0] ?? "";
  if (!trailing) return <>{value}</>;
  return (
    <>
      {value.slice(0, value.length - trailing.length)}
      <span title="blank check character" className="rounded-sm bg-surface-tertiary px-0.5 text-muted-foreground">
        {"·".repeat(trailing.length)}
      </span>
    </>
  );
}

/** One report cell: status badges, monospaced barcodes, and everything else formatted exactly as the exports format it. */
export function ReportCellView({ value, column }: { value: ReportCell | undefined; column: ReportColumnDto }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (column.format === "status") return <Badge tone={statusTone(String(value))}>{humanizeStatus(String(value))}</Badge>;
  if (column.format === "mono") return <span className="font-mono text-xs"><VisibleBlank value={String(value)} /></span>;
  return <>{formatCell(value, column)}</>;
}

import { cn } from "@tobacco/ui";

const show = (v: unknown): string => {
  if (v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export interface DiffRow {
  field: string;
  before: unknown;
  after: unknown;
  kind: "added" | "removed" | "changed" | "same";
}

/** Field-level diff of two audit snapshots (objects compared key by key; anything else as one value). */
export function diffValues(previous: unknown, next: unknown): DiffRow[] {
  if (!isObj(previous) && !isObj(next)) {
    return [{ field: "value", before: previous, after: next, kind: previous === undefined ? "added" : next === undefined ? "removed" : JSON.stringify(previous) === JSON.stringify(next) ? "same" : "changed" }];
  }
  const a = isObj(previous) ? previous : {};
  const b = isObj(next) ? next : {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.map((k) => {
    const before = a[k];
    const after = b[k];
    const same = JSON.stringify(before) === JSON.stringify(after);
    return { field: k, before, after, kind: same ? "same" : before === undefined ? "added" : after === undefined ? "removed" : "changed" };
  });
}

export function JsonDiff({ previous, next }: { previous: unknown; next: unknown }) {
  if (previous === undefined && next === undefined) {
    return <p className="text-sm text-muted-foreground">No before/after values were recorded for this action.</p>;
  }
  const rows = diffValues(previous, next);
  return (
    <div className="overflow-hidden rounded-xl border border-border" data-testid="json-diff">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-secondary text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Field</th>
            <th className="px-3 py-2 text-left font-medium">Before</th>
            <th className="px-3 py-2 text-left font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-t border-border align-top" data-kind={r.kind}>
              <td className="px-3 py-2 font-mono text-[12px]">{r.field}</td>
              <td className={cn("px-3 py-2 font-mono text-[12px] break-all", r.kind === "removed" || r.kind === "changed" ? "bg-danger-soft/60 text-danger-text" : "text-muted-foreground")}>{show(r.before)}</td>
              <td className={cn("px-3 py-2 font-mono text-[12px] break-all", r.kind === "added" || r.kind === "changed" ? "bg-success-soft text-success-text" : "text-muted-foreground")}>{show(r.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

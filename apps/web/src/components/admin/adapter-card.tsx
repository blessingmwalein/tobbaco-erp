import { Card, CardContent, Badge, type BadgeTone } from "@tobacco/ui";
import { Plug } from "lucide-react";
import type { AdapterInfo, AdapterMode } from "./adapters";

const MODE_TONE: Record<AdapterMode, BadgeTone> = {
  SIMULATED: "warning",
  MOCK: "warning",
  "SAMPLE FILES": "warning",
  "CSV GENERATOR": "primary",
  "PREVIEW ONLY": "primary",
};

/** One integration port with its current (always simulated/mock) adapter and what a real one would need. */
export function AdapterCard({ adapter }: { adapter: AdapterInfo }) {
  return (
    <Card data-testid={`adapter-${adapter.id}`} data-mode={adapter.mode}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Plug className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold">{adapter.name}</h3>
              <p className="font-mono text-xs text-muted-foreground">{adapter.port}</p>
            </div>
          </div>
          <Badge tone={MODE_TONE[adapter.mode]} dot>
            {adapter.mode}
          </Badge>
        </div>
        <p className="rounded-xl bg-surface-secondary px-3 py-2 text-sm font-medium" data-testid={`adapter-status-${adapter.id}`}>
          {adapter.status}
        </p>
        <p className="text-sm text-muted-foreground">{adapter.summary}</p>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold">A real integration needs</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {adapter.needs.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold">Adapter contract</p>
            <ul className="list-disc space-y-1 pl-4 font-mono text-[11px] text-muted-foreground">
              {adapter.contract.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <p className="mb-1 text-xs font-semibold">Configuration (kept outside source code)</p>
          <ul className="flex flex-col gap-0.5">
            {adapter.config.map((c) => (
              <li key={c.key} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="font-mono">{c.key}</span>
                <span className="text-muted-foreground">— {c.note}</span>
                <Badge tone="outline" className="ml-auto px-1.5 py-0 text-[10px]">
                  not set (demo)
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">Source: {adapter.manual} · docs/architecture/integration-boundaries.md</p>
        </div>
      </CardContent>
    </Card>
  );
}

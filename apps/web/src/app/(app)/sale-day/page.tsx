"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Button, Card, NativeSelect, PageHeader, Skeleton, cn } from "@tobacco/ui";
import { SALE_STAGE_LABEL, longDate } from "@tobacco/shared";
import { StageDot } from "@/components/domain/stage-pipeline";
import { StatusBadge } from "@/components/domain/status-badge";
import { useDashboardModel } from "@/lib/use-dashboard";

export default function SaleDayWorkflowPage() {
  const { ctx, date, setDate, dates, data: model, isLoading } = useDashboardModel();

  return (
    <>
      <PageHeader
        title="Sale day workflow"
        description="Every stage of the day in order — what is complete, what is waiting, and what is blocked and why."
        actions={
          <>
            <label htmlFor="wf-date" className="sr-only">
              Sale date
            </label>
            <NativeSelect id="wf-date" value={date} onChange={(e) => setDate(e.target.value)} wrapperClassName="w-52">
              {dates.map((d) => (
                <option key={d} value={d}>
                  {longDate(d)}
                  {d === ctx.today ? " (today)" : ""}
                </option>
              ))}
            </NativeSelect>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </>
        }
      />
      {isLoading || !model ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <ol className="relative flex flex-col gap-3" data-testid="workflow-stages">
          {model.stages.map((s, i) => (
            <li key={s.stage} data-stage={s.stage} data-status={s.status}>
              <Card
                className={cn(
                  "p-5",
                  s.status === "BLOCKED" && "border-danger/40",
                  s.status === "ATTENTION" && "border-warning/50",
                  s.status === "ACTIVE" && "border-primary/40",
                )}
              >
                <div className="flex flex-wrap items-start gap-4">
                  <StageDot index={i} status={s.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">{SALE_STAGE_LABEL[s.stage]}</h2>
                      <StatusBadge kind="stage" value={s.status} />
                      <span className="text-xs text-muted-foreground">
                        {s.manual} · {s.role}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{s.summary}</p>
                    {s.blockedReason ? (
                      <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-text" role="alert">
                        <strong>Blocked — </strong>
                        {s.blockedReason}
                      </p>
                    ) : null}
                    {s.metrics.length > 0 ? (
                      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                        {s.metrics.map((m) => (
                          <div key={m.label}>
                            <dt className="text-xs text-muted-foreground">{m.label}</dt>
                            <dd className="tabular text-sm font-semibold">{m.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {s.prerequisites.length > 0 ? (
                      <ul className="mt-3 flex flex-col gap-1">
                        {s.prerequisites.map((p) => (
                          <li key={p.label} className="flex items-center gap-2 text-sm">
                            {p.met ? (
                              <CheckCircle2 className="size-4 text-success-text" aria-label="met" />
                            ) : (
                              <Circle className="size-4 text-muted-foreground" aria-label="not met" />
                            )}
                            <span className={p.met ? "text-foreground" : "text-muted-foreground"}>{p.label}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={s.href}>
                      Open workspace <ExternalLink />
                    </Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

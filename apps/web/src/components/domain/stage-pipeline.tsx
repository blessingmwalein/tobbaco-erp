"use client";

import Link from "next/link";
import { AlertTriangle, Check, Lock, type LucideIcon } from "lucide-react";
import { Tooltip, cn } from "@tobacco/ui";
import { SALE_STAGE_LABEL, type StageStatus } from "@tobacco/shared";
import type { StageInfo } from "@/lib/dashboard";

const DOT: Record<StageStatus, string> = {
  COMPLETE: "bg-success text-success-foreground ring-1 ring-success-text/30",
  ACTIVE: "bg-primary text-primary-foreground",
  BLOCKED: "bg-danger text-danger-foreground",
  ATTENTION: "bg-warning text-warning-foreground",
  NOT_STARTED: "bg-surface-tertiary text-muted-foreground",
};

const ICON: Partial<Record<StageStatus, LucideIcon>> = {
  COMPLETE: Check,
  BLOCKED: Lock,
  ATTENTION: AlertTriangle,
};

export function StageDot({ index, status }: { index: number; status: StageStatus }) {
  const Icon = ICON[status];
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", DOT[status])}>
      {Icon ? <Icon className="size-4" aria-hidden /> : index + 1}
    </span>
  );
}

/** Compact strip of all 11 stages: where is the sale day, and where is it stuck? */
export function StagePipeline({ stages }: { stages: StageInfo[] }) {
  return (
    <ol
      className="grid grid-cols-4 gap-x-2 gap-y-5 pb-1 sm:grid-cols-6 lg:flex lg:items-start lg:gap-0 lg:overflow-x-auto"
      aria-label="Sale day stages"
      data-testid="stage-pipeline"
    >
      {stages.map((s, i) => (
        <li key={s.stage} className="flex min-w-0 flex-col items-center gap-2 text-center lg:min-w-[82px] lg:flex-1" data-stage={s.stage} data-status={s.status}>
          <div className="flex w-full items-center justify-center">
            <span className={cn("hidden h-0.5 flex-1 lg:block", i === 0 ? "bg-transparent" : stages[i - 1]!.status === "COMPLETE" ? "bg-success" : "bg-border")} aria-hidden />
            <Tooltip content={s.blockedReason ?? s.summary}>
              <Link href={s.href} aria-label={`${i + 1}. ${SALE_STAGE_LABEL[s.stage]}: ${s.status.toLowerCase().replace("_", " ")}. ${s.summary}`}>
                <StageDot index={i} status={s.status} />
              </Link>
            </Tooltip>
            <span className={cn("hidden h-0.5 flex-1 lg:block", i === stages.length - 1 ? "bg-transparent" : s.status === "COMPLETE" ? "bg-success" : "bg-border")} aria-hidden />
          </div>
          <p className={cn("px-1 text-[11px] leading-tight", s.status === "NOT_STARTED" ? "text-muted-foreground" : "font-medium text-foreground")}>
            {SALE_STAGE_LABEL[s.stage]}
          </p>
        </li>
      ))}
    </ol>
  );
}

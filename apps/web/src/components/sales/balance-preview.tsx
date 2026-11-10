"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, UnverifiedBadge, cn } from "@tobacco/ui";
import { formatInt, formatKg, formatUsd } from "@tobacco/shared";
import type { BalancePreview } from "@/mock/domain/sales";

/**
 * Balancing preview: every check, every bale, every problem. Nothing is silently ignored (brief Module 7).
 * The result is computed by the (mock) backend — the UI only displays it.
 */
export function BalancePreviewPanel({ preview }: { preview: BalancePreview }) {
  const errors = preview.issues.filter((i) => i.severity === "error");
  return (
    <Card data-testid="balance-preview" data-can-balance={preview.canBalance}>
      <CardHeader>
        <div>
          <CardTitle>Balancing preview</CardTitle>
          <CardDescription>
            {preview.canBalance
              ? "All checks pass — this sale can be balanced."
              : preview.status !== "DRAFT"
                ? `This sale is ${preview.status.toLowerCase()}.`
                : `${errors.length} problem(s) found. Balance Sale stays disabled until they are fixed.`}
          </CardDescription>
        </div>
        <Badge tone={preview.canBalance ? "success" : preview.status === "DRAFT" ? "danger" : "neutral"} dot>
          {preview.canBalance ? "Ready to balance" : preview.status === "DRAFT" ? "Blocked" : preview.status.toLowerCase()}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Bales" value={formatInt(preview.baleCount)} />
          <Stat label="Total mass" value={formatKg(preview.totalMassKg)} />
          <Stat
            label={
              <span className="flex items-center gap-1.5">
                Gross sale value <UnverifiedBadge uq="UQ-05" />
              </span>
            }
            value={formatUsd(preview.grossValueCents)}
          />
          <Stat label="Unsold / rejected" value={formatInt(preview.unsoldCount)} />
          <Stat label="Outstanding approvals" value={formatInt(preview.pendingApprovals)} />
        </dl>

        <ul className="flex flex-col gap-1.5" data-testid="balance-checks">
          {preview.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm" data-check={c.id} data-passed={c.passed}>
              {c.passed ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-text" aria-label="passed" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-danger-text" aria-label="failed" />
              )}
              <span className={cn(c.passed ? "text-foreground" : "font-medium text-danger-text")}>
                {c.label}
                {c.count > 0 ? <span className="ml-1 font-normal">({c.count})</span> : null}
              </span>
              {c.assumption ? <UnverifiedBadge /> : null}
            </li>
          ))}
        </ul>

        {preview.issues.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm" data-testid="balance-issues">
              <thead className="bg-surface-secondary text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Ticket</th>
                  <th className="px-3 py-2 text-left font-medium">Problem</th>
                </tr>
              </thead>
              <tbody>
                {preview.issues.map((i) => (
                  <tr key={i.id} className="border-t border-border" data-check={i.check}>
                    <td className="px-3 py-2 align-top font-mono text-[13px]">{i.barcode ?? "Sale"}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-start gap-2">
                        {i.severity === "error" ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger-text" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />}
                        <span>
                          {i.message}
                          {i.assumption ? <UnverifiedBadge className="ml-2" /> : null}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular text-lg font-semibold">{value}</dd>
    </div>
  );
}

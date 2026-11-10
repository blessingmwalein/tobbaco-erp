"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, ListOrdered, XCircle } from "lucide-react";
import {
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Field,
  NativeSelect,
  PageHeader,
  Skeleton,
  UnverifiedBadge,
} from "@tobacco/ui";
import { DEDUCTION_SOURCES, DEDUCTION_SOURCE_LABEL, formatUsd, longDate } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { SaleDeductionsCard } from "@/components/finance/sale-deductions-card";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDb, useDbQuery } from "@/mock/hooks";
import {
  runStopOrderProcessing,
  selectProcessingChecklist,
  type StopOrderProcessingResult,
} from "@/mock/domain/stop-orders";

export default function StopOrderProcessingPage() {
  return (
    <RequirePermission permission="deductions.view">
      <Inner />
    </RequirePermission>
  );
}

function CheckRow({ state, children, hint }: { state: "ok" | "fail" | "pending" | "advisory"; children: React.ReactNode; hint?: React.ReactNode }) {
  const Icon = state === "ok" ? CheckCircle2 : state === "fail" ? XCircle : Circle;
  const tone = state === "ok" ? "text-success-text" : state === "fail" ? "text-danger-text" : "text-muted-foreground";
  return (
    <li className="flex items-start gap-2.5" data-state={state}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} aria-hidden />
      <span className="min-w-0 text-sm">
        <span className={state === "fail" ? "text-danger-text" : undefined}>{children}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </li>
  );
}

function Inner() {
  const sellingPoints = useDb((db) => db.sellingPoints);
  const [spId, setSpId] = useState<string>(sellingPoints[0]?.id ?? "EL");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StopOrderProcessingResult | null>(null);
  const { data: check, isLoading } = useDbQuery(["finance", "processing-checklist", spId], (db) => selectProcessingChecklist(db, spId));
  const { run, isPending } = useAction(runStopOrderProcessing, { silent: true });

  const doRun = async () => {
    setError(null);
    const res = await run({ sellingPointId: spId });
    setConfirm(false);
    if (res.ok) setResult(res.data);
    else setError(res.error.message);
  };

  const blockedReason = check?.blockers.join(" ");
  const sodState = !check ? "pending" : check.datesWithoutRate.length > 0 ? "fail" : check.balancedSales.length > 0 ? "ok" : "pending";

  return (
    <>
      <PageHeader
        title="Stop Order Processing"
        description="Take the deductions owed from every balanced sale — floor charges, invoices, loans and TIMB stop orders — then set each sale to Processed with a pay batch number."
        actions={
          <Button asChild variant="secondary">
            <Link href="/timb/imports/new?type=STOP_ORDER">Import stop order file</Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Run processing</CardTitle>
                <CardDescription>Choose the selling point and review the checks.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {error ? (
                <div data-testid="processing-error">
                  <Callout tone="danger" title="Processing did not run">
                    {error}
                  </Callout>
                </div>
              ) : null}
              <Field label="Selling_Point" htmlFor="sop-sp" required>
                <NativeSelect id="sop-sp" value={spId} onChange={(e) => setSpId(e.target.value)}>
                  {sellingPoints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              {isLoading || !check ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-4/5" />
                </div>
              ) : (
                <div className="rounded-xl bg-surface-secondary p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Checks before processing</p>
                  <ul className="flex flex-col gap-2" data-testid="processing-checklist">
                    <CheckRow
                      state={sodState}
                      hint={check.datesWithoutRate.length > 0 ? "Exchange rate is not set for this sale. Post Start of Day for the sale date." : undefined}
                    >
                      Start of Day posted with an exchange rate
                    </CheckRow>
                    <CheckRow state={check.balancedSales.length > 0 ? "ok" : "pending"} hint={check.balancedSales.length === 0 ? "There are no Balanced sales to process for this selling point." : undefined}>
                      {check.balancedSales.length} balanced sale(s) to process
                      {check.saleDates.length > 0 ? ` (${check.saleDates.map(longDate).join(", ")})` : ""}
                    </CheckRow>
                    <CheckRow
                      state={check.pendingApprovals === 0 ? "ok" : "fail"}
                      hint={
                        check.pendingApprovals > 0 ? (
                          <>
                            There are :: {check.pendingApprovals} :: Pending Approvals. <Link className="underline" href="/approvals">Approve them first.</Link>
                          </>
                        ) : undefined
                      }
                    >
                      No pending approvals
                    </CheckRow>
                    <CheckRow
                      state={check.stopOrderFileImported ? "ok" : "advisory"}
                      hint={
                        check.stopOrderFileImported ? (
                          `${check.stopOrdersForDates} stop order line(s) dated for the sale date`
                        ) : (
                          <>
                            Stop order file not imported — sales will be processed <strong>without</strong> TIMB stop orders.{" "}
                            <Link className="underline" href="/timb/imports/new?type=STOP_ORDER">
                              Import it
                            </Link>{" "}
                            first if one exists.
                          </>
                        )
                      }
                    >
                      Stop order file imported for the sale date <span className="text-xs text-muted-foreground">(advisory)</span>
                    </CheckRow>
                  </ul>
                </div>
              )}

              {check && check.warnings.length > 0 ? (
                <Callout tone="warning" title="Heads-up">
                  <ul className="list-disc pl-4">
                    {check.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </Callout>
              ) : null}

              <PermissionButton
                permission="deductions.process"
                size="lg"
                onClick={() => setConfirm(true)}
                disabled={!check || check.blockers.length > 0}
                disabledReason={blockedReason || undefined}
                data-testid="run-processing"
              >
                Stop Order Processing <ArrowRight />
              </PermissionButton>
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <UnverifiedBadge uq="UQ-05" /> Floor-charge amounts are illustrative; the real charge formulas are not documented.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="size-4 text-primary" aria-hidden /> Order of deductions
                </CardTitle>
                <CardDescription>As documented in Manual 07. The balance becomes the grower's payout.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2" data-testid="deduction-order">
                {DEDUCTION_SOURCES.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">{i + 1}</span>
                    {DEDUCTION_SOURCE_LABEL[s]}
                    {s === "TIMB_INVOICE" ? <span className="text-xs text-muted-foreground">(not modelled)</span> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 xl:col-span-3">
          {result ? (
            <>
              <Callout tone="success" title={result.message} action={
                <Button asChild size="sm">
                  <Link href={`/finance/payments/${result.payBatchNo}`}>
                    Pay batch {result.payBatchNo} <ArrowRight />
                  </Link>
                </Button>
              }>
                <span data-testid="processing-result">
                  Pay batch <strong>{result.payBatchNo}</strong> · {result.sales.length} sale(s) processed · total net payout{" "}
                  <strong>{formatUsd(result.sales.reduce((a, s) => a + s.netCents, 0))}</strong>
                </span>
              </Callout>
              {result.warnings.length > 0 ? (
                <Callout tone="warning" title="Warnings">
                  <ul className="list-disc pl-4">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
              {result.sales.map((s) => (
                <SaleDeductionsCard
                  key={s.saleId}
                  testId={`result-sale-${s.refNo}`}
                  title={`Sale #${s.refNo} · ${s.growerNo}`}
                  subtitle={`Processed · pay batch ${result.payBatchNo}`}
                  grossCents={s.grossCents}
                  capped={s.capped}
                  lines={s.lines.map((l) => ({ key: l.id, sequence: l.sequence, source: l.source, creditorName: l.creditorName, description: l.description, amountCents: l.amountCents, currency: l.currency, isDemoAmount: l.isDemoAmount }))}
                />
              ))}
            </>
          ) : (
            <>
              <Callout tone="info" title="Preview — nothing is posted until you run processing">
                What the run would deduct for each balanced sale, in the documented order.
              </Callout>
              {isLoading || !check ? (
                <Skeleton className="h-64 rounded-2xl" />
              ) : check.plans.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No balanced sales to process for this selling point. Balance sales first (Sales &amp; balancing).
                  </CardContent>
                </Card>
              ) : (
                check.plans.map((p) => (
                  <SaleDeductionsCard
                    key={p.saleId}
                    testId={`plan-sale-${p.refNo}`}
                    title={`Sale #${p.refNo} · ${p.growerNo}`}
                    subtitle={`Balanced · ${longDate(p.saleDate)}`}
                    grossCents={p.grossCents}
                    capped={p.capped}
                    lines={p.lines.map((l, i) => ({ key: `${l.source}-${i}`, sequence: l.sequence, source: l.source, creditorName: l.creditorName, description: l.description, amountCents: l.amountCents, currency: l.currency, isDemoAmount: l.isDemoAmount }))}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Run Stop Order Processing?"
        description={
          check ? (
            <>
              {check.balancedSales.length} balanced sale(s) will be processed in one new pay batch. Deductions of{" "}
              <strong>{formatUsd(check.totals.deductionsCents)}</strong> will be taken and the sales move to Processed. This cannot be undone
              from here.
            </>
          ) : undefined
        }
        confirmLabel="Process sales"
        loading={isPending}
        onConfirm={doRun}
      />
    </>
  );
}

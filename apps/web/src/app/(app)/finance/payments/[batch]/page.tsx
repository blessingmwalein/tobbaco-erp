"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Download, ShieldAlert, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataTable,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Timeline,
  UnverifiedBadge,
  toast,
  type ColumnDef,
} from "@tobacco/ui";
import { MESSAGES, formatDateTime, formatUsd, longDate, type PaymentScheduleLine, type PaymentSchedule } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { GrowerLink, SaleLink } from "@/components/domain/entity-links";
import { StatusBadge } from "@/components/domain/status-badge";
import { ConfirmPaymentDialog, FailPaymentDialog } from "@/components/finance/payment-line-dialogs";
import { GenerateScheduleDialog } from "@/components/finance/generate-schedule-dialog";
import { formatMoney } from "@/components/finance/money";
import { downloadCsv } from "@/lib/csv";
import { PermissionButton } from "@/lib/permissions";
import { userName } from "@/mock/ctx";
import { useAction, useDbQuery } from "@/mock/hooks";
import { payWithCloudPayMock, recordCsvDownload, scheduleCsv } from "@/mock/domain/payments";
import { saleFinancials } from "@/mock/domain/stop-orders";

export default function PayBatchPage() {
  return (
    <RequirePermission permission="payments.view">
      <Inner />
    </RequirePermission>
  );
}

const TX_TONE = { SCHEDULE_GENERATED: "primary", CSV_DOWNLOADED: "neutral", CLOUDPAY_SUBMITTED_MOCK: "warning", CONFIRMED: "success", FAILED: "danger", RECONCILED_NOTE: "neutral" } as const;
const TX_LABEL = {
  SCHEDULE_GENERATED: "Schedule generated",
  CSV_DOWNLOADED: "CSV downloaded (no status change)",
  CLOUDPAY_SUBMITTED_MOCK: "Submitted to CloudPay (MOCK)",
  CONFIRMED: "Bank confirmation recorded",
  FAILED: "Payment failed",
  RECONCILED_NOTE: "Reconciliation note",
} as const;

type LineRow = PaymentScheduleLine & { name: string };

function Inner() {
  const params = useParams<{ batch: string }>();
  const batchNo = Number(params.batch);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [confirmLine, setConfirmLine] = useState<PaymentScheduleLine | null>(null);
  const [failLine, setFailLine] = useState<PaymentScheduleLine | null>(null);
  const [cloudFor, setCloudFor] = useState<PaymentSchedule | null>(null);
  const csv = useAction(recordCsvDownload, { silent: true });
  const cloud = useAction(payWithCloudPayMock, { silent: true });

  const { data, isLoading } = useDbQuery(["finance", "pay-batch", batchNo], (db) => {
    const batch = db.payBatches.find((p) => p.no === batchNo);
    if (!batch) return null;
    const sales = db.sales
      .filter((s) => s.payBatchNo === batchNo)
      .sort((a, b) => a.refNo - b.refNo)
      .map((s) => ({ sale: s, fin: saleFinancials(db, s), name: (() => { const g = db.growers.find((x) => x.growerNo === s.growerNo); return g ? `${g.firstName} ${g.surname}` : s.growerNo; })() }));
    const schedules = db.paymentSchedules
      .filter((s) => s.payBatchNo === batchNo)
      .map((s) => {
        const lines: LineRow[] = db.paymentLines
          .filter((l) => l.scheduleId === s.id)
          .map((l) => ({ ...l, name: l.beneficiary }));
        return { schedule: s, lines, csv: scheduleCsv(db, s.id), generatedByName: userName(db, s.generatedBy) };
      });
    const scheduleIds = new Set(schedules.map((s) => s.schedule.id));
    const tx = db.paymentTransactions
      .filter((t) => scheduleIds.has(t.scheduleId))
      .map((t) => ({ ...t, who: userName(db, t.userId), ref: db.paymentSchedules.find((s) => s.id === t.scheduleId)?.ref ?? t.scheduleId }))
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
    const sp = db.sellingPoints.find((x) => x.id === batch.sellingPointId);
    const unscheduled = ["USD", db.settings.localCurrencyCode].filter((c) => !db.paymentSchedules.some((s) => s.payBatchNo === batchNo && s.currency === c && s.status !== "FAILED"));
    return { batch, sales, schedules, tx, sellingPointName: sp?.name ?? batch.sellingPointId, unscheduled };
  });

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (!data)
    return (
      <ErrorState
        title={`Pay batch ${params.batch} not found`}
        description="Pay batch numbers are assigned by Stop Order Processing."
        action={
          <Button asChild variant="secondary">
            <Link href="/finance/payments">Back to payments</Link>
          </Button>
        }
      />
    );

  const downloadFor = async (s: PaymentSchedule) => {
    const res = await csv.run({ scheduleId: s.id });
    if (res.ok) {
      downloadCsv(res.data.filename, res.data.headers, res.data.rows);
      toast.info(MESSAGES.PAY_CSV_NOT_PAID.text);
    } else toast.error(res.error.message);
  };

  const submitCloud = async () => {
    if (!cloudFor) return;
    const res = await cloud.run({ scheduleId: cloudFor.id });
    setCloudFor(null);
    if (res.ok) toast.warning(res.data.message);
    else toast.error(res.error.message);
  };

  const lineColumns = (s: PaymentSchedule): ColumnDef<LineRow, unknown>[] => [
    { accessorKey: "growerNo", header: "Grower", cell: ({ row }) => <GrowerLink growerNo={row.original.growerNo} /> },
    { accessorKey: "beneficiary", header: "Beneficiary" },
    { accessorKey: "creditAccount", header: "Credit account", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    { accessorKey: "bank", header: "Bank", cell: ({ row }) => `${row.original.bank} (${row.original.bankCode}/${row.original.branchCode})` },
    { accessorKey: "amountCents", header: "Amount", cell: ({ row }) => <span className="tabular font-medium">{formatMoney(row.original.amountCents, s.currency)}</span> },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className="flex flex-col gap-0.5" data-testid={`line-status-${row.original.growerNo}`} data-status={row.original.status}>
          <StatusBadge kind="paymentLine" value={row.original.status} />
          {row.original.confirmationRef ? <span className="font-mono text-[11px] text-muted-foreground">{row.original.confirmationRef}</span> : null}
          {row.original.failureReason ? <span className="text-[11px] text-danger-text">{row.original.failureReason}</span> : null}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status === "PAID" ? (
          <span className="flex items-center justify-end gap-1 text-xs text-success-text">
            <Check className="size-3.5" aria-hidden /> Confirmed {formatDateTime(row.original.confirmedAt)}
          </span>
        ) : (
          <div className="flex justify-end gap-2">
            <PermissionButton permission="payments.confirm-payment" size="sm" variant="secondary" onClick={() => setConfirmLine(row.original)} data-testid={`confirm-line-${row.original.growerNo}`}>
              <Check /> Record confirmation
            </PermissionButton>
            <PermissionButton permission="payments.confirm-payment" size="sm" variant="ghost" onClick={() => setFailLine(row.original)} data-testid={`fail-line-${row.original.growerNo}`}>
              <XCircle /> Failed
            </PermissionButton>
          </div>
        ),
    },
  ];

  const first = data.schedules[0]?.schedule;
  return (
    <>
      <PageHeader
        title={`Pay batch ${data.batch.no}`}
        description={`${data.sellingPointName} · ${longDate(data.batch.saleDate)} · ${data.sales.length} sale(s)`}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/finance/payments">
                <ArrowLeft /> All payments
              </Link>
            </Button>
            <PermissionButton permission="payments.generate-schedule" onClick={() => setGenerateOpen(true)} disabled={data.unscheduled.length === 0} disabledReason={data.unscheduled.length === 0 ? "Schedules already exist for every currency." : undefined} data-testid="batch-generate">
              Generate schedule
            </PermissionButton>
          </>
        }
        badges={first ? <StatusBadge kind="paymentSchedule" value={first.status} /> : <Badge tone="warning" dot>No schedule yet</Badge>}
      />

      <div className="flex flex-col gap-6">
        <Callout tone="warning" title="Nothing here moves money">
          {MESSAGES.PAY_CSV_NOT_PAID.text} CloudPay is a mock — nothing is sent. Lines become Paid only through a recorded, verified confirmation.
        </Callout>

        {data.schedules.length > 0 ? (
          <section aria-label="Reconciliation" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="reconciliation">
            {data.schedules.map(({ schedule, lines }) => {
              const expected = lines.reduce((a, l) => a + l.amountCents, 0);
              const confirmed = lines.filter((l) => l.status === "PAID").reduce((a, l) => a + l.amountCents, 0);
              return (
                <StatCard
                  key={schedule.id}
                  data-testid={`recon-${schedule.currency}`}
                  label={`${schedule.currency} · expected vs confirmed`}
                  value={formatMoney(confirmed, schedule.currency)}
                  hint={`of ${formatMoney(expected, schedule.currency)} · outstanding ${formatMoney(expected - confirmed, schedule.currency)} · ${lines.filter((l) => l.status === "PAID").length}/${lines.length} lines`}
                  tone={confirmed === expected && expected > 0 ? "success" : "warning"}
                />
              );
            })}
          </section>
        ) : null}

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales in this batch</CardTitle>
              <CardDescription>Net payout = gross − deductions (formulas as documented; amounts illustrative)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale</TableHead>
                  <TableHead>Grower</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net payout</TableHead>
                  <TableHead>USD ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sales.map(({ sale, fin, name }) => (
                  <TableRow key={sale.id}>
                    <TableCell><SaleLink id={sale.id} refNo={sale.refNo} /></TableCell>
                    <TableCell>
                      <GrowerLink growerNo={sale.growerNo} /> <span className="text-muted-foreground">{name}</span>
                    </TableCell>
                    <TableCell className="tabular text-right">{formatUsd(fin.grossCents)}</TableCell>
                    <TableCell className="tabular text-right">− {formatUsd(fin.deductionsCents)}</TableCell>
                    <TableCell className="tabular text-right font-semibold">{formatUsd(fin.netCents)}</TableCell>
                    <TableCell className="font-mono text-xs">{sale.usdPaymentRef ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {data.schedules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm font-semibold">No payment schedule has been generated for this pay batch</p>
              <p className="max-w-md text-sm text-muted-foreground">Generate one schedule per currency. Growers without bank details are left out of the file.</p>
              <PermissionButton permission="payments.generate-schedule" onClick={() => setGenerateOpen(true)}>
                Generate schedule
              </PermissionButton>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue={data.schedules[0]!.schedule.id}>
            <TabsList>
              {data.schedules.map(({ schedule }) => (
                <TabsTrigger key={schedule.id} value={schedule.id} data-testid={`tab-${schedule.currency}`}>
                  {schedule.currency} <StatusBadge kind="paymentSchedule" value={schedule.status} />
                </TabsTrigger>
              ))}
            </TabsList>
            {data.schedules.map(({ schedule, lines, csv: csvData, generatedByName }) => (
              <TabsContent key={schedule.id} value={schedule.id} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono text-[13px] font-semibold text-foreground">{schedule.ref}</span> · generated by {generatedByName} ·{" "}
                    {formatDateTime(schedule.generatedAt)} · bank file downloaded {schedule.csvDownloads}×
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <PermissionButton permission="payments.export" variant="secondary" onClick={() => downloadFor(schedule)} data-testid={`download-csv-${schedule.currency}`}>
                      <Download /> Download bank CSV
                    </PermissionButton>
                    <PermissionButton permission="payments.export" variant="dark" onClick={() => setCloudFor(schedule)} data-testid={`cloudpay-${schedule.currency}`}>
                      <ShieldAlert /> Pay with CloudPay (mock)
                    </PermissionButton>
                  </div>
                </div>
                {schedule.currency !== "USD" ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UnverifiedBadge uq="UQ-04" /> Amounts converted from the USD net at the Start-of-Day rate; the real USD/local split is undocumented.
                  </p>
                ) : null}

                {schedule.excluded.length > 0 ? (
                  <Callout tone="warning" title={`${schedule.excluded.length} grower(s) left out of this schedule`}>
                    <ul className="mt-1 flex flex-col gap-1">
                      {schedule.excluded.map((e) => (
                        <li key={e.growerNo} className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[13px]">{e.growerNo}</span> {e.name} — {e.reason}
                          <Link className="underline" href={`/growers/${e.growerNo}?tab=bank`}>
                            Open bank details
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Callout>
                ) : null}

                <DataTable
                  aria-label={`${schedule.currency} payment lines`}
                  data-testid={`lines-${schedule.currency}`}
                  columns={lineColumns(schedule)}
                  data={lines}
                  hidePagerWhenSinglePage
                  enableColumnVisibility={false}
                  emptyTitle="No payment lines"
                />

                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Bank file preview</CardTitle>
                      <CardDescription>{csvData.filename} · the 13 documented columns</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 pb-2">
                    <Table data-testid={`csv-preview-${schedule.currency}`}>
                      <TableHeader>
                        <TableRow>
                          {csvData.headers.map((h) => (
                            <TableHead key={h} className="font-mono text-[11px]">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.rows.map((r, i) => (
                          <TableRow key={i}>
                            {r.map((c, j) => (
                              <TableCell key={j} className="whitespace-nowrap font-mono text-xs">
                                {c}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-muted-foreground" aria-hidden /> Payment history
              </CardTitle>
              <CardDescription>Append-only. Corrections are new entries; nothing is edited or deleted.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {data.tx.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment activity yet.</p>
            ) : (
              <div data-testid="payment-history">
                <Timeline
                  items={data.tx.map((t) => ({
                    id: t.id,
                    tone: TX_TONE[t.kind],
                    title: `${TX_LABEL[t.kind]} · ${t.ref}`,
                    meta: `${formatDateTime(t.at)} · ${t.who}`,
                    body: (
                      <>
                        {t.note}
                        {t.reference ? <span className="ml-1 font-mono text-xs">[{t.reference}]</span> : null}
                      </>
                    ),
                  }))}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GenerateScheduleDialog open={generateOpen} onOpenChange={setGenerateOpen} defaults={{ batchNo: data.batch.no, invoicesDate: data.batch.saleDate, currency: data.unscheduled[0] }} />
      <ConfirmPaymentDialog line={confirmLine} onOpenChange={(o) => !o && setConfirmLine(null)} />
      <FailPaymentDialog line={failLine} onOpenChange={(o) => !o && setFailLine(null)} />
      <ConfirmDialog
        open={cloudFor !== null}
        onOpenChange={(o) => !o && setCloudFor(null)}
        title="Submit through CloudPay (mock)?"
        description={
          <>
            {MESSAGES.PAY_CLOUDPAY_MOCK.text} In production this sends <strong>real payment instructions</strong>. Unpaid lines on {cloudFor?.ref} move to
            “Submitted”, never to “Paid”.
          </>
        }
        confirmLabel="Submit (mock)"
        tone="dark"
        loading={cloud.isPending}
        onConfirm={submitCloud}
      />
    </>
  );
}

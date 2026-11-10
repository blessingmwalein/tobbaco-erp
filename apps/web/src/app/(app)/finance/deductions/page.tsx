"use client";

import { useState } from "react";
import { Download, Receipt, Users, Layers, Landmark, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  DateInput,
  Field,
  PageHeader,
  Skeleton,
  StatCard,
  type ColumnDef,
} from "@tobacco/ui";
import { DEDUCTION_SOURCE_LABEL, formatUsd, longDate, type MockDb } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { BreakdownList, TopCreditorsChart } from "@/components/finance/deduction-charts";
import { formatMoney } from "@/components/finance/money";
import { GrowerLink, SaleLink } from "@/components/domain/entity-links";
import { downloadCsv } from "@/lib/csv";
import { useDb, useDbQuery } from "@/mock/hooks";
import { selectDeductionsDashboard, type DeductionRow } from "@/mock/domain/stop-orders";

export default function DeductionsPage() {
  return (
    <RequirePermission permission="deductions.view">
      <Inner />
    </RequirePermission>
  );
}

const seasonOf = (db: MockDb) => db.settings.seasonYear;

function Inner() {
  const today = useDb((db) => db.settings.demoToday);
  const season = useDb(seasonOf);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [creditor, setCreditor] = useState<string | null>(null);
  const f = from ?? today;
  const t = to ?? today;
  const { data, isLoading } = useDbQuery(["finance", "deductions-dashboard", f, t], (db) => selectDeductionsDashboard(db, f, t));

  const rows = (data?.rows ?? []).filter((r) => !creditor || r.creditorCode === creditor);
  const selectedName = creditor ? data?.topCreditors.find((c) => c.code === creditor)?.name ?? creditor : null;

  const columns: ColumnDef<DeductionRow, unknown>[] = [
    { accessorKey: "growerNo", header: "Grower", cell: ({ row }) => (
      <span className="flex flex-col leading-tight">
        <GrowerLink growerNo={row.original.growerNo} />
        <span className="text-xs text-muted-foreground">{row.original.growerName}</span>
      </span>
    ) },
    { accessorKey: "sequence", header: "#", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue<number>()}</span> },
    { accessorKey: "creditorName", header: "Creditor", cell: ({ row }) => `${row.original.creditorName} (${row.original.creditorCode})` },
    { accessorKey: "source", header: "Source", cell: ({ getValue }) => <Badge tone="outline">{DEDUCTION_SOURCE_LABEL[getValue<keyof typeof DEDUCTION_SOURCE_LABEL>()]}</Badge> },
    { accessorKey: "amountCents", header: "Amount", cell: ({ row }) => <span className="tabular">{formatMoney(row.original.amountCents, row.original.currency)}</span> },
    { accessorKey: "currency", header: "Currency" },
    { accessorKey: "paidCents", header: "Paid", cell: ({ row }) => <span className="tabular">{formatMoney(row.original.paidCents, row.original.currency)}</span> },
    { accessorKey: "remainingCents", header: "Remaining", cell: ({ row }) => <span className="tabular">{formatMoney(row.original.remainingCents, row.original.currency)}</span> },
    { accessorKey: "saleRefNo", header: "Sale", cell: ({ row }) => (row.original.saleRefNo ? <SaleLink id={row.original.saleId} refNo={row.original.saleRefNo} /> : "—") },
    { accessorKey: "saleNetCents", header: "Net payout (sale)", cell: ({ row }) => <span className="tabular font-medium">{row.original.saleNetCents !== undefined ? formatUsd(row.original.saleNetCents) : "—"}</span> },
    { accessorKey: "payBatchNo", header: "Pay batch" },
  ];

  const exportCsv = () =>
    downloadCsv(
      `deductions_${f}_${t}${creditor ? `_${creditor}` : ""}.csv`,
      ["Grower", "Name", "Sequence", "Creditor_Code", "Creditor", "Source", "Amount", "Currency", "Paid", "Remaining", "Sale", "Net_Payout_Sale", "Pay_Batch", "Selling_Date"],
      rows.map((r) => [r.growerNo, r.growerName, r.sequence, r.creditorCode, r.creditorName, DEDUCTION_SOURCE_LABEL[r.source], (r.amountCents / 100).toFixed(2), r.currency, (r.paidCents / 100).toFixed(2), (r.remainingCents / 100).toFixed(2), r.saleRefNo ?? "", r.saleNetCents !== undefined ? (r.saleNetCents / 100).toFixed(2) : "", r.payBatchNo, r.sellingDate]),
    );

  return (
    <>
      <PageHeader
        title="Deductions Dashboard"
        description={`Season ${season} · stop order processing · click a creditor to open the deductions`}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <Field label="From" htmlFor="dd-from" className="w-40">
              <DateInput id="dd-from" value={f} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To" htmlFor="dd-to" className="w-40">
              <DateInput id="dd-to" value={t} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        }
      />

      {isLoading || !data ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Totals">
            <StatCard data-testid="tile-total" label="Total deducted" icon={Receipt} tone="primary" value={formatUsd(data.totalCents)} hint={f === t ? f : `${f} → ${t}`} />
            <StatCard data-testid="tile-lines" label="Deductions" icon={Layers} value={data.lineCount} hint="lines in range" />
            <StatCard data-testid="tile-growers" label="Growers affected" icon={Users} value={data.growersAffected} hint="distinct grower numbers" />
            <StatCard data-testid="tile-creditors" label="Creditors" icon={Landmark} value={data.creditorsAffected} hint="distinct creditor numbers" />
          </section>

          {data.lineCount === 0 ? (
            <Card>
              <CardContent className="py-14 text-center text-sm text-muted-foreground">
                No deductions between {longDate(f)} and {longDate(t)}. Run Stop Order Processing on balanced sales, or widen the date range.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                  <CardHeader>
                    <div>
                      <CardTitle>Top 10 Creditors by Deduction Amount</CardTitle>
                      <CardDescription>Largest first · click a creditor to open its deductions</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TopCreditorsChart data={data.topCreditors} selected={creditor} onSelect={setCreditor} />
                  </CardContent>
                </Card>
                <div className="flex flex-col gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Deductions by Currency</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BreakdownList
                        testId="by-currency"
                        items={data.byCurrency.map((c) => ({ key: c.currency, label: c.currency, amountCents: c.amountCents, count: c.count }))}
                        format={(c) => formatUsd(c)}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Deductions by Source</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BreakdownList testId="by-source" items={data.bySource} format={(c) => formatUsd(c)} />
                    </CardContent>
                  </Card>
                </div>
              </div>

              <section aria-label="Deductions" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    Deductions
                    {selectedName ? (
                      <Badge tone="primary">
                        {selectedName}
                        <button type="button" onClick={() => setCreditor(null)} aria-label="Clear creditor filter" className="ml-1 rounded-full hover:bg-primary/10">
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ) : null}
                  </h2>
                  <Button variant="secondary" size="sm" onClick={exportCsv} data-testid="export-deductions">
                    <Download /> Export CSV
                  </Button>
                </div>
                <DataTable
                  aria-label="Deduction lines"
                  data-testid="deductions-table"
                  columns={columns}
                  data={rows}
                  searchPlaceholder="Search grower, creditor…"
                  initialColumnVisibility={{ currency: false, payBatchNo: false }}
                  emptyTitle="No deductions for this creditor"
                />
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}

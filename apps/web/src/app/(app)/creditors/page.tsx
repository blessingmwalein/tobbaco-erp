"use client";

import { useState } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DemoBadge,
  KeyValue,
  PageHeader,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  type ColumnDef,
} from "@tobacco/ui";
import { formatDate, formatUsd, type Creditor, type Deduction, type StopOrder } from "@tobacco/shared";
import { GrowerLink, PayBatchLink } from "@/components/domain/entity-links";
import { RequirePermission } from "@/components/page-guard";
import { useDbQuery } from "@/mock/hooks";

type Row = Creditor & {
  stopOrders: StopOrder[];
  deductions: Deduction[];
  stopOrderCents: number;
  paidCents: number;
  deductedCents: number;
};

export default function CreditorsPage() {
  return (
    <RequirePermission permission="deductions.view">
      <Creditors />
    </RequirePermission>
  );
}

function Creditors() {
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useDbQuery(["creditors"], (db): Row[] =>
    db.creditors.map((c) => {
      const stopOrders = db.stopOrders.filter((s) => s.creditorCode === c.code);
      const deductions = db.deductions.filter((d) => d.creditorCode === c.code);
      return {
        ...c,
        stopOrders,
        deductions,
        stopOrderCents: stopOrders.reduce((a, s) => a + s.amount1Cents, 0),
        paidCents: stopOrders.reduce((a, s) => a + s.paidAmountCents, 0),
        deductedCents: deductions.reduce((a, d) => a + d.amountCents, 0),
      };
    }),
  );
  const selected = data?.find((c) => c.code === open);

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono text-[13px] font-medium">{getValue<string>()}</span> },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.isDemo ? <DemoBadge /> : null}
        </span>
      ),
    },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ getValue }) => (getValue<string>() === "TIMB_CREDITOR" ? <Badge tone="primary">TIMB creditor</Badge> : <Badge tone="neutral">Floor charge</Badge>),
    },
    { accessorKey: "cellphone", header: "Cellphone", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue<string>() ?? "—"}</span> },
    { id: "stopOrders", header: "Stop orders", accessorFn: (r) => r.stopOrders.length, cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "stopOrderCents", header: "Stop order total", cell: ({ getValue }) => <span className="tabular">{getValue<number>() ? formatUsd(getValue<number>()) : "—"}</span> },
    { accessorKey: "deductedCents", header: "Deducted", cell: ({ getValue }) => <span className="tabular font-medium">{getValue<number>() ? formatUsd(getValue<number>()) : "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Creditors"
        description="TIMB creditors (such as input suppliers) and the floor's own charge creditors. Select one to see its stop orders and deductions."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/timb/imports/new?type=CREDITOR_REGISTER">Import creditor register</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/finance/stop-orders">Stop orders</Link>
            </Button>
          </>
        }
      />
      <DataTable
        data-testid="creditors-table"
        aria-label="Creditor register"
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        searchPlaceholder="Search creditor code or name"
        pageSize={10}
        getRowId={(c) => c.code}
        onRowClick={(c) => setOpen(c.code)}
        emptyIcon={Landmark}
        emptyTitle="No creditors"
        emptyDescription="Import the creditor register, or import a stop order file (unknown creditors are created automatically)."
      />

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-[min(34rem,100vw)] overflow-y-auto p-6">
          {selected ? (
            <div className="flex flex-col gap-5 pt-2" data-testid="creditor-sheet">
              <div className="pr-8">
                <SheetTitle className="text-lg">{selected.name}</SheetTitle>
                <SheetDescription className="font-mono">{selected.code}</SheetDescription>
              </div>
              <KeyValue
                columns={2}
                items={[
                  { label: "Kind", value: selected.kind === "TIMB_CREDITOR" ? "TIMB creditor" : "Floor charge" },
                  { label: "Cellphone", value: selected.cellphone ?? "—" },
                  { label: "Stop order total", value: formatUsd(selected.stopOrderCents) },
                  { label: "Paid on stop orders", value: formatUsd(selected.paidCents) },
                  { label: "Deducted so far", value: formatUsd(selected.deductedCents) },
                  { label: "Deduction lines", value: selected.deductions.length },
                ]}
              />
              <div>
                <p className="mb-2 text-sm font-semibold">Stop orders</p>
                {selected.stopOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stop orders for this creditor.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                    {selected.stopOrders.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <span className="flex flex-col">
                          <GrowerLink growerNo={s.growerNo} />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(s.fileDate)} · priority {s.priority} · rec type {s.recType}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="tabular block font-medium">{formatUsd(s.amount1Cents)}</span>
                          <span className="tabular block text-xs text-muted-foreground">paid {formatUsd(s.paidAmountCents)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Deductions</p>
                {selected.deductions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing deducted for this creditor yet.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                    {selected.deductions.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <span className="flex flex-col">
                          <GrowerLink growerNo={d.growerNo} />
                          <span className="text-xs text-muted-foreground">
                            {d.description} · <PayBatchLink no={d.payBatchNo} />
                          </span>
                        </span>
                        <span className="tabular font-medium">{formatUsd(d.amountCents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Landmark, Pencil, Plus, Trash2, UserX } from "lucide-react";
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
  DemoBadge,
  EmptyState,
  Field,
  Input,
  KeyValue,
  PageHeader,
  Skeleton,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UnverifiedBadge,
  type ColumnDef,
} from "@tobacco/ui";
import {
  formatDate,
  formatDateTime,
  formatUsd,
  ticketValueCents,
  type Deduction,
  type DeliveryNote,
  type Grower,
  type GrowerBankAccount,
  type GrowerBooking,
  type PaymentScheduleLine,
  type Sale,
  type StopOrder,
} from "@tobacco/shared";
import { StatusBadge } from "@/components/domain/status-badge";
import { GdnLink, PayBatchLink, SaleLink } from "@/components/domain/entity-links";
import { BankAccountDialog } from "@/components/growers/bank-account-dialog";
import { RequirePermission } from "@/components/page-guard";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import { removeGrowerBankAccount } from "@/mock/domain/timb";

interface Detail {
  grower: Grower;
  bookings: GrowerBooking[];
  deliveries: Array<DeliveryNote & { baleCount: number }>;
  sales: Array<Sale & { grossCents: number }>;
  payments: Array<PaymentScheduleLine & { scheduleRef: string }>;
  banks: GrowerBankAccount[];
  stopOrders: Array<StopOrder & { creditorName: string }>;
  deductions: Deduction[];
}

export default function GrowerDetailPage() {
  return (
    <RequirePermission permission="growers.view">
      <GrowerDetail />
    </RequirePermission>
  );
}

function GrowerDetail() {
  const { no } = useParams<{ no: string }>();
  const growerNo = decodeURIComponent(no);
  const { data, isLoading } = useDbQuery(["growers", growerNo], (db): Detail | null => {
    const grower = db.growers.find((g) => g.growerNo === growerNo);
    if (!grower) return null;
    const baleCountOf = (n: DeliveryNote) => n.historicalBaleCount ?? db.bales.filter((b) => b.gdnId === n.id && !b.ejected).length;
    return {
      grower,
      bookings: db.bookings.filter((b) => b.growerNo === growerNo).sort((a, b) => b.sellDate.localeCompare(a.sellDate)),
      deliveries: db.deliveryNotes
        .filter((d) => d.growerNo === growerNo)
        .map((d) => ({ ...d, baleCount: baleCountOf(d) }))
        .sort((a, b) => b.sellingDate.localeCompare(a.sellingDate) || b.docNo.localeCompare(a.docNo)),
      sales: db.sales
        .filter((s) => s.growerNo === growerNo)
        .map((s) => ({
          ...s,
          grossCents:
            s.historical?.usdValueCents ??
            db.bales.filter((b) => b.saleId === s.id && !b.saleCode && b.priceCents).reduce((a, b) => a + ticketValueCents(b.priceCents!, b.mass), 0),
        }))
        .sort((a, b) => b.refNo - a.refNo),
      payments: db.paymentLines
        .filter((l) => l.growerNo === growerNo)
        .map((l) => ({ ...l, scheduleRef: db.paymentSchedules.find((s) => s.id === l.scheduleId)?.ref ?? l.scheduleId })),
      banks: db.growerBankAccounts.filter((a) => a.growerNo === growerNo),
      stopOrders: db.stopOrders
        .filter((s) => s.growerNo === growerNo)
        .map((s) => ({ ...s, creditorName: db.creditors.find((c) => c.code === s.creditorCode)?.name ?? s.creditorCode })),
      deductions: db.deductions.filter((d) => d.growerNo === growerNo),
    };
  });

  if (isLoading) return <Skeleton className="h-[32rem] rounded-2xl" />;
  if (!data) {
    return (
      <EmptyState
        icon={UserX}
        title="Grower not found"
        description={`No grower “${growerNo}” in the register. Import the grower register if this grower should exist.`}
        action={
          <Button asChild variant="secondary">
            <Link href="/growers">Back to growers</Link>
          </Button>
        }
        className="rounded-2xl border border-border bg-surface"
      />
    );
  }
  return <View d={data} />;
}

function View({ d }: { d: Detail }) {
  const g = d.grower;
  const totalBooked = d.bookings.reduce((a, b) => a + b.balesBooked, 0);
  const totalDelivered = d.deliveries.reduce((a, n) => a + n.baleCount, 0);
  const gross = d.sales.reduce((a, s) => a + s.grossCents, 0);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {g.firstName} {g.surname} <span className="font-mono text-xl font-medium text-muted-foreground">{g.growerNo}</span>
          </span>
        }
        description={`District ${g.district || "—"} · Season ${g.season}`}
        badges={
          <>
            {g.active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="outline">Inactive</Badge>}
            {g.isDemo ? <DemoBadge /> : null}
          </>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href="/growers">
              <ArrowLeft /> Growers
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="overview">
        <TabsList className="max-w-full flex-wrap" aria-label="Grower sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings">Bookings ({d.bookings.length})</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries ({d.deliveries.length})</TabsTrigger>
          <TabsTrigger value="sales">Sales ({d.sales.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({d.payments.length})</TabsTrigger>
          <TabsTrigger value="bank" data-testid="tab-bank">Bank accounts ({d.banks.length})</TabsTrigger>
          <TabsTrigger value="stoporders">Stop orders ({d.stopOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Bales booked" value={totalBooked} hint={`${d.bookings.length} booking(s)`} />
            <StatCard label="Bales delivered" value={totalDelivered} hint={`${d.deliveries.length} delivery note(s)`} />
            <StatCard label="Gross sales" value={formatUsd(gross)} hint={`${d.sales.length} sale(s)`} />
            <StatCard
              label="Bank details"
              value={d.banks.length ? d.banks.map((b) => b.currency).join(" · ") : "None"}
              tone={d.banks.length ? "success" : "warning"}
              hint={d.banks.length ? "Included in payment schedules" : "Left out of payment schedules"}
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Register entry</CardTitle>
              </CardHeader>
              <CardContent>
                <KeyValue
                  columns={3}
                  items={[
                    { label: "Grower number", value: <span className="font-mono">{g.growerNo}</span> },
                    { label: "First name", value: g.firstName },
                    { label: "Surname", value: g.surname },
                    { label: "District", value: g.district || "—" },
                    { label: "Season", value: g.season },
                    { label: "Cellphone", value: g.cellphone ?? "—" },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Not in the manuals</CardTitle>
                  <CardDescription>Configurable future fields</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  Registration information <UnverifiedBadge />
                </p>
                <p className="flex items-center gap-2">
                  Contact details beyond cellphone <UnverifiedBadge />
                </p>
                <p className="text-xs">Only documented fields are shown. These can be added as configurable fields when the business confirms what it keeps.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bookings">
          <BookingsTab rows={d.bookings} />
        </TabsContent>
        <TabsContent value="deliveries">
          <DeliveriesTab rows={d.deliveries} />
        </TabsContent>
        <TabsContent value="sales">
          <SalesTab rows={d.sales} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab rows={d.payments} />
        </TabsContent>
        <TabsContent value="bank">
          <BankTab growerNo={g.growerNo} rows={d.banks} />
        </TabsContent>
        <TabsContent value="stoporders">
          <StopOrdersTab stopOrders={d.stopOrders} deductions={d.deductions} />
        </TabsContent>
      </Tabs>
    </>
  );
}

const tableProps = { pageSize: 10, hidePagerWhenSinglePage: true, enableColumnVisibility: false } as const;

function BookingsTab({ rows }: { rows: GrowerBooking[] }) {
  const cols: ColumnDef<GrowerBooking, unknown>[] = [
    { accessorKey: "bookedId", header: "Booked id", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue<string>()}</span> },
    { accessorKey: "sellDate", header: "Sell date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "bookDate", header: "Book date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "balesBooked", header: "Bales booked", cell: ({ getValue }) => <span className="tabular font-medium">{getValue<number>()}</span> },
    { accessorKey: "bookedBy", header: "Booked by" },
    { accessorKey: "lastUpdated", header: "Last updated", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
  ];
  return <DataTable aria-label="Bookings" columns={cols} data={rows} emptyTitle="No bookings for this grower" emptyDescription="Bookings arrive in TIMB's booking file." {...tableProps} />;
}

function DeliveriesTab({ rows }: { rows: Array<DeliveryNote & { baleCount: number }> }) {
  const cols: ColumnDef<DeliveryNote & { baleCount: number }, unknown>[] = [
    { accessorKey: "docNo", header: "Delivery note", cell: ({ row }) => <GdnLink id={row.original.id} docNo={row.original.docNo} /> },
    { accessorKey: "sellingDate", header: "Selling date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "location", header: "Location" },
    { accessorKey: "row", header: "Floor row", cell: ({ getValue }) => getValue<number>() ?? "—" },
    { accessorKey: "balesDeclared", header: "Declared", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "baleCount", header: "Captured", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "state", header: "State", cell: ({ getValue }) => <StatusBadge kind="deliveryNote" value={getValue<string>()} /> },
  ];
  return <DataTable aria-label="Deliveries" columns={cols} data={rows} emptyTitle="No deliveries yet" emptyDescription="Deliveries appear once a truck carrying this grower is received." {...tableProps} />;
}

function SalesTab({ rows }: { rows: Array<Sale & { grossCents: number }> }) {
  const cols: ColumnDef<Sale & { grossCents: number }, unknown>[] = [
    { accessorKey: "refNo", header: "Sale", cell: ({ row }) => <SaleLink id={row.original.id} refNo={row.original.refNo} /> },
    { accessorKey: "saleDate", header: "Sale date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge kind="sale" value={getValue<string>()} /> },
    { accessorKey: "grossCents", header: "Gross (USD)", cell: ({ getValue }) => <span className="tabular font-medium">{getValue<number>() ? formatUsd(getValue<number>()) : "—"}</span> },
    { accessorKey: "payBatchNo", header: "Pay batch", cell: ({ row }) => (row.original.payBatchNo ? <PayBatchLink no={row.original.payBatchNo} /> : <span className="text-muted-foreground">—</span>) },
    { accessorKey: "released", header: "Released", cell: ({ getValue }) => (getValue<boolean>() ? <Badge tone="success" dot>Released</Badge> : <Badge tone="outline">Not released</Badge>) },
  ];
  return (
    <DataTable
      aria-label="Sales"
      columns={cols}
      data={rows}
      emptyTitle="No sales yet"
      emptyDescription="A sale is created when the grower's floor summary is complete."
      {...tableProps}
    />
  );
}

function PaymentsTab({ rows }: { rows: Array<PaymentScheduleLine & { scheduleRef: string }> }) {
  const cols: ColumnDef<PaymentScheduleLine & { scheduleRef: string }, unknown>[] = [
    { accessorKey: "scheduleRef", header: "Schedule", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue<string>()}</span> },
    { accessorKey: "transactionDate", header: "Date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "currency", header: "Currency" },
    { accessorKey: "amountCents", header: "Amount", cell: ({ getValue }) => <span className="tabular font-medium">{formatUsd(getValue<number>())}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge kind="paymentLine" value={getValue<string>()} /> },
    { accessorKey: "confirmationRef", header: "Confirmation", cell: ({ getValue }) => <span className="font-mono text-[13px] text-muted-foreground">{getValue<string>() ?? "—"}</span> },
  ];
  return <DataTable aria-label="Payments" columns={cols} data={rows} emptyTitle="No payments yet" emptyDescription="Payments appear once a payment schedule includes this grower." {...tableProps} />;
}

function BankTab({ growerNo, rows }: { growerNo: string; rows: GrowerBankAccount[] }) {
  const [editing, setEditing] = useState<GrowerBankAccount | undefined>();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<GrowerBankAccount | null>(null);
  const [reason, setReason] = useState("");
  const { run, isPending } = useAction(removeGrowerBankAccount, { success: "Bank account removed" });

  const cols: ColumnDef<GrowerBankAccount, unknown>[] = [
    { accessorKey: "currency", header: "Currency", cell: ({ getValue }) => <Badge tone="neutral">{getValue<string>()}</Badge> },
    { accessorKey: "bankName", header: "Bank", cell: ({ row }) => <span className="inline-flex items-center gap-2">{row.original.bankName}{row.original.isDemo ? <DemoBadge /> : null}</span> },
    { accessorKey: "bankCode", header: "Bank code" },
    { accessorKey: "branchCode", header: "Branch code" },
    { accessorKey: "accountNo", header: "Account no.", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue<string>()}</span> },
    { accessorKey: "accountName", header: "Account name" },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <PermissionButton
            permission="growers.edit-bank"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.original.currency} account`}
            onClick={() => {
              setEditing(row.original);
              setOpen(true);
            }}
          >
            <Pencil />
          </PermissionButton>
          <PermissionButton permission="growers.edit-bank" variant="ghost" size="icon-sm" aria-label={`Remove ${row.original.currency} account`} onClick={() => setRemoving(row.original)}>
            <Trash2 />
          </PermissionButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <Callout tone="warning" title="No bank details">
          This grower is left out of the payment schedule until a bank account is added (Manual 08).
        </Callout>
      ) : null}
      <DataTable
        aria-label="Bank accounts"
        columns={cols}
        data={rows}
        emptyIcon={Landmark}
        emptyTitle="No bank accounts"
        emptyDescription="Add a USD and/or local-currency account."
        toolbarActions={
          <PermissionButton
            permission="growers.edit-bank"
            size="sm"
            data-testid="add-bank-account"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus /> Add bank account
          </PermissionButton>
        }
        {...tableProps}
      />
      <BankAccountDialog open={open} onOpenChange={setOpen} growerNo={growerNo} account={editing} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRemoving(null);
            setReason("");
          }
        }}
        title={`Remove the ${removing?.currency} account?`}
        description="The grower will be left out of that currency's payment schedule. Past payment lines keep their copy of the details. A reason is recorded in the audit log."
        tone="danger"
        confirmLabel="Remove account"
        loading={isPending}
        onConfirm={async () => {
          if (!removing) return;
          const res = await run({ id: removing.id, reason });
          if (res.ok) {
            setRemoving(null);
            setReason("");
          }
        }}
      >
        <Field label="Reason" htmlFor="rm-reason" required>
          <Input id="rm-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Account closed" />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

function StopOrdersTab({ stopOrders, deductions }: { stopOrders: Array<StopOrder & { creditorName: string }>; deductions: Deduction[] }) {
  const soCols: ColumnDef<StopOrder & { creditorName: string }, unknown>[] = [
    { accessorKey: "creditorName", header: "Creditor", cell: ({ row }) => <span>{row.original.creditorCode} · {row.original.creditorName}</span> },
    { accessorKey: "fileDate", header: "File date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "amount1Cents", header: "Amount 1", cell: ({ getValue }) => <span className="tabular font-medium">{formatUsd(getValue<number>())}</span> },
    { accessorKey: "paidAmountCents", header: "Paid", cell: ({ getValue }) => <span className="tabular">{formatUsd(getValue<number>())}</span> },
    { accessorKey: "priority", header: "Priority" },
    { accessorKey: "recType", header: "Rec type" },
  ];
  const dCols: ColumnDef<Deduction, unknown>[] = [
    { accessorKey: "sequence", header: "Order", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "creditorName", header: "Creditor" },
    { accessorKey: "description", header: "Description" },
    { accessorKey: "amountCents", header: "Amount", cell: ({ getValue }) => <span className="tabular font-medium">{formatUsd(getValue<number>())}</span> },
    { accessorKey: "payBatchNo", header: "Pay batch", cell: ({ getValue }) => <PayBatchLink no={getValue<number>()} /> },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-semibold">TIMB stop orders</p>
        <DataTable aria-label="Stop orders" columns={soCols} data={stopOrders} emptyTitle="No stop orders" emptyDescription="Stop orders arrive in TIMB's stop order file." {...tableProps} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Deductions taken</p>
        <DataTable aria-label="Deductions" columns={dCols} data={deductions} emptyTitle="No deductions yet" emptyDescription="Deductions are taken when the sale is processed." {...tableProps} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileStack, Landmark, Plus, Wallet } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UnverifiedBadge,
  type ColumnDef,
} from "@tobacco/ui";
import { centsToDecimalString, formatDateTime, formatUsd, type InternalInvoice, type MerchantLoan, type StopOrder } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { GrowerLink } from "@/components/domain/entity-links";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDb, useDbQuery } from "@/mock/hooks";
import { addInternalInvoice, addMerchantLoan } from "@/mock/domain/stop-orders";

type StopOrderRow = StopOrder & { name: string; creditorName: string };
type InvoiceRow = InternalInvoice & { name: string; creditorName: string };
type LoanRow = MerchantLoan & { name: string; creditorName: string };

const decimal = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a decimal amount like 25.50");

export default function StopOrdersPage() {
  return (
    <RequirePermission permission="deductions.view">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [dialog, setDialog] = useState<"invoice" | "loan" | null>(null);
  const { data, isLoading } = useDbQuery(["finance", "stop-orders"], (db) => {
    const nameOf = (no: string) => {
      const g = db.growers.find((x) => x.growerNo === no);
      return g ? `${g.firstName} ${g.surname}` : no;
    };
    const credOf = (c: string) => db.creditors.find((x) => x.code === c)?.name ?? `Creditor ${c}`;
    return {
      stopOrders: db.stopOrders.map((s): StopOrderRow => ({ ...s, name: nameOf(s.growerNo), creditorName: credOf(s.creditorCode) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      invoices: db.internalInvoices.map((i): InvoiceRow => ({ ...i, name: nameOf(i.growerNo), creditorName: credOf(i.creditorCode) })),
      loans: db.merchantLoans.map((l): LoanRow => ({ ...l, name: nameOf(l.growerNo), creditorName: credOf(l.creditorCode) })),
    };
  });

  const stopColumns: ColumnDef<StopOrderRow, unknown>[] = [
    { accessorKey: "timbFile", header: "TIMB File", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    { accessorKey: "growerNo", header: "Grower No.", cell: ({ row }) => <GrowerLink growerNo={row.original.growerNo} /> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "creditorName", header: "Creditor", cell: ({ row }) => `${row.original.creditorCode} - ${row.original.creditorName}` },
    { accessorKey: "creditorCode", header: "Creditor code" },
    { accessorKey: "amount1Cents", header: "Amount 1", cell: ({ getValue }) => <span className="tabular">{formatUsd(getValue<number>())}</span> },
    { accessorKey: "amount2Cents", header: "Amount 2", cell: ({ getValue }) => <span className="tabular">{formatUsd(getValue<number>())}</span> },
    { accessorKey: "amount3Cents", header: "Amount 3", cell: ({ getValue }) => <span className="tabular">{formatUsd(getValue<number>())}</span> },
    {
      accessorKey: "paidAmountCents",
      header: "Paid Amount",
      cell: ({ row }) => (
        <span className="tabular inline-flex items-center gap-2">
          {formatUsd(row.original.paidAmountCents)}
          {row.original.paidAmountCents >= row.original.amount1Cents ? <Badge tone="success" dot>Deducted</Badge> : <Badge tone="outline">Pending</Badge>}
        </span>
      ),
    },
    { accessorKey: "priority", header: "Priority" },
    { accessorKey: "recType", header: "Rec Type" },
    { accessorKey: "stopOrderNo", header: "Stop Order No." },
    { accessorKey: "percent", header: "Percent" },
    { accessorKey: "season", header: "Season" },
    { accessorKey: "createdAt", header: "Created", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
  ];

  const invoiceColumns: ColumnDef<InvoiceRow, unknown>[] = [
    { accessorKey: "id", header: "Invoice", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    { accessorKey: "growerNo", header: "Grower No.", cell: ({ row }) => <GrowerLink growerNo={row.original.growerNo} /> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "creditorName", header: "Creditor" },
    { accessorKey: "description", header: "Description" },
    { accessorKey: "amountCents", header: "Amount", cell: ({ row }) => <span className="tabular">{formatUsd(row.original.amountCents)} {row.original.currency}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <Badge tone={getValue<string>() === "OPEN" ? "warning" : "success"} dot>{getValue<string>() === "OPEN" ? "Open" : "Settled"}</Badge> },
  ];

  const loanColumns: ColumnDef<LoanRow, unknown>[] = [
    { accessorKey: "id", header: "Loan", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    { accessorKey: "growerNo", header: "Grower No.", cell: ({ row }) => <GrowerLink growerNo={row.original.growerNo} /> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "creditorName", header: "Merchant / creditor" },
    { accessorKey: "balanceCents", header: "Balance", cell: ({ row }) => <span className="tabular">{formatUsd(row.original.balanceCents)} {row.original.currency}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <Badge tone={getValue<string>() === "OPEN" ? "warning" : "success"} dot>{getValue<string>() === "OPEN" ? "Open" : "Settled"}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Stop orders & grower deductions"
        description="TIMB stop orders, internal invoices and merchant loans that are deducted at Stop Order Processing. Paid Amount fills in after processing."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/timb/imports/new?type=STOP_ORDER">
                <FileStack /> Import stop order file
              </Link>
            </Button>
            <Button asChild>
              <Link href="/finance/stop-order-processing">Stop Order Processing</Link>
            </Button>
          </>
        }
      />
      <Tabs defaultValue="stop-orders">
        <TabsList>
          <TabsTrigger value="stop-orders" data-testid="tab-stop-orders">
            <FileStack className="size-4" aria-hidden /> Stop orders
            <Badge tone="outline">{data?.stopOrders.length ?? 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">
            <Wallet className="size-4" aria-hidden /> Internal invoices
            <Badge tone="outline">{data?.invoices.length ?? 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="loans" data-testid="tab-loans">
            <Landmark className="size-4" aria-hidden /> Merchant loans
            <Badge tone="outline">{data?.loans.length ?? 0}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stop-orders" className="flex flex-col gap-3">
          <DataTable
            aria-label="TIMB stop orders"
            data-testid="stop-orders-table"
            columns={stopColumns}
            data={data?.stopOrders ?? []}
            loading={isLoading}
            searchPlaceholder="Search grower, creditor, file…"
            emptyIcon={FileStack}
            emptyTitle="No stop orders imported"
            emptyDescription="Stop orders arrive in TIMB's encrypted file (EL_…YYYYMMDD.txt). Import it from TIMB data → Imports."
            initialColumnVisibility={{ amount2Cents: false, amount3Cents: false, percent: false, season: false }}
            emptyAction={
              <Button asChild size="sm">
                <Link href="/timb/imports/new?type=STOP_ORDER">Import stop order file</Link>
              </Button>
            }
          />
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <UnverifiedBadge uq="UQ-07" /> What Amount 1/2/3, Rec Type and Percent mean is not documented. Phase 1 treats Amount 1 as the amount to deduct.
          </p>
        </TabsContent>

        <TabsContent value="invoices" className="flex flex-col gap-3">
          <DataTable
            aria-label="Internal invoices"
            data-testid="invoices-table"
            columns={invoiceColumns}
            data={data?.invoices ?? []}
            loading={isLoading}
            searchPlaceholder="Search invoices…"
            emptyIcon={Wallet}
            emptyTitle="No internal invoices"
            emptyDescription="Internal invoices are deducted second, after statutory and floor charges."
            toolbarActions={
              <PermissionButton permission="deductions.process" size="sm" onClick={() => setDialog("invoice")} data-testid="add-invoice">
                <Plus /> Add internal invoice
              </PermissionButton>
            }
          />
        </TabsContent>

        <TabsContent value="loans" className="flex flex-col gap-3">
          <DataTable
            aria-label="Merchant loans"
            data-testid="loans-table"
            columns={loanColumns}
            data={data?.loans ?? []}
            loading={isLoading}
            searchPlaceholder="Search loans…"
            emptyIcon={Landmark}
            emptyTitle="No merchant loans"
            emptyDescription="Merchant loans are deducted third. How instalments work is not documented."
            toolbarActions={
              <PermissionButton permission="deductions.process" size="sm" onClick={() => setDialog("loan")} data-testid="add-loan">
                <Plus /> Add merchant loan
              </PermissionButton>
            }
          />
        </TabsContent>
      </Tabs>

      <InvoiceDialog open={dialog === "invoice"} onOpenChange={(o) => !o && setDialog(null)} />
      <LoanDialog open={dialog === "loan"} onOpenChange={(o) => !o && setDialog(null)} />
    </>
  );
}

const invoiceSchema = z.object({
  growerNo: z.string().min(1, "Choose a grower"),
  creditorCode: z.string().min(1, "Choose a creditor"),
  description: z.string().trim().min(1, "Description is required"),
  amount: decimal,
});
type InvoiceForm = z.infer<typeof invoiceSchema>;

function GrowerCreditorFields({ form, amountLabel, amountKey }: { form: ReturnType<typeof useForm<InvoiceForm>>; amountLabel: string; amountKey: "amount" }) {
  const growers = useDb((db) => db.growers);
  const creditors = useDb((db) => db.creditors);
  const { errors } = form.formState;
  return (
    <>
      <Field label="Grower" htmlFor="df-grower" required error={errors.growerNo?.message}>
        <NativeSelect id="df-grower" aria-invalid={!!errors.growerNo} {...form.register("growerNo")}>
          <option value="">Select a grower…</option>
          {growers.map((g) => (
            <option key={g.growerNo} value={g.growerNo}>
              {g.growerNo} · {g.firstName} {g.surname}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Creditor" htmlFor="df-creditor" required error={errors.creditorCode?.message}>
        <NativeSelect id="df-creditor" aria-invalid={!!errors.creditorCode} {...form.register("creditorCode")}>
          <option value="">Select a creditor…</option>
          {creditors.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={amountLabel} htmlFor="df-amount" required hint="USD, e.g. 25.50" error={errors[amountKey]?.message}>
        <Input id="df-amount" inputMode="decimal" aria-invalid={!!errors[amountKey]} {...form.register(amountKey)} />
      </Field>
    </>
  );
}

function InvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run, isPending } = useAction(addInternalInvoice, { silent: true, success: "Internal invoice added" });
  const [error, setError] = useState<string | null>(null);
  const form = useForm<InvoiceForm>({ resolver: zodResolver(invoiceSchema), defaultValues: { growerNo: "", creditorCode: "", description: "", amount: "" } });
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    const res = await run(v);
    if (res.ok) {
      form.reset();
      onOpenChange(false);
    } else setError(res.error.message);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Add internal invoice</DialogTitle>
            <DialogDescription>Deducted second (after floor charges) when the grower's sale is processed.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <GrowerCreditorFields form={form} amountLabel="Amount" amountKey="amount" />
            <Field label="Description" htmlFor="df-desc" required error={form.formState.errors.description?.message}>
              <Input id="df-desc" {...form.register("description")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Add invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const loanSchema = z.object({
  growerNo: z.string().min(1, "Choose a grower"),
  creditorCode: z.string().min(1, "Choose a creditor"),
  balance: decimal,
});
type LoanForm = z.infer<typeof loanSchema>;

function LoanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const growers = useDb((db) => db.growers);
  const creditors = useDb((db) => db.creditors);
  const { run, isPending } = useAction(addMerchantLoan, { silent: true, success: "Merchant loan added" });
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoanForm>({ resolver: zodResolver(loanSchema), defaultValues: { growerNo: "", creditorCode: "", balance: "" } });
  const { errors } = form.formState;
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    const res = await run(v);
    if (res.ok) {
      form.reset();
      onOpenChange(false);
    } else setError(res.error.message);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Add merchant loan</DialogTitle>
            <DialogDescription>Deducted third. The full open balance is taken, limited to what is left of the sale value (UQ-22).</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <Field label="Grower" htmlFor="ln-grower" required error={errors.growerNo?.message}>
              <NativeSelect id="ln-grower" aria-invalid={!!errors.growerNo} {...form.register("growerNo")}>
                <option value="">Select a grower…</option>
                {growers.map((g) => (
                  <option key={g.growerNo} value={g.growerNo}>
                    {g.growerNo} · {g.firstName} {g.surname}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Merchant / creditor" htmlFor="ln-creditor" required error={errors.creditorCode?.message}>
              <NativeSelect id="ln-creditor" aria-invalid={!!errors.creditorCode} {...form.register("creditorCode")}>
                <option value="">Select a creditor…</option>
                {creditors.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Open balance" htmlFor="ln-balance" required hint={`USD, e.g. ${centsToDecimalString(12000)}`} error={errors.balance?.message}>
              <Input id="ln-balance" inputMode="decimal" aria-invalid={!!errors.balance} {...form.register("balance")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Add loan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

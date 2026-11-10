"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PackageCheck, Scale, Undo2 } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  KeyValue,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  UnverifiedBadge,
  type ColumnDef,
} from "@tobacco/ui";
import {
  DEDUCTION_SOURCE_LABEL,
  MESSAGES,
  convertCentsToLocal,
  formatDate,
  formatDateTime,
  formatKg,
  formatLocal,
  formatUsd,
  type Bale,
  type Deduction,
} from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { BalancePreviewPanel } from "@/components/sales/balance-preview";
import { SaleStatusBar } from "@/components/sales/sale-status-bar";
import { GdnLink, GrowerLink } from "@/components/domain/entity-links";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDb, useDbQuery } from "@/mock/hooks";
import { requestSaleReversal } from "@/mock/domain/approvals";
import { balanceSale, releaseSale, selectSaleDetail } from "@/mock/domain/sales";

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: d, isLoading } = useDbQuery(["sale", id], (db) => selectSaleDetail(db, id));
  const currency = useDb((db) => db.settings.localCurrencyCode);
  const [confirmBalance, setConfirmBalance] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reason, setReason] = useState("");
  const balance = useAction(balanceSale, { success: MESSAGES.SALE_BALANCED.text, silent: false });
  const release = useAction(releaseSale, { success: "Sale released for dispatch" });
  const reverse = useAction(requestSaleReversal, {
    success: (r) => (r.mode === "REQUESTED" ? `Reversal requested — ${r.approval?.ref} awaits an approver` : "Sale reversed to Draft"),
  });

  const issueBarcodes = useMemo(() => new Set((d?.preview.issues ?? []).map((i) => i.barcode).filter(Boolean)), [d]);

  if (isLoading && !d) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (!d) return <ErrorState title="Sale not found" description="It may have been removed or the link is wrong." action={<Button asChild variant="secondary"><Link href="/sales">Back to sales</Link></Button>} />;

  const { sale, preview } = d;
  const rate = d.exchangeRate;

  const ticketColumns: ColumnDef<Bale, unknown>[] = [
    { accessorKey: "ticketBarcode", header: "Barcode", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue<string>()}</span> },
    { accessorKey: "group", header: "Group" },
    { accessorKey: "lot", header: "Lot No." },
    { accessorKey: "saleCode", header: "Sale Code", cell: ({ getValue }) => getValue<string | undefined>() ?? "" },
    { accessorKey: "buyerCode", header: "Buyer", cell: ({ getValue }) => getValue<string | undefined>() ?? "" },
    { accessorKey: "hessianOwner", header: "Hessian Owner", cell: ({ getValue }) => getValue<string | undefined>() ?? "" },
    { accessorKey: "buyerGrade", header: "Buyer Grade", cell: ({ getValue }) => getValue<string | undefined>() ?? "" },
    { accessorKey: "timbGrade", header: "TIMB Grade / Reason", cell: ({ getValue }) => getValue<string | undefined>() ?? "" },
    { accessorKey: "priceCents", header: "US Price", cell: ({ getValue }) => <span className="tabular">{getValue<number | undefined>() ?? ""}</span> },
    { accessorKey: "mass", header: "Mass", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { id: "released", header: "Released", accessorFn: () => (sale.released ? "yes" : "no"), cell: () => (sale.released ? <Badge tone="success" dot>Yes</Badge> : <span className="text-muted-foreground">—</span>) },
  ];

  const dedColumns: ColumnDef<Deduction, unknown>[] = [
    { accessorKey: "sequence", header: "Order" },
    { id: "source", header: "Source", accessorFn: (r) => DEDUCTION_SOURCE_LABEL[r.source] },
    { accessorKey: "creditorName", header: "Creditor", cell: ({ row }) => <span>{row.original.creditorName} <span className="text-xs text-muted-foreground">{row.original.creditorCode}</span></span> },
    { accessorKey: "description", header: "Description" },
    { accessorKey: "currency", header: "Currency" },
    { accessorKey: "amountCents", header: "Amount", cell: ({ getValue }) => <span className="tabular">{formatUsd(getValue<number>())}</span> },
    { accessorKey: "paidCents", header: "Paid", cell: ({ getValue }) => <span className="tabular">{formatUsd(getValue<number>())}</span> },
  ];

  const net = preview.grossValueCents - d.deductionsTotalCents;

  return (
    <RequirePermission permission="sales.view">
      <PageHeader
        title={`Sale #${sale.refNo} · ${sale.growerNo} ${d.growerName}`}
        description={`Salesmaster ${sale.refNo} · ${formatDate(sale.saleDate)} · ${d.sellingPointName}`}
        badges={
          <>
            {sale.released ? <Badge tone="success" dot>Released</Badge> : <Badge tone="outline">Not released</Badge>}
            {sale.historical ? <Badge tone="outline">Historical demo sale</Badge> : null}
          </>
        }
        actions={
          <>
            <PermissionButton
              permission="sales.balance"
              onClick={() => setConfirmBalance(true)}
              disabled={!preview.canBalance}
              disabledReason={!preview.canBalance ? preview.blockedReason : undefined}
              data-testid="balance-sale"
            >
              <Scale /> Balance Sale
            </PermissionButton>
            <PermissionButton
              permission="sales.release"
              variant="secondary"
              onClick={() => setConfirmRelease(true)}
              disabled={sale.status === "DRAFT" || sale.released}
              disabledReason={sale.status === "DRAFT" ? "Balance the sale first." : sale.released ? "Already released." : undefined}
              data-testid="release-sale"
            >
              <PackageCheck /> Release for dispatch
            </PermissionButton>
            <PermissionButton
              permission="sales.reverse"
              variant="secondary"
              onClick={() => setReverseOpen(true)}
              disabled={sale.status !== "BALANCED"}
              disabledReason={sale.status === "PROCESSED" ? "A Processed sale needs a financial reversal (not specified — UQ-06)." : sale.status === "DRAFT" ? "Only a Balanced sale can be reversed." : undefined}
              data-testid="reverse-sale"
            >
              <Undo2 /> Reverse
            </PermissionButton>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4">
          <SaleStatusBar status={sale.status} />
          <p className="text-xs text-muted-foreground">Last updated {formatDateTime(sale.updatedAt)}</p>
        </div>

        {d.pendingApprovalIds.length > 0 ? (
          <Callout tone="warning" title="Approval pending" action={<Button asChild size="sm" variant="secondary"><Link href="/approvals">View approvals</Link></Button>}>
            A reversal of this sale is waiting for an approver ({d.pendingApprovalIds.length} request).
          </Callout>
        ) : null}

        <div className="rounded-2xl border border-border bg-surface p-5">
          <KeyValue
            columns={4}
            items={[
              { label: "Grower No.", value: <GrowerLink growerNo={sale.growerNo} /> },
              { label: "First name", value: d.firstName },
              { label: "Surname", value: d.surname },
              { label: "Sale", value: sale.saleNo },
              { label: "Sale Date", value: formatDate(sale.saleDate) },
              { label: "Sale Point", value: d.sellingPointName },
              { label: "Floor Code", value: sale.floorCode },
              { label: "Delivery Note", value: d.note ? <GdnLink id={d.note.id} docNo={d.note.docNo} /> : "—" },
              { label: "Released", value: sale.released ? "Yes" : "No" },
              { label: "ZWG Payment Ref", value: sale.zwgPaymentRef ?? "—" },
              { label: "USD Payment Ref", value: sale.usdPaymentRef ?? "—" },
              { label: "Pay batch no.", value: sale.payBatchNo ?? "—" },
            ]}
          />
        </div>

        {sale.status === "DRAFT" ? <BalancePreviewPanel preview={preview} /> : null}

        <Tabs defaultValue="tickets">
          <TabsList>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="deductions">Deductions</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          <TabsContent value="tickets">
            {sale.historical ? (
              <div className="rounded-2xl border border-border bg-surface">
                <EmptyState title="Bale-level detail not seeded" description={`This historical demo sale carries aggregates only: ${sale.historical.baleCount} bales, ${formatKg(sale.historical.massKg)}, ${formatUsd(sale.historical.usdValueCents)}.`} />
              </div>
            ) : (
              <DataTable
                aria-label="Tickets"
                data-testid="tickets-table"
                columns={ticketColumns}
                data={d.bales}
                pageSize={25}
                hidePagerWhenSinglePage
                enableColumnVisibility={false}
                emptyTitle="No tickets"
                rowClassName={(b) => (b.ticketBarcode && issueBarcodes.has(b.ticketBarcode) ? "bg-danger-soft/50" : undefined)}
              />
            )}
          </TabsContent>
          <TabsContent value="deductions">
            {d.deductions.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface">
                <EmptyState title="No deductions yet" description="Deductions are taken when Stop Order Processing runs on a Balanced sale (Manual 07)." />
              </div>
            ) : (
              <>
                <DataTable aria-label="Deductions" columns={dedColumns} data={d.deductions} pageSize={25} hidePagerWhenSinglePage enableColumnVisibility={false} />
                <p className="mt-3 text-sm text-muted-foreground">
                  Total deducted <span className="tabular font-semibold text-foreground">{formatUsd(d.deductionsTotalCents)}</span> · Net grower payout{" "}
                  <span className="tabular font-semibold text-foreground">{formatUsd(net)}</span>
                </p>
              </>
            )}
          </TabsContent>
          <TabsContent value="summary">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <KeyValue
                columns={3}
                items={[
                  { label: "Bales", value: preview.baleCount },
                  { label: "Purchased bales", value: preview.purchasedCount },
                  { label: "Unsold / rejected bales", value: preview.unsoldCount },
                  { label: "Total mass", value: formatKg(preview.totalMassKg) },
                  {
                    label: "Gross sale value",
                    value: (
                      <span className="flex items-center gap-2">
                        {sale.status === "DRAFT" ? `${formatUsd(preview.grossValueCents)} (provisional)` : formatUsd(preview.grossValueCents)} <UnverifiedBadge uq="UQ-05" />
                      </span>
                    ),
                  },
                  {
                    label: `${currency} value`,
                    value: (
                      <span className="flex items-center gap-2">
                        {rate && sale.status !== "DRAFT" ? formatLocal(convertCentsToLocal(preview.grossValueCents, rate), currency) : "—"} <UnverifiedBadge uq="UQ-04" />
                      </span>
                    ),
                  },
                  { label: "Deductions", value: d.deductions.length ? formatUsd(d.deductionsTotalCents) : "—" },
                  { label: "Net grower payout", value: sale.status === "PROCESSED" ? formatUsd(net) : "—" },
                  { label: "Exchange rate (Start of Day)", value: rate ?? "—" },
                ]}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                Gross value = Σ price (US cents/kg) × mass (kg) over purchased bales. This arithmetic and its rounding are not documented in the manuals.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={confirmBalance}
        onOpenChange={setConfirmBalance}
        title="Balance this sale?"
        description={`Sale #${sale.refNo} (${sale.growerNo}) moves to Balanced. Gross value ${formatUsd(preview.grossValueCents)} across ${preview.baleCount} bales.`}
        confirmLabel="Balance Sale"
        loading={balance.isPending}
        onConfirm={async () => {
          await balance.run({ saleId: sale.id });
          setConfirmBalance(false);
        }}
      />
      <ConfirmDialog
        open={confirmRelease}
        onOpenChange={setConfirmRelease}
        title="Release this sale for dispatch?"
        description="Dispatch refuses bales from sales that have not been released. (Who releases a sale at Ethical is not documented — UQ-03.)"
        confirmLabel="Release"
        loading={release.isPending}
        onConfirm={async () => {
          await release.run({ saleId: sale.id });
          setConfirmRelease(false);
        }}
      />
      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse sale #{sale.refNo}</DialogTitle>
            <DialogDescription>
              Returns a Balanced sale to Draft. By default this needs an approver. What a reversal does exactly is not documented (UQ-06).
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Reason" htmlFor="reverse-reason" required>
              <Textarea id="reverse-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why does this sale need to be reversed?" data-testid="reverse-reason" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setReverseOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={reverse.isPending}
              onClick={async () => {
                const res = await reverse.run({ saleId: sale.id, reason });
                if (res.ok) {
                  setReverseOpen(false);
                  setReason("");
                }
              }}
              data-testid="submit-reversal"
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequirePermission>
  );
}

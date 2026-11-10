import { Badge, DemoBadge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tobacco/ui";
import { DEDUCTION_SOURCE_LABEL, formatDate, formatUsd, longDate } from "@tobacco/shared";
import type { SalesSheet as SalesSheetModel } from "@/mock/domain/payments";

/**
 * Printable grower sales sheet (Manual 08 Step 1). Rendered from the data we hold — which report Ethical actually uses is
 * an open question (UQ-12). Prints one sheet per page.
 */
export function SalesSheet({ sheet, sellingPointName }: { sheet: SalesSheetModel; sellingPointName: string }) {
  const { sale } = sheet;
  return (
    <article
      data-testid="sales-sheet"
      data-grower={sale.growerNo}
      className="break-after-page rounded-2xl border border-border bg-surface p-6 shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Grower sales sheet</p>
          <h2 className="mt-1 text-xl font-semibold">
            {sheet.growerName} <span className="font-mono text-base text-muted-foreground">{sale.growerNo}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {sellingPointName} · {longDate(sale.saleDate)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Sale ref (REF#)</dt>
          <dd className="tabular font-medium">{sale.refNo}</dd>
          <dt className="text-muted-foreground">Pay batch #</dt>
          <dd className="tabular font-medium">{sale.payBatchNo ?? "—"}</dd>
          <dt className="text-muted-foreground">Delivery note</dt>
          <dd className="font-mono text-[13px]">{sheet.delivery ?? "—"}</dd>
          <dt className="text-muted-foreground">District</dt>
          <dd className="tabular">{sheet.district ?? "—"}</dd>
          <dt className="text-muted-foreground">Processed</dt>
          <dd>{formatDate(sale.processedAt)}</dd>
        </dl>
      </header>

      <section className="mt-4" aria-label="Tickets">
        <h3 className="mb-2 text-sm font-semibold">Tickets</h3>
        {sheet.tickets.length === 0 ? (
          <p className="rounded-xl bg-surface-secondary px-4 py-3 text-sm text-muted-foreground">
            Bale-level detail is not seeded for historical demo sales (aggregate gross only).
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barcode</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Buyer grade</TableHead>
                <TableHead>TIMB grade</TableHead>
                <TableHead className="text-right">Price (US¢/kg)</TableHead>
                <TableHead className="text-right">Mass (kg)</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.tickets.map((t) => (
                <TableRow key={t.barcode}>
                  <TableCell className="font-mono text-[13px]">{t.barcode}</TableCell>
                  <TableCell className="tabular">{t.group}</TableCell>
                  <TableCell className="tabular">{t.lot}</TableCell>
                  <TableCell>{t.buyer}</TableCell>
                  <TableCell>{t.grade}</TableCell>
                  <TableCell>{t.saleCode ? <Badge tone="danger">{t.saleCode}</Badge> : t.timbGrade}</TableCell>
                  <TableCell className="tabular text-right">{t.priceCents || "—"}</TableCell>
                  <TableCell className="tabular text-right">{t.mass}</TableCell>
                  <TableCell className="tabular text-right">{formatUsd(t.valueCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="mt-5 grid gap-6 md:grid-cols-2" aria-label="Settlement">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            Deductions <DemoBadge>DEMO AMOUNTS</DemoBadge>
          </h3>
          {sheet.deductions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deductions on file.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {sheet.deductions.map((d, i) => (
                <li key={`${d.creditorName}-${i}`} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span>
                    <span className="tabular mr-2 text-xs text-muted-foreground">{d.sequence}</span>
                    {d.creditorName}
                    <span className="ml-2 text-xs text-muted-foreground">{DEDUCTION_SOURCE_LABEL[d.source]}</span>
                  </span>
                  <span className="tabular">− {formatUsd(d.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <dl className="flex flex-col gap-2 self-start rounded-xl bg-surface-secondary p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Gross sale value</dt>
            <dd className="tabular font-medium" data-testid="sheet-gross">{formatUsd(sheet.gross)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total deductions</dt>
            <dd className="tabular" data-testid="sheet-deductions">− {formatUsd(sheet.deductionsCents)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base">
            <dt className="font-semibold">Net payout</dt>
            <dd className="tabular font-semibold" data-testid="sheet-net">{formatUsd(sheet.netCents)}</dd>
          </div>
          <div className="flex justify-between pt-1">
            <dt className="text-muted-foreground">Payment</dt>
            <dd className="font-medium" data-testid="sheet-payment-status">{sheet.paymentStatus}</dd>
          </div>
          {sheet.paymentRefs.length > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Bank reference</dt>
              <dd className="font-mono text-[13px]">{sheet.paymentRefs.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </article>
  );
}

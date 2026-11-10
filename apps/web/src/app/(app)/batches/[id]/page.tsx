"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EyeOff, Send } from "lucide-react";
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
  EmptyState,
  ErrorState,
  Input,
  KeyValue,
  PageHeader,
  ProgressBar,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Timeline,
  cn,
} from "@tobacco/ui";
import { MESSAGES, formatDate, formatDateTime, formatKg, type Bale } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { GrowerLink, SaleLink } from "@/components/domain/entity-links";
import { PermissionButton, useGuard } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import { postBatch, selectBatchDetail, setBatchPrice } from "@/mock/domain/batches";

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: d, isLoading } = useDbQuery(["batch", id], (db) => selectBatchDetail(db, id));
  const [confirm, setConfirm] = useState(false);
  const post = useAction(postBatch, { success: MESSAGES.BATCH_POSTED.text });

  if (isLoading && !d) return <Skeleton className="h-96 rounded-2xl" />;
  if (!d) return <ErrorState title="Batch not found" action={<Button asChild variant="secondary"><Link href="/batches">Back to batches</Link></Button>} />;
  const posted = d.batch.status === "POSTED";
  const complete = d.pricesEntered === d.pricesNeeded;

  return (
    <RequirePermission permission="batch.view">
      <PageHeader
        title={`Batch ${d.batch.refNo} · ${d.batch.growerNo} ${d.growerName}`}
        description={`${formatDate(d.batch.sellingDate)} · ${d.sellingPointName}`}
        badges={<StatusBadge kind="priceBatch" value={d.batch.status} />}
        actions={
          <PermissionButton
            permission="batch.post"
            onClick={() => setConfirm(true)}
            disabled={posted || d.historical}
            disabledReason={posted ? "This batch is already posted." : undefined}
            data-testid="post-batch"
          >
            <Send /> Post Batch
          </PermissionButton>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {!posted && !d.historical ? (
            <Callout tone="info" title="Blind entry" data-testid="blind-note">
              <span className="flex items-center gap-2">
                <EyeOff className="size-4" aria-hidden /> Captured prices are hidden while you type the prices from the buyer's batch sheet. They appear once the batch is posted.
              </span>
            </Callout>
          ) : null}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Tickets</CardTitle>
                <CardDescription>
                  Enter the Batch Price (US cents per kg) for each ticket. Saves when you press Enter or leave the field.
                </CardDescription>
              </div>
              <div className="w-48">
                <p className="tabular mb-1 text-right text-xs text-muted-foreground">
                  {d.pricesEntered} of {d.pricesNeeded} prices
                </p>
                <ProgressBar value={d.pricesEntered} max={d.pricesNeeded} tone={complete ? "success" : "primary"} label="Batch prices entered" />
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {d.historical ? (
                <EmptyState title="Bale-level detail not seeded" description="This historical demo batch is already posted; its tickets are not part of the demo data." />
              ) : (
                <Table data-testid="batch-tickets">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Lot No.</TableHead>
                      <TableHead className="w-44">Batch Price</TableHead>
                      {posted ? <TableHead>Captured price</TableHead> : null}
                      <TableHead>Mass</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.bales.map((b) => (
                      <BatchRowEditor key={b.id} bale={b} batchId={d.batch.id} posted={posted} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-5">
              <KeyValue
                columns={1}
                items={[
                  { label: "Grower", value: <GrowerLink growerNo={d.batch.growerNo} label={`${d.batch.growerNo} · ${d.growerName}`} /> },
                  { label: "Sale", value: d.sale ? <SaleLink id={d.sale.id} refNo={d.sale.refNo} /> : "—" },
                  { label: "Selling Date (GDN)", value: formatDate(d.batch.sellingDate) },
                  { label: "Selling Point", value: d.sellingPointName },
                  { label: "Total mass", value: formatKg(d.bales.reduce((a, b) => a + b.mass, 0)) },
                  { label: "Posted", value: posted ? `${formatDateTime(d.batch.postedAt)}` : "Not yet" },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {d.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes yet.</p>
              ) : (
                <Timeline
                  items={d.history.map((h) => ({
                    id: h.id,
                    tone: h.action === "batch.post" ? "success" : "primary",
                    title: h.text,
                    meta: formatDateTime(h.at),
                    body: h.userName,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Post this batch?"
        description={`Batch ${d.batch.refNo} (${d.batch.growerNo}) moves to Posted. Batch prices can no longer be changed.`}
        confirmLabel="Post Batch"
        loading={post.isPending}
        onConfirm={async () => {
          await post.run({ batchId: d.batch.id });
          setConfirm(false);
        }}
      />
    </RequirePermission>
  );
}

function BatchRowEditor({ bale, batchId, posted }: { bale: Bale; batchId: string; posted: boolean }) {
  const saved = bale.batchPriceCents;
  const [value, setValue] = useState(saved !== undefined ? String(saved) : "");
  const [error, setError] = useState<string | null>(null);
  const set = useAction(setBatchPrice, { latency: 0, silent: true });
  const guard = useGuard("batch.capture-price");
  const unsold = Boolean(bale.saleCode);
  const mismatch = posted && !unsold && bale.priceCents !== undefined && saved !== undefined && bale.priceCents !== saved;

  const commit = async () => {
    const current = saved !== undefined ? String(saved) : "";
    if (value.trim() === current) return;
    const res = await set.run({ batchId, barcode: bale.ticketBarcode!, price: value });
    setError(res.ok ? null : res.error.message);
  };

  return (
    <TableRow data-barcode={bale.ticketBarcode} className={cn(mismatch && "bg-danger-soft/50")}>
      <TableCell className="font-mono text-[13px]">{bale.ticketBarcode}</TableCell>
      <TableCell>{bale.group}</TableCell>
      <TableCell>{bale.lot}</TableCell>
      <TableCell>
        {unsold ? (
          <Badge tone="outline">Unsold · {bale.saleCode}</Badge>
        ) : posted ? (
          <span className="tabular font-medium">{saved ?? "—"}</span>
        ) : (
          <div className="flex flex-col gap-1">
            <Input
              size="sm"
              inputMode="numeric"
              aria-label={`Batch price for ${bale.ticketBarcode}`}
              data-testid={`batch-price-${bale.ticketBarcode}`}
              value={value}
              disabled={!guard.allowed}
              title={guard.allowed ? undefined : guard.reason}
              aria-invalid={!!error}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                  // Move down to the next price field, like a spreadsheet.
                  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid^="batch-price-"]'));
                  const i = inputs.indexOf(e.currentTarget);
                  inputs[i + 1]?.focus();
                }
              }}
            />
            {error ? <span className="text-xs text-danger-text">{error}</span> : null}
          </div>
        )}
      </TableCell>
      {posted ? (
        <TableCell>
          <span className={cn("tabular", mismatch && "font-semibold text-danger-text")}>{bale.priceCents ?? "—"}</span>
          {mismatch ? <span className="ml-2 text-xs text-danger-text">≠ batch</span> : null}
        </TableCell>
      ) : null}
      <TableCell className="tabular">{bale.mass}</TableCell>
    </TableRow>
  );
}

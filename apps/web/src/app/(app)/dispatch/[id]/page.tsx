"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink, FileDown, PackageSearch, Truck } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  KeyValue,
  PageHeader,
  Skeleton,
  StatCard,
  Timeline,
  UnverifiedBadge,
} from "@tobacco/ui";
import { formatDate, formatDateTime } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { DispatchActionBar } from "@/components/dispatch/action-bar";
import { DispatchBalesTable } from "@/components/dispatch/bale-table";
import { downloadTextFile } from "@/lib/csv";
import { useDbQuery } from "@/mock/hooks";
import { PRODUCT_LABEL, selectDispatchDetail } from "@/mock/domain/dispatch";

export default function DispatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useDbQuery(["dispatch", "detail", id], (db) => selectDispatchDetail(db, id));

  if (isLoading) {
    return (
      <RequirePermission permission="dispatch.view">
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </RequirePermission>
    );
  }
  if (!data) {
    return (
      <RequirePermission permission="dispatch.view">
        <EmptyState
          icon={PackageSearch}
          title="Dispatch note not found"
          description="Check the reference, or reset the demo data."
          action={
            <Button asChild variant="secondary">
              <Link href="/dispatch">Back to dispatch notes</Link>
            </Button>
          }
        />
      </RequirePermission>
    );
  }

  const { note } = data;
  const latestExport = data.exports[0];
  const transport = note.noTransportDetails
    ? [{ label: "Transport", value: "No transportation details recorded" }]
    : [
        { label: "Transport name", value: note.transportName ?? "—" },
        { label: "Truck registration", value: note.truckReg ?? "—" },
        { label: "Driver", value: note.driver ?? "—" },
      ];

  return (
    <RequirePermission permission="dispatch.view">
      <PageHeader
        title={<span className="font-mono">{note.ref}</span>}
        description={`Dispatch to ${data.warehouse?.name ?? note.warehouseCode} — ${PRODUCT_LABEL[note.product]}`}
        badges={<StatusBadge kind="dispatch" value={note.state} />}
        actions={
          <>
            {note.state === "DRAFT" ? (
              <Button asChild variant="secondary">
                <Link href={`/floor/dispatch/${note.id}`}>
                  <Truck /> Open loading workspace
                </Link>
              </Button>
            ) : null}
            <DispatchActionBar
              note={note}
              latestExport={latestExport}
              allowPostWithoutDone
              onCancelled={() => router.refresh()}
            />
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {note.state === "CANCELLED" ? (
          <Callout tone="warning" title="Cancelled">
            Reason: “{note.cancelReason}” — {data.cancelledByName}, {formatDateTime(note.cancelledAt)}. The note is kept for the record (dispatch notes are never deleted) and
            its bales were released so they can go on another note.
          </Callout>
        ) : null}

        <section aria-label="Totals" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Total bales" value={note.totalBales} hint={note.state === "CANCELLED" ? "at cancellation" : undefined} data-testid="detail-bales" />
          <StatCard label="Total mass" value={`${note.totalMass} kg`} data-testid="detail-mass" />
          <StatCard label="Dispatch date" value={note.dispatchDate ? formatDate(note.dispatchDate) : "—"} hint={note.state === "POSTED" ? `posted by ${data.postedByName}` : "not posted"} />
          <StatCard label="Shipment files" value={data.exports.length} hint={latestExport ? latestExport.filename : "none generated"} />
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Dispatch details</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValue
                columns={3}
                items={[
                  { label: "Reference", value: <span className="font-mono">{note.ref}</span> },
                  { label: "Destination warehouse", value: `${note.warehouseCode}${data.warehouse && data.warehouse.name !== note.warehouseCode ? ` — ${data.warehouse.name}` : ""}` },
                  { label: "Buyer(s) packing there", value: data.buyers.length ? data.buyers.map((b) => b.code).join(", ") : "—" },
                  { label: "Product", value: PRODUCT_LABEL[note.product] },
                  ...transport,
                  { label: "Driver national ID", value: note.driverNationalId ?? "—" },
                  { label: "Driver cellphone", value: note.driverCell ?? "—" },
                  { label: "Created", value: `${data.createdByName}, ${formatDateTime(note.createdAt)}` },
                  { label: "Loading done", value: note.loadingDoneAt ? formatDateTime(note.loadingDoneAt) : "—" },
                  {
                    label: "Mobile created",
                    value: (
                      <span className="inline-flex items-center gap-2">
                        {note.mobileCreated ? "Yes" : "No"} <UnverifiedBadge uq="UQ-24" />
                      </span>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Shipment files</CardTitle>
                <CardDescription>For the destination warehouse</CardDescription>
              </div>
              <Badge tone="outline">MOCK FORMAT</Badge>
            </CardHeader>
            <CardContent className="pt-2">
              {data.exports.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {note.state === "POSTED"
                    ? "No shipment file yet. Use Generate Shipment File above."
                    : "A shipment file can only be generated once the note is Posted."}
                </p>
              ) : (
                <ul className="flex flex-col gap-2" data-testid="note-exports">
                  {data.exports.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs font-medium">{e.filename}</span>
                        <span className="block text-xs text-muted-foreground">
                          {e.rowCount} rows · {formatDateTime(e.generatedAt)}
                        </span>
                      </span>
                      <Button size="icon-sm" variant="ghost" aria-label={`Download ${e.filename}`} onClick={() => downloadTextFile(e.filename, e.csv)}>
                        <FileDown />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="link" className="mt-3 text-xs">
                <Link href="/dispatch/shipments">
                  All shipment files <ExternalLink />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Bales on this note</CardTitle>
              <CardDescription>
                {note.state === "DRAFT"
                  ? "Bales are loaded in the floor workspace."
                  : note.state === "CANCELLED"
                    ? "Snapshot at cancellation — these bales were released."
                    : "Locked. A supervisor can reset the note to draft with a reason."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <DispatchBalesTable rows={data.bales} pageSize={10} emptyTitle="No bales on this note" testId="detail-bales-table" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>History</CardTitle>
              <CardDescription>Audited actions on this note</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {data.audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audited actions yet.</p>
            ) : (
              <Timeline
                items={data.audit.map((a) => ({
                  id: a.id,
                  tone: a.action === "dispatch.cancel" ? "warning" : a.action === "dispatch.post" ? "success" : "primary",
                  title: a.action,
                  meta: formatDateTime(a.at),
                  body: `${a.userName}${a.reason ? ` — “${a.reason}”` : ""}`,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}

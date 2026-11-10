"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Printer, ScanLine } from "lucide-react";
import { Badge, Button, Callout, Card, CardContent, DataTable, ErrorState, KeyValue, PageHeader, Skeleton, type ColumnDef } from "@tobacco/ui";
import { formatDateTime, longDate, type Bale } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { GrowerLink, TdnLink } from "@/components/domain/entity-links";
import { AuditTimeline } from "@/components/receiving/audit-timeline";
import { DeliveryStatusBar } from "@/components/receiving/delivery-status-bar";
import { deliveryTally } from "@/mock/domain/receiving";
import { useDbQuery } from "@/mock/hooks";

export default function DeliveryNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useDbQuery(["delivery-note", id], (db) => {
    const note = db.deliveryNotes.find((d) => d.id === id);
    if (!note) return null;
    const bales = db.bales.filter((b) => b.gdnId === id);
    return {
      note,
      bales,
      grower: db.growers.find((g) => g.growerNo === note.growerNo),
      tdn: note.transporterNoteId ? db.transporterNotes.find((t) => t.id === note.transporterNoteId) : undefined,
      sellingPoint: db.sellingPoints.find((s) => s.id === note.sellingPointId)?.name ?? "—",
      tally: deliveryTally(db, note),
      sale: db.sales.find((s) => s.gdnId === id),
    };
  });

  const columns: ColumnDef<Bale, unknown>[] = [
    { accessorKey: "scaleBarcode", header: "Scale barcode", cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span> },
    { id: "ticket", header: "Ticket barcode", accessorFn: (b) => b.ticketBarcode ?? "", cell: ({ row }) => (row.original.ticketBarcode ? <span className="font-mono font-semibold">{row.original.ticketBarcode}</span> : <span className="text-muted-foreground">—</span>) },
    { accessorKey: "group", header: "Group" },
    { accessorKey: "lot", header: "Lot" },
    { accessorKey: "mass", header: "Mass (kg)", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { id: "row", header: "Floor row", accessorFn: (b) => b.floorRow ?? "", cell: ({ row }) => row.original.floorRow ?? <span className="text-muted-foreground">—</span> },
    {
      id: "status",
      header: "Status",
      accessorFn: (b) => (b.ejected ? "ejected" : b.printed ? "printed" : "captured"),
      cell: ({ row }) => (row.original.ejected ? <Badge tone="danger">Ejected</Badge> : row.original.scannedAt ? <Badge tone="success" dot>Scanned</Badge> : row.original.printed ? <Badge tone="neutral" dot>Printed</Badge> : <Badge tone="primary" dot>Captured</Badge>),
    },
  ];

  return (
    <RequirePermission permission="receiving.view">
      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !data ? (
        <ErrorState title="Delivery note not found" action={<Button asChild variant="secondary"><Link href="/receiving/delivery-notes">Back to the list</Link></Button>} />
      ) : (
        <>
          <PageHeader
            title={<span className="font-mono">{data.note.docNo}</span>}
            description={`${data.note.growerNo} ${data.grower ? `${data.grower.firstName} ${data.grower.surname}` : ""} · ${longDate(data.note.sellingDate)} · ${data.sellingPoint}`}
            badges={<StatusBadge kind="deliveryNote" value={data.note.state} />}
            actions={
              <>
                {data.note.state === "OPEN" ? (
                  <Button asChild>
                    <Link href={`/floor/receiving/${data.note.id}/bales`}>
                      <ScanLine /> Capture bales
                    </Link>
                  </Button>
                ) : null}
                {data.note.state === "TICKETS_PRINTING" || data.note.state === "CHECKED" ? (
                  <Button asChild variant="secondary">
                    <Link href={`/floor/tickets/${data.note.id}`}>
                      <Printer /> Ticket printing
                    </Link>
                  </Button>
                ) : null}
              </>
            }
          />
          <div className="flex flex-col gap-6">
            <DeliveryStatusBar state={data.note.state} />
            {data.note.historicalBaleCount ? (
              <Callout tone="info" title="Historical demo delivery">
                Bale-level detail is not seeded for the 11 September demo history ({data.note.historicalBaleCount} bales declared).
              </Callout>
            ) : null}
            <Card>
              <CardContent className="pt-5">
                <KeyValue
                  columns={4}
                  items={[
                    { label: "Grower", value: <GrowerLink growerNo={data.note.growerNo} /> },
                    { label: "Transporter note", value: data.tdn ? <TdnLink id={data.tdn.id} docNo={data.tdn.docNo} /> : "—" },
                    { label: "Location", value: data.note.location },
                    { label: "Floor row", value: data.note.row ?? "—" },
                    { label: "Bales declared", value: data.note.balesDeclared },
                    { label: "Bales captured", value: `${data.tally.captured}${data.tally.balanced ? " (balanced)" : ""}` },
                    { label: "Start barcode", value: data.note.startBarcode ? <span className="font-mono">{data.note.startBarcode}</span> : "—" },
                    { label: "Lots", value: data.note.lotLowest !== undefined ? `${data.note.lotLowest} – ${data.note.lotHighest}` : "—" },
                    { label: "Season", value: data.note.season },
                    { label: "Floor sale", value: data.note.floorSale },
                    { label: "Created", value: formatDateTime(data.note.createdAt) },
                    { label: "Last updated", value: formatDateTime(data.note.updatedAt) },
                  ]}
                />
              </CardContent>
            </Card>
            {data.sale ? (
              <Callout tone="info" title={`Sale #${data.sale.refNo} (${data.sale.status.toLowerCase()})`}>
                The floor summary created this delivery's sale.{" "}
                <Link href={`/sales/${data.sale.id}`} className="font-medium underline">
                  Open the sale
                </Link>
              </Callout>
            ) : null}
            <DataTable
              aria-label="Bales on this delivery"
              data-testid="delivery-bales"
              columns={columns}
              data={data.bales}
              getRowId={(b) => b.id}
              pageSize={25}
              hidePagerWhenSinglePage
              enableColumnVisibility={false}
              emptyTitle="No bales captured yet"
              toolbar={<p className="text-sm font-semibold">Bales · {data.bales.filter((b) => !b.ejected).length}</p>}
              rowClassName={(b) => (b.ejected ? "bg-surface-secondary text-muted-foreground" : undefined)}
            />
            <AuditTimeline entityIds={[data.note.id, ...data.bales.map((b) => b.id)]} />
          </div>
        </>
      )}
    </RequirePermission>
  );
}

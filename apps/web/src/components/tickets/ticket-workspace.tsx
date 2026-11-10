"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Printer, RotateCcw, Split, Ticket, TriangleAlert } from "lucide-react";
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
  EmptyState,
  KeyValue,
  type ColumnDef,
} from "@tobacco/ui";
import { formatDateTime, longDate, type Bale } from "@tobacco/shared";
import { StatusBadge } from "@/components/domain/status-badge";
import { WorkspaceHeader } from "@/components/floor/workspace";
import { DeliveryStatusBar } from "@/components/receiving/delivery-status-bar";
import { PermissionButton } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { allocateNextBarcode, balesInTicketOrder, confirmTicketPrinting, printTickets, reverseTicketPrinting } from "@/mock/domain/tickets";
import { deliveryTally } from "@/mock/domain/receiving";
import { useAction, useDb } from "@/mock/hooks";
import { InterruptedTicketDialog, ReasonDialog, SetStartBarcodeDialog, SplitSaleDialog } from "./barcode-dialogs";
import { TicketSheet } from "./ticket-preview";

/** One delivery in the Ticket Printing app (Manual 04, Steps 1–5). */
export function TicketWorkspace({ gdnId }: { gdnId: string }) {
  const userId = useSession((s) => s.userId);
  const view = useDb((db) => {
    const note = db.deliveryNotes.find((d) => d.id === gdnId);
    if (!note) return null;
    const sp = db.sellingPoints.find((s) => s.id === note.sellingPointId);
    return {
      note,
      grower: db.growers.find((g) => g.growerNo === note.growerNo),
      sellingPoint: sp,
      bales: balesInTicketOrder(db, gdnId),
      tally: deliveryTally(db, note),
      next: userId ? db.userNextBarcode[userId] : undefined,
      events: db.ticketEvents.filter((e) => e.gdnId === gdnId).sort((a, b) => b.at.localeCompare(a.at)),
    };
  });
  const [dialog, setDialog] = useState<null | "start" | "interrupted" | "split" | "reverse" | "reprint">(null);
  const [confirm, setConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const nextAction = useAction(allocateNextBarcode, { silent: true });
  const confirmAction = useAction(confirmTicketPrinting, { silent: true });
  const printAction = useAction(printTickets, { silent: true });
  const reverseAction = useAction(reverseTicketPrinting, { silent: true });

  if (!view) return <EmptyState title="Delivery note not found" description="Return to the ticket printing list." className="rounded-2xl border border-border bg-surface" />;
  const { note, grower, sellingPoint, bales, next, events } = view;
  const printing = note.state === "TICKETS_PRINTING";
  const allocated = bales.length > 0 && bales.every((b) => b.ticketBarcode);
  const lockedReason = printing ? undefined : note.state === "OPEN" ? "Complete the delivery at receiving first" : `Delivery is ${note.state === "CHECKED" ? "Checked" : "Laid"} — tickets are confirmed`;
  const saleRoom = sellingPoint?.saleRooms[0] ?? "A";
  const ok = (text: string) => setNotice({ tone: "success", text });

  const columns: ColumnDef<Bale, unknown>[] = [
    { id: "barcode", header: "Barcode", accessorFn: (b) => b.ticketBarcode ?? "", cell: ({ row }) => (row.original.ticketBarcode ? <span className="font-mono font-semibold">{row.original.ticketBarcode}</span> : <span className="text-muted-foreground">—</span>) },
    { accessorKey: "group", header: "Group" },
    { accessorKey: "lot", header: "Lot No." },
    { id: "date", header: "Ticket Date", accessorFn: (b) => b.ticketDate ?? "", cell: ({ row }) => (row.original.ticketDate ? longDate(row.original.ticketDate) : <span className="text-muted-foreground">—</span>) },
    { accessorKey: "mass", header: "Mass", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "scaleBarcode", header: "Scale Barcode", cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span> },
    { id: "printed", header: "Printed", accessorFn: (b) => (b.printed ? "yes" : "no"), cell: ({ row }) => (row.original.printed ? <Badge tone="success" dot>Printed</Badge> : <Badge tone="outline">Not yet</Badge>) },
  ];

  return (
    <>
      <div className="print:hidden">
        <WorkspaceHeader
          title={
            <span className="flex items-center gap-3">
              <Ticket className="size-8 text-primary" aria-hidden /> Ticket Printing
            </span>
          }
          subtitle={
            <>
              <span className="font-mono">{note.docNo}</span> · {note.growerNo} {grower ? `${grower.firstName} ${grower.surname}` : ""}
            </>
          }
          chips={<StatusBadge kind="deliveryNote" value={note.state} />}
          actions={
            <Button asChild variant="secondary">
              <Link href="/floor/tickets">
                <ArrowLeft /> Waiting to print
              </Link>
            </Button>
          }
        />

        <DeliveryStatusBar state={note.state} className="mb-6" />

        <div className="mb-6 flex flex-wrap items-center gap-3" data-testid="ticket-actions">
          <PermissionButton permission="tickets.allocate" size="lg" disabled={!printing} disabledReason={lockedReason} onClick={() => setDialog("start")} data-testid="set-start-barcode">
            Set Starting Barcode
          </PermissionButton>
          <PermissionButton
            permission="tickets.allocate"
            size="lg"
            variant="secondary"
            disabled={!printing || !next}
            disabledReason={lockedReason ?? (!next ? "There is no previously set barcode — use Set Starting Barcode first" : undefined)}
            loading={nextAction.isPending}
            data-testid="use-next-barcode"
            onClick={async () => {
              const res = await nextAction.run({ gdnId });
              setNotice(res.ok ? { tone: "success", text: res.data.message } : { tone: "danger", text: res.error.message });
            }}
          >
            Use Next Barcode
          </PermissionButton>
          <PermissionButton permission="tickets.interrupt" size="lg" variant="secondary" disabled={!printing || !allocated} disabledReason={lockedReason ?? (!allocated ? "Allocate barcodes first" : undefined)} onClick={() => setDialog("interrupted")} data-testid="interrupted-ticket">
            Interrupted Ticket
          </PermissionButton>
          <PermissionButton permission="tickets.allocate" size="lg" variant="secondary" onClick={() => setDialog("split")} data-testid="split-sale">
            <Split /> Split this Sale
          </PermissionButton>
          <PermissionButton permission="tickets.print" size="lg" variant="secondary" disabled={!allocated} disabledReason={!allocated ? "Allocate barcodes first" : undefined} onClick={() => setShowPreview(true)} data-testid="print-tickets">
            <Printer /> Print → Bale Tickets
          </PermissionButton>
          {printing ? (
            <PermissionButton permission="tickets.confirm" size="lg" variant="success" disabled={!allocated} disabledReason={!allocated ? "Bale has no barcode in line 1 — allocate barcodes first" : undefined} onClick={() => setConfirm(true)} data-testid="confirm-ticket-printing">
              <CheckCircle2 /> Confirm Ticket Printing
            </PermissionButton>
          ) : null}
          {note.state === "CHECKED" ? (
            <PermissionButton permission="tickets.reverse-printing" size="lg" variant="danger" onClick={() => setDialog("reverse")} data-testid="reverse-printing">
              <RotateCcw /> Reverse Printing Status
            </PermissionButton>
          ) : null}
        </div>

        <div className="mb-6" role="status" aria-live="polite" data-testid="ticket-notice">
          {notice ? <Callout tone={notice.tone} title={notice.text} /> : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValue
                columns={3}
                items={[
                  { label: "Grower Name", value: grower ? `${grower.firstName} ${grower.surname}` : "—" },
                  { label: "Grower Number", value: <span className="font-mono">{note.growerNo}</span> },
                  { label: "Season", value: note.season },
                  { label: "Location", value: note.location },
                  { label: "Number of Bales", value: note.balesDeclared },
                  { label: "Start Barcode", value: note.startBarcode ? <span className="font-mono" data-testid="start-barcode">{note.startBarcode}</span> : "—" },
                  { label: "Lot Number - Highest", value: note.lotHighest ?? "—" },
                  { label: "Lot Number - Lowest", value: note.lotLowest ?? "—" },
                  { label: "Floor Sale", value: note.floorSale },
                  { label: "Created on", value: formatDateTime(note.createdAt) },
                  { label: "Selling Date", value: longDate(note.sellingDate) },
                  { label: "Selling Point", value: sellingPoint?.name ?? "—" },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Your roll</CardTitle>
                <CardDescription>Start barcodes belong to each user and are saved automatically after you confirm a delivery.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Your next barcode</p>
                <p className="font-mono text-2xl font-semibold" data-testid="next-barcode">
                  {next ?? "Not set"}
                </p>
              </div>
              <Callout tone="warning" title="No printer connected">
                Printing here is a preview and an audited event only. Confirm only when tickets would really be printed and attached — confirming uses up the barcodes for the season.
              </Callout>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <DataTable
            aria-label="Tobacco bales"
            data-testid="ticket-bales"
            columns={columns}
            data={bales}
            getRowId={(b) => b.id}
            pageSize={25}
            hidePagerWhenSinglePage
            enableColumnVisibility={false}
            emptyTitle="No bales on this delivery"
            toolbar={<p className="text-sm font-semibold">Tobacco Bales · {bales.length}</p>}
          />
        </div>

        {events.length > 0 ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Print history</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1.5 text-sm" data-testid="ticket-events">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap gap-x-3">
                    <Badge tone="outline">{e.kind}</Badge>
                    <span>{e.detail}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(e.at)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {showPreview ? (
        <section className="mt-6" aria-label="Bale ticket print preview" data-testid="ticket-preview">
          <Card>
            <CardHeader className="print:hidden">
              <div>
                <CardTitle>Print preview — Bale Tickets</CardTitle>
                <CardDescription>
                  <Badge tone="warning">Preview only</Badge> No printer is connected; the bars are decorative, not a scannable symbol. Each ticket shows the sale date, scale and ticket barcode, grower, group, mass and sale room.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <PermissionButton
                  permission="tickets.print"
                  loading={printAction.isPending}
                  data-testid="do-print"
                  onClick={async () => {
                    const res = await printAction.run({ gdnId, reason: printing ? undefined : "Reprint from preview" });
                    if (res.ok) {
                      ok(res.data.reprint ? `Reprint of ${res.data.count} tickets recorded` : `${res.data.count} tickets sent to print preview`);
                      setTimeout(() => window.print(), 50);
                    } else setNotice({ tone: "danger", text: res.error.message });
                  }}
                >
                  <Printer /> Print
                </PermissionButton>
                <Button variant="secondary" onClick={() => setShowPreview(false)}>
                  Close preview
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <TicketSheet bales={bales} growerNo={note.growerNo} saleDate={note.sellingDate} floorSale={note.floorSale} saleRoom={saleRoom} />
            </CardContent>
          </Card>
        </section>
      ) : null}

      <div className="print:hidden">
        <SetStartBarcodeDialog open={dialog === "start"} onOpenChange={(o) => setDialog(o ? "start" : null)} gdnId={gdnId} onDone={ok} />
        <InterruptedTicketDialog open={dialog === "interrupted"} onOpenChange={(o) => setDialog(o ? "interrupted" : null)} gdnId={gdnId} onDone={ok} />
        <SplitSaleDialog open={dialog === "split"} onOpenChange={(o) => setDialog(o ? "split" : null)} gdnId={gdnId} onDone={ok} />
        <ReasonDialog
          open={dialog === "reverse"}
          onOpenChange={(o) => setDialog(o ? "reverse" : null)}
          title="Reverse Printing Status"
          description="Supervisors only. Moves the delivery from Checked back to Tickets Printing. The allocated barcodes stay with the delivery (what happens to them is not documented — UQ-19). The reason is audited."
          confirmLabel="Reverse printing status"
          permission="tickets.reverse-printing"
          variant="danger"
          testId="confirm-reverse"
          onSubmit={async (reason) => {
            const res = await reverseAction.run({ gdnId, reason });
            if (res.ok) {
              ok(res.data.message);
              return null;
            }
            return res.error.message;
          }}
        />
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Confirm Ticket Printing?"
          description="Confirming uses up the barcodes for the season. Only confirm when the tickets are physically printed and correct."
          confirmLabel="Confirm Ticket Printing"
          tone="success"
          loading={confirmAction.isPending}
          onConfirm={async () => {
            const res = await confirmAction.run({ gdnId });
            setConfirm(false);
            setNotice(res.ok ? { tone: "success", text: res.data.message } : { tone: "danger", text: res.error.message });
          }}
        >
          <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-text">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {bales.length} tickets: {bales[0]?.ticketBarcode} – {bales.at(-1)?.ticketBarcode}. Only a supervisor can undo this.
          </p>
        </ConfirmDialog>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, History, Layers3, ListChecks, Printer, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  DropdownMenuItem,
  PageHeader,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ColumnDef,
} from "@tobacco/ui";
import { formatDateTime, checkTicketBarcode, type TicketEvent } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { GdnLink } from "@/components/domain/entity-links";
import { DeliveryQueue, type QueueRow } from "@/components/tickets/delivery-queue";
import { ReasonDialog } from "@/components/tickets/barcode-dialogs";
import { useGuard } from "@/lib/permissions";
import { userName } from "@/mock/ctx";
import { printTickets, reverseTicketPrinting } from "@/mock/domain/tickets";
import { useAction, useDbQuery } from "@/mock/hooks";

interface HistoryRow extends TicketEvent {
  docNo: string;
  by: string;
}

/** Back-office view of ticket printing: the queue, print history and barcode stock. The scanning/printing happens in the floor workspace. */
export default function TicketsOverviewPage() {
  const [dialog, setDialog] = useState<null | { kind: "reverse" | "reprint"; gdnId: string; docNo: string }>(null);
  const canReverse = useGuard("tickets.reverse-printing").allowed;
  const canPrint = useGuard("tickets.print").allowed;
  const reverse = useAction(reverseTicketPrinting, { silent: true, success: (r) => r.message });
  const print = useAction(printTickets, { silent: true, success: (r) => `Reprint of ${r.count} tickets recorded` });

  const { data: history, isLoading: loadingHistory } = useDbQuery(["ticket-history"], (db): HistoryRow[] =>
    [...db.ticketEvents]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((e) => ({ ...e, docNo: db.deliveryNotes.find((d) => d.id === e.gdnId)?.docNo ?? e.gdnId, by: userName(db, e.userId) })),
  );
  const { data: stock } = useDbQuery(["barcode-stock"], (db) => {
    const withTickets = db.bales.filter((b) => !b.ejected && b.ticketBarcode);
    const bases = withTickets.map((b) => checkTicketBarcode(b.ticketBarcode!)).filter((c): c is Extract<typeof c, { valid: true }> => c.valid);
    const first = bases.length ? bases.reduce((a, b) => (b.base < a.base ? b : a)) : undefined;
    const last = bases.length ? bases.reduce((a, b) => (b.base > a.base ? b : a)) : undefined;
    return {
      allocated: withTickets.length,
      locked: withTickets.filter((b) => b.printed).length,
      first: first?.barcode,
      last: last?.barcode,
      rolls: Object.entries(db.userNextBarcode).map(([userId, barcode]) => ({ userId, name: userName(db, userId), barcode })),
    };
  });

  const historyColumns: ColumnDef<HistoryRow, unknown>[] = [
    { accessorKey: "at", header: "When", cell: ({ getValue }) => <span className="tabular">{formatDateTime(getValue<string>())}</span> },
    { accessorKey: "kind", header: "Event", cell: ({ getValue }) => <Badge tone={getValue<string>() === "REVERSE" ? "warning" : getValue<string>() === "CONFIRM" ? "success" : "outline"}>{getValue<string>()}</Badge> },
    { accessorKey: "docNo", header: "Delivery", cell: ({ row }) => <GdnLink id={row.original.gdnId} docNo={row.original.docNo} /> },
    { accessorKey: "detail", header: "Detail" },
    { accessorKey: "by", header: "User" },
  ];

  const rowMenu = (row: QueueRow) => (
    <>
      <DropdownMenuItem asChild>
        <Link href={`/floor/tickets/${row.note.id}`}>
          <ExternalLink /> Open in Ticket Printing
        </Link>
      </DropdownMenuItem>
      {row.note.state === "CHECKED" && canReverse ? (
        <DropdownMenuItem onSelect={() => setDialog({ kind: "reverse", gdnId: row.note.id, docNo: row.note.docNo })}>
          <RotateCcw /> Reverse printing status…
        </DropdownMenuItem>
      ) : null}
      {(row.note.state === "CHECKED" || row.note.state === "LAID") && canPrint ? (
        <DropdownMenuItem onSelect={() => setDialog({ kind: "reprint", gdnId: row.note.id, docNo: row.note.docNo })}>
          <Printer /> Reprint tickets…
        </DropdownMenuItem>
      ) : null}
    </>
  );

  return (
    <RequirePermission permission="tickets.view">
      <PageHeader
        title="Ticket printing"
        description="Deliveries waiting for tickets, the print history and the barcode stock. Allocation and printing happen in the Ticket Printing workspace."
        actions={
          <Button asChild>
            <Link href="/floor/tickets">
              <Printer /> Open workspace
            </Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Barcodes allocated" icon={Layers3} value={stock?.allocated ?? 0} hint="this season, across all deliveries" />
        <StatCard label="Confirmed (locked)" icon={ListChecks} tone="success" value={stock?.locked ?? 0} hint="used up for the season" />
        <StatCard label="First barcode" icon={Printer} value={<span className="font-mono text-xl">{stock?.first ?? "—"}</span>} />
        <StatCard label="Last barcode" icon={Printer} value={<span className="font-mono text-xl">{stock?.last ?? "—"}</span>} />
      </div>
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">
            <ListChecks className="size-4" /> Queue
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="size-4" /> Print history
          </TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock">
            <Layers3 className="size-4" /> Barcode stock
          </TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <DeliveryQueue hrefBase="/floor/tickets" rowMenu={rowMenu} />
        </TabsContent>
        <TabsContent value="history">
          <DataTable
            aria-label="Ticket print history"
            data-testid="ticket-history"
            columns={historyColumns}
            data={history ?? []}
            loading={loadingHistory}
            getRowId={(r) => r.id}
            searchPlaceholder="Search delivery or user…"
            emptyIcon={History}
            emptyTitle="No print events yet"
            enableColumnVisibility={false}
            hidePagerWhenSinglePage
          />
        </TabsContent>
        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Rolls in use</CardTitle>
                <CardDescription>Start barcodes belong to each user. The next barcode is saved automatically after a delivery is confirmed.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {stock && stock.rolls.length > 0 ? (
                <ul className="divide-y divide-border text-sm" data-testid="rolls">
                  {stock.rolls.map((r) => (
                    <li key={r.userId} className="flex items-center justify-between py-2">
                      <span>{r.name}</span>
                      <span className="font-mono font-semibold">{r.barcode}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No start barcode has been set yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReasonDialog
        open={dialog?.kind === "reverse"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reverse printing status — ${dialog?.docNo ?? ""}`}
        description="Moves the delivery from Checked back to Tickets Printing. The reason is audited."
        confirmLabel="Reverse printing status"
        permission="tickets.reverse-printing"
        variant="danger"
        testId="confirm-reverse"
        onSubmit={async (reason) => {
          const res = await reverse.run({ gdnId: dialog!.gdnId, reason });
          return res.ok ? null : res.error.message;
        }}
      />
      <ReasonDialog
        open={dialog?.kind === "reprint"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reprint tickets — ${dialog?.docNo ?? ""}`}
        description="Reprints a confirmed delivery's tickets. A reason is required and the reprint is audited."
        confirmLabel="Record reprint"
        permission="tickets.print"
        testId="confirm-reprint"
        onSubmit={async (reason) => {
          const res = await print.run({ gdnId: dialog!.gdnId, reason });
          return res.ok ? null : res.error.message;
        }}
      />
    </RequirePermission>
  );
}

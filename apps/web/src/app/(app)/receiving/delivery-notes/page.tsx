"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { DataTable, NativeSelect, PageHeader, type ColumnDef } from "@tobacco/ui";
import { DELIVERY_NOTE_STATES, DELIVERY_NOTE_STATE_LABEL, formatDateTime, longDate, type DeliveryNote } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { GdnLink, GrowerLink } from "@/components/domain/entity-links";
import { deliveryTally } from "@/mock/domain/receiving";
import { useDb, useDbQuery } from "@/mock/hooks";

type Row = DeliveryNote & { sellingPointName: string; growerName: string; captured: number; ticketsAllocated: number; ticketsPrinted: number };

export default function DeliveryNotesPage() {
  const router = useRouter();
  const [state, setState] = useState("ALL");
  const [date, setDate] = useState("ALL");
  const dates = useDb((db) => [...new Set(db.deliveryNotes.map((d) => d.sellingDate))].sort().reverse());
  const { data, isLoading } = useDbQuery(["delivery-notes", state, date], (db): Row[] =>
    db.deliveryNotes
      .filter((d) => (state === "ALL" || d.state === state) && (date === "ALL" || d.sellingDate === date))
      .map((d) => {
        const g = db.growers.find((x) => x.growerNo === d.growerNo);
        const bales = db.bales.filter((b) => b.gdnId === d.id && !b.ejected);
        return {
          ...d,
          sellingPointName: db.sellingPoints.find((s) => s.id === d.sellingPointId)?.name ?? "—",
          growerName: g ? `${g.firstName} ${g.surname}` : "—",
          captured: deliveryTally(db, d).captured,
          ticketsAllocated: d.historicalBaleCount ?? bales.filter((b) => b.ticketBarcode).length,
          ticketsPrinted: d.historicalBaleCount ?? bales.filter((b) => b.printed).length,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.docNo.localeCompare(a.docNo)),
  );

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "docNo", header: "Document", cell: ({ row }) => <GdnLink id={row.original.id} docNo={row.original.docNo} /> },
    { accessorKey: "growerNo", header: "Grower No.", cell: ({ row }) => <GrowerLink growerNo={row.original.growerNo} /> },
    { accessorKey: "growerName", header: "Grower Name" },
    { accessorKey: "sellingDate", header: "Selling Date", cell: ({ getValue }) => <span className="tabular">{longDate(getValue<string>())}</span> },
    { accessorKey: "sellingPointName", header: "Selling Point" },
    { accessorKey: "season", header: "Season" },
    { accessorKey: "location", header: "Location" },
    { id: "row", header: "Row #", accessorFn: (r) => r.row ?? "", cell: ({ row }) => row.original.row ?? <span className="text-muted-foreground">—</span> },
    { accessorKey: "balesDeclared", header: "Declared", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "captured", header: "Captured", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { id: "tickets", header: "Tickets printed", accessorFn: (r) => r.ticketsPrinted, cell: ({ row }) => <span className="tabular">{row.original.ticketsPrinted} / {row.original.ticketsAllocated || 0}</span> },
    { accessorKey: "state", header: "State", cell: ({ getValue }) => <StatusBadge kind="deliveryNote" value={getValue<string>()} /> },
    { accessorKey: "updatedAt", header: "Last Updated", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
    { accessorKey: "createdAt", header: "Created on", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
  ];

  return (
    <RequirePermission permission="receiving.view">
      <PageHeader title="Grower delivery notes" description="Every grower's delivery from capture to the floor: Open → Tickets Printing → Checked → Laid." />
      <DataTable
        aria-label="Grower delivery notes"
        data-testid="delivery-notes-table"
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/receiving/delivery-notes/${r.id}`)}
        searchPlaceholder="Search GDN, grower number or name…"
        initialColumnVisibility={{ season: false, sellingPointName: false, createdAt: false }}
        emptyIcon={PackageCheck}
        emptyTitle="No delivery notes match"
        emptyDescription="Delivery notes are created when a transporter note is completed."
        toolbar={
          <>
            <NativeSelect value={state} onChange={(e) => setState(e.target.value)} wrapperClassName="w-44" aria-label="Filter by state" size="sm">
              <option value="ALL">All states</option>
              {DELIVERY_NOTE_STATES.map((s) => (
                <option key={s} value={s}>
                  {DELIVERY_NOTE_STATE_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={date} onChange={(e) => setDate(e.target.value)} wrapperClassName="w-48" aria-label="Filter by selling date" size="sm">
              <option value="ALL">All dates</option>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {longDate(d)}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />
    </RequirePermission>
  );
}

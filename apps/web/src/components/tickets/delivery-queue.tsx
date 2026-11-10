"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Button, DataTable, type ColumnDef } from "@tobacco/ui";
import { formatDateTime, type DeliveryNote } from "@tobacco/shared";
import { StatusBadge } from "@/components/domain/status-badge";
import { useDb, useDbQuery } from "@/mock/hooks";

export interface QueueRow {
  note: DeliveryNote;
  sellingPoint: string;
  growerName: string;
}

/** Deliveries waiting for tickets ("Waiting to Print") or all of today's deliveries. Row click opens the delivery. */
export function DeliveryQueue({ hrefBase, rowMenu }: { hrefBase: string; rowMenu?: (row: QueueRow) => ReactNode }) {
  const router = useRouter();
  const today = useDb((db) => db.settings.demoToday);
  const [filter, setFilter] = useState<"waiting" | "all">("waiting");
  const { data, isLoading } = useDbQuery(["ticket-queue", filter, today], (db): QueueRow[] =>
    db.deliveryNotes
      .filter((d) => d.sellingDate === today && d.state !== "OPEN" && (filter === "all" || d.state === "TICKETS_PRINTING"))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((note) => {
        const g = db.growers.find((x) => x.growerNo === note.growerNo);
        return { note, sellingPoint: db.sellingPoints.find((s) => s.id === note.sellingPointId)?.name ?? "—", growerName: g ? `${g.firstName} ${g.surname}` : "—" };
      }),
  );

  const columns: ColumnDef<QueueRow, unknown>[] = [
    { id: "sp", header: "Selling Point", accessorFn: (r) => r.sellingPoint },
    { id: "name", header: "Grower Name", accessorFn: (r) => r.growerName },
    { id: "no", header: "Grower Number", accessorFn: (r) => r.note.growerNo, cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span> },
    { id: "loc", header: "Location", accessorFn: (r) => r.note.location },
    { id: "bales", header: "Number of Bales", accessorFn: (r) => r.note.balesDeclared, cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { id: "state", header: "State", accessorFn: (r) => r.note.state, cell: ({ row }) => <StatusBadge kind="deliveryNote" value={row.original.note.state} /> },
    { id: "season", header: "Season", accessorFn: (r) => r.note.season },
    { id: "created", header: "Created on", accessorFn: (r) => r.note.createdAt, cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
    { id: "doc", header: "Document", accessorFn: (r) => r.note.docNo, cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue<string>()}</span> },
  ];

  return (
    <DataTable
      aria-label="Deliveries for ticket printing"
      data-testid="ticket-queue"
      columns={columns}
      data={data ?? []}
      loading={isLoading}
      getRowId={(r) => r.note.id}
      onRowClick={(r) => router.push(`${hrefBase}/${r.note.id}`)}
      rowMenu={rowMenu}
      searchPlaceholder="Search grower or document…"
      emptyIcon={Printer}
      emptyTitle={filter === "waiting" ? "Nothing waiting to print" : "No deliveries yet today"}
      emptyDescription={filter === "waiting" ? "Deliveries appear here once the grower's delivery is completed at receiving." : undefined}
      enableColumnVisibility={false}
      hidePagerWhenSinglePage
      toolbar={
        <div className="flex gap-1 rounded-xl bg-surface-tertiary p-1" role="group" aria-label="Filter deliveries">
          {(
            [
              ["waiting", "Waiting to Print"],
              ["all", "All today"],
            ] as const
          ).map(([key, label]) => (
            <Button key={key} size="sm" variant={filter === key ? "secondary" : "ghost"} aria-pressed={filter === key} onClick={() => setFilter(key)} data-testid={`queue-${key}`}>
              {label}
            </Button>
          ))}
        </div>
      }
    />
  );
}

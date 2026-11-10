"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Truck } from "lucide-react";
import { Button, DataTable, NativeSelect, PageHeader, type ColumnDef } from "@tobacco/ui";
import { formatDateTime, type TransporterNote } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { TdnLink } from "@/components/domain/entity-links";
import { userName } from "@/mock/ctx";
import { useDbQuery } from "@/mock/hooks";

type Row = TransporterNote & { totalBales: number; createdByName: string };

export default function TransporterNotesPage() {
  const router = useRouter();
  const [state, setState] = useState("ALL");
  const { data, isLoading } = useDbQuery(["transporter-notes", state], (db): Row[] =>
    db.transporterNotes
      .filter((t) => state === "ALL" || t.state === state)
      .map((t) => ({ ...t, totalBales: t.growers.reduce((a, g) => a + g.bales, 0), createdByName: userName(db, t.createdBy) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "docNo", header: "Doc No.", cell: ({ row }) => <TdnLink id={row.original.id} docNo={row.original.docNo} /> },
    { accessorKey: "transporterName", header: "Transporter" },
    { accessorKey: "vehicleReg", header: "Vehicle Reg", cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span> },
    { accessorKey: "phone", header: "Phone" },
    { id: "growers", header: "Growers", accessorFn: (r) => r.growers.length, cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "totalBales", header: "Bales", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "state", header: "State", cell: ({ getValue }) => <StatusBadge kind="transporterNote" value={getValue<string>()} /> },
    { accessorKey: "createdByName", header: "Created by" },
    { accessorKey: "createdAt", header: "Created", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
  ];

  return (
    <RequirePermission permission="receiving.view">
      <PageHeader
        title="Transporter delivery notes"
        description="One note per truck: the transporter and every grower on board. Completing a note creates the grower delivery notes."
        actions={
          <Button asChild>
            <Link href="/floor/receiving">
              <Plus /> New transporter note
            </Link>
          </Button>
        }
      />
      <DataTable
        aria-label="Transporter delivery notes"
        data-testid="transporter-notes-table"
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/receiving/transporter-notes/${r.id}`)}
        searchPlaceholder="Search TDN, transporter, vehicle…"
        emptyIcon={Truck}
        emptyTitle="No transporter notes"
        emptyDescription="Create one in the Receiving workspace when a truck arrives."
        toolbar={
          <NativeSelect value={state} onChange={(e) => setState(e.target.value)} wrapperClassName="w-44" aria-label="Filter by state" size="sm">
            <option value="ALL">All states</option>
            <option value="OPEN">Open</option>
            <option value="COMPLETED">Completed</option>
          </NativeSelect>
        }
      />
    </RequirePermission>
  );
}

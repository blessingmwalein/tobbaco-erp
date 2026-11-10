"use client";

import { useState } from "react";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import { Button, DataTable, NativeSelect, PageHeader, type ColumnDef } from "@tobacco/ui";
import { formatDate } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { GdnLink, GrowerLink } from "@/components/domain/entity-links";
import { useDb, useDbQuery } from "@/mock/hooks";
import { selectFloorSummaries, type FloorSummaryRow } from "@/mock/domain/floor-summary";

export default function FloorSummaryListPage() {
  const dates = useDb((db) => [...new Set(db.floorSummaries.map((f) => f.sellingDate))].sort().reverse());
  const [date, setDate] = useState("ALL");
  const { data, isLoading } = useDbQuery(["floor-summaries"], selectFloorSummaries);
  const rows = (data ?? []).filter((r) => date === "ALL" || r.sellingDate === date);

  const columns: ColumnDef<FloorSummaryRow, unknown>[] = [
    { accessorKey: "sellingTime", header: "Selling Time", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue<string | undefined>() ?? "—"}</span> },
    { accessorKey: "growerNo", header: "Grower Number", cell: ({ row }) => <GrowerLink growerNo={row.original.growerNo} /> },
    { accessorKey: "firstName", header: "First Name" },
    { accessorKey: "surname", header: "Surname" },
    { accessorKey: "sellingPointName", header: "Selling Point" },
    { accessorKey: "sellingDate", header: "Selling Date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "district", header: "District" },
    { accessorKey: "season", header: "Season" },
    { accessorKey: "gdnDocNo", header: "Delivery Note", cell: ({ row }) => <GdnLink id={row.original.gdnId} docNo={row.original.gdnDocNo} /> },
    { accessorKey: "row", header: "Row", cell: ({ getValue }) => <span className="font-semibold">{getValue<number>()}</span> },
    { accessorKey: "groupFirst", header: "Group - first" },
    { accessorKey: "groupLast", header: "Group - last" },
    { accessorKey: "totalBales", header: "Total Bales", cell: ({ getValue }) => <span className="tabular font-medium">{getValue<number>()}</span> },
    { accessorKey: "unbooked", header: "Unbooked", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
  ];

  return (
    <RequirePermission permission="floor-summary.view">
      <PageHeader
        title="Floor summary"
        description="Every grower's floor summary: where the bales are, how many, and the delivery note behind them. Summaries are created automatically when the last ticket of a delivery is scanned."
        actions={
          <Button asChild>
            <Link href="/floor/floor-summary">
              <ScanLine /> Open scanning workspace
            </Link>
          </Button>
        }
      />
      <DataTable
        aria-label="Floor summaries"
        data-testid="floor-summary-table"
        columns={columns}
        data={rows}
        loading={isLoading}
        searchPlaceholder="Search grower, name, delivery note…"
        pageSize={10}
        emptyIcon={ScanLine}
        emptyTitle="No floor summaries yet"
        emptyDescription="Scan the tickets of a Checked delivery to create the first one."
        initialColumnVisibility={{ firstName: true }}
        toolbar={
          <NativeSelect value={date} onChange={(e) => setDate(e.target.value)} aria-label="Selling date" wrapperClassName="w-48" size="sm" className="h-9">
            <option value="ALL">All dates</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </NativeSelect>
        }
      />
    </RequirePermission>
  );
}

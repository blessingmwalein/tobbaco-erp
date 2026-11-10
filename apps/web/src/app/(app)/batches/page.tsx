"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { Badge, DataTable, NativeSelect, PageHeader, ProgressBar, type ColumnDef } from "@tobacco/ui";
import { formatDate } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { GrowerLink } from "@/components/domain/entity-links";
import { useDbQuery } from "@/mock/hooks";
import { selectBatchRows, type BatchRow } from "@/mock/domain/batches";

export default function BatchesPage() {
  const router = useRouter();
  const [status, setStatus] = useState("ALL");
  const { data, isLoading } = useDbQuery(["batches"], selectBatchRows);
  const rows = (data ?? []).filter((r) => status === "ALL" || r.status === status);

  const columns: ColumnDef<BatchRow, unknown>[] = [
    { accessorKey: "refNo", header: "Batch", cell: ({ getValue }) => <span className="font-medium">Batch {getValue<number>()}</span> },
    { accessorKey: "growerNo", header: "Grower No.", cell: ({ row }) => <GrowerLink growerNo={row.original.growerNo} /> },
    { accessorKey: "firstName", header: "First name" },
    { accessorKey: "surname", header: "Surname" },
    { accessorKey: "saleNo", header: "Sale" },
    { accessorKey: "sellingDate", header: "Selling Date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "sellingPointName", header: "Selling Point" },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge kind="priceBatch" value={getValue<string>()} /> },
    {
      id: "progress",
      header: "Batch prices",
      accessorFn: (r) => `${r.pricesEntered}/${r.pricesNeeded}`,
      cell: ({ row }) => (
        <div className="flex w-32 items-center gap-2">
          <ProgressBar value={row.original.pricesEntered} max={row.original.pricesNeeded} tone={row.original.pricesEntered === row.original.pricesNeeded ? "success" : "primary"} label="Batch prices entered" />
          <span className="tabular text-xs text-muted-foreground">
            {row.original.pricesEntered}/{row.original.pricesNeeded}
          </span>
        </div>
      ),
    },
    { accessorKey: "lastUpdatedByName", header: "Last Updated by" },
  ];

  return (
    <RequirePermission permission="batch.view">
      <PageHeader
        title="Price batches"
        description="Batch processing: each grower's sale has a batch. A second clerk re-enters every price from the buyer's batch sheet — without looking at the captured prices — then posts the batch."
        badges={<Badge tone="outline">{(data ?? []).filter((b) => b.status === "DRAFT").length} draft</Badge>}
      />
      <DataTable
        aria-label="Price batches"
        data-testid="batches-table"
        columns={columns}
        data={rows}
        loading={isLoading}
        searchPlaceholder="Search grower or batch…"
        pageSize={10}
        emptyIcon={Layers}
        emptyTitle="No price batches"
        emptyDescription="A batch is created with each sale when a floor summary completes."
        initialColumnVisibility={{ firstName: false }}
        onRowClick={(r) => router.push(`/batches/${r.id}`)}
        toolbar={
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" wrapperClassName="w-40" size="sm" className="h-9">
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
          </NativeSelect>
        }
      />
    </RequirePermission>
  );
}

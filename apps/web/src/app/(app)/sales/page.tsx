"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, PackageCheck, Scale } from "lucide-react";
import {
  Badge,
  DataTable,
  DropdownMenuItem,
  NativeSelect,
  PageHeader,
  UnverifiedBadge,
  type ColumnDef,
} from "@tobacco/ui";
import { convertCentsToLocal, formatDate, formatLocal, formatUsd } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { GdnLink, GrowerLink } from "@/components/domain/entity-links";
import { useGuard } from "@/lib/permissions";
import { useAction, useDb, useDbQuery } from "@/mock/hooks";
import { releaseSale, selectSaleRows, type SaleRow } from "@/mock/domain/sales";

export default function SalesPage() {
  const router = useRouter();
  const dates = useDb((db) => [...new Set(db.sales.map((s) => s.saleDate))].sort().reverse());
  const currency = useDb((db) => db.settings.localCurrencyCode);
  const [date, setDate] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const { data, isLoading } = useDbQuery(["sales"], selectSaleRows);
  const release = useAction(releaseSale, { success: "Sale released for dispatch" });
  const canRelease = useGuard("sales.release");
  const rows = (data ?? []).filter((r) => (date === "ALL" || r.saleDate === date) && (status === "ALL" || r.status === status));
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  const columns: ColumnDef<SaleRow, unknown>[] = [
    { accessorKey: "growerNo", header: "Grower No.", cell: ({ row }) => <GrowerLink growerNo={row.original.growerNo} /> },
    { accessorKey: "firstName", header: "First name" },
    { accessorKey: "surname", header: "Surname" },
    { accessorKey: "saleNo", header: "Sale" },
    { accessorKey: "floorCode", header: "Floor Code" },
    { accessorKey: "saleDate", header: "Sale Date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "status", header: "S/Status", cell: ({ getValue }) => <StatusBadge kind="sale" value={getValue<string>()} /> },
    { accessorKey: "refNo", header: "ID", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { id: "gdn", header: "Delivery note", accessorFn: (r) => r.gdnDocNo, cell: ({ row }) => <GdnLink id={row.original.gdnId} docNo={row.original.gdnDocNo} /> },
    { accessorKey: "payBatchNo", header: "Batch No.", cell: ({ getValue }) => <span className="tabular">{getValue<number | undefined>() ?? "0"}</span> },
    {
      accessorKey: "usdValueCents",
      header: "US Value",
      cell: ({ getValue }) => <span className="tabular">{getValue<number | undefined>() === undefined ? "—" : formatUsd(getValue<number>())}</span>,
    },
    {
      id: "rtgs",
      header: () => (
        <span className="inline-flex items-center gap-1.5">
          {currency} Value <UnverifiedBadge uq="UQ-04" />
        </span>
      ),
      accessorFn: (r) => (r.usdValueCents !== undefined && r.exchangeRate ? convertCentsToLocal(r.usdValueCents, r.exchangeRate) : ""),
      cell: ({ row }) => (
        <span className="tabular">
          {row.original.usdValueCents !== undefined && row.original.exchangeRate ? formatLocal(convertCentsToLocal(row.original.usdValueCents, row.original.exchangeRate), currency) : "—"}
        </span>
      ),
    },
    { id: "released", header: "Released", accessorFn: (r) => (r.released ? "yes" : "no"), cell: ({ row }) => (row.original.released ? <Badge tone="success" dot>Released</Badge> : <span className="text-muted-foreground">—</span>) },
  ];

  return (
    <RequirePermission permission="sales.view">
      <PageHeader
        title="Sales & balancing"
        description="Ticket processing: every grower's sale for the day. Draft sales are shown in red. Open a sale to check its tickets and balance it."
        badges={
          <>
            <Badge tone="danger" dot>{count("DRAFT")} draft</Badge>
            <Badge tone="warning" dot>{count("BALANCED")} balanced</Badge>
            <Badge tone="success" dot>{count("PROCESSED")} processed</Badge>
          </>
        }
      />
      <DataTable
        aria-label="Sales"
        data-testid="sales-table"
        columns={columns}
        data={rows}
        loading={isLoading}
        searchPlaceholder="Search grower, name, delivery note…"
        pageSize={10}
        emptyIcon={Scale}
        emptyTitle="No sales"
        emptyDescription="Sales are created automatically when a grower's floor summary is complete."
        initialColumnVisibility={{ firstName: false, gdn: false }}
        onRowClick={(r) => router.push(`/sales/${r.id}`)}
        rowClassName={(r) => (r.status === "DRAFT" && !r.historical ? "[&>td]:text-danger-text" : undefined)}
        toolbar={
          <>
            <NativeSelect value={date} onChange={(e) => setDate(e.target.value)} aria-label="Sale date" wrapperClassName="w-44" size="sm" className="h-9">
              <option value="ALL">All dates</option>
              {dates.map((d) => (
                <option key={d} value={d}>{formatDate(d)}</option>
              ))}
            </NativeSelect>
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" wrapperClassName="w-36" size="sm" className="h-9">
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="BALANCED">Balanced</option>
              <option value="PROCESSED">Processed</option>
            </NativeSelect>
          </>
        }
        rowMenu={(r) => (
          <>
            <DropdownMenuItem onSelect={() => router.push(`/sales/${r.id}`)}>
              <ExternalLink /> Open sale
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canRelease.allowed || r.status === "DRAFT" || r.released}
              onSelect={() => void release.run({ saleId: r.id })}
            >
              <PackageCheck /> Release for dispatch
            </DropdownMenuItem>
          </>
        )}
      />
    </RequirePermission>
  );
}

"use client";
import { Warehouse } from "lucide-react";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerTable } from "@/components/buyer/buyer-resource";
import { useBuyerQuery } from "@/lib/api";
import type { ColumnDef } from "@tobacco/ui";
import { Badge } from "@tobacco/ui";
type W = { id: string; code: string; name: string; kind: string; address?: string | null; active: boolean; _count?: { bays: number; bales: number } };
export default function WarehousesPage() {
  const q = useBuyerQuery<W[]>("/warehouses");
  const columns: ColumnDef<W, unknown>[] = [
    { accessorKey: "code", header: "Code" }, { accessorKey: "name", header: "Warehouse" }, { accessorKey: "kind", header: "Type" },
    { id: "bays", header: "Bays", accessorFn: (r) => r._count?.bays ?? 0 }, { id: "bales", header: "Bales", accessorFn: (r) => r._count?.bales ?? 0 },
    { id: "status", header: "Status", cell: ({ row }) => <Badge tone={row.original.active ? "success" : "neutral"}>{row.original.active ? "Active" : "Inactive"}</Badge> },
  ];
  return <RequireBuyerPermission permission="buyer.warehouse.view"><BuyerResourceHeader title="Buyer warehouses" description="Manage storage locations owned by your company." permission="buyer.warehouse.view" /><BuyerQueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}><BuyerTable columns={columns} data={q.data ?? []} emptyTitle="No warehouses yet" emptyDescription="Warehouses will appear here when they are configured." searchPlaceholder="Search warehouses" /></BuyerQueryState></RequireBuyerPermission>;
}

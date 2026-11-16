"use client";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerTable } from "@/components/buyer/buyer-resource";
import { useBuyerQuery } from "@/lib/api";
import type { ColumnDef } from "@tobacco/ui";
type W = { id: string; code: string; name: string; kind: string; address?: string | null; active: boolean; _count?: { bays: number; bales: number } };
export default function ProcessingWarehousesPage() {
  const q = useBuyerQuery<W[]>("/warehouses");
  const columns: ColumnDef<W, unknown>[] = [{ accessorKey: "code", header: "Code" }, { accessorKey: "name", header: "Warehouse" }, { accessorKey: "address", header: "Address" }, { id: "bays", header: "Bays", accessorFn: (r) => r._count?.bays ?? 0 }, { id: "bales", header: "Bales", accessorFn: (r) => r._count?.bales ?? 0 }];
  return <RequireBuyerPermission permission="buyer.warehouse.view"><BuyerResourceHeader title="Processing warehouses" description="Locations used to receive tobacco returned from processing." permission="buyer.warehouse.view" /><BuyerQueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}><BuyerTable columns={columns} data={(q.data ?? []).filter((w) => w.kind === "PROCESSING")} emptyTitle="No processing warehouses" emptyDescription="Processing warehouses will appear when configured." searchPlaceholder="Search processing warehouses" /></BuyerQueryState></RequireBuyerPermission>;
}

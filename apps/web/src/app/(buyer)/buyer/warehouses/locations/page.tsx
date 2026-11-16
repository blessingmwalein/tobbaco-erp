"use client";
import { Grid3x3 } from "lucide-react";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerTable } from "@/components/buyer/buyer-resource";
import { useBuyerQuery } from "@/lib/api";
import type { ColumnDef } from "@tobacco/ui";
type W = { id: string; code: string; name: string; bays?: { id: string; code: string; name?: string | null; _count?: { rows: number; bales: number }; rows?: { code: string; _count?: { bales: number } }[] }[] };
type L = { warehouse: string; bay: string; row: string; bales: number };
export default function WarehouseLocationsPage() {
  const q = useBuyerQuery<W[]>("/warehouses");
  const rows: L[] = (q.data ?? []).flatMap((w) => (w.bays ?? []).flatMap((b) => (b.rows ?? []).map((r) => ({ warehouse: w.code, bay: b.code, row: r.code, bales: r._count?.bales ?? 0 }))));
  const columns: ColumnDef<L, unknown>[] = [{ accessorKey: "warehouse", header: "Warehouse" }, { accessorKey: "bay", header: "Bay" }, { accessorKey: "row", header: "Row" }, { accessorKey: "bales", header: "Bales" }];
  return <RequireBuyerPermission permission="buyer.warehouse.view"><BuyerResourceHeader title="Warehouse bays & rows" description="Review the physical locations used for bale storage." permission="buyer.warehouse.view" /><BuyerQueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}><BuyerTable columns={columns} data={rows} emptyTitle="No locations configured" emptyDescription="Add bays and rows to organize warehouse inventory." searchPlaceholder="Search locations" /></BuyerQueryState></RequireBuyerPermission>;
}

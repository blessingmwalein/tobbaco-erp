"use client";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerTable } from "@/components/buyer/buyer-resource";
import { useBuyerQuery } from "@/lib/api";
import type { ColumnDef } from "@tobacco/ui";
type M = { id: string; performedAt: string; reason?: string; note?: string | null; bale?: { barcode: string; massKg: string | number; status: string }; fromWarehouseId?: string | null; toWarehouseId?: string | null };
export default function MovementsPage() {
  const q = useBuyerQuery<M[]>("/movements");
  const columns: ColumnDef<M, unknown>[] = [{ id: "date", header: "Date", accessorFn: (r) => new Date(r.performedAt).toLocaleString() }, { id: "barcode", header: "Bale", accessorFn: (r) => r.bale?.barcode ?? "—" }, { accessorKey: "reason", header: "Reason" }, { accessorKey: "fromWarehouseId", header: "From" }, { accessorKey: "toWarehouseId", header: "To" }];
  return <RequireBuyerPermission permission="buyer.warehouse.view"><BuyerResourceHeader title="Warehouse movements" description="Review the movement ledger for your company's bales." permission="buyer.warehouse.view" /><BuyerQueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}><BuyerTable columns={columns} data={q.data ?? []} emptyTitle="No movements recorded" emptyDescription="Movement activity will appear here as bales are relocated." searchPlaceholder="Search movements" /></BuyerQueryState></RequireBuyerPermission>;
}

"use client";

import { useState } from "react";
import { DateRangePicker, type ColumnDef } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerTable } from "@/components/buyer/buyer-resource";
import { useBuyerQuery } from "@/lib/api";

type M = {
  id: string;
  performedAt: string;
  reason?: string;
  note?: string | null;
  bale?: { barcode: string; massKg: string | number; status: string };
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
};

export default function MovementsPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const q = useBuyerQuery<M[]>("/movements", { from: range.from, to: range.to }, { key: ["movements", range.from, range.to] });
  const columns: ColumnDef<M, unknown>[] = [
    { id: "date", header: "Date", accessorFn: (r) => new Date(r.performedAt).toLocaleString() },
    { id: "barcode", header: "Bale", accessorFn: (r) => r.bale?.barcode ?? "—" },
    { accessorKey: "reason", header: "Reason" },
    { accessorKey: "fromWarehouseId", header: "From" },
    { accessorKey: "toWarehouseId", header: "To" },
  ];
  return (
    <RequireBuyerPermission permission="buyer.warehouse.view">
      <BuyerResourceHeader title="Warehouse movements" description="Review the movement ledger for your company's bales." permission="buyer.warehouse.view" />
      <div className="mb-4 max-w-sm">
        <DateRangePicker aria-label="Movement dates" placeholder="Any movement date" value={range} onChange={setRange} />
      </div>
      <BuyerQueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}>
        <BuyerTable columns={columns} data={q.data ?? []} emptyTitle="No movements recorded" emptyDescription="Movement activity will appear here as bales are relocated." searchPlaceholder="Search movements" />
      </BuyerQueryState>
    </RequireBuyerPermission>
  );
}

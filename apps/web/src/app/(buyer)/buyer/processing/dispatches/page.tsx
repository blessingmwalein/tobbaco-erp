"use client";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerTable } from "@/components/buyer/buyer-resource";
import { useBuyerQuery } from "@/lib/api";
import type { ColumnDef } from "@tobacco/ui";
import { Badge } from "@tobacco/ui";
type D = { id: string; reference: string; processingCompany: { name: string }; dispatchDate: string; reason: string; status: string; totalBales: number; totalMassKg: string };
type P = { items: D[]; total: number };
export default function DispatchesPage() {
  const q = useBuyerQuery<P>("/buyer/processing/dispatches", { page: 1, pageSize: 100 }, { key: ["processing-dispatches"] });
  const columns: ColumnDef<D, unknown>[] = [{ accessorKey: "reference", header: "Reference" }, { id: "company", header: "Processor", accessorFn: (r) => r.processingCompany.name }, { id: "date", header: "Dispatch date", accessorFn: (r) => new Date(r.dispatchDate).toLocaleDateString() }, { accessorKey: "reason", header: "Reason" }, { accessorKey: "totalBales", header: "Bales" }, { accessorKey: "totalMassKg", header: "Mass (kg)" }, { id: "status", header: "Status", cell: ({ row }) => <Badge tone={row.original.status === "RETURNED" ? "success" : "neutral"}>{row.original.status}</Badge> }];
  return <RequireBuyerPermission permission="buyer.processing.view"><BuyerResourceHeader title="Processing dispatches" description="Track tobacco sent to processing companies." permission="buyer.processing.view" /><BuyerQueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}><BuyerTable columns={columns} data={q.data?.items ?? []} emptyTitle="No dispatches yet" emptyDescription="Dispatches will appear here after tobacco is sent for processing." searchPlaceholder="Search dispatches" /></BuyerQueryState></RequireBuyerPermission>;
}

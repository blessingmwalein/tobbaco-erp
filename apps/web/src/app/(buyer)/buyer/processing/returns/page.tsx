"use client";
import { Callout } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerTable } from "@/components/buyer/buyer-resource";
import { useBuyerQuery } from "@/lib/api";
import type { ColumnDef } from "@tobacco/ui";
type D = { id: string; reference: string; processingCompany: { name: string }; dispatchDate: string; status: string; totalBales: number; totalMassKg: string };
type P = { items: D[]; total: number };
export default function ProcessingReturnsPage() {
  const q = useBuyerQuery<P>("/buyer/processing/dispatches", { page: 1, pageSize: 100 }, { key: ["processing-returns-source"] });
  const columns: ColumnDef<D, unknown>[] = [{ accessorKey: "reference", header: "Dispatch" }, { id: "company", header: "Processor", accessorFn: (r) => r.processingCompany.name }, { accessorKey: "totalBales", header: "Bales" }, { accessorKey: "status", header: "Return status" }];
  return <RequireBuyerPermission permission="buyer.processing.view"><BuyerResourceHeader title="Processing returns" description="Receive and reconcile bales returned from processors." permission="buyer.processing.view" /><Callout tone="info" title="Return scanning"><span>Start a return from a dispatch detail page. Each returned, missing, or unexpected bale must be recorded with an explanation when required.</span></Callout><div className="mt-4"><BuyerQueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}><BuyerTable columns={columns} data={(q.data?.items ?? []).filter((d) => d.status !== "CANCELLED")} emptyTitle="No dispatches awaiting returns" emptyDescription="Dispatches available for return processing will appear here." searchPlaceholder="Search dispatches" /></BuyerQueryState></div></RequireBuyerPermission>;
}

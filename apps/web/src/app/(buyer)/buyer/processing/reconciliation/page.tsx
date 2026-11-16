"use client";
import { ClipboardCheck } from "lucide-react";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerTable } from "@/components/buyer/buyer-resource";
import { useBuyerQuery } from "@/lib/api";
import type { ColumnDef } from "@tobacco/ui";
type R = { id: string; reference: string; processingCompany: { name: string }; dispatchDate: string; status: string; totalBales: number; totalMassKg: string };
type P = { items: R[]; total: number };
export default function ProcessingReconciliationPage() {
  const q = useBuyerQuery<P>("/buyer/processing/dispatches", { page: 1, pageSize: 100 }, { key: ["processing-reconciliation"] });
  const columns: ColumnDef<R, unknown>[] = [{ accessorKey: "reference", header: "Dispatch" }, { id: "company", header: "Processor", accessorFn: (r) => r.processingCompany.name }, { accessorKey: "totalBales", header: "Dispatched bales" }, { accessorKey: "totalMassKg", header: "Dispatched mass (kg)" }, { accessorKey: "status", header: "Reconciliation status" }];
  return <RequireBuyerPermission permission="buyer.processing.view"><BuyerResourceHeader title="Processing reconciliation" description="Compare dispatched tobacco with processing returns and outstanding balances." permission="buyer.processing.view" /><BuyerQueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}><BuyerTable columns={columns} data={q.data?.items ?? []} emptyTitle="No reconciliation records" emptyDescription="Reconciliation results will appear as processing returns are confirmed." searchPlaceholder="Search dispatches" /></BuyerQueryState></RequireBuyerPermission>;
}

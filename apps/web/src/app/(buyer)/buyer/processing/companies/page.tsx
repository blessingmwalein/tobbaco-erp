"use client";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerTable } from "@/components/buyer/buyer-resource";
import { useBuyerQuery } from "@/lib/api";
import type { ColumnDef } from "@tobacco/ui";
import { Badge } from "@tobacco/ui";
type C = { id: string; name: string; registrationNo?: string | null; contactPerson?: string | null; phone?: string | null; email?: string | null; active: boolean };
type P = { items: C[]; total: number };
export default function ProcessingCompaniesPage() {
  const q = useBuyerQuery<P>("/buyer/processing/companies", { page: 1, pageSize: 100 }, { key: ["processing-companies"] });
  const columns: ColumnDef<C, unknown>[] = [{ accessorKey: "name", header: "Company" }, { accessorKey: "registrationNo", header: "Registration" }, { accessorKey: "contactPerson", header: "Contact" }, { accessorKey: "phone", header: "Phone" }, { id: "status", header: "Status", cell: ({ row }) => <Badge tone={row.original.active ? "success" : "neutral"}>{row.original.active ? "Active" : "Inactive"}</Badge> }];
  return <RequireBuyerPermission permission="buyer.processing.view"><BuyerResourceHeader title="Processing companies" description="Manage companies that receive dispatched tobacco." permission="buyer.processing.view" /><BuyerQueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}><BuyerTable columns={columns} data={q.data?.items ?? []} emptyTitle="No processing companies" emptyDescription="Processing partners will appear here once configured." searchPlaceholder="Search companies" /></BuyerQueryState></RequireBuyerPermission>;
}

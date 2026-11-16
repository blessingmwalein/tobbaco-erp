"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, DataTable, Input, type ColumnDef } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { useBuyerQuery } from "@/lib/api";
import { BuyerQueryState, BuyerResourceHeader, BuyerSelect } from "@/components/buyer/buyer-resource";
import { RecordLink } from "../_components/buyer-data";

type Purchase = { id: string; reference: string; floorName: string; saleDate: string; totalBales: number; totalMassKg: string; totalUsdValue: string; receivingStatus: string };
type Page = { items: Purchase[]; total: number; page: number; pageSize: number };
const statuses = [{ value: "ALL", label: "All statuses" }, { value: "NOT_STARTED", label: "Not started" }, { value: "IN_PROGRESS", label: "In progress" }, { value: "PARTIAL", label: "Partial" }, { value: "COMPLETE", label: "Complete" }];
const tone = (status: string) => status === "COMPLETE" ? "success" : status === "IN_PROGRESS" || status === "PARTIAL" ? "warning" : "neutral";

export default function PurchasesPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState("ALL");
  const query = useBuyerQuery<Page>("/buyer/purchases", { page: 1, pageSize: 100, search: search || undefined, from: from || undefined, to: to || undefined, floor: floor || undefined, status: status === "ALL" ? undefined : status }, { key: ["purchases", search, from, to, floor, status] });
  const columns: ColumnDef<Purchase, unknown>[] = [
    { accessorKey: "reference", header: "Purchase", cell: ({ row }) => <RecordLink href={`/buyer/purchases/${row.original.id}`}>{row.original.reference}</RecordLink> },
    { accessorKey: "saleDate", header: "Sale date" },
    { accessorKey: "floorName", header: "Floor" },
    { accessorKey: "totalBales", header: "Bales" },
    { accessorKey: "totalMassKg", header: "Mass (kg)" },
    { accessorKey: "receivingStatus", header: "Receiving", cell: ({ row }) => <Badge tone={tone(row.original.receivingStatus) as "success" | "warning" | "neutral"}>{row.original.receivingStatus.replaceAll("_", " ")}</Badge> },
    { accessorKey: "totalUsdValue", header: "Value (USD)" },
  ];
  return <RequireBuyerPermission permission="buyer.purchases.view"><BuyerResourceHeader title="Purchase register" description="Search, filter and sort purchases imported into your buyer inventory." permission="buyer.purchases.view" />
    <Card className="mb-6"><CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference or floor" aria-label="Search purchases" /><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Sale date from" /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sale date to" /><Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Filter floor" aria-label="Filter floor" /><BuyerSelect label="Receiving status" value={status} onValueChange={setStatus} placeholder="All statuses" options={statuses} /></CardContent></Card>
    <BuyerQueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}><DataTable columns={columns} data={query.data?.items ?? []} searchPlaceholder="Search loaded purchases" emptyTitle="No purchases found" emptyDescription="Adjust the filters or import a Flow Disk purchase." getRowId={(row) => row.id} aria-label="Purchase register" /></BuyerQueryState>
  </RequireBuyerPermission>;
}

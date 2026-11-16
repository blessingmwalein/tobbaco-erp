"use client";

import { useState } from "react";
import { Badge, Card, CardContent, DataTable, Input, type ColumnDef } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { useBuyerQuery } from "@/lib/api";
import { BuyerQueryState, BuyerResourceHeader, BuyerSelect } from "@/components/buyer/buyer-resource";

type Purchase = { id: string; reference: string; floorName: string; saleDate: string; totalBales: number; totalMassKg: string; receivingStatus: string };
type Page = { items: Purchase[]; total: number; page: number; pageSize: number };
const statuses = [{ value: "ALL", label: "All statuses" }, { value: "NOT_STARTED", label: "Not started" }, { value: "IN_PROGRESS", label: "In progress" }, { value: "PARTIAL", label: "Partial" }, { value: "COMPLETE", label: "Complete" }];

export default function ManifestsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState("ALL");
  const query = useBuyerQuery<Page>("/buyer/purchases", { page: 1, pageSize: 100, from: from || undefined, to: to || undefined, floor: floor || undefined, status: status === "ALL" ? undefined : status }, { key: ["manifests", from, to, floor, status] });
  const columns: ColumnDef<Purchase, unknown>[] = [
    { accessorKey: "reference", header: "Manifest / purchase" },
    { accessorKey: "saleDate", header: "Sale date" },
    { accessorKey: "floorName", header: "Floor" },
    { accessorKey: "totalBales", header: "Expected bales" },
    { accessorKey: "totalMassKg", header: "Expected mass (kg)" },
    { accessorKey: "receivingStatus", header: "Receiving", cell: ({ row }) => <Badge tone={row.original.receivingStatus === "COMPLETE" ? "success" : "neutral"}>{row.original.receivingStatus.replaceAll("_", " ")}</Badge> },
  ];
  return <RequireBuyerPermission permission="buyer.purchases.view"><BuyerResourceHeader title="Bale manifests" description="Filter, sort and review expected bales grouped by purchase." permission="buyer.purchases.view" />
    <Card className="mb-6"><CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Sale date from" /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sale date to" /><Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Filter floor" aria-label="Filter floor" /><BuyerSelect label="Receiving status" value={status} onValueChange={setStatus} placeholder="All statuses" options={statuses} /></CardContent></Card>
    <BuyerQueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}><DataTable columns={columns} data={query.data?.items ?? []} searchPlaceholder="Search loaded manifests" emptyTitle="No manifests found" emptyDescription="Adjust the filters or import a purchase." getRowId={(row) => row.id} aria-label="Bale manifests" /></BuyerQueryState>
  </RequireBuyerPermission>;
}

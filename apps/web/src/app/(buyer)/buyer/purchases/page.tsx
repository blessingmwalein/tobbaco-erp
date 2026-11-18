"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge, Button, Card, CardContent, DataTable, Input, type ColumnDef, DateRangePicker } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { useBuyerQuery } from "@/lib/api";
import { BuyerQueryState, BuyerResourceHeader, BuyerSelect } from "@/components/buyer/buyer-resource";
import { RecordLink } from "../_components/buyer-data";

type Purchase = {
  id: string;
  reference: string;
  invoiceNumber: string | null;
  invoiceReference: string | null;
  buyerName: string | null;
  floorName: string;
  saleDate: string;
  totalBales: number;
  totalMassKg: string;
  totalUsdValue: string;
  totalDispatchedBales: number;
  totalReceivedBales: number;
  totalDispatchedMassKg: string;
  outstandingBales: number;
  shipmentCount: number;
  receivingStatus: string;
  reconciliationStatus: string | null;
};
type Page = { items: Purchase[]; total: number; page: number; pageSize: number };

const statuses = [
  { value: "ALL", label: "All receiving statuses" },
  { value: "NOT_STARTED", label: "Not started" },
  { value: "PARTIALLY_DISPATCHED", label: "Partially dispatched" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "PARTIALLY_RECEIVED", label: "Partially received" },
  { value: "PARTIAL", label: "Partial" },
  { value: "COMPLETE", label: "Complete" },
];
const reconciliationStatuses = [
  { value: "ALL", label: "All reconciliations" },
  { value: "AWAITING_SHIPMENTS", label: "Awaiting shipments" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "CLOSED", label: "Closed" },
];
const tone = (status: string) => (status === "COMPLETE" ? "success" : status === "IN_PROGRESS" || status === "PARTIAL" || status === "PARTIALLY_RECEIVED" || status === "PARTIALLY_DISPATCHED" ? "warning" : "neutral");

export default function PurchasesPage() {
  const [search, setSearch] = useState("");
  const [buyer, setBuyer] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState("ALL");
  const [reconciliationStatus, setReconciliationStatus] = useState("ALL");
  const query = useBuyerQuery<Page>("/buyer/purchases", { page: 1, pageSize: 100, search: search || undefined, buyer: buyer || undefined, invoiceNumber: invoiceNumber || undefined, from: from || undefined, to: to || undefined, floor: floor || undefined, status: status === "ALL" ? undefined : status, reconciliationStatus: reconciliationStatus === "ALL" ? undefined : reconciliationStatus }, { key: ["purchases", search, buyer, invoiceNumber, from, to, floor, status, reconciliationStatus] });

  const columns: ColumnDef<Purchase, unknown>[] = [
    { accessorKey: "reference", header: "Purchase", cell: ({ row }) => <RecordLink href={`/buyer/purchases/${row.original.id}`}>{row.original.reference}</RecordLink> },
    { accessorKey: "invoiceNumber", header: "Invoice", cell: ({ row }) => row.original.invoiceNumber ?? row.original.invoiceReference ?? "—" },
    { accessorKey: "buyerName", header: "Buyer", cell: ({ row }) => row.original.buyerName ?? "—" },
    { accessorKey: "floorName", header: "Auction floor" },
    { accessorKey: "saleDate", header: "Purchase date" },
    { accessorKey: "totalBales", header: "Purchased bales" },
    { accessorKey: "totalMassKg", header: "Purchased mass (kg)" },
    { accessorKey: "totalDispatchedBales", header: "Dispatched" },
    { accessorKey: "totalReceivedBales", header: "Received" },
    { accessorKey: "outstandingBales", header: "Outstanding", cell: ({ row }) => <span className={row.original.outstandingBales > 0 ? "font-medium text-warning" : ""}>{row.original.outstandingBales}</span> },
    { accessorKey: "shipmentCount", header: "Shipments" },
    { accessorKey: "receivingStatus", header: "Receiving", cell: ({ row }) => <Badge tone={tone(row.original.receivingStatus) as "success" | "warning" | "neutral"}>{row.original.receivingStatus.replaceAll("_", " ")}</Badge> },
    { id: "actions", header: "Actions", cell: ({ row }) => <Button asChild size="sm" variant="secondary"><a href={`/buyer/purchases/${row.original.id}`}>View <ArrowRight className="size-3" /></a></Button> },
  ];

  return <RequireBuyerPermission permission="buyer.purchases.view"><BuyerResourceHeader title="Purchase register" description="Monitor purchased quantities against physically received quantities across every associated shipment." permission="buyer.purchases.view" />
    <Card className="mb-6"><CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search purchase reference" aria-label="Search purchases" /><Input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Filter buyer" aria-label="Filter buyer" /><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Filter invoice number" aria-label="Filter invoice number" /><Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Filter auction floor" aria-label="Filter floor" /><DateRangePicker aria-label="Purchase dates" placeholder="Any purchase date" value={{ from: from || undefined, to: to || undefined }} onChange={(range) => { setFrom(range.from ?? ""); setTo(range.to ?? ""); }} /><BuyerSelect label="Receiving status" value={status} onValueChange={setStatus} placeholder="All receiving statuses" options={statuses} /><BuyerSelect label="Reconciliation status" value={reconciliationStatus} onValueChange={setReconciliationStatus} placeholder="All reconciliations" options={reconciliationStatuses} /></CardContent></Card>
    <BuyerQueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}><DataTable columns={columns} data={query.data?.items ?? []} searchPlaceholder="Search loaded purchases" emptyTitle="No purchases found" emptyDescription="Adjust the filters or import a Flow Disk purchase." getRowId={(row) => row.id} aria-label="Purchase register" /></BuyerQueryState>
  </RequireBuyerPermission>;
}

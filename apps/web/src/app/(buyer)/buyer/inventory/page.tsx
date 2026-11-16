"use client";

import { useMemo, useState } from "react";
import { History, Warehouse as WarehouseIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Skeleton,
  type ColumnDef,
} from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerSelect } from "@/components/buyer/buyer-resource";
import { describeError, useBuyerQuery } from "@/lib/api";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  bays: Array<{ id: string; code: string; name?: string | null; rows: Array<{ id: string; code: string }> }>;
};
type Bale = { id: string; barcode: string; season?: string; buyerGrade?: string | null; timbGrade?: string | null; growerNo?: string | null; lotNo?: string | null; massKg: string | number; usdValue: string | number; receivedAt?: string | null; status: string; currentBayId?: string | null; currentRowId?: string | null };
type Timeline = { bale: Record<string, unknown>; events: Array<{ id: string; type: string; occurredAt: string; performedByName: string | null; fromLabel: string | null; toLabel: string | null; refLabel: string | null; notes: string | null }>; movements: Record<string, unknown>[]; scans: Record<string, unknown>[] };

const display = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const money = (value: unknown) => value === null || value === undefined ? "—" : `US$ ${Number(value).toFixed(2)}`;

export default function InventoryPage() {
  const warehouses = useBuyerQuery<Warehouse[]>("/warehouses");
  const [selected, setSelected] = useState("");
  const [bayId, setBayId] = useState("");
  const [rowId, setRowId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedBale, setSelectedBale] = useState<string | null>(null);
  const warehouseId = selected || warehouses.data?.[0]?.id || "";
  const warehouse = warehouses.data?.find((item) => item.id === warehouseId);
  const bay = warehouse?.bays.find((item) => item.id === bayId);
  const inventory = useBuyerQuery<Bale[]>(
    warehouseId ? `/warehouses/${warehouseId}/inventory?${new URLSearchParams({ ...(bayId ? { bayId } : {}), ...(rowId ? { rowId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()}` : "/warehouses/none/inventory",
    undefined,
    { enabled: Boolean(warehouseId), key: ["inventory", warehouseId, bayId, rowId, from, to] },
  );
  const timeline = useBuyerQuery<Timeline>(selectedBale ? `/buyer/traceability/${encodeURIComponent(selectedBale)}` : "/buyer/traceability/none", undefined, { enabled: Boolean(selectedBale), key: ["inventory/bale", selectedBale] });
  const timelineMatchesSelection = Boolean(selectedBale && timeline.data?.bale?.barcode === selectedBale);

  const columns = useMemo<ColumnDef<Bale, unknown>[]>(() => [
    { accessorKey: "barcode", header: "Barcode", cell: ({ row }) => <span className="font-medium text-primary">{row.original.barcode}</span> },
    { accessorKey: "buyerGrade", header: "Grade" },
    { accessorKey: "growerNo", header: "Grower" },
    { accessorKey: "lotNo", header: "Lot" },
    { accessorKey: "massKg", header: "Mass (kg)" },
    { accessorKey: "usdValue", header: "Bought price (US$)" },
    { id: "receivedAt", header: "Received", accessorFn: (row) => row.receivedAt ? new Date(row.receivedAt).getTime() : 0, cell: ({ row }) => row.original.receivedAt ? new Date(row.original.receivedAt).toLocaleDateString() : "—" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge tone={row.original.status === "IN_STOCK" ? "success" : "neutral"}>{row.original.status}</Badge> },
  ], []);

  function selectWarehouse(value: string) {
    setSelected(value);
    setBayId("");
    setRowId("");
  }

  return (
    <RequireBuyerPermission permission="buyer.warehouse.view">
      <BuyerResourceHeader title="Warehouse inventory" description="Visualize bales by warehouse, bay and row. Select a bale to review its complete purchase, receiving and storage history." permission="buyer.warehouse.view" />
      <BuyerQueryState loading={warehouses.isLoading} error={warehouses.error} retry={() => void warehouses.refetch()}>
        {!warehouses.data?.length ? <EmptyState icon={WarehouseIcon} title="No warehouses available" description="Inventory is available after a warehouse is configured." /> : (
          <>
            <Card className="mb-4">
              <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
                <BuyerSelect label="Warehouse" value={warehouseId} onValueChange={selectWarehouse} placeholder="Select warehouse" options={warehouses.data.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))} />
                <BuyerSelect label="Bay" value={bayId || "all-bays"} onValueChange={(value) => { setBayId(value === "all-bays" ? "" : value); setRowId(""); }} placeholder="All bays" options={[{ value: "all-bays", label: "All bays" }, ...(warehouse?.bays ?? []).map((item) => ({ value: item.id, label: item.name ? `${item.code} · ${item.name}` : item.code }))]} />
                <BuyerSelect label="Row" value={rowId || "all-rows"} onValueChange={(value) => setRowId(value === "all-rows" ? "" : value)} placeholder="All rows" options={[{ value: "all-rows", label: "All rows" }, ...(bay?.rows ?? []).map((item) => ({ value: item.id, label: item.code }))]} />
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Received from" />
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Received to" />
              </CardContent>
            </Card>
            <BuyerQueryState loading={inventory.isLoading} error={inventory.error} retry={() => void inventory.refetch()}>
              <DataTable data={inventory.data ?? []} columns={columns} getRowId={(row) => row.id} onRowClick={(row) => setSelectedBale(row.barcode)} searchPlaceholder="Search barcode, grower or lot" emptyIcon={WarehouseIcon} emptyTitle="No bales in this selection" emptyDescription="Try another warehouse, bay, row or date range." aria-label="Warehouse bale inventory" />
            </BuyerQueryState>
          </>
        )}
      </BuyerQueryState>
      <Sheet open={Boolean(selectedBale)} onOpenChange={(open) => { if (!open) setSelectedBale(null); }}>
        <SheetContent key={selectedBale ?? "bale-drawer"} className="w-[min(48rem,100vw)] overflow-y-auto p-6">
          <SheetTitle>Bale history</SheetTitle>
          <SheetDescription>{selectedBale ? `Complete traceability for ${selectedBale}` : "Bale details"}</SheetDescription>
          {timeline.isError ? <Card className="mt-6"><CardContent className="pt-6 text-sm text-danger-text">{describeError(timeline.error)}<Button className="mt-3" variant="secondary" onClick={() => void timeline.refetch()}>Try again</Button></CardContent></Card> : timeline.isLoading || !timelineMatchesSelection ? <Skeleton className="mt-6 h-96" /> : timeline.data ? <BaleHistory timeline={timeline.data} /> : null}
        </SheetContent>
      </Sheet>
    </RequireBuyerPermission>
  );
}

function BaleHistory({ timeline }: { timeline: Timeline }) {
  const bale = timeline.bale;
  const purchase = bale.purchase as Record<string, unknown> | undefined;
  const warehouse = bale.warehouse as Record<string, unknown> | undefined;
  const bay = bale.bay as Record<string, unknown> | undefined;
  const row = bale.row as Record<string, unknown> | undefined;
  const currentLocation = bale.currentLocation as { warehouse?: Record<string, unknown> | null; bay?: Record<string, unknown> | null; row?: Record<string, unknown> | null } | undefined;
  const resolvedWarehouse = currentLocation?.warehouse ?? warehouse;
  const resolvedBay = currentLocation?.bay ?? bay;
  const resolvedRow = currentLocation?.row ?? row;
  return <div className="mt-5 space-y-4">
    <Card><CardHeader><CardTitle>Current stock</CardTitle><CardDescription>Where this bale is currently stored</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><Info label="Warehouse" value={resolvedWarehouse ? `${display(resolvedWarehouse.code)} · ${display(resolvedWarehouse.name)}` : "Not allocated"} /><Info label="Bay" value={display(resolvedBay?.code)} /><Info label="Row" value={display(resolvedRow?.code)} /><Info label="Status" value={display(bale.status)} /><Info label="Mass" value={`${display(bale.massKg)} kg`} /><Info label="Bought price" value={money(bale.usdValue)} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Purchase and receiving</CardTitle><CardDescription>Imported invoice and scan information</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><Info label="Purchase" value={display(purchase?.reference)} /><Info label="Sale date" value={display(purchase?.saleDate)} /><Info label="Barcode" value={display(bale.barcode)} /><Info label="Received at" value={display(bale.receivedAt)} /><Info label="Grade" value={`${display(bale.buyerGrade)} / ${display(bale.timbGrade)}`} /><Info label="Grower / lot" value={`${display(bale.growerNo)} / ${display(bale.lotNo)}`} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Warehouse history</CardTitle><CardDescription>Scans, receiving and movements</CardDescription></CardHeader><CardContent>{timeline.events.length ? <ol className="space-y-4" aria-label="Bale warehouse history">{timeline.events.map((event) => <li key={event.id} className="border-l-2 border-primary/30 pl-4"><p className="font-medium">{event.type}</p><p className="text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString()} · {event.performedByName ?? "System"}</p><p className="mt-1 text-sm">{event.fromLabel && event.toLabel ? `${event.fromLabel} → ${event.toLabel}` : event.refLabel ?? event.notes ?? "Recorded event"}</p></li>)}</ol> : <EmptyState icon={History} title="No history recorded" description="No warehouse events have been recorded for this bale." />}</CardContent></Card>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

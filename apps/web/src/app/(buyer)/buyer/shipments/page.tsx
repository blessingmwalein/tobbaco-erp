"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, FileUp, Truck } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  toast,
  type ColumnDef,
} from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerResourceHeader, BuyerSelect } from "@/components/buyer/buyer-resource";
import { buyerApi, describeError, useBuyerMutation, useBuyerQuery } from "@/lib/api";
import { DataTableCard, LoadingTable, PageIntro } from "../_components/buyer-data";

// ── Types ──────────────────────────────────────────────────────────────────────

type Shipment = {
  id: string;
  reference: string;
  status: string;
  dispatchDate: string;
  dispatchLocation?: string | null;
  expectedBales: number;
  expectedMassKg: string;
  truckRegistration?: string | null;
  trailerRegistration?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  transporter?: string | null;
  notes?: string | null;
  arrivedAt?: string | null;
  arrivalNotes?: string | null;
  actualTruckRegistration?: string | null;
  purchase: { id: string; reference: string; totalBales: number; totalMassKg: string; receivingStatus: string };
  destinationWarehouse?: { id: string; code: string; name: string } | null;
  _count: { bales: number; sessions: number };
};

type ShipmentBale = {
  id: string;
  massKgAtDispatch: string;
  bale: { id: string; barcode: string; massKg: string; buyerGrade: string; growerNo: string; lotNo: string; status: string };
};

type ReceivingSession = { id: string; reference: string; status: string; startedAt: string; confirmedAt?: string | null };

type ShipmentDetail = Shipment & {
  bales: ShipmentBale[];
  sessions: ReceivingSession[];
  purchase: Shipment["purchase"] & { totalUsdValue?: string };
};

type Warehouse = { id: string; code: string; name: string; kind: string; active: boolean };
type PreviewRow = { rowNumber: number; barcode: string; massKg: string };
type PreviewIssue = { rowNumber: number; field: string; message: string; severity: string };
type Preview = {
  id: string; reference: string; filename: string; status: string; recordCount: number; validCount: number; invalidCount: number;
  purchase: { id: string; reference: string; totalBales: number; totalMassKg: string; receivingStatus: string } | null;
  destinationWarehouse: { id: string; code: string; name: string } | null;
  rows: PreviewRow[]; issues: PreviewIssue[];
  metadata: { dispatchDate?: string; dispatchLocation?: string | null; truckRegistration?: string; driverName?: string; transporter?: string | null; sourceShipmentId?: string | number | null };
};

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "IN_TRANSIT",               label: "In transit" },
  { value: "ARRIVED",                  label: "Arrived" },
  { value: "RECEIVING",                label: "Receiving" },
  { value: "RECONCILIATION_REQUIRED",  label: "Reconciliation required" },
  { value: "CONFIRMED",                label: "Confirmed" },
  { value: "ALLOCATED",                label: "Allocated" },
  { value: "CANCELLED",                label: "Cancelled" },
];

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "ALLOCATED" || status === "CONFIRMED") return "success";
  if (status === "IN_TRANSIT" || status === "ARRIVED" || status === "RECEIVING") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ShipmentsPage() {
  // Filters
  const [search, setSearch]     = useState("");
  const [status, setStatus]     = useState("");
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");
  const [warehouse, setWarehouse] = useState("");

  // Detail drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Arrival dialog
  const [arrivalOpen, setArrivalOpen]   = useState(false);
  const [arrivalTarget, setArrivalTarget] = useState<Shipment | null>(null);

  // Import dialog
  const [importOpen, setImportOpen]     = useState(false);
  const [warehouseId, setWarehouseId]   = useState("");
  const [purchaseRef, setPurchaseRef]   = useState("");
  const [override, setOverride]         = useState({ reference: "", dispatchDate: "", truck: "", driver: "", location: "", transporter: "" });
  const [preview, setPreview]           = useState<Preview | null>(null);
  const [formError, setFormError]       = useState<string | null>(null);

  // Data
  const shipmentsQuery = useBuyerQuery<Shipment[]>(
    "/buyer/shipments",
    {
      search: search || undefined,
      status: status || undefined,
    },
    { key: ["buyer/shipments", search, status, from, to, warehouse] },
  );

  const detailQuery = useBuyerQuery<ShipmentDetail>(
    `/buyer/shipments/${selectedId}`,
    undefined,
    { key: ["buyer/shipments", selectedId], enabled: Boolean(selectedId) },
  );

  const warehousesQuery = useBuyerQuery<Warehouse[]>("/warehouses", undefined, { key: ["buyer/shipment-warehouses"] });

  const arrive = useBuyerMutation(
    (body: { id: string; receivingWarehouseId: string; actualTruckRegistration?: string; arrivalNotes?: string }) =>
      buyerApi.post(`/buyer/shipments/${body.id}/arrive`, {
        receivingWarehouseId: body.receivingWarehouseId,
        actualTruckRegistration: body.actualTruckRegistration,
        arrivalNotes: body.arrivalNotes,
      }),
    { invalidate: [["buyer/shipments"]], success: "Shipment marked as arrived", toastError: false },
  );

  const stage = useBuyerMutation(
    (body: Record<string, unknown>) => buyerApi.post<Preview>("/buyer/shipments/import", body),
    { invalidate: [["buyer/shipments"]], toastError: false },
  );

  const confirmImport = useBuyerMutation(
    (id: string) => buyerApi.post(`/buyer/shipments/imports/${id}/confirm`),
    { invalidate: [["buyer/shipments"], ["purchases"]], success: "Shipment imported successfully", toastError: false },
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  function closeImport() {
    setImportOpen(false);
    setPreview(null);
    setWarehouseId("");
    setPurchaseRef("");
    setOverride({ reference: "", dispatchDate: "", truck: "", driver: "", location: "", transporter: "" });
    setFormError(null);
  }

  async function importManifest(form: HTMLFormElement) {
    setFormError(null);
    const data = new FormData(form);
    const file = data.get("file");
    try {
      const pasted = String(data.get("content") ?? "").trim();
      const content = pasted || (file instanceof File ? await file.text() : "");
      if (!content) { setFormError("Choose a shipment JSON file or paste its contents."); return; }
      if (!warehouseId) { setFormError("Select the destination warehouse."); return; }
      const result = await stage.mutateAsync({
        filename: file instanceof File && file.name ? file.name : "shipment.json",
        content,
        destinationWarehouseId: warehouseId,
        purchaseReference: purchaseRef || undefined,
        dispatchReference: override.reference || undefined,
        dispatchDate: override.dispatchDate || undefined,
        truckRegistration: override.truck || undefined,
        driverName: override.driver || undefined,
        dispatchLocation: override.location || undefined,
        transporter: override.transporter || undefined,
      });
      setPreview(result);
      if (result.invalidCount) setFormError(`${result.invalidCount} validation issue(s) — resolve before confirming.`);
    } catch (e) {
      const msg = describeError(e);
      setFormError(msg);
      toast.error(msg);
    }
  }

  async function confirmShipment() {
    if (!preview) return;
    setFormError(null);
    try {
      await confirmImport.mutateAsync(preview.id);
      closeImport();
    } catch (e) {
      setFormError(describeError(e));
    }
  }

  async function markArrived(form: HTMLFormElement) {
    if (!arrivalTarget) return;
    const data = new FormData(form);
    try {
      await arrive.mutateAsync({
        id: arrivalTarget.id,
        receivingWarehouseId: String(data.get("warehouseId") ?? ""),
        actualTruckRegistration: String(data.get("truck") ?? "") || undefined,
        arrivalNotes: String(data.get("notes") ?? "") || undefined,
      });
      setArrivalOpen(false);
      // refresh detail if this shipment is open in the drawer
      if (selectedId === arrivalTarget.id) void detailQuery.refetch();
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  // ── Client-side date filter (API doesn't support date params yet) ────────────
  const allShipments = shipmentsQuery.data ?? [];
  const filtered = allShipments.filter((s) => {
    const date = s.dispatchDate.slice(0, 10);
    if (from && date < from) return false;
    if (to   && date > to)   return false;
    if (warehouse && s.destinationWarehouse?.id !== warehouse) return false;
    return true;
  });

  // ── Table columns ────────────────────────────────────────────────────────────

  const columns: ColumnDef<Shipment, unknown>[] = [
    {
      accessorKey: "reference",
      header: "Reference",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.reference}</p>
          <p className="text-xs text-muted-foreground">{new Date(row.original.dispatchDate).toLocaleDateString()}</p>
        </div>
      ),
    },
    {
      id: "purchase",
      header: "Purchase",
      cell: ({ row }) => row.original.purchase.reference,
    },
    {
      accessorKey: "truckRegistration",
      header: "Truck / driver",
      cell: ({ row }) => (
        <div>
          <p>{row.original.truckRegistration ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.original.driverName ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "warehouse",
      header: "Warehouse",
      cell: ({ row }) => row.original.destinationWarehouse?.name ?? "—",
    },
    {
      accessorKey: "expectedBales",
      header: "Bales",
      cell: ({ row }) => (
        <div>
          <p>{row.original.expectedBales}</p>
          <p className="text-xs text-muted-foreground">{row.original.expectedMassKg} kg</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge tone={statusTone(row.original.status)}>
          {row.original.status.replaceAll("_", " ")}
        </Badge>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  const activeWarehouses = (warehousesQuery.data ?? []).filter((w) => w.active && w.kind === "STANDARD");

  return (
    <RequireBuyerPermission permission="buyer.receiving.view">
      <PageIntro
        title="Invoice shipments"
        description="Track dispatched bales from purchase through to warehouse receipt."
        actions={
          <Button onClick={() => setImportOpen(true)}>
            <FileUp /> Import shipment JSON
          </Button>
        }
      />

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-6">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, truck, driver"
            aria-label="Search shipments"
            className="lg:col-span-2"
          />
          <BuyerSelect
            label="Status"
            value={status}
            onValueChange={setStatus}
            placeholder="All statuses"
            options={STATUS_OPTIONS}
          />
          <BuyerSelect
            label="Warehouse"
            value={warehouse}
            onValueChange={setWarehouse}
            placeholder="All warehouses"
            options={activeWarehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))}
          />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Dispatch date from" />
          <Input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   aria-label="Dispatch date to" />
        </CardContent>
        {(search || status || warehouse || from || to) && (
          <CardContent className="pb-4 pt-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setSearch(""); setStatus(""); setWarehouse(""); setFrom(""); setTo(""); }}
            >
              Clear filters
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <BuyerQueryState
        loading={shipmentsQuery.isLoading}
        error={shipmentsQuery.error}
        retry={() => void shipmentsQuery.refetch()}
      >
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search loaded shipments"
          emptyIcon={Truck}
          emptyTitle="No shipments"
          emptyDescription={search || status || warehouse || from || to ? "Try changing the filters." : "Import a shipment JSON file to get started."}
          getRowId={(row) => row.id}
          onRowClick={(row) => setSelectedId(row.id)}
          rowClassName={(row) => (row.id === selectedId ? "bg-surface-secondary" : undefined)}
          aria-label="Invoice shipments"
          hidePagerWhenSinglePage
        />
      </BuyerQueryState>

      {/* ── Detail drawer ────────────────────────────────────────────────────── */}
      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent side="right" className="flex w-[min(44rem,100vw)] flex-col gap-0 overflow-hidden p-0">
          {detailQuery.isLoading ? (
            <div className="p-6"><LoadingTable columns={2} /></div>
          ) : detailQuery.isError ? (
            <div className="p-6">
              <EmptyState title="Could not load shipment" description={describeError(detailQuery.error)} action={<Button variant="secondary" onClick={() => void detailQuery.refetch()}>Try again</Button>} />
            </div>
          ) : detailQuery.data ? (
            <ShipmentDrawerContent
              shipment={detailQuery.data}
              onMarkArrived={() => { setArrivalTarget(detailQuery.data!); setArrivalOpen(true); }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ── Import dialog ────────────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) closeImport(); }}>
        <DialogContent size="lg" className="max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{preview ? "Review shipment import" : "Import shipment JSON"}</DialogTitle>
            <DialogDescription>
              {preview
                ? "Confirm the resolved purchase and dispatched bales before creating the in-transit shipment."
                : "The purchase is derived from the bale barcodes. Metadata (vehicle, driver, departure date) is read from the file."}
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <>
              <DialogBody className="max-h-[65vh] overflow-y-auto pr-2">
                <ShipmentPreview preview={preview} />
              </DialogBody>
              {formError && (
                <Card className="mx-6 mb-2 border-danger/30">
                  <CardContent className="pt-4 text-sm text-danger-text">{formError}</CardContent>
                </Card>
              )}
              <DialogFooter className="shrink-0 border-t border-border pt-4">
                <Button type="button" variant="secondary" onClick={() => setPreview(null)}><ArrowLeft /> Back</Button>
                <Button
                  type="button"
                  variant="success"
                  disabled={preview.invalidCount > 0 || !preview.purchase || confirmImport.isPending}
                  loading={confirmImport.isPending}
                  onClick={() => void confirmShipment()}
                >
                  <CheckCircle2 /> Confirm shipment
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void importManifest(e.currentTarget); }} className="flex min-h-0 flex-col">
              <DialogBody className="max-h-[65vh] overflow-y-auto pr-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Destination warehouse" required hint="Active standard warehouses only.">
                    <SearchablePicker
                      value={warehouseId}
                      onChange={setWarehouseId}
                      placeholder="Search warehouses…"
                      options={activeWarehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))}
                    />
                  </Field>
                  <Field label="Purchase reference" hint="Leave blank to auto-detect from barcodes.">
                    <SearchablePicker value={purchaseRef} onChange={setPurchaseRef} placeholder="Auto-detect from barcodes" options={[]} />
                  </Field>
                  <Field label="Shipment reference" hint="Derived from source_shipment_id if blank.">
                    <Input value={override.reference} onChange={(e) => setOverride((o) => ({ ...o, reference: e.target.value }))} placeholder="Auto from JSON" />
                  </Field>
                  <Field label="Departure date" hint="Derived from departure_date if blank.">
                    <Input type="date" value={override.dispatchDate} onChange={(e) => setOverride((o) => ({ ...o, dispatchDate: e.target.value }))} />
                  </Field>
                  <Field label="Truck registration" hint="Derived from vehicle if blank.">
                    <Input value={override.truck} onChange={(e) => setOverride((o) => ({ ...o, truck: e.target.value }))} placeholder="Auto from JSON" />
                  </Field>
                  <Field label="Driver name" hint="Derived from driver if blank.">
                    <Input value={override.driver} onChange={(e) => setOverride((o) => ({ ...o, driver: e.target.value }))} placeholder="Auto from JSON" />
                  </Field>
                </div>
                <div className="mt-4 grid gap-4">
                  <Field label="Shipment JSON file">
                    <Input name="file" type="file" accept=".json,application/json" />
                  </Field>
                  <Field label="Or paste JSON content">
                    <Textarea name="content" placeholder={'{"format":"leaflogix-shipment","shipment":{},"bales":[]}'} rows={5} />
                  </Field>
                </div>
                {formError && (
                  <Card className="mt-4 border-danger/30">
                    <CardContent className="pt-4 text-sm text-danger-text">{formError}</CardContent>
                  </Card>
                )}
              </DialogBody>
              <DialogFooter className="shrink-0 border-t border-border pt-4">
                <Button type="button" variant="secondary" onClick={closeImport}>Cancel</Button>
                <Button type="submit" disabled={!warehouseId || stage.isPending} loading={stage.isPending}>
                  <FileUp /> Preview import
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Arrival dialog ───────────────────────────────────────────────────── */}
      <Dialog open={arrivalOpen} onOpenChange={setArrivalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm shipment arrival</DialogTitle>
            <DialogDescription>{arrivalTarget?.reference} · {arrivalTarget?.truckRegistration ?? "truck not recorded"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); void markArrived(e.currentTarget); }}>
            <DialogBody className="grid gap-3">
              <Field label="Receiving warehouse" required>
                <select
                  name="warehouseId"
                  required
                  defaultValue={
                    arrivalTarget?.destinationWarehouse
                      ? activeWarehouses.find((w) => w.id === arrivalTarget.destinationWarehouse?.id)?.id ?? ""
                      : ""
                  }
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Select warehouse</option>
                  {activeWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Actual truck registration">
                <Input name="truck" defaultValue={arrivalTarget?.truckRegistration ?? ""} />
              </Field>
              <Field label="Arrival notes">
                <Textarea name="notes" rows={3} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setArrivalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={arrive.isPending}><Truck /> Confirm arrival</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </RequireBuyerPermission>
  );
}

// ── Shipment detail drawer content ────────────────────────────────────────────

function ShipmentDrawerContent({ shipment, onMarkArrived }: { shipment: ShipmentDetail; onMarkArrived: () => void }) {
  const canArrive = shipment.status === "IN_TRANSIT";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border px-6 py-5">
        <div className="min-w-0 pr-4">
          <SheetTitle className="text-base font-semibold">{shipment.reference}</SheetTitle>
          <SheetDescription className="mt-0.5 text-sm text-muted-foreground">
            {shipment.purchase.reference} · {new Date(shipment.dispatchDate).toLocaleDateString()}
          </SheetDescription>
        </div>
        <Badge tone={statusTone(shipment.status)} className="shrink-0">
          {shipment.status.replaceAll("_", " ")}
        </Badge>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">

        {/* KPIs */}
        <KeyValue
          columns={2}
          items={[
            { label: "Dispatched bales",  value: shipment.expectedBales },
            { label: "Dispatched mass",   value: `${shipment.expectedMassKg} kg` },
            { label: "Truck",             value: shipment.truckRegistration ?? "—" },
            { label: "Driver",            value: shipment.driverName ?? "—" },
            { label: "Trailer",           value: shipment.trailerRegistration ?? "—" },
            { label: "Transporter",       value: shipment.transporter ?? "—" },
            { label: "Dispatch location", value: shipment.dispatchLocation ?? "—" },
            { label: "Destination",       value: shipment.destinationWarehouse?.name ?? "—" },
          ]}
        />

        {/* Arrival info (shown once arrived) */}
        {shipment.arrivedAt && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Arrival</h3>
            <KeyValue
              columns={2}
              items={[
                { label: "Arrived at",   value: new Date(shipment.arrivedAt).toLocaleString() },
                { label: "Actual truck", value: shipment.actualTruckRegistration ?? "—" },
                { label: "Arrival notes", value: shipment.arrivalNotes ?? "—" },
              ]}
            />
          </div>
        )}

        {/* Purchase summary */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Purchase</h3>
          <KeyValue
            columns={2}
            items={[
              { label: "Reference",     value: shipment.purchase.reference },
              { label: "Total bales",   value: shipment.purchase.totalBales },
              { label: "Total mass",    value: `${shipment.purchase.totalMassKg} kg` },
              { label: "Receiving status", value: shipment.purchase.receivingStatus.replaceAll("_", " ") },
            ]}
          />
        </div>

        {/* Receiving sessions */}
        {shipment.sessions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Receiving sessions ({shipment.sessions.length})</h3>
            <div className="rounded-xl border border-border">
              <Table aria-label="Receiving sessions">
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipment.sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.reference}</TableCell>
                      <TableCell>
                        <Badge tone={s.status === "CONFIRMED" ? "success" : s.status === "OPEN" ? "warning" : "neutral"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(s.startedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Bale manifest */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Dispatched bales ({shipment.bales.length})</h3>
          <div className="max-h-72 overflow-auto rounded-xl border border-border">
            <Table aria-label="Dispatched bales">
              <TableHeader>
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Grower / lot</TableHead>
                  <TableHead>Mass (kg)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.bales.map((sb) => (
                  <TableRow key={sb.id}>
                    <TableCell className="font-mono text-xs">{sb.bale.barcode}</TableCell>
                    <TableCell>{sb.bale.buyerGrade}</TableCell>
                    <TableCell>{sb.bale.growerNo} / {sb.bale.lotNo}</TableCell>
                    <TableCell>{sb.massKgAtDispatch}</TableCell>
                    <TableCell>
                      <Badge tone={sb.bale.status === "IN_STOCK" ? "success" : sb.bale.status === "DISPATCHED" ? "warning" : "neutral"} dot>
                        {sb.bale.status.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Notes */}
        {shipment.notes && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground">{shipment.notes}</p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {canArrive && (
        <div className="shrink-0 border-t border-border px-6 py-4">
          <Button variant="primary" onClick={onMarkArrived} className="w-full">
            <Truck /> Mark as arrived
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Import preview ────────────────────────────────────────────────────────────

function ShipmentPreview({ preview }: { preview: Preview }) {
  return (
    <div className="space-y-4">
      <KeyValue
        columns={2}
        items={[
          { label: "Resolved purchase",    value: preview.purchase ? `${preview.purchase.reference} · ${preview.purchase.totalBales} bales` : "Not identified" },
          { label: "Destination warehouse", value: preview.destinationWarehouse?.name ?? "—" },
          { label: "Dispatch date",         value: preview.metadata.dispatchDate ?? "—" },
          { label: "Truck · driver",        value: `${preview.metadata.truckRegistration ?? "—"} · ${preview.metadata.driverName ?? "—"}` },
          { label: "Records",               value: preview.recordCount },
          { label: "Valid / issues",        value: `${preview.validCount} / ${preview.invalidCount}` },
        ]}
      />
      {preview.issues.length > 0 && (
        <Callout tone="danger" title={`${preview.issues.length} validation issue(s)`}>
          <ul className="list-disc pl-5">
            {preview.issues.map((issue, i) => (
              <li key={i}>Row {issue.rowNumber || "—"}{issue.field ? ` · ${issue.field}` : ""}: {issue.message}</li>
            ))}
          </ul>
        </Callout>
      )}
      <DataTableCard>
        <CardHeader>
          <CardTitle>Dispatched bales</CardTitle>
          <CardDescription>{preview.rows.length} bale(s) in this shipment</CardDescription>
        </CardHeader>
        <Table aria-label="Shipment preview bales">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Mass (kg)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell>{row.rowNumber}</TableCell>
                <TableCell className="font-mono">{row.barcode}</TableCell>
                <TableCell>{row.massKg}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>
    </div>
  );
}

// ── Searchable picker (warehouse / purchase combobox) ─────────────────────────

function SearchablePicker({ value, onChange, placeholder, options }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" className="w-full justify-between font-normal">
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selected?.label ?? placeholder}</span>
          <span aria-hidden="true">⌄</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{options.length ? "No matching records." : "No options — auto-detect from JSON."}</CommandEmpty>
            {options.map((o) => (
              <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => { onChange(o.value); setOpen(false); }}>
                {o.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

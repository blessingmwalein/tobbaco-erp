"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardCheck, Download, Lock } from "lucide-react";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, KeyValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, type ColumnDef, DateRangePicker } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerQueryState, BuyerSelect } from "@/components/buyer/buyer-resource";
import { buyerApi, describeError, saveBlob, useBuyerMutation, useBuyerQuery } from "@/lib/api";
import { LoadingTable, PageIntro } from "../_components/buyer-data";

// ── Types ─────────────────────────────────────────────────────────────────────

type ListItem = {
  id: string; purchaseId: string; purchaseReference: string; invoiceNumber: string | null; buyerName: string | null;
  floorName: string; saleDate: string; status: string; totalPurchasedBales: number; totalDispatchedBales: number;
  totalReceivedBales: number; outstandingBales: number; shipmentCount: number; allocationComplete: boolean;
  closedAt: string | null; updatedAt: string;
};
type RecShipment = {
  id: string; reference: string; dispatchDate: string; truckRegistration: string; driverName: string | null;
  destinationWarehouse: { id: string; code: string; name: string } | null;
  expectedBales: number; receivedBales: number; allocatedBales: number; status: string;
};
type Bale = {
  id: string; barcode: string; buyerGrade: string; timbGrade: string | null; growerNo: string; lotNo: string;
  massKg: string; uscPerKg: string; usdValue: string; lifecycle: string; dispatched: boolean;
  shipmentReference: string | null; received: boolean; receivedAt: string | null; allocated: boolean; discrepancy: string | null;
};
type Summary = {
  totalPurchasedBales: number; totalPurchasedMassKg: string; totalDispatchedBales: number; totalReceivedBales: number;
  totalAllocatedBales: number; outstandingBales: number; notYetDispatchedBales: number; missingBales: number;
  unexpectedBales: number; duplicateScans: number; openExceptions: number; resolvedExceptions: number; shipmentCount: number;
};
type Reconciliation = {
  id: string; purchaseId: string; purchaseReference: string; invoiceNumber: string | null; invoiceReference: string | null;
  buyerName: string | null; floorName: string; saleDate: string; status: string; summary: Summary;
  shipments: RecShipment[]; bales: Bale[]; allocationComplete: boolean; closedAt: string | null; closedByName: string | null;
};
type Warehouse = {
  id: string; name: string; kind: string; active: boolean;
  bays: Array<{ id: string; code: string; name?: string | null; active: boolean; rows: Array<{ id: string; code: string; capacityBales?: number | null; active: boolean }> }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const lifecycleLabel: Record<string, string> = {
  NOT_DISPATCHED: "Not dispatched",
  IN_TRANSIT: "In transit",
  ARRIVED_NOT_RECEIVED: "Arrived · not received",
  RECEIVED: "Received",
  ALLOCATED: "Allocated",
};
const lifecycleTone = (l: string): "neutral" | "warning" | "success" | "danger" =>
  l === "ALLOCATED" || l === "RECEIVED" ? "success" : l === "IN_TRANSIT" || l === "ARRIVED_NOT_RECEIVED" ? "warning" : "neutral";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReconciliationPage() {
  return <Suspense fallback={<LoadingTable />}><ReconciliationPageInner /></Suspense>;
}

function ReconciliationPageInner() {
  const params = useSearchParams();
  const initialPurchase = params.get("purchase");

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [floor, setFloor]   = useState("");
  const [from, setFrom]     = useState("");
  const [to, setTo]         = useState("");

  // Detail dialog
  const [selectedId, setSelectedId]   = useState<string | null>(initialPurchase);
  const [detailOpen, setDetailOpen]   = useState(Boolean(initialPurchase));
  const [actionError, setActionError] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("");

  // Allocate sub-dialog
  const [allocateOpen, setAllocateOpen]   = useState(false);
  const [warehouseId, setWarehouseId]     = useState("");
  const [bayId, setBayId]                 = useState("");
  const [startingRowId, setStartingRowId] = useState("");

  useEffect(() => { if (initialPurchase) { setSelectedId(initialPurchase); setDetailOpen(true); } }, [initialPurchase]);

  // Queries
  const list = useBuyerQuery<ListItem[]>(
    "/buyer/reconciliations",
    { search: search || undefined, status: status || undefined, floor: floor || undefined, from: from || undefined, to: to || undefined },
    { key: ["reconciliations", search, status, floor, from, to] },
  );
  const detail = useBuyerQuery<Reconciliation>(
    selectedId ? `/buyer/reconciliations/${selectedId}` : "/buyer/reconciliations/disabled",
    undefined,
    { enabled: Boolean(selectedId), key: ["reconciliation", selectedId] },
  );
  const warehouses = useBuyerQuery<Warehouse[]>("/warehouses", undefined, { key: ["reconciliation/warehouses"] });

  // Mutations
  const close = useBuyerMutation(
    (body: { purchaseId: string; reason?: string }) =>
      buyerApi.post(`/buyer/reconciliations/${body.purchaseId}/close`, { reason: body.reason || undefined }),
    { invalidate: [["reconciliation", selectedId], ["reconciliations"], ["purchases"]], success: "Reconciliation closed", toastError: false },
  );
  const allocate = useBuyerMutation(
    (body: { purchaseId: string; warehouseId: string; bayId: string; startingRowId: string }) =>
      buyerApi.post(`/buyer/reconciliations/${body.purchaseId}/allocate`, { warehouseId: body.warehouseId, bayId: body.bayId, startingRowId: body.startingRowId }),
    { invalidate: [["reconciliation", selectedId], ["reconciliations"], ["purchases"]], success: "Bales allocated to warehouse storage", toastError: false },
  );

  function openDetail(purchaseId: string) {
    setSelectedId(purchaseId);
    setDetailOpen(true);
    setActionError(null);
    setCloseReason("");
  }
  function closeDetail() {
    setDetailOpen(false);
    setActionError(null);
  }

  async function downloadReport(format: "pdf" | "csv" | "json") {
    if (!selectedId) return;
    setActionError(null);
    try {
      const file = await buyerApi.download(`/buyer/reconciliations/${selectedId}/report?format=${format}`);
      saveBlob(file.blob, file.filename);
    } catch (e) { setActionError(describeError(e)); }
  }
  async function closeReconciliation() {
    if (!selectedId) return;
    setActionError(null);
    try { await close.mutateAsync({ purchaseId: selectedId, reason: closeReason.trim() || undefined }); setCloseReason(""); }
    catch (e) { setActionError(describeError(e)); }
  }
  async function allocateReconciliation() {
    if (!selectedId) return;
    setActionError(null);
    try { await allocate.mutateAsync({ purchaseId: selectedId, warehouseId, bayId, startingRowId }); setAllocateOpen(false); }
    catch (e) { setActionError(describeError(e)); }
  }

  const selectedWarehouse = warehouses.data?.find((w) => w.id === warehouseId);
  const selectedBay = selectedWarehouse?.bays.find((b) => b.id === bayId);
  const summary = detail.data?.summary;

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<ListItem>[]>(() => [
    {
      accessorKey: "purchaseReference",
      header: "Purchase",
      cell: ({ row }) => <span className="font-medium text-primary">{row.original.purchaseReference}</span>,
    },
    {
      accessorKey: "invoiceNumber",
      header: "Invoice",
      cell: ({ row }) => row.original.invoiceNumber ?? "—",
    },
    {
      accessorKey: "buyerName",
      header: "Buyer",
      cell: ({ row }) => row.original.buyerName ?? "—",
    },
    { accessorKey: "floorName",             header: "Floor" },
    { accessorKey: "saleDate",              header: "Sale date" },
    { accessorKey: "totalPurchasedBales",   header: "Purchased" },
    { accessorKey: "totalDispatchedBales",  header: "Dispatched" },
    { accessorKey: "totalReceivedBales",    header: "Received" },
    {
      accessorKey: "outstandingBales",
      header: "Outstanding",
      cell: ({ row }) => (
        <span className={row.original.outstandingBales > 0 ? "font-medium text-warning" : ""}>
          {row.original.outstandingBales}
        </span>
      ),
    },
    { accessorKey: "shipmentCount", header: "Shipments" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge tone={row.original.status === "CLOSED" ? "success" : row.original.status === "IN_PROGRESS" ? "warning" : "neutral"}>
          {row.original.status.replaceAll("_", " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "allocationComplete",
      header: "Allocation",
      cell: ({ row }) => (
        <Badge tone={row.original.allocationComplete ? "success" : "neutral"}>
          {row.original.allocationComplete ? "Complete" : "Outstanding"}
        </Badge>
      ),
    },
  ], []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <RequireBuyerPermission permission="buyer.receiving.view">
      <PageIntro
        title="Receiving reconciliation"
        description="Purchase-level reconciliation aggregates every associated shipment and physically received bale."
      />

      {/* Filter bar */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search purchase or invoice" aria-label="Search reconciliations" />
          <Input value={floor}  onChange={(e) => setFloor(e.target.value)}  placeholder="Filter floor"             aria-label="Filter floor" />
          <DateRangePicker aria-label="Purchase dates" placeholder="Any sale date" value={{ from: from || undefined, to: to || undefined }} onChange={(range) => { setFrom(range.from ?? ""); setTo(range.to ?? ""); }} />
          <BuyerSelect
            label="Status"
            value={status}
            onValueChange={setStatus}
            placeholder="All statuses"
            options={[
              { value: "AWAITING_SHIPMENTS", label: "Awaiting shipments" },
              { value: "IN_PROGRESS",        label: "In progress" },
              { value: "CLOSED",             label: "Closed" },
            ]}
          />
        </CardContent>
      </Card>

      {/* Table */}
      <BuyerQueryState loading={list.isLoading} error={list.error} retry={() => void list.refetch()}>
        {!list.data?.length ? (
          <Card>
            <EmptyState
              icon={ClipboardCheck}
              title="No reconciliations"
              description="Confirm an Invoices Import to create a purchase and its reconciliation record."
            />
          </Card>
        ) : (
          <DataTable
            data={list.data}
            columns={columns}
            getRowId={(row) => row.purchaseId}
            onRowClick={(row) => openDetail(row.purchaseId)}
            rowClassName={(row) => (row.purchaseId === selectedId && detailOpen ? "bg-surface-secondary" : undefined)}
            searchPlaceholder="Search reconciliations"
            emptyIcon={ClipboardCheck}
            emptyTitle="No matching reconciliations"
            emptyDescription="Try changing the filters."
            aria-label="Purchase reconciliations"
            hidePagerWhenSinglePage
          />
        )}
      </BuyerQueryState>

      {/* ── Detail dialog ────────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <DialogContent size="xl" className="max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {detail.data?.purchaseReference ?? "Reconciliation"}
            </DialogTitle>
            <DialogDescription>
              {detail.data
                ? `${detail.data.floorName} · Sale date ${detail.data.saleDate}${detail.data.invoiceNumber ? ` · Invoice ${detail.data.invoiceNumber}` : ""}${detail.data.buyerName ? ` · ${detail.data.buyerName}` : ""}`
                : "Loading…"}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="overflow-y-auto pr-1">
            {detail.isLoading ? (
              <LoadingTable columns={3} />
            ) : detail.isError ? (
              <EmptyState
                title="Could not load reconciliation"
                description={describeError(detail.error)}
                action={<Button variant="secondary" onClick={() => void detail.refetch()}>Try again</Button>}
              />
            ) : detail.data ? (
              <ReconciliationDetail
                data={detail.data}
                summary={summary}
                actionError={actionError}
                closeReason={closeReason}
                setCloseReason={setCloseReason}
                closing={close.isPending}
                allocating={allocate.isPending}
                onClose={() => void closeReconciliation()}
                onAllocate={() => {
                  // Pre-fill warehouse from the shipment's destination — user only needs to pick bay + row
                  const shipmentWarehouseId = detail.data?.shipments.find((s) => s.destinationWarehouse)?.destinationWarehouse?.id ?? "";
                  setWarehouseId(shipmentWarehouseId);
                  setBayId("");
                  setStartingRowId("");
                  setAllocateOpen(true);
                }}
                onReport={downloadReport}
              />
            ) : null}
          </DialogBody>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="secondary" onClick={closeDetail}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Allocate sub-dialog ───────────────────────────────────────────────── */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Allocate warehouse storage</DialogTitle>
            <DialogDescription>
              Bales will be stored sequentially from the selected starting row.
              Warehouse is pre-filled from the shipment destination.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <BuyerSelect
              label="Warehouse"
              value={warehouseId}
              onValueChange={(v) => { setWarehouseId(v); setBayId(""); setStartingRowId(""); }}
              placeholder="Select warehouse"
              options={(warehouses.data ?? []).filter((w) => w.active && w.kind === "STANDARD").map((w) => ({ value: w.id, label: w.name }))}
            />
            <BuyerSelect
              label="Bay"
              value={bayId}
              onValueChange={(v) => { setBayId(v); setStartingRowId(""); }}
              placeholder="Select bay"
              options={(selectedWarehouse?.bays ?? []).filter((b) => b.active).map((b) => ({ value: b.id, label: b.name ? `${b.code} · ${b.name}` : b.code }))}
            />
            <BuyerSelect
              label="Starting row"
              value={startingRowId}
              onValueChange={setStartingRowId}
              placeholder="Select starting row"
              options={(selectedBay?.rows ?? []).filter((r) => r.active).map((r) => ({ value: r.id, label: `${r.code}${r.capacityBales ? ` · capacity ${r.capacityBales}` : ""}` }))}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAllocateOpen(false)}>Cancel</Button>
            <Button
              variant="success"
              disabled={!warehouseId || !bayId || !startingRowId || allocate.isPending}
              loading={allocate.isPending}
              onClick={() => void allocateReconciliation()}
            >
              Allocate bales
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireBuyerPermission>
  );
}

// ── Detail panel (renders inside the dialog body) ─────────────────────────────

function ReconciliationDetail({
  data, summary, actionError, closeReason, setCloseReason, closing, allocating, onClose, onAllocate, onReport,
}: {
  data: Reconciliation; summary?: Summary; actionError: string | null;
  closeReason: string; setCloseReason: (v: string) => void;
  closing: boolean; allocating: boolean;
  onClose: () => void; onAllocate: () => void;
  onReport: (f: "pdf" | "csv" | "json") => void;
}) {
  const canClose    = data.status === "IN_PROGRESS";
  const canAllocate = data.status === "CLOSED" && !data.allocationComplete;

  return (
    <div className="space-y-6">

      {/* Status badge + KPIs */}
      <div className="flex items-center gap-3">
        <Badge tone={data.status === "CLOSED" ? "success" : data.status === "IN_PROGRESS" ? "warning" : "neutral"}>
          {data.status.replaceAll("_", " ")}
        </Badge>
      </div>

      {summary ? (
        <KeyValue columns={3} items={[
          { label: "Purchased bales",                    value: summary.totalPurchasedBales },
          { label: "Purchased mass",                     value: `${summary.totalPurchasedMassKg} kg` },
          { label: "Shipments",                          value: summary.shipmentCount },
          { label: "Dispatched bales",                   value: summary.totalDispatchedBales },
          { label: "Received bales",                     value: summary.totalReceivedBales },
          { label: "Allocated bales",                    value: summary.totalAllocatedBales },
          { label: "Outstanding (dispatched, not rcvd)", value: summary.outstandingBales },
          { label: "Not yet dispatched",                 value: summary.notYetDispatchedBales },
          { label: "Missing bales",                      value: summary.missingBales },
          { label: "Unexpected bales",                   value: summary.unexpectedBales },
          { label: "Duplicate scans",                    value: summary.duplicateScans },
          { label: "Open exceptions",                    value: summary.openExceptions },
        ]} />
      ) : null}

      {/* Status callouts */}
      {data.status === "AWAITING_SHIPMENTS" && (
        <Callout tone="warning" title="Awaiting shipments">
          Import at least one shipment for this purchase before reconciling.
        </Callout>
      )}
      {data.status === "IN_PROGRESS" && (
        <Callout tone="info" title="Reconciliation in progress">
          The reconciliation stays open while shipments are imported, received and reconciled.
          It can be closed once every purchased bale has been dispatched and received and all exceptions are resolved.
        </Callout>
      )}
      {data.status === "CLOSED" && !data.allocationComplete && (
        <Callout tone="warning" title="Storage allocation outstanding">
          Reconciliation is closed but received bales have not all been allocated to warehouse storage.
        </Callout>
      )}
      {data.status === "CLOSED" && data.allocationComplete && (
        <Callout tone="success" title="Reconciliation complete">
          All bales received and allocated to warehouse storage.
        </Callout>
      )}

      {/* Associated shipments */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Associated shipments</h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table aria-label="Reconciliation shipments">
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.shipments.length ? data.shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.reference}</TableCell>
                  <TableCell>{s.dispatchDate}</TableCell>
                  <TableCell>{s.truckRegistration}</TableCell>
                  <TableCell>{s.expectedBales}</TableCell>
                  <TableCell>{s.receivedBales}</TableCell>
                  <TableCell>{s.allocatedBales}</TableCell>
                  <TableCell>
                    <Badge tone={s.status === "ALLOCATED" || s.status === "CONFIRMED" ? "success" : s.status === "IN_TRANSIT" ? "warning" : "neutral"}>
                      {s.status.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">No shipments yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Bale comparison */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Bale-level comparison</h3>
        <div className="max-h-72 overflow-auto rounded-xl border border-border">
          <Table aria-label="Bale reconciliation">
            <TableHeader>
              <TableRow>
                <TableHead>Barcode</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Grower / lot</TableHead>
                <TableHead>Mass</TableHead>
                <TableHead>Shipment</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Lifecycle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bales.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.barcode}</TableCell>
                  <TableCell>{b.buyerGrade}</TableCell>
                  <TableCell>{b.growerNo} / {b.lotNo}</TableCell>
                  <TableCell>{b.massKg}</TableCell>
                  <TableCell>{b.shipmentReference ?? "—"}</TableCell>
                  <TableCell>{b.received ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Badge tone={lifecycleTone(b.lifecycle)}>
                      {lifecycleLabel[b.lifecycle] ?? b.lifecycle}{b.discrepancy ? ` · ${b.discrepancy}` : ""}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Discrepancy callout */}
      {summary && (summary.openExceptions > 0 || summary.unexpectedBales > 0 || summary.duplicateScans > 0 || summary.missingBales > 0) && (
        <Callout tone="danger" title="Discrepancies to resolve">
          <ul className="list-disc pl-5">
            {summary.missingBales    > 0 && <li>{summary.missingBales} missing bale(s)</li>}
            {summary.unexpectedBales > 0 && <li>{summary.unexpectedBales} unexpected bale(s)</li>}
            {summary.duplicateScans  > 0 && <li>{summary.duplicateScans} duplicate scan(s)</li>}
            {summary.openExceptions  > 0 && <li>{summary.openExceptions} open exception(s)</li>}
          </ul>
        </Callout>
      )}

      {/* Action error */}
      {actionError && (
        <Card className="border-danger/30">
          <CardContent className="pt-4 text-sm text-danger-text">{actionError}</CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canClose && (
          <div className="flex items-end gap-2">
            <Input
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="Close reason (optional)"
              aria-label="Close reason"
            />
            <Button variant="success" disabled={closing} loading={closing} onClick={onClose}>
              <Lock /> Close reconciliation
            </Button>
          </div>
        )}
        {canAllocate && (
          <Button variant="success" disabled={allocating} loading={allocating} onClick={onAllocate}>
            Allocate warehouse storage
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => onReport("pdf")}><Download /> PDF</Button>
          <Button variant="secondary" onClick={() => onReport("csv")}><Download /> CSV</Button>
          <Button variant="secondary" onClick={() => onReport("json")}><Download /> JSON</Button>
        </div>
      </div>
    </div>
  );
}

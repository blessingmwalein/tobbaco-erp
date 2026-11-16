"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  KeyValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  type ColumnDef,
} from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerSelect } from "@/components/buyer/buyer-resource";
import { buyerApi, describeError, useBuyerMutation, useBuyerQuery } from "@/lib/api";
import { LoadingTable, PageIntro } from "../../_components/buyer-data";

type Bale = {
  id: string;
  barcode: string;
  buyerGrade: string;
  timbGrade: string | null;
  growerNo: string;
  lotNo: string;
  massKg: string;
  uscPerKg: string;
  usdValue: string;
  status: string;
};

type Session = {
  id: string;
  reference: string;
  status: string;
  startedAt: string;
  purchase?: { id?: string; reference: string; totalBales: number; receivingStatus: string };
  _count?: { scans: number; exceptions: number };
  reconciliation?: { expectedBales?: number; receivedBales?: number; scanned?: number; missingBales?: number } | null;
};

type SessionDetail = Session & {
  purchase?: Session["purchase"] & { bales: Bale[] };
  scans?: Array<{ id: string; barcode: string; result: string; scannedAt: string; bale: Bale | null }>;
  exceptions?: Array<{ id: string; barcode: string; kind: string; explanation: string; status: string; resolution?: string | null }>;
};

type Warehouse = {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  bays: Array<{
    id: string;
    code: string;
    name?: string | null;
    active: boolean;
    rows: Array<{ id: string; code: string; capacityBales?: number | null; active: boolean }>;
  }>;
};

export default function ReceivingReconciliationPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [bayId, setBayId] = useState("");
  const [startingRowId, setStartingRowId] = useState("");
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const sessions = useBuyerQuery<Session[]>("/receiving/sessions", undefined, { key: ["receiving/reconciliation"] });
  const detail = useBuyerQuery<SessionDetail>(
    selectedId ? `/receiving/sessions/${selectedId}` : "/receiving/sessions/disabled",
    undefined,
    { enabled: Boolean(selectedId), key: ["receiving/session", selectedId] },
  );
  const warehouses = useBuyerQuery<Warehouse[]>("/warehouses", undefined, { key: ["receiving/reconciliation/warehouses"] });

  const filteredSessions = useMemo(() => (sessions.data ?? []).filter((item) => {
    const query = search.trim().toLowerCase();
    const started = item.startedAt.slice(0, 10);
    return (!query || `${item.reference} ${item.purchase?.reference ?? ""}`.toLowerCase().includes(query))
      && (!from || started >= from)
      && (!to || started <= to)
      && (!status || item.status === status);
  }), [from, search, sessions.data, status, to]);

  const columns = useMemo<ColumnDef<Session>[]>(() => [
    { accessorKey: "reference", header: "Session", cell: ({ row }) => <span className="font-medium text-primary">{row.original.reference}</span> },
    { id: "purchase", header: "Purchase", accessorFn: (row) => row.purchase?.reference ?? "—" },
    { id: "startedAt", header: "Started", accessorFn: (row) => new Date(row.startedAt).getTime(), cell: ({ row }) => new Date(row.original.startedAt).toLocaleString() },
    { id: "expected", header: "Expected", accessorFn: (row) => row.reconciliation?.expectedBales ?? row.purchase?.totalBales ?? 0 },
    { id: "received", header: "Received", accessorFn: (row) => row.reconciliation?.receivedBales ?? 0 },
    { id: "exceptions", header: "Exceptions", accessorFn: (row) => row._count?.exceptions ?? 0 },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge tone={row.original.status === "ALLOCATED" ? "success" : row.original.status === "CONFIRMED" ? "warning" : "neutral"}>{row.original.status}</Badge> },
  ], []);

  const receivedBales = detail.data?.scans?.filter((scan) => scan.result === "RECEIVED" && scan.bale).map((scan) => scan.bale!) ?? [];
  const receivedBarcodes = new Set(receivedBales.map((bale) => bale.barcode));
  const missingBales = detail.data?.purchase?.bales.filter((bale) => !receivedBarcodes.has(bale.barcode)) ?? [];
  const scanDisputes = detail.data?.scans?.filter((scan) => scan.result !== "RECEIVED") ?? [];
  const openExceptions = detail.data?.exceptions?.filter((exception) => exception.status === "OPEN") ?? [];
  const canConfirm = Boolean(detail.data?.status === "OPEN" && !missingBales.length && !scanDisputes.length && !openExceptions.length);
  const canFinalise = detail.data?.status === "CONFIRMED";
  const selectedWarehouse = warehouses.data?.find((warehouse) => warehouse.id === warehouseId);
  const selectedBay = selectedWarehouse?.bays.find((bay) => bay.id === bayId);

  const resolve = useBuyerMutation(
    (body: { sessionId: string; exceptionId: string; resolution: string }) =>
      buyerApi.post(`/receiving/sessions/${body.sessionId}/exceptions/${body.exceptionId}/resolve`, { resolution: body.resolution }),
    { invalidate: [["receiving/session", selectedId]], toastError: false },
  );
  const confirm = useBuyerMutation(
    (sessionId: string) => buyerApi.post(`/receiving/sessions/${sessionId}/confirm`),
    { invalidate: [["receiving/session", selectedId], ["receiving/reconciliation"], ["receiving/sessions"]], success: "Receiving reconciliation confirmed", toastError: false },
  );
  const finalise = useBuyerMutation(
    (body: { sessionId: string; warehouseId: string; bayId: string; startingRowId: string }) =>
      buyerApi.post(`/receiving/sessions/${body.sessionId}/finalise`, { warehouseId: body.warehouseId, bayId: body.bayId, startingRowId: body.startingRowId }),
    { invalidate: [["receiving/session", selectedId], ["receiving/reconciliation"], ["receiving/sessions"], ["purchases"]], success: "Reconciliation finalised and bales allocated", toastError: false },
  );

  function selectSession(session: Session) {
    setSelectedId(session.id);
    setActionError(null);
    setWarehouseId("");
    setBayId("");
    setStartingRowId("");
  }

  async function resolveException(exceptionId: string) {
    if (!selectedId || !resolution[exceptionId]?.trim()) return;
    setActionError(null);
    try {
      await resolve.mutateAsync({ sessionId: selectedId, exceptionId, resolution: resolution[exceptionId].trim() });
      setResolution((current) => ({ ...current, [exceptionId]: "" }));
    } catch (error) {
      setActionError(describeError(error));
    }
  }

  async function confirmReconciliation() {
    if (!selectedId) return;
    setActionError(null);
    try {
      await confirm.mutateAsync(selectedId);
    } catch (error) {
      setActionError(describeError(error));
    }
  }

  async function finaliseReconciliation() {
    if (!selectedId) return;
    setActionError(null);
    try {
      await finalise.mutateAsync({ sessionId: selectedId, warehouseId, bayId, startingRowId });
      setConfirmOpen(false);
    } catch (error) {
      setActionError(describeError(error));
    }
  }

  return (
    <RequireBuyerPermission permission="buyer.receiving.view">
      <PageIntro title="Receiving reconciliation" description="Compare the imported Flow Disk manifest with scans, resolve discrepancies, and store received bales." />
      {actionError ? <Card className="mb-4 border-danger/30"><CardContent className="pt-6 text-sm text-danger-text">{actionError}</CardContent></Card> : null}
      {sessions.isLoading ? <LoadingTable /> : sessions.isError ? <Card><EmptyState title="Could not load reconciliation" description={describeError(sessions.error)} action={<Button variant="secondary" onClick={() => void sessions.refetch()}>Try again</Button>} /></Card> : !sessions.data?.length ? <Card><EmptyState icon={ClipboardCheck} title="Nothing to reconcile" description="Receiving sessions will appear here after scanning begins." /></Card> : (
        <div className="space-y-3">
          <Card>
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search session or purchase" aria-label="Search reconciliation" />
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Started from" />
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Started to" />
              <BuyerSelect label="Session status" value={status} onValueChange={setStatus} placeholder="All statuses" options={[{ value: "OPEN", label: "Open" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "ALLOCATED", label: "Allocated" }, { value: "CANCELLED", label: "Cancelled" }]} />
            </CardContent>
          </Card>
          <DataTable data={filteredSessions} columns={columns} getRowId={(row) => row.id} onRowClick={selectSession} searchPlaceholder="Search table rows" initialSorting={[{ id: "startedAt", desc: true }]} emptyIcon={ClipboardCheck} emptyTitle="No matching sessions" emptyDescription="Try changing the search, date range, or status filter." aria-label="Receiving reconciliation" />
        </div>
      )}
      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent className="w-[min(48rem,100vw)] overflow-y-auto p-6">
          <SheetTitle className="pr-10">Session reconciliation</SheetTitle>
          <SheetDescription className="pr-10">Manifest detail, discrepancies, and warehouse allocation.</SheetDescription>
          <div className="mt-5">
            {detail.isLoading ? <LoadingTable columns={2} /> : detail.data ? <ReconciliationDetail
              detail={detail.data}
              receivedBales={receivedBales}
              receivedBarcodes={receivedBarcodes}
              missingBales={missingBales}
              scanDisputes={scanDisputes}
              openExceptions={openExceptions}
              resolution={resolution}
              canConfirm={canConfirm}
              resolving={resolve.isPending}
              onResolutionChange={(id, value) => setResolution((current) => ({ ...current, [id]: value }))}
              onResolve={(id) => void resolveException(id)}
              onConfirm={() => void confirmReconciliation()}
              onFinalise={() => setConfirmOpen(true)}
              confirming={confirm.isPending}
              canFinalise={canFinalise}
            /> : <EmptyState icon={ClipboardCheck} title="Select a session" description="Choose a session to see its manifest reconciliation." />}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Finalise reconciliation and assign inventory</DialogTitle>
            <DialogDescription>Received bales will be stored sequentially from the selected starting row, using each row capacity before continuing to the next row.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <BuyerSelect label="Warehouse" value={warehouseId} onValueChange={(value) => { setWarehouseId(value); setBayId(""); setStartingRowId(""); }} placeholder="Select warehouse" options={(warehouses.data ?? []).filter((warehouse) => warehouse.active && warehouse.kind === "STANDARD").map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))} />
            <BuyerSelect label="Bay" value={bayId} onValueChange={(value) => { setBayId(value); setStartingRowId(""); }} placeholder="Select bay" options={(selectedWarehouse?.bays ?? []).filter((bay) => bay.active).map((bay) => ({ value: bay.id, label: bay.name ? `${bay.code} · ${bay.name}` : bay.code }))} />
            <BuyerSelect label="Starting row" value={startingRowId} onValueChange={setStartingRowId} placeholder="Select starting row" options={(selectedBay?.rows ?? []).filter((row) => row.active).map((row) => ({ value: row.id, label: `${row.code}${row.capacityBales ? ` · capacity ${row.capacityBales}` : ""}` }))} />
            <p className="text-xs text-muted-foreground">{receivedBales.length} bale(s) will be assigned from this row forward.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="success" disabled={!canFinalise || !warehouseId || !bayId || !startingRowId} loading={finalise.isPending} onClick={() => void finaliseReconciliation()}>Finalise and allocate bales</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireBuyerPermission>
  );
}

function ReconciliationDetail({
  detail,
  receivedBales,
  receivedBarcodes,
  missingBales,
  scanDisputes,
  openExceptions,
  resolution,
  canConfirm,
  canFinalise,
  confirming,
  resolving,
  onResolutionChange,
  onResolve,
  onConfirm,
  onFinalise,
}: {
  detail: SessionDetail;
  receivedBales: Bale[];
  receivedBarcodes: Set<string>;
  missingBales: Bale[];
  scanDisputes: NonNullable<SessionDetail["scans"]>;
  openExceptions: NonNullable<SessionDetail["exceptions"]>;
  resolution: Record<string, string>;
  canConfirm: boolean;
  canFinalise: boolean;
  confirming: boolean;
  resolving: boolean;
  onResolutionChange: (id: string, value: string) => void;
  onResolve: (id: string) => void;
  onConfirm: () => void;
  onFinalise: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{detail.reference}</CardTitle>
        <CardDescription>{detail.purchase?.reference} · Manifest reconciliation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <KeyValue columns={2} items={[
          { label: "Expected bales", value: detail.purchase?.bales.length ?? detail.purchase?.totalBales },
          { label: "Received bales", value: receivedBales.length },
          { label: "Missing bales", value: missingBales.length },
          { label: "Scan disputes", value: scanDisputes.length },
          { label: "Open exceptions", value: openExceptions.length },
          { label: "Status", value: detail.status },
        ]} />
        {missingBales.length || scanDisputes.length || openExceptions.length ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm">
            <p className="font-semibold text-danger-text">Reconciliation cannot be confirmed</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-danger-text">
              {missingBales.length ? <li>{missingBales.length} imported bale(s) have not been received.</li> : null}
              {scanDisputes.map((scan) => <li key={scan.id}>{scan.barcode}: {scan.result.replaceAll("_", " ").toLowerCase()}.</li>)}
              {openExceptions.map((exception) => <li key={exception.id}>{exception.barcode}: {exception.explanation}</li>)}
            </ul>
          </div>
        ) : <div className="rounded-xl border border-success/30 bg-success-soft p-4 text-sm text-success-text">All imported bales match the receiving scans. Choose a warehouse location to confirm.</div>}
        {detail.purchase?.bales.length ? <div>
          <h3 className="mb-2 text-sm font-semibold">Imported manifest vs received</h3>
          <div className="max-h-72 overflow-auto rounded-xl border border-border">
            <Table aria-label="Imported manifest reconciliation">
              <TableHeader><TableRow><TableHead>Barcode</TableHead><TableHead>Grade</TableHead><TableHead>Grower / lot</TableHead><TableHead>Scan</TableHead></TableRow></TableHeader>
              <TableBody>{detail.purchase.bales.map((bale) => <TableRow key={bale.id}><TableCell className="font-mono text-xs">{bale.barcode}</TableCell><TableCell>{bale.buyerGrade}</TableCell><TableCell>{bale.growerNo} / {bale.lotNo}</TableCell><TableCell><Badge tone={receivedBarcodes.has(bale.barcode) ? "success" : "danger"}>{receivedBarcodes.has(bale.barcode) ? "Received" : "Missing"}</Badge></TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </div> : null}
        {openExceptions.length ? <div className="space-y-3">
          <h3 className="text-sm font-semibold">Resolve discrepancies</h3>
          {openExceptions.map((exception) => <div key={exception.id} className="rounded-xl border border-border p-3"><p className="text-sm">{exception.barcode} · {exception.explanation}</p><div className="mt-2 flex gap-2"><Input value={resolution[exception.id] ?? ""} onChange={(event) => onResolutionChange(exception.id, event.target.value)} placeholder="Explain how this was resolved" /><Button size="sm" disabled={!resolution[exception.id]?.trim()} loading={resolving} onClick={() => onResolve(exception.id)}>Resolve</Button></div></div>)}
        </div> : null}
        {detail.status === "OPEN" ? <Button className="w-full" variant="success" disabled={!canConfirm} loading={confirming} onClick={onConfirm}>Confirm reconciliation</Button> : detail.status === "CONFIRMED" ? <Button className="w-full" variant="success" disabled={!canFinalise} onClick={onFinalise}>Finalise reconciliation and assign warehouse</Button> : <Badge tone="success">Reconciliation allocated</Badge>}
      </CardContent>
    </Card>
  );
}

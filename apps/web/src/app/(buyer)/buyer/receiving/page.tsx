"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronDown, PackageCheck, Plus, ScanBarcode } from "lucide-react";
import {
  Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
  DataTable,
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, Field, Input,
  KeyValue,
  Popover, PopoverContent, PopoverTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  toast,
  type ColumnDef,
} from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { buyerApi, describeError, useBuyerCan, useBuyerMutation, useBuyerQuery } from "@/lib/api";
import { BuyerQueryState } from "@/components/buyer/buyer-resource";
import { PageIntro } from "../_components/buyer-data";

// ── Types ─────────────────────────────────────────────────────────────────────

type Shipment = {
  id: string; reference: string; status: string;
  expectedBales: number; expectedMassKg?: string; dispatchDate: string;
  truckRegistration?: string | null; driverName?: string | null;
  purchase: { id: string; reference: string; totalBales: number; receivingStatus: string };
  destinationWarehouse?: { name: string; code: string } | null;
};

type Session = {
  id: string; reference: string; status: string; startedAt: string;
  shipment?: Shipment | null;
  purchase?: { id?: string; reference: string; totalBales: number; receivingStatus: string } | null;
  _count?: { scans: number; exceptions: number };
};

type ScannedBale = {
  barcode: string; buyerGrade: string; timbGrade: string | null;
  growerNo: string; lotNo: string; massKg: string; uscPerKg: string; usdValue: string; status: string;
};

function scanResultMessage(result: string): string {
  if (result === "WRONG_PURCHASE") return "This bale is not on the selected purchase invoice.";
  if (result === "WRONG_BUYER")    return "This bale belongs to a different buyer.";
  if (result === "UNEXPECTED")     return "This barcode is not in the imported invoice manifest.";
  if (result === "INVALID_BARCODE") return "This barcode is invalid — check the Code 39 check character.";
  if (result === "DUPLICATE_SCAN") return "This bale has already been scanned in this session.";
  return `Receiving action failed\n\n${result}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReceivingPage() {
  const canScan = useBuyerCan()("buyer.receiving.scan");

  // ── Active session state ────────────────────────────────────────────────
  const [active, setActive]       = useState<Session | null>(null);
  const [barcode, setBarcode]     = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScan, setLastScan]   = useState<ScannedBale | null>(null);

  // ── New session dialog ──────────────────────────────────────────────────
  const [newOpen, setNewOpen]           = useState(false);
  const [shipmentId, setShipmentId]     = useState("");
  const [reference, setReference]       = useState("");
  const [formError, setFormError]       = useState<string | null>(null);

  // ── Session list filters ────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // ── Data ────────────────────────────────────────────────────────────────
  const shipmentsQ = useBuyerQuery<Shipment[]>("/buyer/shipments", { status: "ARRIVED" }, { key: ["receiving-shipments"] });
  const sessionsQ  = useBuyerQuery<Session[]>("/receiving/sessions", undefined,            { key: ["receiving/sessions"] });

  const openSessions = useMemo(
    () => new Map((sessionsQ.data ?? []).filter((s) => s.status === "OPEN" && s.shipment?.id).map((s) => [s.shipment!.id, s])),
    [sessionsQ.data],
  );

  // ── Mutations ───────────────────────────────────────────────────────────
  const start = useBuyerMutation(
    (body: { shipmentId: string; reference: string }) => buyerApi.post<Session>("/receiving/sessions", body),
    { invalidate: [["receiving/sessions"], ["receiving-shipments"], ["purchases"]], toastError: false },
  );
  const scan = useBuyerMutation(
    (body: { id: string; barcode: string }) => buyerApi.post(`/receiving/sessions/${body.id}/scans`, { barcode: body.barcode }),
    { invalidate: [["receiving/sessions"]], toastError: false },
  );
  const confirmSession = useBuyerMutation(
    (id: string) => buyerApi.post(`/receiving/sessions/${id}/confirm`),
    { invalidate: [["receiving/sessions"], ["purchases"]], success: "Receiving session confirmed", toastError: false },
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  async function beginSession() {
    setFormError(null);
    if (!shipmentId) { setFormError("Select an arrived shipment."); return; }
    if (!reference.trim()) { setFormError("Enter a session reference."); return; }
    if (openSessions.has(shipmentId)) { setFormError("This shipment already has an open session. Select it below to continue."); return; }
    try {
      const result = await start.mutateAsync({ shipmentId, reference: reference.trim() });
      setActive(result);
      setNewOpen(false);
      setShipmentId("");
      setReference("");
    } catch (e) { setFormError(describeError(e)); }
  }

  async function submitScan() {
    const raw = barcode.replace(/[\r\n]+$/g, "");
    if (!active || !raw.trim()) { if (!raw.trim()) setScanError("Scan or enter a barcode."); return; }
    setScanError(null);
    try {
      const result = await scan.mutateAsync({ id: active.id, barcode: raw }) as { scan: { result: string }; bale: ScannedBale | null };
      if (result.scan.result !== "RECEIVED" || !result.bale) {
        throw new Error(scanResultMessage(result.scan.result));
      }
      setLastScan(result.bale);
      setBarcode("");
    } catch (e) { setScanError(describeError(e)); }
  }

  async function finish() {
    if (!active) return;
    try {
      await confirmSession.mutateAsync(active.id);
      setActive(null);
      setBarcode("");
      setLastScan(null);
      setScanError(null);
    } catch (e) { setScanError(describeError(e)); }
  }

  function continueSession(session: Session) {
    if (session.status !== "OPEN") return;
    setScanError(null);
    setLastScan(null);
    setActive(session);
    setShipmentId(session.shipment?.id ?? "");
  }

  // ── Session list (filtered client-side) ─────────────────────────────────
  const filteredSessions = useMemo(() => {
    const all = sessionsQ.data ?? [];
    return all.filter((s) => {
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (!s.reference.toLowerCase().includes(q) && !s.purchase?.reference.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [sessionsQ.data, filterStatus, filterSearch]);

  // ── Columns ─────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Session>[]>(() => [
    {
      accessorKey: "reference",
      header: "Session",
      cell: ({ row }) => <span className="font-medium">{row.original.reference}</span>,
    },
    {
      id: "purchase",
      header: "Purchase",
      cell: ({ row }) => row.original.purchase?.reference ?? "—",
    },
    {
      id: "shipment",
      header: "Shipment",
      cell: ({ row }) => row.original.shipment?.reference ?? "—",
    },
    {
      accessorKey: "startedAt",
      header: "Started",
      cell: ({ row }) => new Date(row.original.startedAt).toLocaleString(),
    },
    {
      id: "scans",
      header: "Scans",
      cell: ({ row }) => row.original._count?.scans ?? 0,
    },
    {
      id: "exceptions",
      header: "Exceptions",
      cell: ({ row }) => {
        const n = row.original._count?.exceptions ?? 0;
        return n > 0 ? <span className="font-medium text-warning">{n}</span> : <span className="text-muted-foreground">0</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge tone={row.original.status === "CONFIRMED" ? "success" : row.original.status === "OPEN" ? "warning" : "neutral"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.status === "OPEN" ? (
          <Button
            size="sm"
            variant={active?.id === row.original.id ? "primary" : "secondary"}
            onClick={() => continueSession(row.original)}
          >
            {active?.id === row.original.id ? "Active" : "Continue"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Closed</span>
        ),
    },
  ], [active]);

  return (
    <RequireBuyerPermission permission="buyer.receiving.view">
      <PageIntro
        title="Bale receiving"
        description="Start a session per shipment then scan bales until the session is confirmed."
        actions={
          canScan ? (
            <Button onClick={() => setNewOpen(true)}>
              <Plus /> New session
            </Button>
          ) : undefined
        }
      />

      {/* ── Active scan workspace ──────────────────────────────────────────── */}
      {active ? (
        <Card className="mb-6 border-primary/40">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{active.reference}</CardTitle>
                <CardDescription>
                  {active.purchase?.reference ?? "—"} ·{" "}
                  {active.shipment?.reference ?? "—"} ·{" "}
                  {active.shipment?.expectedBales ?? "?"} bales expected
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="primary">Open</Badge>
                <Button size="sm" variant="secondary" onClick={() => { setActive(null); setLastScan(null); setScanError(null); }}>
                  Minimise
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Scan input */}
            <div className="flex gap-2">
              <Input
                autoFocus
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void submitScan(); }}
                placeholder="Scan or type barcode then Enter"
                aria-label="Bale barcode"
                className="font-mono"
              />
              <Button onClick={() => void submitScan()} disabled={!barcode.trim()} loading={scan.isPending}>
                <ScanBarcode /> Scan
              </Button>
            </div>

            {/* Scan error */}
            {scanError && (
              <Callout tone="danger" title="Receiving action failed">{scanError}</Callout>
            )}

            {/* Last received bale */}
            {lastScan && (
              <Card className="border-success/40 bg-success/5">
                <CardContent className="pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-success" />
                    <span className="text-sm font-semibold text-success">Bale received</span>
                    <Badge tone="success">{lastScan.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <KeyValue columns={4} items={[
                    { label: "Barcode",     value: lastScan.barcode },
                    { label: "Buyer grade", value: lastScan.buyerGrade },
                    { label: "TIMB grade",  value: lastScan.timbGrade ?? "—" },
                    { label: "Grower / lot", value: `${lastScan.growerNo} / ${lastScan.lotNo}` },
                    { label: "Mass (kg)",   value: lastScan.massKg },
                    { label: "USc / kg",    value: lastScan.uscPerKg },
                    { label: "USD value",   value: lastScan.usdValue },
                  ]} />
                </CardContent>
              </Card>
            )}

            {/* Confirm */}
            <div className="flex justify-end">
              <Button variant="success" onClick={() => void finish()} loading={confirmSession.isPending}>
                <CheckCircle2 /> Confirm session
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <EmptyState
              icon={ScanBarcode}
              title="No active session"
              description="Start a new session or click Continue on an open session below to begin scanning."
              action={canScan ? <Button onClick={() => setNewOpen(true)}><Plus /> New session</Button> : undefined}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Sessions DataTable ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
            <Input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search session or purchase ref"
              aria-label="Search sessions"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            {(filterSearch || filterStatus) && (
              <Button variant="secondary" onClick={() => { setFilterSearch(""); setFilterStatus(""); }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <BuyerQueryState loading={sessionsQ.isLoading} error={sessionsQ.error} retry={() => void sessionsQ.refetch()}>
          <DataTable
            columns={columns}
            data={filteredSessions}
            getRowId={(row) => row.id}
            onRowClick={(row) => { if (row.status === "OPEN") continueSession(row); }}
            rowClassName={(row) => row.id === active?.id ? "bg-surface-secondary" : undefined}
            emptyIcon={PackageCheck}
            emptyTitle="No sessions"
            emptyDescription={filterSearch || filterStatus ? "Try changing the filters." : "Start a session to begin receiving bales."}
            hidePagerWhenSinglePage
            aria-label="Receiving sessions"
          />
        </BuyerQueryState>
      </div>

      {/* ── New session dialog ─────────────────────────────────────────────── */}
      <Dialog open={newOpen} onOpenChange={(open) => { if (!open) { setFormError(null); } setNewOpen(open); }}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Start receiving session</DialogTitle>
            <DialogDescription>
              Select an arrived shipment and give this session a reference. Only one open session is allowed per shipment.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">

            {/* Arrived shipment picker */}
            <Field label="Arrived shipment" required hint="Only shipments marked Arrived are shown. Search by dispatch ref, purchase, or truck.">
              <ShipmentPicker
                shipments={shipmentsQ.data ?? []}
                selectedId={shipmentId}
                openSessions={openSessions}
                onSelect={setShipmentId}
              />
            </Field>

            {/* Selected shipment summary */}
            {shipmentId && (() => {
              const sh = (shipmentsQ.data ?? []).find((s) => s.id === shipmentId);
              if (!sh) return null;
              return (
                <Card className="bg-surface-secondary">
                  <CardContent className="pt-4">
                    <KeyValue columns={2} items={[
                      { label: "Purchase",  value: sh.purchase.reference },
                      { label: "Truck",     value: sh.truckRegistration ?? "—" },
                      { label: "Driver",    value: sh.driverName ?? "—" },
                      { label: "Expected",  value: `${sh.expectedBales} bales` },
                      { label: "Warehouse", value: sh.destinationWarehouse?.name ?? "—" },
                      { label: "Dispatched", value: new Date(sh.dispatchDate).toLocaleDateString() },
                    ]} />
                  </CardContent>
                </Card>
              );
            })()}

            {/* Session reference */}
            <Field label="Session reference" required hint="A truck delivery docket number works well.">
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void beginSession(); }}
                placeholder="e.g. TRUCK-1042"
              />
            </Field>

            {formError && <Callout tone="danger" title="Cannot start session">{formError}</Callout>}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!shipmentId || !reference.trim() || start.isPending}
              loading={start.isPending}
              onClick={() => void beginSession()}
            >
              Start session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireBuyerPermission>
  );
}

// ── Shipment picker combobox ───────────────────────────────────────────────────

function ShipmentPicker({ shipments, selectedId, openSessions, onSelect }: {
  shipments: Shipment[];
  selectedId: string;
  openSessions: Map<string, Session>;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = shipments.find((s) => s.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="truncate">{selected.reference} · {selected.purchase.reference} · {selected.expectedBales} bales</span>
          ) : (
            <span className="text-muted-foreground">Search arrived shipments…</span>
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search dispatch ref, purchase, truck…" />
          <CommandList>
            <CommandEmpty>No arrived shipments found.</CommandEmpty>
            {shipments.map((sh) => {
              const existing = openSessions.get(sh.id);
              return (
                <CommandItem
                  key={sh.id}
                  value={`${sh.reference} ${sh.purchase.reference} ${sh.truckRegistration ?? ""} ${sh.id}`}
                  onSelect={() => { onSelect(sh.id); setOpen(false); }}
                >
                  <Check className={`mr-2 size-4 ${selectedId === sh.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0 flex-1 truncate">
                    {sh.reference} · {sh.purchase.reference} · {sh.expectedBales} bales
                    {sh.truckRegistration ? ` · ${sh.truckRegistration}` : ""}
                  </span>
                  {existing && <Badge tone="warning" className="ml-2 shrink-0">Open</Badge>}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

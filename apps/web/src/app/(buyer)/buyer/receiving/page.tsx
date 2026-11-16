"use client";

import { useState } from "react";
import { Check, CheckCircle2, ChevronDown, PackageCheck, ScanBarcode } from "lucide-react";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Command, CommandEmpty, CommandInput, CommandItem, CommandList, EmptyState, Field, Input, Popover, PopoverContent, PopoverTrigger, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { buyerApi, describeError, useBuyerCan, useBuyerMutation, useBuyerQuery } from "@/lib/api";
import { DataTableCard, LoadingTable, PageIntro } from "../_components/buyer-data";

type Shipment = { id: string; reference: string; status: string; expectedBales: number; expectedMassKg?: string; dispatchDate: string; expectedArrivalAt?: string | null; truckRegistration?: string | null; driverName?: string | null; purchase: { id: string; reference: string; totalBales: number; receivingStatus: string }; destinationWarehouse?: { name: string; code: string } | null };
type Session = { id: string; reference: string; status: string; startedAt: string; shipment?: Shipment; purchase?: { id?: string; reference: string; totalBales: number; receivingStatus: string }; _count?: { scans: number; exceptions: number } };
type ScannedBale = { barcode: string; buyerGrade: string; timbGrade: string | null; growerNo: string; lotNo: string; massKg: string; uscPerKg: string; usdValue: string; status: string };

export default function ReceivingPage() {
  const canScan = useBuyerCan()("buyer.receiving.scan");
  const [shipmentId, setShipmentId] = useState("");
  const [reference, setReference] = useState("");
  const [active, setActive] = useState<Session | null>(null);
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<ScannedBale | null>(null);
  const shipments = useBuyerQuery<Shipment[]>("/buyer/shipments", { status: "ARRIVED" }, { key: ["receiving-shipments"] });
  const sessions = useBuyerQuery<Session[]>("/receiving/sessions", undefined, { key: ["receiving/sessions"] });
  const openSessions = new Map((sessions.data ?? []).filter((session) => session.status === "OPEN" && session.shipment?.id).map((session) => [session.shipment!.id, session]));
  const start = useBuyerMutation((body: { shipmentId: string; reference: string }) => buyerApi.post<Session>("/receiving/sessions", body), { invalidate: [["receiving/sessions"], ["receiving-shipments"], ["purchases"]], toastError: false });
  const scan = useBuyerMutation((body: { id: string; barcode: string }) => buyerApi.post(`/receiving/sessions/${body.id}/scans`, { barcode: body.barcode }), { invalidate: [["receiving/sessions"]], toastError: false });
  const confirm = useBuyerMutation((id: string) => buyerApi.post(`/receiving/sessions/${id}/confirm`), { invalidate: [["receiving/sessions"], ["purchases"]], success: "Receiving session confirmed", toastError: false });

  async function begin() {
    setError(null);
    if (!shipmentId) { setError("Select an arrived shipment before starting the session."); return; }
    if (!reference.trim()) { setError("Enter a session reference before starting."); return; }
    if (openSessions.has(shipmentId)) { setError("This shipment already has an open receiving session. Select it below to continue scanning."); return; }
    try { const result = await start.mutateAsync({ shipmentId, reference: reference.trim() }); setActive(result); setReference(""); } catch (e) { setError(describeError(e)); }
  }

  async function submitScan() {
    const scannedBarcode = barcode.replace(/[\r\n]+$/g, "");
    if (!active || !scannedBarcode.trim()) { if (!scannedBarcode.trim()) setError("Scan or enter a bale barcode."); return; }
    setError(null);
    try {
      const result = await scan.mutateAsync({ id: active.id, barcode: scannedBarcode }) as { scan: { result: string }; bale: ScannedBale | null };
      if (result.scan.result !== "RECEIVED" || !result.bale) {
        throw new Error(scanResultMessage(result.scan.result));
      }
      setLastScan(result.bale);
      setBarcode("");
    }
    catch (e) { setError(describeError(e)); }
  }

  async function finish() {
    if (!active) return;
    try { await confirm.mutateAsync(active.id); setActive(null); setBarcode(""); setLastScan(null); }
    catch (e) { setError(describeError(e)); }
  }

  function continueSession(session: Session) {
    if (session.status !== "OPEN") return;
    setError(null);
    setActive(session);
    setShipmentId(session.shipment?.id ?? "");
  }

  return <RequireBuyerPermission permission="buyer.receiving.view"><PageIntro title="Bale receiving" description="Start one receiving session per purchase, then continue scanning until the session is confirmed." />
    {error ? <Callout tone="danger" title="Receiving action failed" className="mb-4">{error}</Callout> : null}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card><CardHeader><CardTitle>Start a session</CardTitle><CardDescription>Select an arrived shipment. A dispatch must be marked arrived before its bales can be scanned.</CardDescription></CardHeader><CardContent className="space-y-4">
        <Field label="Arrived shipment" htmlFor="receiving-shipment" required hint="Search by dispatch reference, purchase, or truck.">
          <ShipmentSelector shipments={shipments.data ?? []} selectedId={shipmentId} openSessions={openSessions} disabled={!canScan || Boolean(active)} onSelect={(id) => { setShipmentId(id); setError(null); }} />
        </Field>
        <Field label="Session reference" htmlFor="receiving-reference" required hint="Use a truck, delivery or docket reference.">
          <Input id="receiving-reference" value={reference} onChange={(e) => setReference(e.target.value)} disabled={!canScan || Boolean(active)} placeholder="e.g. TRUCK-1042" aria-invalid={!reference.trim() && Boolean(error)} />
        </Field>
        <Button className="w-full" disabled={!canScan || Boolean(active)} loading={start.isPending} onClick={() => void begin()}>Start receiving session</Button>
      </CardContent></Card>
      {active ? <Card><CardHeader><div><CardTitle>Receiving {active.reference}</CardTitle><CardDescription>Only bales from this purchase invoice are accepted. Duplicate scans are rejected.</CardDescription></div><Badge tone="primary">Open</Badge></CardHeader><CardContent>
        <div className="flex gap-2"><Input autoFocus value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submitScan(); }} placeholder="Scan or enter barcode" aria-label="Bale barcode" /><Button onClick={() => void submitScan()} disabled={!barcode.trim()} loading={scan.isPending}><ScanBarcode /> Scan</Button></div>
        {lastScan ? <div className="mt-4 rounded-xl border border-border bg-muted p-4 text-sm"><div className="flex items-center justify-between gap-3"><strong>Bale received and verified</strong><Badge tone="success">{lastScan.status}</Badge></div><dl className="mt-3 grid gap-2 sm:grid-cols-4"><div><dt className="text-muted-foreground">Barcode</dt><dd className="font-mono">{lastScan.barcode}</dd></div><div><dt className="text-muted-foreground">Buyer grade</dt><dd>{lastScan.buyerGrade}</dd></div><div><dt className="text-muted-foreground">TIMB grade</dt><dd>{lastScan.timbGrade || "—"}</dd></div><div><dt className="text-muted-foreground">Grower / lot</dt><dd>{lastScan.growerNo} / {lastScan.lotNo}</dd></div><div><dt className="text-muted-foreground">Mass</dt><dd>{lastScan.massKg} kg</dd></div><div><dt className="text-muted-foreground">USc/kg</dt><dd>{lastScan.uscPerKg}</dd></div><div><dt className="text-muted-foreground">USD value</dt><dd>{lastScan.usdValue}</dd></div></dl></div> : null}
        <Button className="mt-4" variant="success" onClick={() => void finish()} loading={confirm.isPending}><CheckCircle2 /> Confirm session</Button>
      </CardContent></Card> : <Card><EmptyState icon={ScanBarcode} title="No active session" description="Start a session or select an open session below to continue scanning." /></Card>}
    </div>
    <div className="mt-6">{sessions.isLoading ? <LoadingTable /> : sessions.isError ? <Card><EmptyState title="Could not load receiving sessions" description={describeError(sessions.error)} action={<Button variant="secondary" onClick={() => void sessions.refetch()}>Try again</Button>} /></Card> : !sessions.data?.length ? <Card><EmptyState icon={PackageCheck} title="No receiving sessions" description="Start a session to begin receiving bales." /></Card> : <DataTableCard><Table aria-label="Receiving sessions"><TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Purchase</TableHead><TableHead>Started</TableHead><TableHead>Scans</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{sessions.data.map((item) => <TableRow key={item.id} className={item.status === "OPEN" ? "cursor-pointer" : undefined} onClick={() => continueSession(item)}><TableCell className="font-medium">{item.reference}</TableCell><TableCell>{item.purchase?.reference ?? "—"}</TableCell><TableCell>{new Date(item.startedAt).toLocaleString()}</TableCell><TableCell>{item._count?.scans ?? 0}</TableCell><TableCell><Badge tone={item.status === "CONFIRMED" ? "success" : "warning"}>{item.status}</Badge></TableCell><TableCell>{item.status === "OPEN" ? <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); continueSession(item); }}>Continue <ChevronDown className="rotate-[-90deg]" /></Button> : <span className="text-xs text-muted-foreground">Closed</span>}</TableCell></TableRow>)}</TableBody></Table></DataTableCard>}</div>
  </RequireBuyerPermission>;
}

function scanResultMessage(result: string): string {
  if (result === "WRONG_PURCHASE") return "This bale is not on the selected purchase invoice.";
  if (result === "WRONG_BUYER") return "This bale belongs to a different buyer.";
  if (result === "UNEXPECTED") return "This barcode is not present in the imported invoice manifest.";
  if (result === "INVALID_BARCODE") return "This barcode is invalid.";
  return `Bale could not be received (${result}).`;
}

function ShipmentSelector({ shipments, selectedId, openSessions, disabled, onSelect }: { shipments: Shipment[]; selectedId: string; openSessions: Map<string, Session>; disabled: boolean; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = shipments.find((shipment) => shipment.id === selectedId);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id="receiving-shipment" type="button" variant="secondary" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">{selected ? <span className="truncate">{selected.reference} · {selected.expectedBales} bales</span> : <span className="text-muted-foreground">Search arrived shipments...</span>}<ChevronDown className="size-4 shrink-0" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0"><Command><CommandInput placeholder="Search dispatch, purchase, or truck..." /><CommandList><CommandEmpty>No arrived shipments found.</CommandEmpty>{shipments.map((shipment) => { const openSession = openSessions.get(shipment.id); return <CommandItem key={shipment.id} value={`${shipment.reference} ${shipment.purchase.reference} ${shipment.truckRegistration ?? ""} ${shipment.id}`} onSelect={() => { onSelect(shipment.id); setOpen(false); }}><Check className={`size-4 ${selectedId === shipment.id ? "opacity-100" : "opacity-0"}`} /><span className="min-w-0 flex-1 truncate">{shipment.reference} · {shipment.purchase.reference} · {shipment.expectedBales} bales</span>{openSession ? <Badge tone="warning">Open</Badge> : null}</CommandItem>; })}</CommandList></Command></PopoverContent></Popover>;
}

"use client";

import { useState } from "react";
import { FileUp, Truck } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Command, CommandEmpty, CommandInput, CommandItem, CommandList, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Field, Input, Popover, PopoverContent, PopoverTrigger, Textarea } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { buyerApi, describeError, useBuyerMutation, useBuyerQuery } from "@/lib/api";
import { DataTableCard, LoadingTable, PageIntro } from "../_components/buyer-data";

type Shipment = { id: string; reference: string; status: string; dispatchDate: string; expectedBales: number; expectedMassKg: string; truckRegistration?: string | null; driverName?: string | null; purchase: { reference: string }; destinationWarehouse?: { code: string; name: string } | null };
type Warehouse = { id: string; code: string; name: string; kind: string; active: boolean };
type Purchase = { id: string; reference: string; totalBales: number; receivingStatus?: string };

export default function ShipmentsPage() {
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Shipment | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [purchaseReference, setPurchaseReference] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shipments = useBuyerQuery<Shipment[]>("/buyer/shipments", status ? { status } : undefined, { key: ["buyer/shipments", status] });
  const warehouses = useBuyerQuery<Warehouse[]>("/warehouses", undefined, { key: ["buyer/shipment-warehouses"] });
  const purchases = useBuyerQuery<{ items: Purchase[] }>("/buyer/purchases", { page: 1, pageSize: 200 }, { key: ["buyer/shipment-purchases"] });
  const arrive = useBuyerMutation((body: { id: string; receivingWarehouseId: string; actualTruckRegistration?: string; arrivalNotes?: string }) => buyerApi.post(`/buyer/shipments/${body.id}/arrive`, { receivingWarehouseId: body.receivingWarehouseId, actualTruckRegistration: body.actualTruckRegistration, arrivalNotes: body.arrivalNotes }), { invalidate: [["buyer/shipments", status]], success: "Shipment marked arrived", toastError: false });
  const stage = useBuyerMutation((body: Record<string, unknown>) => buyerApi.post("/buyer/shipments/import", body), { invalidate: [["buyer/shipments", status]], success: "Dispatch manifest staged", toastError: false });

  async function markArrived(form: HTMLFormElement) {
    if (!selected) return;
    setError(null);
    const data = new FormData(form);
    try {
      await arrive.mutateAsync({ id: selected.id, receivingWarehouseId: String(data.get("warehouseId") ?? ""), actualTruckRegistration: String(data.get("truck") ?? "") || undefined, arrivalNotes: String(data.get("notes") ?? "") || undefined });
      setArrivalOpen(false);
    } catch (e) { setError(describeError(e)); }
  }

  async function importManifest(form: HTMLFormElement) {
    setError(null);
    const data = new FormData(form);
    const file = data.get("file");
    try {
      const pastedContent = String(data.get("content") ?? "").trim();
      const content = pastedContent || (file instanceof File ? await file.text() : "");
      await stage.mutateAsync({ filename: file instanceof File ? file.name : "dispatch.csv", content, dispatchReference: String(data.get("reference") ?? ""), purchaseReference, dispatchDate: String(data.get("dispatchDate") ?? ""), destinationWarehouseId: warehouseId, truckRegistration: String(data.get("truck") ?? ""), driverName: String(data.get("driver") ?? ""), trailerRegistration: String(data.get("trailer") ?? "") || undefined, transporter: String(data.get("transporter") ?? "") || undefined, dispatchLocation: String(data.get("location") ?? "") || undefined });
      setImportOpen(false);
    } catch (e) { setError(describeError(e)); }
  }

  return <RequireBuyerPermission permission="buyer.receiving.view"><PageIntro title="Incoming shipments" description="Import dispatch manifests, track trucks in transit, and mark arrivals before receiving." actions={<Button onClick={() => setImportOpen(true)}><FileUp /> Import dispatch file</Button>} />
    {error ? <Card className="mb-4 border-danger/30"><CardContent className="pt-6 text-sm text-danger-text">{error}</CardContent></Card> : null}
    <Card className="mb-4"><CardContent className="flex flex-wrap gap-2 pt-6">{["", "IN_TRANSIT", "ARRIVED", "RECEIVING", "RECONCILIATION_REQUIRED", "CONFIRMED", "ALLOCATED"].map((item) => <Button key={item || "all"} size="sm" variant={status === item ? "primary" : "secondary"} onClick={() => setStatus(item)}>{item || "All shipments"}</Button>)}</CardContent></Card>
    {shipments.isLoading ? <LoadingTable /> : shipments.isError ? <Card><EmptyState title="Could not load shipments" description={describeError(shipments.error)} action={<Button variant="secondary" onClick={() => void shipments.refetch()}>Try again</Button>} /></Card> : <DataTableCard><table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="p-3">Dispatch</th><th className="p-3">Purchase</th><th className="p-3">Truck</th><th className="p-3">Warehouse</th><th className="p-3">Bales</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{(shipments.data ?? []).map((item) => <tr key={item.id} className="border-b border-border"><td className="p-3 font-medium">{item.reference}<div className="text-xs text-muted-foreground">{new Date(item.dispatchDate).toLocaleDateString()}</div></td><td className="p-3">{item.purchase.reference}</td><td className="p-3">{item.truckRegistration ?? "—"}<div className="text-xs text-muted-foreground">{item.driverName ?? "—"}</div></td><td className="p-3">{item.destinationWarehouse?.name ?? "—"}</td><td className="p-3">{item.expectedBales}</td><td className="p-3"><Badge tone={item.status === "ALLOCATED" ? "success" : item.status === "IN_TRANSIT" ? "warning" : "neutral"}>{item.status}</Badge></td><td className="p-3">{item.status === "IN_TRANSIT" ? <Button size="sm" variant="secondary" onClick={() => { setSelected(item); setArrivalOpen(true); }}>Mark arrived</Button> : <span className="text-xs text-muted-foreground">Tracked</span>}</td></tr>)}</tbody></table></DataTableCard>}
    <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setPurchaseReference(""); setWarehouseId(""); } }}><DialogContent size="lg" className="max-h-[90vh] overflow-hidden"><DialogHeader><DialogTitle>Import dispatch manifest</DialogTitle><DialogDescription>The manifest creates an in-transit shipment. It does not create purchase bales.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void importManifest(event.currentTarget); }} className="flex min-h-0 flex-col"><DialogBody className="max-h-[65vh] overflow-y-auto pr-2"><div className="grid gap-4 sm:grid-cols-2"><Field label="Dispatch reference" required><Input name="reference" required placeholder="DISPATCH-001" /></Field><Field label="Purchase reference" required hint="Search purchases already imported into the portal."><SearchablePicker value={purchaseReference} onChange={setPurchaseReference} placeholder="Search current purchases..." options={(purchases.data?.items ?? []).map((item) => ({ value: item.reference, label: `${item.reference} · ${item.totalBales} bales` }))} /></Field><Field label="Dispatch date" required><Input name="dispatchDate" type="date" required /></Field><Field label="Destination warehouse" required hint="Search active standard warehouses."><SearchablePicker value={warehouseId} onChange={setWarehouseId} placeholder="Search warehouses..." options={(warehouses.data ?? []).filter((item) => item.active && item.kind === "STANDARD").map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))} /></Field><Field label="Truck registration" required><Input name="truck" required /></Field><Field label="Driver" required><Input name="driver" required /></Field><Field label="Trailer"><Input name="trailer" /></Field><Field label="Transporter"><Input name="transporter" /></Field></div><div className="mt-4 grid gap-4"><Field label="CSV file" hint="Choose a file or paste its contents below."><Input name="file" type="file" accept=".csv,text/csv" /></Field><Field label="CSV content"><Textarea name="content" placeholder={"Barcode,MassKg\n2220000017,100"} rows={8} /></Field></div></DialogBody><DialogFooter className="shrink-0 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setImportOpen(false)}>Cancel</Button><Button type="submit" disabled={!purchaseReference || !warehouseId} loading={stage.isPending}>Stage manifest</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={arrivalOpen} onOpenChange={setArrivalOpen}><DialogContent><DialogHeader><DialogTitle>Confirm shipment arrival</DialogTitle><DialogDescription>{selected?.reference} · {selected?.truckRegistration ?? "truck not recorded"}</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void markArrived(event.currentTarget); }}><DialogBody className="grid gap-3"><Field label="Receiving warehouse" required><select name="warehouseId" required defaultValue={selected?.destinationWarehouse ? (warehouses.data ?? []).find((item) => item.code === selected.destinationWarehouse?.code)?.id ?? "" : ""} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"><option value="">Select warehouse</option>{(warehouses.data ?? []).filter((item) => item.active && item.kind === "STANDARD").map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field><Field label="Actual truck registration"><Input name="truck" defaultValue={selected?.truckRegistration ?? ""} /></Field><Field label="Arrival notes"><Textarea name="notes" rows={3} /></Field></DialogBody><DialogFooter><Button type="button" variant="secondary" onClick={() => setArrivalOpen(false)}>Cancel</Button><Button type="submit" loading={arrive.isPending}><Truck /> Confirm arrival</Button></DialogFooter></form></DialogContent></Dialog>
  </RequireBuyerPermission>;
}

function SearchablePicker({ value, onChange, placeholder, options }: { value: string; onChange: (value: string) => void; placeholder: string; options: Array<{ value: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="secondary" className="w-full justify-between font-normal"><span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selected?.label ?? placeholder}</span><span aria-hidden="true">⌄</span></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0"><Command><CommandInput placeholder={placeholder} /><CommandList><CommandEmpty>No matching records.</CommandEmpty>{options.map((option) => <CommandItem key={option.value} value={`${option.label} ${option.value}`} onSelect={() => { onChange(option.value); setOpen(false); }}>{option.label}</CommandItem>)}</CommandList></Command></PopoverContent></Popover>;
}

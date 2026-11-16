"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileDown, LoaderCircle, Trash2, Upload } from "lucide-react";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { buyerApi, describeError, isApiError, useBuyerCan, useBuyerMutation, useBuyerQuery } from "@/lib/api";
import { DataTableCard, LoadingTable, PageIntro, Pagination } from "../_components/buyer-data";

type ImportRow = { id: string; reference: string; filename: string; status: string; parserId: string; parserVersion: string; formatVerified: boolean; recordCount: number; validCount: number; invalidCount: number; expectedMassKg: string; expectedUsdValue: string; createdAt: string };
type BaleRow = { rowNumber: number; buyerGrade: string; growerNo: string; lotNo: string; massKg: string; uscPerKg: string; usdValue: string; barcode: string; timbGrade: string | null };
type InvoiceDraft = { preparedBy: string | null; totalZigValue: string | null; payableUsd: string | null; payableZig: string | null; charges: Array<{ status: string; code: string; label: string; amountUsd: string; amountZig: string; sortOrder: number }>; gradeSummary: Array<{ grade: string; bales: number; massKg: string; avgUsc: string; usdValue: string }> };
type Staged = ImportRow & { header?: { floorName: string; buyerCode: string; buyerName: string; saleDateFrom: string; saleDateTo: string; exchangeRate: string | null }; rows?: BaleRow[]; issues?: Array<{ rowNumber: number; kind?: string; field?: string | null; message: string; severity?: string }>; invoiceDraft?: InvoiceDraft | null; totalMassKg?: string; totalUsdValue?: string };

export default function ImportsPage() {
  const canImport = useBuyerCan()("buyer.flowdisk.import");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Staged | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [duplicateBarcodes, setDuplicateBarcodes] = useState<string[]>([]);
  const [balePage, setBalePage] = useState(1);
  const query = useBuyerQuery<ImportRow[]>("/buyer/flowdisk/imports");
  const stage = useBuyerMutation((body: { filename: string; content: string }) => buyerApi.post<Staged>("/buyer/flowdisk/imports", body), { invalidate: [["flowdisk/imports"]], toastError: false });
  const confirm = useBuyerMutation((id: string) => buyerApi.post(`/buyer/flowdisk/imports/${id}/confirm`, {}), { invalidate: [["flowdisk/imports"], ["purchases"], ["invoices"]], success: "Import confirmed", toastError: false, onSuccess: () => setSelected(null) });
  const remove = useBuyerMutation((id: string) => buyerApi.delete(`/buyer/flowdisk/imports/${id}`), { invalidate: [["flowdisk/imports"]], success: "Staged import deleted", toastError: false, onSuccess: () => setSelected(null) });

  async function viewImport(id: string) {
    setError(null);
    try { setDuplicateBarcodes([]); setBalePage(1); setSelected(await buyerApi.get<Staged>(`/buyer/flowdisk/imports/${id}`)); }
    catch (e) { setError(describeError(e)); }
  }
  async function upload(file?: File) {
    if (!file) return;
    setError(null); setDuplicateBarcodes([]); setUploadName(file.name); setUploading(true);
    try { setBalePage(1); setSelected(await stage.mutateAsync({ filename: file.name, content: await file.text() })); }
    catch (e) { setError(describeError(e)); }
    finally { setUploadName(""); setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  function deleteImport(id: string) {
    if (window.confirm("Delete this staged import? It has not created an invoice or bales.")) void remove.mutateAsync(id).catch(() => undefined);
  }
  async function confirmImport(id: string) {
    setError(null); setDuplicateBarcodes([]);
    try { await confirm.mutateAsync(id); }
    catch (e) {
      if (isApiError(e) && e.code === "DUPLICATE_BALE" && typeof e.details === "object" && e.details && "barcodes" in e.details && Array.isArray(e.details.barcodes)) {
        setDuplicateBarcodes(e.details.barcodes.filter((barcode): barcode is string => typeof barcode === "string"));
        setError("Import cannot be confirmed because these bale barcodes already exist in the buyer inventory.");
      } else setError(describeError(e));
    }
  }

  return <RequireBuyerPermission permission="buyer.flowdisk.import"><PageIntro title="Flow Disk imports" description="Upload, validate and preview every invoice fact before creating purchases and bales." actions={<Button disabled={!canImport || stage.isPending} disabledReason="Your role cannot import Flow Disk files" onClick={() => inputRef.current?.click()}><Upload /> Upload Flow Disk</Button>} />
    <input ref={inputRef} className="sr-only" type="file" accept=".txt,.csv,text/plain,text/csv" onChange={(e) => void upload(e.target.files?.[0])} aria-label="Upload Flow Disk file" />
    {uploading || stage.isPending ? <Card className="mb-6" role="status" aria-live="polite"><CardContent className="flex items-center gap-3 py-4 text-sm"><LoaderCircle className="size-5 animate-spin text-primary" /><span>Uploading and validating <strong>{uploadName}</strong>...</span></CardContent></Card> : null}
    {error ? <Callout tone="danger" title="Import failed" className="mb-4">{error}</Callout> : null}
    {selected ? <ImportPreview selected={selected} canImport={canImport} balePage={balePage} setBalePage={setBalePage} confirming={confirm.isPending} deleting={remove.isPending} duplicateBarcodes={duplicateBarcodes} onConfirm={() => void confirmImport(selected.id)} onDelete={() => deleteImport(selected.id)} onClose={() => setSelected(null)} /> : null}
    {query.isLoading ? <LoadingTable /> : query.isError ? <Card><EmptyState title="Could not load imports" description={describeError(query.error)} action={<Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>} /></Card> : !query.data?.length ? <Card><EmptyState icon={FileDown} title="No Flow Disk imports" description="Upload a Flow Disk file to preview its invoice, charges and bale manifest." /></Card> : <DataTableCard><div className="overflow-x-auto"><Table aria-label="Flow Disk imports"><TableHeader><TableRow><TableHead>Import</TableHead><TableHead>File</TableHead><TableHead>Rows</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{query.data.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.reference}</TableCell><TableCell>{item.filename}</TableCell><TableCell>{item.validCount}/{item.recordCount}</TableCell><TableCell><Badge tone={item.status === "COMPLETED" ? "success" : item.invalidCount ? "warning" : "neutral"}>{item.status}</Badge></TableCell><TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell><TableCell className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void viewImport(item.id)}>Preview</Button>{item.status === "STAGED" ? <Button size="sm" variant="ghost" onClick={() => deleteImport(item.id)} disabled={remove.isPending}><Trash2 /> Delete</Button> : null}</TableCell></TableRow>)}</TableBody></Table></div></DataTableCard>}
  </RequireBuyerPermission>;
}

function ImportPreview({ selected, canImport, balePage, setBalePage, confirming, deleting, duplicateBarcodes, onConfirm, onDelete, onClose }: { selected: Staged; canImport: boolean; balePage: number; setBalePage: (page: number) => void; confirming: boolean; deleting: boolean; duplicateBarcodes: string[]; onConfirm: () => void; onDelete: () => void; onClose: () => void }) {
  const pageSize = 20;
  const rows = selected.rows ?? [];
  const visibleRows = rows.slice((balePage - 1) * pageSize, balePage * pageSize);
  return <Card className="mb-6"><CardHeader><div><CardTitle>Preview import</CardTitle><CardDescription>{selected.filename} · {selected.validCount} valid of {selected.recordCount} rows</CardDescription></div><Badge tone={selected.status === "COMPLETED" ? "success" : selected.invalidCount ? "warning" : "neutral"}>{selected.status === "COMPLETED" ? "Completed" : selected.invalidCount ? `${selected.invalidCount} issues` : "Ready to confirm"}</Badge></CardHeader><CardContent>
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6"><Field label="Floor"><Input value={selected.header?.floorName ?? ""} readOnly /></Field><Field label="Buyer"><Input value={selected.header?.buyerName ?? ""} readOnly /></Field><Field label="Buyer code"><Input value={selected.header?.buyerCode ?? ""} readOnly /></Field><Field label="From"><Input value={selected.header?.saleDateFrom ?? ""} readOnly /></Field><Field label="To"><Input value={selected.header?.saleDateTo ?? ""} readOnly /></Field><Field label="Exchange rate"><Input value={selected.header?.exchangeRate ?? ""} readOnly /></Field></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6"><Field label="Import reference"><Input value={selected.reference} readOnly /></Field><Field label="Parser"><Input value={`${selected.parserId} ${selected.parserVersion}`} readOnly /></Field><Field label="Format verified"><Input value={selected.formatVerified ? "Yes" : "No"} readOnly /></Field><Field label="Expected mass"><Input value={`${selected.expectedMassKg} kg`} readOnly /></Field><Field label="Total mass"><Input value={`${selected.totalMassKg ?? selected.expectedMassKg} kg`} readOnly /></Field><Field label="Total value"><Input value={selected.totalUsdValue ?? selected.expectedUsdValue} readOnly /></Field></div>
    {selected.invoiceDraft ? <div className="mt-6 grid gap-6 lg:grid-cols-2"><DataTableCard><CardHeader><CardTitle>Invoice charges</CardTitle><CardDescription>Charges captured from the invoice source.</CardDescription></CardHeader><div className="overflow-x-auto"><Table aria-label="Preview invoice charges"><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Charge</TableHead><TableHead>USD</TableHead><TableHead>ZiG</TableHead></TableRow></TableHeader><TableBody>{selected.invoiceDraft.charges.map((charge) => <TableRow key={`${charge.sortOrder}-${charge.code}`}><TableCell>{charge.status}</TableCell><TableCell>{charge.label}</TableCell><TableCell>{charge.amountUsd}</TableCell><TableCell>{charge.amountZig}</TableCell></TableRow>)}</TableBody></Table></div></DataTableCard><DataTableCard><CardHeader><CardTitle>Grade summary</CardTitle></CardHeader><Table aria-label="Preview grade summary"><TableHeader><TableRow><TableHead>Grade</TableHead><TableHead>Bales</TableHead><TableHead>Mass</TableHead><TableHead>USc/kg</TableHead><TableHead>USD</TableHead></TableRow></TableHeader><TableBody>{selected.invoiceDraft.gradeSummary.map((summary) => <TableRow key={summary.grade}><TableCell>{summary.grade}</TableCell><TableCell>{summary.bales}</TableCell><TableCell>{summary.massKg}</TableCell><TableCell>{summary.avgUsc}</TableCell><TableCell>{summary.usdValue}</TableCell></TableRow>)}</TableBody></Table></DataTableCard><div className="rounded-xl border border-border p-4 text-sm"><strong>Payable totals</strong><p className="mt-2 text-muted-foreground">{selected.invoiceDraft.payableUsd ?? "—"} USD · {selected.invoiceDraft.payableZig ?? "—"} ZiG</p></div></div> : null}
    {rows.length ? <DataTableCard className="mt-6"><CardHeader><CardTitle>Bale manifest</CardTitle><CardDescription>Showing {visibleRows.length} of {rows.length} bales.</CardDescription></CardHeader><div className="overflow-x-auto"><Table aria-label="Flow Disk bale manifest"><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Buyer Grade</TableHead><TableHead>Grower Nr</TableHead><TableHead>Lot Nr</TableHead><TableHead>Mass</TableHead><TableHead>USc/kg</TableHead><TableHead>US$ Value</TableHead><TableHead>Barcode</TableHead><TableHead>TIMB Grade</TableHead></TableRow></TableHeader><TableBody>{visibleRows.map((row) => <TableRow key={`${row.rowNumber}-${row.barcode}`}><TableCell>{row.rowNumber}</TableCell><TableCell>{row.buyerGrade}</TableCell><TableCell>{row.growerNo}</TableCell><TableCell>{row.lotNo}</TableCell><TableCell>{row.massKg}</TableCell><TableCell>{row.uscPerKg}</TableCell><TableCell>{row.usdValue}</TableCell><TableCell className="font-mono">{row.barcode}</TableCell><TableCell>{row.timbGrade ?? ""}</TableCell></TableRow>)}</TableBody></Table></div><Pagination page={balePage} pageSize={pageSize} total={rows.length} onPage={setBalePage} /></DataTableCard> : null}
    {duplicateBarcodes.length ? <Callout tone="danger" title="Duplicate bales found" className="mt-6"><p>This import cannot create a second invoice for bales already in inventory.</p><p className="mt-2 break-words font-mono text-xs">{duplicateBarcodes.join(", ")}</p></Callout> : null}
    {selected.issues?.length ? <Callout tone="warning" title="Resolve import issues" className="mt-6"><ul className="list-disc pl-5">{selected.issues.map((issue) => <li key={`${issue.rowNumber}-${issue.message}`}>Row {issue.rowNumber}{issue.field ? ` · ${issue.field}` : ""}{issue.kind ? ` · ${issue.kind}` : ""}: {issue.message}</li>)}</ul></Callout> : null}
    <div className="mt-6 flex flex-wrap gap-2"><Button disabled={!canImport || selected.status !== "STAGED" || Boolean(selected.invalidCount) || confirming} loading={confirming} onClick={onConfirm}><CheckCircle2 /> Confirm import</Button>{selected.status === "STAGED" ? <Button variant="ghost" onClick={onDelete} disabled={deleting}><Trash2 /> Delete import</Button> : null}<Button variant="secondary" onClick={onClose}>Close</Button></div>
  </CardContent></Card>;
}

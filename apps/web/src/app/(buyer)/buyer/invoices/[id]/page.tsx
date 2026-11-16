"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { useBuyerQuery, describeError } from "@/lib/api";
import { DataTableCard, PageIntro, QueryState } from "../../_components/buyer-data";
import { BuyerSelect } from "@/components/buyer/buyer-resource";

type Charge = { status: string; code: string; label: string; amountUsd: string; amountZig: string; sortOrder: number };
type GradeSummary = { grade: string; bales: number; massKg: string; avgUsc: string; usdValue: string };
type Bale = { id: string; barcode: string; buyerGrade: string; timbGrade: string | null; growerNo: string; lotNo: string; massKg: string; uscPerKg: string; usdValue: string; status: string };
type Invoice = {
  id: string;
  reference: string;
  invoiceNumber: string | null;
  company: string | null;
  floorName: string;
  buyerNameOnInvoice: string;
  saleDateFrom: string;
  saleDateTo: string;
  invoiceDate: string;
  exchangeRate: string;
  totalBales: number;
  totalMassKg: string;
  avgUscPerKg: string;
  totalUsdValue: string;
  totalZigValue: string | null;
  payableUsd: string | null;
  payableZig: string | null;
  charges: Charge[];
  gradeSummary: GradeSummary[];
  purchase: { id: string; reference: string; receivingStatus: string; bales: Bale[] } | null;
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useBuyerQuery<Invoice>(`/buyer/invoices/${id}`, undefined, { key: ["invoice", id] });
  return <RequireBuyerPermission permission="buyer.invoices.view">
    <PageIntro title="Invoice details" description="Complete invoice facts, charges and grade summary." actions={<Button asChild variant="secondary"><Link href="/buyer/invoices"><ArrowLeft /> Back to invoices</Link></Button>} />
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} onRetry={() => void query.refetch()} empty={!query.data}>
      {query.data ? <InvoiceContent invoice={query.data} /> : <p className="text-sm text-muted-foreground">{describeError(query.error)}</p>}
    </QueryState>
  </RequireBuyerPermission>;
}

function InvoiceContent({ invoice }: { invoice: Invoice }) {
  const [groupBy, setGroupBy] = useState<"none" | "buyerGrade" | "lotNo">("none");
  const groups = invoice.purchase ? groupBales(invoice.purchase.bales, groupBy) : [];
  return <div className="space-y-6">
    <Card><CardHeader><div><CardTitle>{invoice.invoiceNumber || invoice.reference}</CardTitle><CardDescription>{invoice.company || invoice.buyerNameOnInvoice} · {invoice.floorName}</CardDescription></div><Badge tone="success">{invoice.totalBales} bales</Badge></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-muted-foreground">Buyer</dt><dd>{invoice.buyerNameOnInvoice}</dd></div><div><dt className="text-muted-foreground">Sale period</dt><dd>{invoice.saleDateFrom} to {invoice.saleDateTo}</dd></div><div><dt className="text-muted-foreground">Invoice date</dt><dd>{invoice.invoiceDate}</dd></div><div><dt className="text-muted-foreground">Exchange rate</dt><dd>{invoice.exchangeRate}</dd></div><div><dt className="text-muted-foreground">Mass</dt><dd>{invoice.totalMassKg} kg</dd></div><div><dt className="text-muted-foreground">Average USc/kg</dt><dd>{invoice.avgUscPerKg}</dd></div><div><dt className="text-muted-foreground">Tobacco value (USD)</dt><dd>{invoice.totalUsdValue}</dd></div><div><dt className="text-muted-foreground">Payable</dt><dd>{invoice.payableUsd ?? invoice.totalUsdValue} USD{invoice.payableZig ? ` · ${invoice.payableZig} ZiG` : ""}</dd></div></dl></CardContent></Card>
    <div className="grid gap-6 lg:grid-cols-2">
      <DataTableCard><CardHeader><CardTitle>Grade summary</CardTitle></CardHeader><Table aria-label="Invoice grade summary"><TableHeader><TableRow><TableHead>Grade</TableHead><TableHead>Bales</TableHead><TableHead>Mass</TableHead><TableHead>USc/kg</TableHead><TableHead>USD value</TableHead></TableRow></TableHeader><TableBody>{invoice.gradeSummary.map((row) => <TableRow key={row.grade}><TableCell>{row.grade}</TableCell><TableCell>{row.bales}</TableCell><TableCell>{row.massKg}</TableCell><TableCell>{row.avgUsc}</TableCell><TableCell>{row.usdValue}</TableCell></TableRow>)}</TableBody></Table></DataTableCard>
      <DataTableCard><CardHeader><CardTitle>Invoice charges</CardTitle></CardHeader><Table aria-label="Invoice charges"><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Charge</TableHead><TableHead>USD</TableHead><TableHead>ZiG</TableHead></TableRow></TableHeader><TableBody>{invoice.charges.map((charge) => <TableRow key={`${charge.sortOrder}-${charge.code}`}><TableCell>{charge.status}</TableCell><TableCell>{charge.label}</TableCell><TableCell>{charge.amountUsd}</TableCell><TableCell>{charge.amountZig}</TableCell></TableRow>)}</TableBody></Table></DataTableCard>
    </div>
    {invoice.purchase ? <DataTableCard><CardHeader><div className="flex flex-wrap items-center justify-between gap-4"><div><CardTitle>Bale detail</CardTitle><CardDescription><Link className="text-primary underline-offset-4 hover:underline" href={`/buyer/purchases/${invoice.purchase.id}`}>{invoice.purchase.reference}</Link> · {invoice.purchase.bales.length} bales</CardDescription></div><div className="flex items-center gap-3"><BuyerSelect label="Group bale rows" value={groupBy} onValueChange={(value) => setGroupBy(value as typeof groupBy)} placeholder="No grouping" options={[{ value: "none", label: "No grouping" }, { value: "buyerGrade", label: "Group by buyer grade" }, { value: "lotNo", label: "Group by lot" }]} /><Badge tone="neutral">{invoice.purchase.receivingStatus.replaceAll("_", " ")}</Badge></div></div></CardHeader><div className="overflow-x-auto"><Table aria-label="Invoice bale detail"><TableHeader><TableRow><TableHead>Buyer grade</TableHead><TableHead>Grower Nr</TableHead><TableHead>Lot Nr</TableHead><TableHead>Mass kg</TableHead><TableHead>USc/kg</TableHead><TableHead>USD value</TableHead><TableHead>Barcode</TableHead><TableHead>TIMB grade</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{groups.map((group) => <Fragment key={group.label || "all"}>{groupBy !== "none" ? <TableRow className="bg-muted hover:bg-muted"><TableCell colSpan={9} className="font-semibold">{group.label} · {group.items.length} bales</TableCell></TableRow> : null}{group.items.map((bale) => <TableRow key={bale.id}><TableCell>{bale.buyerGrade}</TableCell><TableCell>{bale.growerNo}</TableCell><TableCell>{bale.lotNo}</TableCell><TableCell>{bale.massKg}</TableCell><TableCell>{bale.uscPerKg}</TableCell><TableCell className="tabular">{bale.usdValue}</TableCell><TableCell className="font-mono text-xs">{bale.barcode}</TableCell><TableCell>{bale.timbGrade || "—"}</TableCell><TableCell><Badge tone={bale.status === "RECEIVED" ? "success" : "neutral"}>{bale.status.replaceAll("_", " ")}</Badge></TableCell></TableRow>)}</Fragment>)}</TableBody></Table></div></DataTableCard> : null}
  </div>;
}

function groupBales(bales: Bale[], groupBy: "none" | "buyerGrade" | "lotNo"): Array<{ label: string; items: Bale[] }> {
  if (groupBy === "none") return [{ label: "", items: bales }];
  const groups = new Map<string, Bale[]>();
  for (const bale of bales) {
    const key = groupBy === "buyerGrade" ? bale.buyerGrade : bale.lotNo;
    groups.set(key, [...(groups.get(key) ?? []), bale]);
  }
  return [...groups.entries()].map(([label, items]) => ({ label: groupBy === "buyerGrade" ? `Buyer grade ${label}` : `Lot ${label}`, items }));
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { useBuyerQuery } from "@/lib/api";
import { DataTableCard, PageIntro, QueryState } from "../../_components/buyer-data";

type Bale = {
  id: string;
  barcode: string;
  buyerGrade: string;
  timbGrade: string;
  growerNo: string;
  lotNo: string;
  massKg: string;
  uscPerKg: string;
  usdValue: string;
  status: string;
};

type Purchase = {
  id: string;
  reference: string;
  floorName: string;
  saleDate: string;
  totalBales: number;
  totalMassKg: string;
  totalUsdValue: string;
  receivingStatus: string;
  invoiceId: string | null;
  invoice: { id: string; reference: string } | null;
  bales: Bale[];
};

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useBuyerQuery<Purchase>(`/buyer/purchases/${id}`, undefined, { key: ["purchase", id] });

  return <RequireBuyerPermission permission="buyer.purchases.view">
    <PageIntro title="Purchase details" description="Review purchase facts and the complete expected bale manifest." actions={<Button asChild variant="secondary"><Link href="/buyer/purchases"><ArrowLeft /> Back to purchases</Link></Button>} />
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} onRetry={() => void query.refetch()} empty={!query.data}>
      {query.data ? <PurchaseContent purchase={query.data} /> : null}
    </QueryState>
  </RequireBuyerPermission>;
}

function PurchaseContent({ purchase }: { purchase: Purchase }) {
  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <div><CardTitle>{purchase.reference}</CardTitle><CardDescription>{purchase.floorName} · Sale date {purchase.saleDate}</CardDescription></div>
        <Badge tone={purchase.receivingStatus === "COMPLETE" ? "success" : "warning"}>{purchase.receivingStatus.replaceAll("_", " ")}</Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Expected bales</dt><dd>{purchase.totalBales}</dd></div>
          <div><dt className="text-muted-foreground">Expected mass</dt><dd>{purchase.totalMassKg} kg</dd></div>
          <div><dt className="text-muted-foreground">USD value</dt><dd>{purchase.totalUsdValue}</dd></div>
          <div><dt className="text-muted-foreground">Invoice</dt><dd>{purchase.invoice ? <Link className="text-primary underline-offset-4 hover:underline" href={`/buyer/invoices/${purchase.invoice.id}`}>{purchase.invoice.reference}</Link> : "—"}</dd></div>
        </dl>
      </CardContent>
    </Card>
    <DataTableCard>
      <CardHeader><CardTitle>Bale manifest</CardTitle><CardDescription>{purchase.bales.length} bale(s) in this purchase.</CardDescription></CardHeader>
      <Table aria-label="Purchase bale manifest">
        <TableHeader><TableRow><TableHead>Barcode</TableHead><TableHead>Buyer grade</TableHead><TableHead>TIMB grade</TableHead><TableHead>Grower</TableHead><TableHead>Lot</TableHead><TableHead>Mass</TableHead><TableHead>USc/kg</TableHead><TableHead className="text-right">USD value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{purchase.bales.map((bale) => <TableRow key={bale.id}><TableCell className="font-medium">{bale.barcode}</TableCell><TableCell>{bale.buyerGrade}</TableCell><TableCell>{bale.timbGrade}</TableCell><TableCell>{bale.growerNo}</TableCell><TableCell>{bale.lotNo}</TableCell><TableCell>{bale.massKg} kg</TableCell><TableCell>{bale.uscPerKg}</TableCell><TableCell className="text-right tabular">{bale.usdValue}</TableCell><TableCell><Badge tone={bale.status === "RECEIVED" ? "success" : "neutral"}>{bale.status.replaceAll("_", " ")}</Badge></TableCell></TableRow>)}</TableBody>
      </Table>
    </DataTableCard>
  </div>;
}

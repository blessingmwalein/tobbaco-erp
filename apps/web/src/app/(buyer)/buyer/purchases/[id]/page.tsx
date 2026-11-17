"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { useBuyerQuery } from "@/lib/api";
import { DataTableCard, PageIntro, QueryState } from "../../_components/buyer-data";

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
  lifecycle?: string;
  shipmentReference?: string | null;
  received?: boolean;
  allocated?: boolean;
};

type Shipment = {
  id: string;
  reference: string;
  dispatchDate: string;
  truckRegistration: string;
  driverName: string;
  destinationWarehouse: { id: string; code: string; name: string } | null;
  expectedBales: number;
  expectedMassKg: string;
  receivedBales: number;
  allocatedBales: number;
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
  totalDispatchedBales: number;
  totalReceivedBales: number;
  totalAllocatedBales: number;
  totalDispatchedMassKg: string;
  outstandingBales: number;
  notYetDispatchedBales: number;
  shipmentCount: number;
  receivingStatus: string;
  reconciliationStatus: string | null;
  allocationComplete: boolean;
  invoiceId: string | null;
  invoice: { id: string; reference: string } | null;
  reconciliation: { id: string; status: string; closedAt: string | null } | null;
  bales: Bale[];
  shipments: Shipment[];
};

const lifecycleTone = (l: string): "neutral" | "warning" | "success" | "danger" =>
  l === "ALLOCATED" ? "success" : l === "RECEIVED" ? "success" : l === "ARRIVED_NOT_RECEIVED" ? "warning" : l === "IN_TRANSIT" ? "warning" : "neutral";
const lifecycleLabel: Record<string, string> = {
  NOT_DISPATCHED: "Not dispatched",
  IN_TRANSIT: "In transit",
  ARRIVED_NOT_RECEIVED: "Arrived · not received",
  RECEIVED: "Received",
  ALLOCATED: "Allocated to storage",
};

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useBuyerQuery<Purchase>(`/buyer/purchases/${id}`, undefined, { key: ["purchase", id] });

  return <RequireBuyerPermission permission="buyer.purchases.view">
    <PageIntro title="Purchase details" description="Review the original purchase, its shipment delivery progress and the complete bale lifecycle." actions={<Button asChild variant="secondary"><Link href="/buyer/purchases"><ArrowLeft /> Back to purchases</Link></Button>} />
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} onRetry={() => void query.refetch()} empty={!query.data}>
      {query.data ? <PurchaseContent purchase={query.data} /> : null}
    </QueryState>
  </RequireBuyerPermission>;
}

function PurchaseContent({ purchase }: { purchase: Purchase }) {
  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <div><CardTitle>{purchase.reference}</CardTitle><CardDescription>{purchase.floorName} · Sale date {purchase.saleDate}{purchase.invoice ? <> · Invoice <Link className="text-primary underline-offset-4 hover:underline" href={`/buyer/invoices/${purchase.invoice.id}`}>{purchase.invoice.reference}</Link></> : null}</CardDescription></div>
        <Badge tone={purchase.receivingStatus === "COMPLETE" ? "success" : "warning"}>{purchase.receivingStatus.replaceAll("_", " ")}</Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Total purchased bales</dt><dd className="text-lg font-semibold">{purchase.totalBales}</dd></div>
          <div><dt className="text-muted-foreground">Total purchased mass</dt><dd className="text-lg font-semibold">{purchase.totalMassKg} kg</dd></div>
          <div><dt className="text-muted-foreground">Total dispatched bales</dt><dd className="text-lg font-semibold">{purchase.totalDispatchedBales}</dd></div>
          <div><dt className="text-muted-foreground">Total received bales</dt><dd className="text-lg font-semibold">{purchase.totalReceivedBales}</dd></div>
          <div><dt className="text-muted-foreground">Outstanding bales</dt><dd className={`text-lg font-semibold ${purchase.outstandingBales > 0 ? "text-warning" : ""}`}>{purchase.outstandingBales}</dd></div>
          <div><dt className="text-muted-foreground">Not yet dispatched</dt><dd className="text-lg font-semibold">{purchase.notYetDispatchedBales}</dd></div>
          <div><dt className="text-muted-foreground">Associated shipments</dt><dd className="text-lg font-semibold">{purchase.shipmentCount}</dd></div>
          <div><dt className="text-muted-foreground">Reconciliation</dt><dd>{purchase.reconciliation ? <Badge tone={purchase.reconciliation.status === "CLOSED" ? "success" : "warning"}>{purchase.reconciliation.status.replaceAll("_", " ")}</Badge> : "—"}</dd></div>
        </dl>
        {purchase.reconciliation ? <div className="mt-4"><Button asChild size="sm" variant="secondary"><Link href={`/buyer/reconciliation?purchase=${purchase.id}`}><Truck /> Open reconciliation</Link></Button></div> : null}
      </CardContent>
    </Card>

    <DataTableCard>
      <CardHeader><CardTitle>Associated shipments</CardTitle><CardDescription>{purchase.shipments.length} shipment(s) make up this purchase. Never treat the purchase as fully received until every bale is accounted for.</CardDescription></CardHeader>
      <Table aria-label="Associated shipments">
        <TableHeader><TableRow><TableHead>Shipment</TableHead><TableHead>Dispatch date</TableHead><TableHead>Truck</TableHead><TableHead>Driver</TableHead><TableHead>Destination</TableHead><TableHead>Expected</TableHead><TableHead>Received</TableHead><TableHead>Allocated</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{purchase.shipments.length ? purchase.shipments.map((s) => <TableRow key={s.id}><TableCell className="font-medium">{s.reference}</TableCell><TableCell>{s.dispatchDate}</TableCell><TableCell>{s.truckRegistration}</TableCell><TableCell>{s.driverName}</TableCell><TableCell>{s.destinationWarehouse?.name ?? "—"}</TableCell><TableCell>{s.expectedBales}</TableCell><TableCell>{s.receivedBales}</TableCell><TableCell>{s.allocatedBales}</TableCell><TableCell><Badge tone={s.status === "ALLOCATED" ? "success" : s.status === "CONFIRMED" ? "success" : s.status === "IN_TRANSIT" ? "warning" : "neutral"}>{s.status.replaceAll("_", " ")}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No shipments imported yet. Use Invoice Shipments to import a shipment JSON for this purchase.</TableCell></TableRow>}</TableBody>
      </Table>
    </DataTableCard>

    <DataTableCard>
      <CardHeader><CardTitle>Bale manifest</CardTitle><CardDescription>{purchase.bales.length} bale(s) with their current lifecycle status.</CardDescription></CardHeader>
      <Table aria-label="Purchase bale manifest">
        <TableHeader><TableRow><TableHead>Barcode</TableHead><TableHead>Grade</TableHead><TableHead>TIMB</TableHead><TableHead>Grower</TableHead><TableHead>Lot</TableHead><TableHead>Mass</TableHead><TableHead>Shipment</TableHead><TableHead>Lifecycle</TableHead></TableRow></TableHeader>
        <TableBody>{purchase.bales.map((bale) => <TableRow key={bale.id}><TableCell className="font-mono">{bale.barcode}</TableCell><TableCell>{bale.buyerGrade}</TableCell><TableCell>{bale.timbGrade ?? "—"}</TableCell><TableCell>{bale.growerNo}</TableCell><TableCell>{bale.lotNo}</TableCell><TableCell>{bale.massKg} kg</TableCell><TableCell>{bale.shipmentReference ?? "—"}</TableCell><TableCell><Badge tone={lifecycleTone(bale.lifecycle ?? "NOT_DISPATCHED")}>{lifecycleLabel[bale.lifecycle ?? "NOT_DISPATCHED"] ?? bale.status}</Badge></TableCell></TableRow>)}</TableBody>
      </Table>
    </DataTableCard>
  </div>;
}

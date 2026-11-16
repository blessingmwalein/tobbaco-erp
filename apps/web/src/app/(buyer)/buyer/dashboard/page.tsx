"use client";

import Link from "next/link";
import { useState } from "react";
import { Banknote, Boxes, ClipboardList, PackageCheck, Receipt, RefreshCw, Scale } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, PageHeader, Skeleton } from "@tobacco/ui";
import type { BuyerDashboardDto } from "@tobacco/shared";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerSelect } from "@/components/buyer/buyer-resource";
import { describeError, useBuyerPrincipal, useBuyerQuery } from "@/lib/api";

export default function BuyerDashboardPage() {
  const principal = useBuyerPrincipal();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [floor, setFloor] = useState("");
  const dashboard = useBuyerQuery<BuyerDashboardDto>("/buyer/dashboard", { from: from || undefined, to: to || undefined, floor: floor || undefined }, { key: ["dashboard", from, to, floor] });
  const data = dashboard.data;
  const summary = dashboard.data?.summary;
  return (
    <RequireBuyerPermission permission="buyer.dashboard.view">
      <PageHeader title={`Welcome, ${principal?.name.split(" ")[0] ?? ""}`} description={`${principal?.organisation?.name} · Buyer Portal`} />
      <Card className="mb-6">
        <CardHeader><CardTitle>Dashboard filters</CardTitle><CardDescription>Filter purchase, receiving, cost and inventory metrics by sale/receiving period and floor.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">From</span><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">To</span><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <div className="space-y-1 text-sm"><span className="block text-muted-foreground">Floor</span><BuyerSelect label="Filter by floor" value={floor} onValueChange={setFloor} placeholder="All floors" options={[{ value: "", label: "All floors" }, ...(dashboard.data?.floorOptions ?? []).map((option) => ({ value: option, label: option }))]} /></div>
        </CardContent>
      </Card>
      {dashboard.isLoading ? <Skeleton className="h-80" /> : dashboard.isError ? <Card><CardContent className="pt-6"><EmptyState title="Could not load dashboard" description={describeError(dashboard.error)} action={<Button variant="secondary" onClick={() => void dashboard.refetch()}><RefreshCw /> Try again</Button>} /></CardContent></Card> : data && summary ? <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={PackageCheck} label="Received bales" value={summary.receivedBales.toLocaleString()} detail={`${summary.receivedMassKg} kg received`} href="/buyer/receiving/reconciliation" />
          <StatCard icon={Banknote} label="Purchase spend" value={`$${summary.totalSpendUsd}`} detail={`${summary.purchasedBales.toLocaleString()} bales purchased`} href="/buyer/purchases" />
          <StatCard icon={Receipt} label="Invoice costs" value={`$${summary.costsUsd}`} detail={`${summary.costsZig} ZiG charges`} href="/buyer/invoices" />
          <StatCard icon={ClipboardList} label="Open receiving sessions" value={summary.openReceivingSessions.toLocaleString()} detail={`${summary.openExceptions.toLocaleString()} open exceptions`} href="/buyer/receiving" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Purchase and inventory position</CardTitle><CardDescription>Current totals for the selected filters.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Metric icon={Boxes} label="Inventory bales" value={summary.inventoryBales.toLocaleString()} /><Metric icon={Scale} label="Purchased mass" value={`${summary.purchasedMassKg} kg`} /><Metric icon={Banknote} label="Payable USD" value={`$${summary.payableUsd}`} /><Metric icon={Banknote} label="Payable ZiG" value={`${summary.payableZig} ZiG`} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Open receiving sessions</CardTitle><CardDescription>Continue scanning from the receiving workflow.</CardDescription></CardHeader><CardContent>{data.openSessions.length ? <div className="space-y-3">{data.openSessions.map((session) => <Link key={session.id} href="/buyer/receiving" className="flex items-center justify-between rounded-xl border border-border p-3 transition hover:bg-surface-tertiary"><div><p className="font-medium">{session.reference}</p><p className="text-xs text-muted-foreground">{session.purchaseReference} · {new Date(session.startedAt).toLocaleString()}</p></div><Badge tone="warning">{session.scannedBales}/{session.expectedBales} scanned</Badge></Link>)}</div> : <p className="text-sm text-muted-foreground">No open receiving sessions.</p>}</CardContent></Card>
        </div>
        <Card className="mt-6"><CardHeader><CardTitle>Recent purchases</CardTitle><CardDescription>Latest purchases matching the selected filters.</CardDescription></CardHeader><CardContent>{data.recentPurchases.length ? <div className="divide-y divide-border">{data.recentPurchases.map((purchase) => <Link key={purchase.id} href={`/buyer/purchases/${purchase.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-surface-tertiary"><div><p className="font-medium">{purchase.reference}</p><p className="text-xs text-muted-foreground">{purchase.floorName} · {purchase.saleDate}</p></div><div className="text-right"><p className="font-medium">${purchase.totalUsdValue}</p><p className="text-xs text-muted-foreground">{purchase.totalBales} bales · {purchase.receivingStatus.replaceAll("_", " ")}</p></div></Link>)}</div> : <p className="text-sm text-muted-foreground">No purchases match these filters.</p>}</CardContent></Card>
      </> : null}
    </RequireBuyerPermission>
  );
}

function StatCard({ icon: Icon, label, value, detail, href }: { icon: typeof Boxes; label: string; value: string; detail: string; href: string }) {
  return <Link href={href} className="block"><Card className="h-full transition hover:border-primary/50 hover:shadow-card"><CardContent className="pt-6"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><span className="rounded-xl bg-primary-soft p-2 text-primary"><Icon className="size-5" /></span></div></CardContent></Card></Link>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return <div className="rounded-xl border border-border p-4"><Icon className="size-4 text-muted-foreground" /><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

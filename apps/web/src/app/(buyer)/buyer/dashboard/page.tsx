"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, FileWarning, PackageCheck, RefreshCw, Receipt, ShoppingBag, Truck, Warehouse } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DateRangePicker, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton, StatCard, cn, type IsoDateRange } from "@tobacco/ui";
import { formatDecimal, formatDocDate, humanizeStatus, statusTone, type BuyerDashboardDto, type DashboardShipmentItem, type DashboardShipmentStage } from "@tobacco/shared";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { BuyerSelect } from "@/components/buyer/buyer-resource";
import { describeError, useBuyerPrincipal, useBuyerQuery } from "@/lib/api";

const ALL = "__all";
const int = (n: number) => formatDecimal(n, 0);
const kg = (v: string) => `${formatDecimal(v, 1)} kg`;
const usd = (v: string) => `US$ ${formatDecimal(v, 2)}`;
const zig = (v: string) => `ZiG ${formatDecimal(v, 2)}`;

export default function BuyerDashboardPage() {
  const principal = useBuyerPrincipal();
  const [range, setRange] = useState<IsoDateRange>({});
  const [floor, setFloor] = useState("");
  const dashboard = useBuyerQuery<BuyerDashboardDto>("/buyer/dashboard", { from: range.from, to: range.to, floor: floor || undefined }, { key: ["dashboard"], refetchInterval: 60_000 });
  const data = dashboard.data;

  return (
    <RequireBuyerPermission permission="buyer.dashboard.view">
      <PageHeader title={`Welcome, ${principal?.name.split(" ")[0] ?? ""}`} description={`${principal?.organisation?.name} · Buyer Portal`} />

      <Card className="mb-6">
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,22rem)_minmax(0,16rem)_1fr] lg:items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Sale dates</span>
            <DateRangePicker aria-label="Sale dates" data-testid="dashboard-date-range" placeholder="All sale dates" value={range} onChange={setRange} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Floor</span>
            <BuyerSelect label="Filter by floor" value={floor || ALL} placeholder="All floors" onValueChange={(v) => setFloor(v === ALL ? "" : v)} options={[{ value: ALL, label: "All floors" }, ...(data?.floorOptions ?? []).map((o) => ({ value: o, label: o }))]} />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-1">
            The dates select <strong className="font-medium text-foreground">purchases by sale date</strong>. Shipments, open sessions and warehouse stock are shown <strong className="font-medium text-foreground">as they are right now</strong>.
          </p>
        </CardContent>
      </Card>

      {dashboard.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : dashboard.isError || !data ? (
        <Card>
          <CardContent className="pt-6">
            <ErrorState title="Could not load the dashboard" description={describeError(dashboard.error)} action={<Button variant="secondary" onClick={() => void dashboard.refetch()}><RefreshCw /> Try again</Button>} />
          </CardContent>
        </Card>
      ) : (
        <Dashboard data={data} />
      )}
    </RequireBuyerPermission>
  );
}

function Dashboard({ data }: { data: BuyerDashboardDto }) {
  const s = data.summary;
  const period = data.period.firstSaleDate
    ? data.period.firstSaleDate === data.period.lastSaleDate
      ? formatDocDate(data.period.firstSaleDate)
      : `${formatDocDate(data.period.firstSaleDate)} – ${formatDocDate(data.period.lastSaleDate!)}`
    : "No purchases in this selection";
  const liveCount = data.shipments.inTransit.count + data.shipments.arrived.count + data.shipments.receiving.count + data.shipments.awaitingStorage.count;

  return (
    <div className="space-y-6">
      <section aria-label="Purchases and receiving" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-kpis">
        <Link href="/buyer/purchases" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
          <StatCard className="h-full transition-colors hover:border-primary/50" icon={ShoppingBag} tone="primary" label="Total purchases" value={int(s.purchaseCount)} hint={period} data-testid="kpi-purchases" />
        </Link>
        <Link href="/buyer/invoices" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
          <StatCard className="h-full transition-colors hover:border-primary/50" icon={Receipt} label="Bought" value={`${int(s.purchasedBales)} bales`} hint={`${kg(s.purchasedMassKg)} · ${usd(s.totalSpendUsd)}`} data-testid="kpi-bought" />
        </Link>
        <Link href="/buyer/reconciliation" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
          <StatCard className="h-full transition-colors hover:border-primary/50" icon={PackageCheck} tone="success" label="Received" value={`${int(s.receivedBales)} of ${int(s.purchasedBales)}`} hint={`${int(s.pendingReceiptBales)} still to receive · ${kg(s.receivedMassKg)}`} data-testid="kpi-received" />
        </Link>
        <Link href="/buyer/inventory" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
          <StatCard
            className="h-full transition-colors hover:border-primary/50"
            icon={Warehouse}
            label="In warehouses now"
            value={`${int(s.inventoryBales)} bales`}
            hint={s.unallocatedReceivedBales ? `${int(s.unallocatedReceivedBales)} received, not yet stored` : "All received bales are stored"}
            tone={s.unallocatedReceivedBales ? "warning" : "neutral"}
            data-testid="kpi-stock"
          />
        </Link>
        <StatCard icon={Receipt} label="Payable US$" value={usd(s.payableUsd)} hint="after the USD/ZiG split" data-testid="kpi-payable-usd" />
        <StatCard icon={Receipt} label="Payable ZiG" value={zig(s.payableZig)} hint={`incl. levies ${usd(s.leviesUsd)} + ${zig(s.leviesZig)}`} data-testid="kpi-payable-zig" />
        <Link href="/buyer/receiving" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
          <StatCard className="h-full transition-colors hover:border-primary/50" icon={ClipboardList} label="Open receiving sessions" value={int(s.openReceivingSessions)} hint="live" tone={s.openReceivingSessions ? "warning" : "neutral"} data-testid="kpi-sessions" />
        </Link>
        <Link href="/buyer/reports/receiving?report=bale-discrepancies" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
          <StatCard className="h-full transition-colors hover:border-primary/50" icon={FileWarning} label="Open exceptions" value={int(s.openExceptions)} hint="live — unexpected, wrong or invalid scans" tone={s.openExceptions ? "danger" : "success"} data-testid="kpi-exceptions" />
        </Link>
      </section>

      <section aria-labelledby="shipments-heading" data-testid="dashboard-shipments">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="shipments-heading" className="text-lg font-semibold tracking-tight">Shipments right now</h2>
            <p className="text-sm text-muted-foreground">{liveCount === 0 ? "Nothing is on the road or waiting at the gate." : `${int(liveCount)} shipment${liveCount === 1 ? "" : "s"} still moving toward your warehouse.`}</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link href="/buyer/shipments">All shipments <ArrowRight /></Link></Button>
        </div>

        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Shipment pipeline">
          <Stage n={1} icon={Truck} title="In transit" hint="Dispatched, on the road" stage={data.shipments.inTransit} href="/buyer/shipments?status=IN_TRANSIT" testId="stage-in-transit" tone="warning" />
          <Stage n={2} icon={AlertTriangle} title="Arrived" hint="At the gate, receiving not started" stage={data.shipments.arrived} href="/buyer/shipments?status=ARRIVED" testId="stage-arrived" tone="warning" />
          <Stage n={3} icon={ClipboardList} title="Being received" hint="A session is scanning" stage={data.shipments.receiving} href="/buyer/shipments?status=RECEIVING" testId="stage-receiving" tone="primary" />
          <Stage n={4} icon={Boxes} title="Awaiting storage" hint="Fully scanned, no locations yet" stage={data.shipments.awaitingStorage} href="/buyer/shipments?status=CONFIRMED" testId="stage-awaiting-storage" tone="primary" />
        </ol>
        <p className="mt-2 text-xs text-muted-foreground" data-testid="stage-completed">
          Received and stored: <strong className="font-medium text-foreground">{int(data.shipments.completed.count)}</strong> shipment{data.shipments.completed.count === 1 ? "" : "s"} · {int(data.shipments.completed.bales)} bales
          {data.filters.from || data.filters.to ? " in the selected dates" : " in total"}
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ShipmentList title="On the road" description="Dispatched and not yet arrived — longest-waiting first." items={data.shipments.inTransit.items} total={data.shipments.inTransit.count} empty="No shipments in transit." testId="list-in-transit" />
          <ShipmentList
            title="At the gate and being received"
            description="Arrived, being scanned, or waiting for storage."
            items={[...data.shipments.arrived.items, ...data.shipments.receiving.items, ...data.shipments.awaitingStorage.items].slice(0, 6)}
            total={data.shipments.arrived.count + data.shipments.receiving.count + data.shipments.awaitingStorage.count}
            empty="Nothing waiting at the gate."
            testId="list-arrived"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open receiving sessions</CardTitle>
            <CardDescription>Continue scanning where you left off.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.openSessions.length ? (
              <ul className="space-y-3">
                {data.openSessions.map((session) => (
                  <li key={session.id}>
                    <Link href="/buyer/receiving" className="block rounded-xl border border-border p-3 transition hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-primary">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{session.reference}</p>
                        <Badge tone="warning">{int(session.scannedBales)} / {int(session.expectedBales)} scanned</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{session.shipmentReference ? `${session.shipmentReference} · ` : ""}{session.purchaseReference}</p>
                      <ProgressBar className="mt-2" value={session.scannedBales} max={session.expectedBales} label={`${session.reference} scanned`} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No open receiving sessions.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent purchases</CardTitle>
            <CardDescription>Latest by sale date{data.filters.from || data.filters.to || data.filters.floor ? " for this selection" : ""}.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentPurchases.length ? (
              <ul className="divide-y divide-border">
                {data.recentPurchases.map((p) => (
                  <li key={p.id}>
                    <Link href={`/buyer/purchases/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-primary">
                      <div>
                        <p className="font-medium">{p.reference}</p>
                        <p className="text-xs text-muted-foreground">{p.floorName} · {formatDocDate(p.saleDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="tabular font-medium">{usd(p.totalUsdValue)}</p>
                        <p className="text-xs text-muted-foreground">{int(p.totalBales)} bales · <Badge tone={statusTone(p.receivingStatus)}>{humanizeStatus(p.receivingStatus)}</Badge></p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={ShoppingBag} title="No purchases match" description="Try a wider range of sale dates, or import a Flow Disk to get started." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stage({ n, icon: Icon, title, hint, stage, href, testId, tone }: { n: number; icon: typeof Truck; title: string; hint: string; stage: DashboardShipmentStage; href: string; testId: string; tone: "warning" | "primary" }) {
  const busy = stage.count > 0;
  return (
    <li>
      <Link href={href} data-testid={testId} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
        <div className={cn("flex h-full flex-col gap-2 rounded-2xl border bg-surface p-4 shadow-card transition-colors hover:border-primary/50", busy ? (tone === "warning" ? "border-warning/50" : "border-primary/40") : "border-border")}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium"><span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", busy ? (tone === "warning" ? "bg-warning-soft text-warning-text" : "bg-primary-soft text-primary-soft-foreground") : "bg-surface-tertiary text-muted-foreground")} aria-hidden>{n}</span>{title}</span>
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className={cn("tabular text-3xl font-semibold leading-none tracking-tight", !busy && "text-muted-foreground")} data-testid={`${testId}-count`}>{int(stage.count)}</p>
          <p className="text-xs text-muted-foreground">{busy ? `${int(stage.bales)} bales · ${kg(stage.massKg)}` : hint}</p>
        </div>
      </Link>
    </li>
  );
}

function ShipmentList({ title, description, items, total, empty, testId }: { title: string; description: string; items: DashboardShipmentItem[]; total: number; empty: string; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border p-3" data-testid="dashboard-shipment">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{item.reference}</p>
                  <Badge tone={statusTone(item.status)} dot>{humanizeStatus(item.status)}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.purchaseReference} · {item.truck} · dispatched {formatDocDate(item.dispatchDate)}
                  {item.status === "IN_TRANSIT" ? ` · ${item.daysSinceDispatch} day${item.daysSinceDispatch === 1 ? "" : "s"} on the road` : ""}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar className="flex-1" value={item.receivedBales} max={item.expectedBales} tone={item.receivedBales >= item.expectedBales ? "success" : "primary"} label={`${item.reference} received`} />
                  <span className="tabular whitespace-nowrap text-xs text-muted-foreground">{int(item.receivedBales)} / {int(item.expectedBales)} bales</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {total > items.length ? <p className="mt-3 text-xs text-muted-foreground">Showing {items.length} of {int(total)}. <Link href="/buyer/shipments" className="font-medium text-primary hover:underline">See all</Link></p> : null}
      </CardContent>
    </Card>
  );
}

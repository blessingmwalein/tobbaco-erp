"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarCheck,
  ClipboardList,
  Layers,
  ListChecks,
  PackageCheck,
  Printer,
  ScanLine,
  Truck,
  Users,
  Warehouse,
  AlertCircle,
  AlertTriangle,
  Info,
  Percent,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  NativeSelect,
  PageHeader,
  Skeleton,
  StatCard,
  Timeline,
  cn,
} from "@tobacco/ui";
import { SALE_STAGE_LABEL, formatDateTime, formatRate, longDate } from "@tobacco/shared";
import { BaleProgressChart, GrowerDeliveryChart } from "@/components/charts/dashboard-charts";
import { StagePipeline } from "@/components/domain/stage-pipeline";
import { StatusBadge } from "@/components/domain/status-badge";
import { useDashboardModel } from "@/lib/use-dashboard";
import { useDb } from "@/mock/hooks";

const SEVERITY_ICON = { error: AlertCircle, warning: AlertTriangle, info: Info } as const;
const SEVERITY_TONE = {
  error: "bg-danger-soft text-danger-text",
  warning: "bg-warning-soft text-warning-text",
  info: "bg-primary-soft text-primary-soft-foreground",
} as const;

export default function DashboardPage() {
  const { ctx, date, setDate, dates, data: model, isLoading } = useDashboardModel();
  const activity = useDb((db) => db.audit.slice(0, 6));

  return (
    <>
      <PageHeader
        title="Sale day dashboard"
        description={`${ctx.sellingPoint.name} · Season ${ctx.seasonYear} · ${longDate(date)}`}
        badges={
          model ? (
            <>
              <Badge tone={model.stats.saleDateActive ? "success" : "warning"} dot>
                {model.stats.saleDateActive ? "Sale date active" : "No sale date"}
              </Badge>
              <Badge tone={model.stats.startOfDayPosted ? "success" : "warning"} dot>
                {model.stats.startOfDayPosted ? `Start of Day · ${formatRate(model.stats.exchangeRate ?? "0")}` : "Start of Day not posted"}
              </Badge>
            </>
          ) : null
        }
        actions={
          <>
            <label className="sr-only" htmlFor="sale-date-filter">
              Sale date
            </label>
            <NativeSelect id="sale-date-filter" value={date} onChange={(e) => setDate(e.target.value)} wrapperClassName="w-64" aria-label="Sale date">
              {dates.map((d) => (
                <option key={d} value={d}>
                  {longDate(d)}
                  {d === ctx.today ? " (today)" : ""}
                </option>
              ))}
            </NativeSelect>
            <label className="sr-only" htmlFor="selling-point-filter">
              Selling point
            </label>
            <NativeSelect id="selling-point-filter" value={ctx.sellingPoint.id} onChange={() => {}} wrapperClassName="w-60" aria-label="Selling point">
              <option value={ctx.sellingPoint.id}>
                {ctx.sellingPoint.code} · {ctx.sellingPoint.name}
              </option>
            </NativeSelect>
            <Button asChild variant="secondary">
              <Link href="/sale-day">Workflow detail</Link>
            </Button>
          </>
        }
      />

      {isLoading || !model ? (
        <DashboardSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Where is the day?</CardTitle>
                <CardDescription>Eleven stages, nine manuals, one lifecycle. Select a stage to open its workspace.</CardDescription>
              </div>
              {model.nextAction ? (
                <Button asChild size="sm" data-testid="next-action">
                  <Link href={model.nextAction.href}>
                    Next: {model.nextAction.label.length > 48 ? `${model.nextAction.label.slice(0, 48)}…` : model.nextAction.label}
                    <ArrowRight />
                  </Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <StagePipeline stages={model.stages} />
              {model.stages.some((s) => s.status === "BLOCKED") ? (
                <ul className="mt-4 flex flex-col gap-1.5">
                  {model.stages
                    .filter((s) => s.status === "BLOCKED")
                    .map((s) => (
                      <li key={s.stage} className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-text">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>
                          <strong className="font-semibold">Blocked — </strong>
                          {s.blockedReason}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Sale date"
              icon={CalendarCheck}
              tone={model.stats.saleDateActive ? "success" : "warning"}
              value={model.stats.saleDateActive ? "Active" : "Not set"}
              hint={model.stats.canScanFloor ? "Floor scanning on" : "Floor scanning off"}
            />
            <StatCard
              label="Exchange rate"
              icon={Percent}
              tone="primary"
              value={model.stats.exchangeRate ? formatRate(model.stats.exchangeRate) : "—"}
              hint={model.stats.startOfDayPosted ? "Start of Day posted" : "Start of Day pending"}
            />
            <StatCard label="TIMB bookings" icon={ClipboardList} value={model.stats.bookingsCount} hint={`${model.stats.balesBooked} bales booked`} />
            <StatCard label="Trucks · growers" icon={Truck} value={`${model.stats.trucksReceived} · ${model.stats.growersReceived}`} hint="received" />
            <StatCard label="Bales received" icon={PackageCheck} value={model.stats.balesReceived} hint={`of ${model.stats.balesBooked} booked`} />
            <StatCard label="Tickets" icon={Printer} value={model.stats.ticketsConfirmed} hint={`confirmed · ${model.stats.ticketsPending} pending`} />
            <StatCard
              label="Floor summary"
              icon={ScanLine}
              value={`${model.stats.floorDeliveriesLaid}/${model.stats.floorDeliveriesTotal}`}
              hint={`deliveries laid · ${model.stats.balesScanned} bales scanned`}
            />
            <StatCard label="Awaiting data capture" icon={Users} tone={model.stats.balesAwaitingCapture ? "warning" : "neutral"} value={model.stats.balesAwaitingCapture} hint="bales missing grade, buyer or price" />
            <StatCard
              label="Sales"
              icon={Layers}
              value={`${model.stats.draftSales} · ${model.stats.balancedSales} · ${model.stats.processedSales}`}
              hint="draft · balanced · processed"
            />
            <StatCard
              label="Approvals"
              icon={ListChecks}
              tone={model.stats.pendingApprovals ? "warning" : "neutral"}
              value={model.stats.pendingApprovals}
              hint={`pending · ${model.stats.pendingStopOrders} stop orders to deduct`}
            />
            <StatCard label="Payment batches" icon={BadgeDollarSign} value={model.stats.payBatches} hint={`${model.stats.paymentLinesPaid}/${model.stats.paymentLinesTotal} payments confirmed`} />
            <StatCard
              label="Dispatch"
              icon={Warehouse}
              value={`${model.stats.balesDispatched}/${model.stats.balesReleasable}`}
              hint={`bales dispatched · ${model.stats.draftDispatchNotes} draft notes`}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Bales through the day</CardTitle>
                  <CardDescription>Where bales are queuing between stages</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <BaleProgressChart data={model.charts.baleProgress} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Outstanding exceptions</CardTitle>
                  <CardDescription>{model.exceptions.length === 0 ? "Nothing needs attention" : `${model.exceptions.length} item(s)`}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {model.exceptions.length === 0 ? (
                  <EmptyState title="All clear" description="No delays or exceptions for this sale day." className="py-8" />
                ) : (
                  <ul className="flex flex-col gap-2" data-testid="exceptions">
                    {model.exceptions.map((e) => {
                      const Icon = SEVERITY_ICON[e.severity];
                      return (
                        <li key={e.id}>
                          <Link href={e.href} className={cn("flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-opacity hover:opacity-80", SEVERITY_TONE[e.severity])}>
                            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span className="min-w-0">
                              <span className="block font-medium">{e.title}</span>
                              <span className="block text-xs opacity-90">{e.detail}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Booked vs received by grower</CardTitle>
                  <CardDescription>Bales booked with TIMB against bales received</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {model.charts.perGrower.length === 0 ? (
                  <EmptyState title="No bookings or deliveries" description="Import the day's bookings to see growers here." className="py-10" />
                ) : (
                  <GrowerDeliveryChart data={model.charts.perGrower} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Recent activity</CardTitle>
                  <CardDescription>Latest audited actions</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/audit">All</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <Timeline
                  items={activity.map((a) => ({
                    id: a.id,
                    tone: "primary",
                    title: a.action,
                    meta: formatDateTime(a.at),
                    body: `${a.userName}${a.entityRef ? ` · ${a.entityRef}` : ""}`,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Stage detail</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {model.stages.map((s) => (
                  <li key={s.stage}>
                    <Link href={s.href} className="flex h-full flex-col gap-1.5 rounded-xl border border-border p-3 transition-colors hover:border-primary hover:bg-primary-soft/30">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {SALE_STAGE_LABEL[s.stage]} <span className="font-normal text-muted-foreground">· {s.manual}</span>
                        </span>
                        <StatusBadge kind="stage" value={s.status} />
                      </span>
                      <span className="text-sm text-muted-foreground">{s.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

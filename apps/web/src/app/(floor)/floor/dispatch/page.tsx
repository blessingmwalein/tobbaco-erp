"use client";

import Link from "next/link";
import { ArrowRight, PackageOpen, Truck } from "lucide-react";
import { Badge, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, DemoBadge, EmptyState, Skeleton } from "@tobacco/ui";
import { formatDateTime } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { InitiateDispatchCard } from "@/components/dispatch/initiate-form";
import { WorkspaceHeader } from "@/components/floor/workspace";
import { useDbQuery } from "@/mock/hooks";
import { selectDispatchHub } from "@/mock/domain/dispatch";

export default function FloorDispatchPage() {
  const { data: hub, isLoading } = useDbQuery(["dispatch", "hub"], selectDispatchHub, { latency: 0 });

  return (
    <RequirePermission permission="dispatch.view">
      <WorkspaceHeader
        title="Floor dispatch"
        subtitle="Sold bales leave the floor on trucks for the buyer's packing warehouse. Open a note, scan each bale ticket, post."
        chips={
          hub ? (
            <>
              <Badge tone={hub.drafts.length ? "warning" : "outline"} dot>
                {hub.drafts.length} draft note{hub.drafts.length === 1 ? "" : "s"}
              </Badge>
              <Badge tone="outline">Manual 09</Badge>
            </>
          ) : null
        }
      />

      {isLoading || !hub ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <Skeleton className="h-[28rem] rounded-2xl xl:col-span-2" />
          <Skeleton className="h-[28rem] rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-6 xl:col-span-2">
            {hub.unreleasedBales > 0 ? (
              <Callout tone="warning" title={`${hub.unreleasedBales} bale(s) are in sales that have not been released`}>
                Dispatch refuses bales from unreleased sales. Who releases a sale at Ethical is unconfirmed (UQ-03); in this demo the Data Processing
                Supervisor releases it from <Link href="/sales" className="font-medium underline">Sales &amp; balancing</Link>.
              </Callout>
            ) : null}
            <InitiateDispatchCard />
          </div>

          <div className="flex flex-col gap-6">
            <Card data-testid="draft-notes">
              <CardHeader>
                <div>
                  <CardTitle>Draft notes — resume loading</CardTitle>
                  <CardDescription>Notes that are still being loaded</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {hub.drafts.length === 0 ? (
                  <EmptyState icon={Truck} title="No draft notes" description="Initiate a dispatch to start loading a truck." className="py-8" />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {hub.drafts.map(({ note }) => (
                      <li key={note.id}>
                        <Link
                          href={`/floor/dispatch/${note.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:border-primary hover:bg-primary-soft/30"
                          data-testid={`resume-${note.id}`}
                        >
                          <span className="min-w-0">
                            <span className="block font-mono text-sm font-medium">{note.ref}</span>
                            <span className="block text-xs text-muted-foreground">
                              {note.warehouseCode} · {note.totalBales} bales · {note.totalMass} kg
                            </span>
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Bales ready to dispatch</CardTitle>
                  <CardDescription>Released, not rejected, not yet on a note</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <ul className="flex flex-col divide-y divide-border">
                  {hub.overview.map((o) => (
                    <li key={o.warehouse.code} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {o.warehouse.code}
                          {o.warehouse.isDemo ? <DemoBadge /> : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {o.buyers.length ? `Buyers: ${o.buyers.map((b) => b.code).join(", ")}` : "No buyer packs here"}
                        </span>
                      </span>
                      <span className="tabular text-right">
                        <span className="block text-lg font-semibold leading-none">{o.readyBales}</span>
                        <span className="text-xs text-muted-foreground">{o.readyMassKg} kg</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {hub.recentPosted.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Recently posted</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <ul className="flex flex-col gap-2">
                    {hub.recentPosted.map(({ note }) => (
                      <li key={note.id} className="flex items-center justify-between gap-3 text-sm">
                        <Link href={`/floor/dispatch/${note.id}`} className="font-mono font-medium text-primary hover:underline">
                          {note.ref}
                        </Link>
                        <span className="text-xs text-muted-foreground">{formatDateTime(note.postedAt)}</span>
                        <StatusBadge kind="dispatch" value={note.state} />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <PackageOpen className="size-3.5" aria-hidden /> Destination warehouses CURVERID and DEMOWH2 are fixtures — the sandbox had none configured (UQ-12).
      </p>
    </RequirePermission>
  );
}

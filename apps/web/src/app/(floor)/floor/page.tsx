"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge, Card, PageHeader } from "@tobacco/ui";
import { FLOOR_STATIONS } from "@/lib/nav";
import { usePermissions } from "@/lib/permissions";
import { selectSaleContext } from "@/lib/sale-context";
import { useDb } from "@/mock/hooks";

export default function FloorHubPage() {
  const perms = usePermissions();
  const ctx = useDb(selectSaleContext);
  const stats = useDb((db) => ({
    "/floor/receiving": `${db.transporterNotes.filter((t) => t.state === "OPEN").length} open truck notes`,
    "/floor/tickets": `${db.deliveryNotes.filter((d) => d.state === "TICKETS_PRINTING").length} waiting to print`,
    "/floor/floor-summary": `${db.deliveryNotes.filter((d) => d.state === "CHECKED").length} deliveries to scan`,
    "/floor/data-capture": `${db.sales.filter((s) => s.status === "DRAFT" && s.saleDate === db.settings.demoToday).length} draft sales`,
    "/floor/dispatch": `${db.dispatchNotes.filter((d) => d.state === "DRAFT").length} draft dispatch notes`,
  }));

  return (
    <>
      <PageHeader
        title="Floor workspaces"
        description="Keyboard- and scanner-first stations for the sale floor. Large fields, instant feedback, no modal per scan."
        badges={
          <Badge tone={ctx.startOfDayPosted && ctx.saleDateIsCurrent ? "success" : "warning"} dot>
            {ctx.startOfDayPosted && ctx.saleDateIsCurrent ? "Sale day ready" : "Daily setup incomplete"}
          </Badge>
        }
      />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FLOOR_STATIONS.map((s) => {
          const allowed = perms.has(s.permission);
          const Icon = s.icon;
          const body = (
            <Card className={`flex h-full flex-col gap-3 p-5 transition-colors ${allowed ? "hover:border-primary" : "bg-surface-secondary"}`}>
              <div className="flex items-start justify-between">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="size-6" aria-hidden />
                </span>
                {allowed ? <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden /> : <Badge tone="outline">No access</Badge>}
              </div>
              <div>
                <p className="text-lg font-semibold">{s.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                <span>{s.manual}</span>
                <span className="font-medium text-foreground">{stats[s.href as keyof typeof stats]}</span>
              </div>
            </Card>
          );
          return (
            <li key={s.href}>
              {allowed ? (
                <Link href={s.href} className="block h-full rounded-2xl" data-testid={`station-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

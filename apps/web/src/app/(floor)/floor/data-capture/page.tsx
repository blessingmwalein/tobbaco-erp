"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ClipboardList, Layers3, LogOut, ShoppingCart } from "lucide-react";
import { Badge, Button, Card } from "@tobacco/ui";
import { RequirePermission } from "@/components/page-guard";
import { WorkspaceHeader } from "@/components/floor/workspace";
import { usePermissions } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { useDb } from "@/mock/hooks";
import { selectCaptureQueue } from "@/mock/domain/data-capture";

const STATIONS = [
  { href: "/floor/data-capture/classification", label: "Classification", icon: ClipboardList, text: "TIMB grade or reason and hessian owner", needs: ["data-capture.classify"] as const },
  { href: "/floor/data-capture/e-buying", label: "e-Buying", icon: ShoppingCart, text: "Buyer, buyer grade, price and sale code", needs: ["data-capture.capture-buyer"] as const },
  { href: "/floor/data-capture/all-details", label: "All Details", icon: Layers3, text: "Classification and e-Buying on one form", needs: ["data-capture.classify", "data-capture.capture-buyer"] as const },
];

/** Data capture home (Manual 06, Step 1): choose the station for your job. */
export default function DataCaptureHome() {
  const router = useRouter();
  const perms = usePermissions();
  const signOut = useSession((s) => s.signOut);
  const queue = useDb(selectCaptureQueue);
  const done = queue.filter((q) => q.complete).length;

  return (
    <RequirePermission permission="data-capture.view">
      <WorkspaceHeader
        title="Data Capturing"
        subtitle="Choose the station for your job."
        chips={
          <Badge tone="primary">
            {done} of {queue.length} bales complete
          </Badge>
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              signOut();
              router.replace("/login");
            }}
          >
            <LogOut /> Log Out of System
          </Button>
        }
      />
      <ul className="grid gap-4 md:grid-cols-3" data-testid="capture-stations">
        {STATIONS.map((s) => {
          const allowed = s.needs.every((p) => perms.has(p));
          const Icon = s.icon;
          const card = (
            <Card className={`flex h-full flex-col gap-4 p-6 transition-colors ${allowed ? "hover:border-primary" : "bg-surface-secondary"}`}>
              <div className="flex items-start justify-between">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="size-7" aria-hidden />
                </span>
                {allowed ? <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden /> : <Badge tone="outline">No access</Badge>}
              </div>
              <div>
                <p className="text-xl font-semibold">{s.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            </Card>
          );
          return (
            <li key={s.href}>
              {allowed ? (
                <Link href={s.href} className="block h-full rounded-2xl" data-testid={`station-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>
    </RequirePermission>
  );
}

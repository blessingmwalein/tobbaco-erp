"use client";

import { Printer } from "lucide-react";
import { Badge, Card, CardContent } from "@tobacco/ui";
import { RequirePermission } from "@/components/page-guard";
import { WorkspaceHeader } from "@/components/floor/workspace";
import { DeliveryQueue } from "@/components/tickets/delivery-queue";
import { selectSaleContext } from "@/lib/sale-context";
import { useSession } from "@/lib/session";
import { useDb } from "@/mock/hooks";

export default function FloorTicketsPage() {
  const ctx = useDb(selectSaleContext);
  const userId = useSession((s) => s.userId);
  const next = useDb((db) => (userId ? db.userNextBarcode[userId] : undefined));
  return (
    <RequirePermission permission="tickets.view">
      <WorkspaceHeader
        title={
          <span className="flex items-center gap-3">
            <Printer className="size-8 text-primary" aria-hidden /> Ticket Printing
          </span>
        }
        subtitle="Each line is a delivery waiting for tickets: give its bales a run of barcodes from your roll, print, then confirm."
        chips={
          <Badge tone={ctx.saleDateIsCurrent ? "success" : "danger"} dot>
            {ctx.saleDateIsCurrent ? "Sale date active" : "Please set a sale date"}
          </Badge>
        }
        actions={
          <Card>
            <CardContent className="px-4 py-2">
              <p className="text-xs text-muted-foreground">Your next barcode</p>
              <p className="font-mono text-lg font-semibold" data-testid="roll-next">
                {next ?? "Not set"}
              </p>
            </CardContent>
          </Card>
        }
      />
      <DeliveryQueue hrefBase="/floor/tickets" />
    </RequirePermission>
  );
}

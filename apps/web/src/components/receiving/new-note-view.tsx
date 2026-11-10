"use client";

import Link from "next/link";
import { ArrowRight, PackageOpen, ScanLine } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Callout, EmptyState } from "@tobacco/ui";
import { formatDateTime } from "@tobacco/shared";
import { StatusBadge } from "@/components/domain/status-badge";
import { selectSaleContext } from "@/lib/sale-context";
import { createTransporterNote, deliveryTally } from "@/mock/domain/receiving";
import { useAction, useDb } from "@/mock/hooks";
import { TransporterForm } from "./transporter-form";

/** Step 1 of Manual 03: create the transporter delivery note — plus a way back to open notes and open deliveries. */
export function NewNoteView({ onOpen }: { onOpen: (id: string) => void }) {
  const ctx = useDb(selectSaleContext);
  const { run, isPending } = useAction(createTransporterNote, { silent: true });
  const notes = useDb((db) => [...db.transporterNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6));
  const waiting = useDb((db) =>
    db.deliveryNotes
      .filter((d) => d.state === "OPEN")
      .map((d) => ({ note: d, tally: deliveryTally(db, d) })),
  );
  const canCreate = ctx.saleDateIsCurrent;

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-2">
        <CardHeader>
          <div>
            <CardTitle className="text-lg">Create a new Delivery Note</CardTitle>
            <CardDescription>A truck has arrived: record the transporter, then the growers on board.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!canCreate ? (
            <Callout tone="warning" title={ctx.activeSaleDate ? "Date has expired. Please set a valid sale date" : "Please set a sale date"}>
              Growers can't be added until today's receiving sale date is active (Manual 01, Step 1).{" "}
              <Link href="/setup/sale-dates" className="font-medium underline">
                Set the sale date
              </Link>
            </Callout>
          ) : null}
          <TransporterForm
            autoFocus
            submitLabel="Create Transporter Delivery Note"
            loading={isPending}
            onSubmit={async (values) => {
              const res = await run(values);
              if (res.ok) {
                onOpen(res.data.id);
                return null;
              }
              return res.error.message;
            }}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6 xl:col-span-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Deliveries waiting for bale capture</CardTitle>
              <CardDescription>Open grower delivery notes — weigh, scan and save each bale.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {waiting.length === 0 ? (
              <EmptyState icon={PackageOpen} title="No open deliveries" description="Complete a transporter delivery note to create grower delivery notes." className="py-8" />
            ) : (
              <ul className="flex flex-col gap-2" data-testid="open-deliveries">
                {waiting.map(({ note, tally }) => (
                  <li key={note.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3">
                    <span className="font-mono text-sm font-semibold">{note.docNo}</span>
                    <span className="text-sm">{note.growerNo}</span>
                    <Badge tone={tally.balanced ? "success" : "neutral"}>
                      {tally.captured} of {tally.declared} bales
                    </Badge>
                    <Button asChild size="sm" className="ml-auto">
                      <Link href={`/floor/receiving/${note.id}/bales`}>
                        <ScanLine /> Capture bales
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Transporter delivery notes</CardTitle>
              <CardDescription>Most recent first — open one to continue or review it.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {notes.length === 0 ? (
              <EmptyState title="No transporter notes yet" className="py-8" />
            ) : (
              <ul className="flex flex-col gap-2" data-testid="recent-notes">
                {notes.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(n.id)}
                      className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary-soft/30"
                    >
                      <span className="font-mono text-sm font-semibold">{n.docNo}</span>
                      <span className="text-sm">{n.transporterName}</span>
                      <span className="font-mono text-xs text-muted-foreground">{n.vehicleReg}</span>
                      <span className="text-xs text-muted-foreground">
                        {n.growers.length} growers · {n.growers.reduce((a, g) => a + g.bales, 0)} bales · {formatDateTime(n.createdAt)}
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        <StatusBadge kind="transporterNote" value={n.state} />
                        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

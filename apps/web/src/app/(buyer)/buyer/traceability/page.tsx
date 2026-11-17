"use client";

import { useState } from "react";
import { Check, Copy, History, Package, Search, Truck, Warehouse } from "lucide-react";
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  EmptyState, ErrorState, Input, KeyValue, Skeleton, toast,
} from "@tobacco/ui";
import type { BaleTimelineDto, BaleTimelineEventDto } from "@tobacco/shared";
import { describeError, useBuyerQuery } from "@/lib/api";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { PageIntro } from "../_components/buyer-data";

// ── Helpers ───────────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success("Barcode copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy barcode"
      className="ml-1.5 inline-flex items-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-surface-tertiary hover:text-foreground"
      aria-label="Copy barcode"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

const EVENT_ICONS: Record<string, string> = {
  PURCHASED:         "💰",
  IMPORTED:          "📥",
  RECEIVED:          "📦",
  STORED:            "🏭",
  MOVED:             "↔",
  DISPATCHED:        "🚚",
  RETURNED:          "↩",
  RE_IDENTIFIED:     "🔄",
  EXCEPTION_FLAGGED: "⚠",
};

function eventTone(type: string): "success" | "warning" | "danger" | "neutral" {
  if (["RECEIVED", "STORED", "PURCHASED", "IMPORTED"].includes(type)) return "success";
  if (["DISPATCHED", "MOVED"].includes(type)) return "warning";
  if (["EXCEPTION_FLAGGED"].includes(type)) return "danger";
  return "neutral";
}

// ── Bale detail cards ─────────────────────────────────────────────────────────

function BaleDetailsPanel({ bale }: { bale: Record<string, unknown> }) {
  const barcode = String(bale.barcode ?? "");

  // Group fields into logical sections
  const identity = [
    { label: "Barcode",     value: barcode },
    { label: "Season",      value: bale.season },
    { label: "Status",      value: bale.status },
  ];
  const grading = [
    { label: "Buyer grade", value: bale.buyerGrade },
    { label: "TIMB grade",  value: bale.timbGrade ?? "—" },
    { label: "Grower no.",  value: bale.growerNo },
    { label: "Lot no.",     value: bale.lotNo },
  ];
  const financials = [
    { label: "Mass (kg)",   value: bale.massKg },
    { label: "USc / kg",    value: bale.uscPerKg },
    { label: "USD value",   value: bale.usdValue },
  ];
  const location = [
    { label: "Received at",    value: bale.receivedAt ? new Date(String(bale.receivedAt)).toLocaleString() : "—" },
  ];

  return (
    <div className="space-y-4">

      {/* Identity */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-1 font-mono text-base">
                {barcode}
                {barcode && <CopyButton value={barcode} />}
              </CardTitle>
              <CardDescription>Bale identity</CardDescription>
            </div>
            <Badge tone={String(bale.status) === "IN_STOCK" ? "success" : String(bale.status) === "DISPATCHED" ? "warning" : "neutral"}>
              {String(bale.status ?? "—").replace(/_/g, " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <KeyValue columns={2} items={[
            { label: "Season",  value: String(bale.season ?? "—") },
            { label: "Purchase", value: String(bale.purchaseId ?? "—") },
          ]} />
        </CardContent>
      </Card>

      {/* Grading */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="size-4 text-muted-foreground" /> Grade &amp; Origin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue columns={2} items={grading.map((g) => ({ label: g.label, value: String(g.value ?? "—") }))} />
        </CardContent>
      </Card>

      {/* Financials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">$</span> Financials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue columns={1} items={financials.map((f) => ({ label: f.label, value: String(f.value ?? "—") }))} />
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Warehouse className="size-4 text-muted-foreground" /> Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue columns={1} items={location} />
        </CardContent>
      </Card>

    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function TimelinePanel({ events }: { events: BaleTimelineEventDto[] }) {
  if (!events.length) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState icon={History} title="No timeline events" description="No events have been recorded for this bale." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" /> Event timeline
        </CardTitle>
        <CardDescription>{events.length} event{events.length !== 1 ? "s" : ""} recorded</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-0" aria-label="Bale event timeline">
          {events.map((event, i) => (
            <li key={event.id} className="flex gap-4">
              {/* Spine */}
              <div className="flex flex-col items-center">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface text-sm">
                  {EVENT_ICONS[event.type] ?? "●"}
                </span>
                {i < events.length - 1 && <div className="w-px flex-1 bg-border" />}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={eventTone(event.type)} className="shrink-0">
                    {event.type.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleString()}
                    {event.performedByName ? ` · ${event.performedByName}` : ""}
                  </span>
                </div>
                {(event.fromLabel || event.toLabel) && (
                  <p className="mt-1 flex items-center gap-1 text-sm">
                    {event.fromLabel && <span className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs">{event.fromLabel}</span>}
                    {event.fromLabel && event.toLabel && <Truck className="size-3 shrink-0 text-muted-foreground" />}
                    {event.toLabel && <span className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs">{event.toLabel}</span>}
                  </p>
                )}
                {event.refLabel && !event.fromLabel && (
                  <p className="mt-1 text-sm text-muted-foreground">{event.refLabel}</p>
                )}
                {event.notes && (
                  <p className="mt-1 text-sm text-muted-foreground">{event.notes}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TraceabilityPage() {
  const [value, setValue]     = useState("");
  const [barcode, setBarcode] = useState("");

  const result = useBuyerQuery<BaleTimelineDto>(
    barcode ? `/buyer/traceability/${encodeURIComponent(barcode)}` : "/buyer/traceability/none",
    undefined,
    { enabled: Boolean(barcode), key: ["traceability", barcode] },
  );

  return (
    <RequireBuyerPermission permission="buyer.traceability.view">
      <PageIntro
        title="Bale traceability"
        description="Follow a bale from purchase through receiving, storage and processing."
      />

      {/* Search bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form
            className="flex max-w-lg gap-2"
            onSubmit={(e) => { e.preventDefault(); setBarcode(value.trim()); }}
            aria-label="Find a bale"
          >
            <div className="relative flex-1">
              <label htmlFor="bale-barcode" className="sr-only">Bale barcode</label>
              <Input
                id="bale-barcode"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter 10-character barcode"
                autoComplete="off"
                className="pr-9 font-mono"
              />
              {value && (
                <CopyButton value={value} />
              )}
            </div>
            <Button type="submit" disabled={!value.trim()}>
              <Search className="size-4" /> Find bale
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading */}
      {barcode && result.isLoading && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-28 w-full rounded-2xl" />)}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      )}

      {/* Error */}
      {barcode && result.isError && (
        <ErrorState
          title="Bale not found"
          description={describeError(result.error)}
          action={<Button variant="secondary" onClick={() => void result.refetch()}>Try again</Button>}
        />
      )}

      {/* Result */}
      {barcode && result.data && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <BaleDetailsPanel bale={result.data.bale} />
          <TimelinePanel events={result.data.events} />
        </div>
      )}

      {/* Empty state */}
      {!barcode && (
        <EmptyState
          icon={History}
          title="Search for a bale"
          description="Enter a barcode above to view the full traceability history."
        />
      )}
    </RequireBuyerPermission>
  );
}

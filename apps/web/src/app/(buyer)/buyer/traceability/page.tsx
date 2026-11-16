"use client";

import { useState } from "react";
import { History, Search } from "lucide-react";
import { Button, Card, CardContent, EmptyState, ErrorState, PageHeader, Skeleton } from "@tobacco/ui";
import type { BaleTimelineDto } from "@tobacco/shared";
import { describeError, useBuyerQuery } from "@/lib/api";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";

export default function TraceabilityPage() {
  const [value, setValue] = useState("");
  const [barcode, setBarcode] = useState("");
  const result = useBuyerQuery<BaleTimelineDto>(barcode ? `/buyer/traceability/${encodeURIComponent(barcode)}` : "/buyer/traceability/none", undefined, { enabled: Boolean(barcode), key: ["traceability", barcode] });
  return (
    <RequireBuyerPermission permission="buyer.traceability.view">
      <PageHeader title="Bale traceability" description="Follow a bale from purchase through receiving, storage and processing." />
      <Card>
        <CardContent className="pt-6">
          <form className="flex max-w-xl gap-2" onSubmit={(event) => { event.preventDefault(); setBarcode(value.trim()); }} aria-label="Find a bale">
            <label htmlFor="bale-barcode" className="sr-only">Bale barcode</label>
            <input id="bale-barcode" className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter the 10-character barcode" autoComplete="off" />
            <Button type="submit" disabled={!value.trim()}><Search aria-hidden /> Find bale</Button>
          </form>
        </CardContent>
      </Card>
      {barcode && result.isLoading ? <Skeleton className="mt-6 h-96" /> : null}
      {barcode && result.isError ? <ErrorState title="Bale not found or unavailable" description={describeError(result.error)} action={<Button variant="secondary" onClick={() => void result.refetch()}>Try again</Button>} /> : null}
      {barcode && result.data ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_2fr]">
          <Card><CardContent className="pt-6"><h2 className="font-semibold">Bale details</h2><dl className="mt-4 space-y-3 text-sm">{Object.entries(result.data.bale).map(([key, item]) => <div key={key} className="flex justify-between gap-4 border-b border-border pb-2"><dt className="text-muted-foreground">{key}</dt><dd className="text-right font-medium">{String(item ?? "—")}</dd></div>)}</dl></CardContent></Card>
          <Card><CardContent className="pt-6"><h2 className="font-semibold">Timeline</h2>{result.data.events.length ? <ol className="mt-4 space-y-4" aria-label="Bale event timeline">{result.data.events.map((event) => <li key={event.id} className="border-l-2 border-primary/30 pl-4"><p className="font-medium">{event.type}</p><p className="text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString()} · {event.performedByName ?? "System"}</p><p className="mt-1 text-sm">{event.fromLabel && event.toLabel ? `${event.fromLabel} → ${event.toLabel}` : event.refLabel ?? event.notes ?? "Recorded event"}</p></li>)}</ol> : <EmptyState icon={History} title="No timeline events" description="No events have been recorded for this bale." />}</CardContent></Card>
        </div>
      ) : !barcode ? <EmptyState icon={History} title="Search for a bale" description="Enter a barcode to view its complete traceability history." /> : null}
    </RequireBuyerPermission>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CircleDot, ExternalLink, PackageSearch } from "lucide-react";
import {
  Badge,
  BarcodeScannerInput,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Kbd,
  ProgressBar,
  ScanHistory,
  Skeleton,
  cn,
  type ScanController,
  type ScanOutcome,
} from "@tobacco/ui";
import { formatDateTime } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { DispatchActionBar } from "@/components/dispatch/action-bar";
import { DispatchBalesTable } from "@/components/dispatch/bale-table";
import { DispatchSimulateChips } from "@/components/dispatch/simulate-chips";
import { BigNumberCard } from "@/components/dispatch/totals";
import { WorkspaceHeader, useScanFeed } from "@/components/floor/workspace";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import {
  PRODUCT_LABEL,
  finishLoading,
  removeDispatchBale,
  scanDispatchBale,
  selectDispatchCandidates,
  selectDispatchDetail,
} from "@/mock/domain/dispatch";

export default function DispatchWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useDbQuery(
    ["dispatch", "workspace", id],
    (db) => {
      const detail = selectDispatchDetail(db, id);
      return detail ? { ...detail, candidates: selectDispatchCandidates(db, detail.note) } : null;
    },
    { latency: 0 },
  );

  const { run: scan } = useAction(scanDispatchBale, { latency: 30, silent: true });
  const remove = useAction(removeDispatchBale, { latency: 30, success: "Bale removed from the note" });
  const done = useAction(finishLoading, { latency: 30, success: "Load marked as done — review the totals, then post" });
  const feed = useScanFeed(`dispatch-${id}`);
  const { track } = feed;
  const scanner = useRef<ScanController>(null);

  const onScan = useMemo(
    () =>
      track(async (barcode: string): Promise<ScanOutcome> => {
        const res = await scan({ dispatchId: id, barcode });
        return res.ok
          ? { ok: true, message: `Bale added · ${res.data.totalBales} on the note · ${res.data.totalMass} kg` }
          : { ok: false, message: res.error.message };
      }),
    [track, scan, id],
  );

  const note = data?.note;
  const canMarkDone = note?.state === "DRAFT" && note.totalBales > 0 && !note.loadingDoneAt;
  // F2 = Done (keyboard-first)
  useEffect(() => {
    if (!canMarkDone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        void done.run({ dispatchId: id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canMarkDone, done, id]);

  if (isLoading) {
    return (
      <RequirePermission permission="dispatch.view">
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-16 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </RequirePermission>
    );
  }

  if (!data || !note) {
    return (
      <RequirePermission permission="dispatch.view">
        <EmptyState
          icon={PackageSearch}
          title="Dispatch note not found"
          description="It may have been removed by resetting the demo data."
          action={
            <Button asChild variant="secondary">
              <Link href="/floor/dispatch">Back to floor dispatch</Link>
            </Button>
          }
        />
      </RequirePermission>
    );
  }

  const draft = note.state === "DRAFT";
  const posted = note.state === "POSTED";
  const cancelled = note.state === "CANCELLED";
  const loadingDone = Boolean(note.loadingDoneAt);
  const latestExport = data.exports[0];
  const target = note.totalBales + data.readyForDestination;
  const transport = note.noTransportDetails
    ? "No transportation details"
    : [note.transportName, note.truckReg, note.driver].filter(Boolean).join(" · ") || "—";

  const steps = [
    { label: "Scan bales", done: note.totalBales > 0 },
    { label: "Done — truck loaded", done: loadingDone || posted },
    { label: "Post the note", done: posted },
    { label: "Shipment file", done: data.exports.length > 0 },
  ];
  const current = cancelled ? -1 : steps.findIndex((s) => !s.done);

  return (
    <RequirePermission permission="dispatch.view">
      <WorkspaceHeader
        title={<span className="font-mono">{note.ref}</span>}
        subtitle={
          <>
            To <strong className="font-semibold text-foreground">{data.warehouse?.name ?? note.warehouseCode}</strong> · {PRODUCT_LABEL[note.product]} ·{" "}
            {transport}
          </>
        }
        chips={<StatusBadge kind="dispatch" value={note.state} />}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/floor/dispatch">
                <ArrowLeft /> All notes
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/dispatch/${note.id}`}>
                Back-office view <ExternalLink />
              </Link>
            </Button>
          </>
        }
      />

      {cancelled ? (
        <Callout tone="warning" title="This dispatch note was cancelled" className="mb-6">
          {note.cancelReason} — {data.cancelledByName}, {formatDateTime(note.cancelledAt)}. The note is kept (dispatch notes are never deleted) and its bales were released.
        </Callout>
      ) : null}
      {posted ? (
        <Callout tone="success" title="Dispatch note posted" className="mb-6">
          Posted {formatDateTime(note.postedAt)} by {data.postedByName}. Bales on a posted note cannot be changed; a supervisor can reset it to draft with a reason.
        </Callout>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col gap-3 p-5" data-testid="bales-card">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">Bales on this note</p>
            {draft && target > 0 && note.totalBales === target ? (
              <span className="rounded-full bg-success px-2.5 py-0.5 text-xs font-semibold text-success-foreground">All ready bales loaded</span>
            ) : null}
          </div>
          <p className="tabular text-5xl font-semibold leading-none tracking-tight" aria-live="polite" data-testid="total-bales">
            {note.totalBales}
            {draft ? <span className="ml-2 text-2xl font-medium text-muted-foreground">of {target} ready</span> : null}
          </p>
          <ProgressBar value={note.totalBales} max={Math.max(target, 1)} tone={note.totalBales === target && target > 0 ? "success" : "primary"} label="Bales loaded" />
        </Card>
        <BigNumberCard
          label="Total mass"
          value={note.totalMass}
          unit="kg"
          testId="total-mass"
          hint={`${data.buyers.length ? `Buyer ${data.buyers.map((b) => b.code).join(", ")}` : "No buyer packs at this warehouse"} · packs at ${note.warehouseCode}`}
        />
        <Card className="p-5" data-testid="steps-card">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Progress</p>
          <ol className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={s.label} className={cn("flex items-center gap-2.5 text-sm", i === current ? "font-semibold text-foreground" : s.done ? "text-foreground" : "text-muted-foreground")}>
                {s.done ? (
                  <Check className="size-4 text-success-text" aria-label="done" />
                ) : i === current ? (
                  <CircleDot className="size-4 text-primary" aria-label="current step" />
                ) : (
                  <span className="size-4 rounded-full border border-border-strong" aria-hidden />
                )}
                {s.label}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        {draft ? (
          <div className="flex flex-col gap-4 xl:col-span-2">
            <BarcodeScannerInput
              label="Scan bale ticket barcode"
              placeholder="Scan ticket barcode…"
              submitLabel="Save Bale"
              sound={feed.sound}
              onScan={onScan}
              controllerRef={scanner}
            />
            {/* Chips go through the scanner itself: same queue, inline feedback and refocus as a real scan. */}
            <DispatchSimulateChips candidates={data.candidates} onScan={(v) => scanner.current?.scan(v)} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {feed.accepted} accepted · {feed.rejected} rejected this session
              </span>
              <span>
                <Kbd>Enter</Kbd> saves · <Kbd>Tab</Kbd> moves · <Kbd>F2</Kbd> Done
              </span>
            </div>
            <ScanHistory entries={feed.entries} />
          </div>
        ) : null}

        <div className={cn("flex flex-col gap-4", draft ? "xl:col-span-3" : "xl:col-span-5")}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Bales loaded</CardTitle>
                <CardDescription>
                  {draft ? "Newest first. Remove Bale takes off a bale scanned by mistake." : cancelled ? "Bales were released when the note was cancelled." : "Locked — posted notes cannot be changed."}
                </CardDescription>
              </div>
              {loadingDone && draft ? (
                <Badge tone="success" dot>
                  Loading complete
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="pt-3">
              <DispatchBalesTable
                rows={data.bales}
                newestFirst
                pageSize={10}
                removing={remove.isPending}
                onRemove={draft ? (row) => void remove.run({ dispatchId: note.id, baleId: row.bale.id }) : undefined}
                emptyTitle="Nothing loaded yet"
                emptyDescription={draft ? "Scan the first bale ticket to start loading." : undefined}
                testId="loaded-bales"
              />
            </CardContent>
          </Card>

          <Card data-testid="next-step">
            <CardHeader>
              <div>
                <CardTitle>{draft ? (loadingDone ? "Review and post" : "Finish loading") : posted ? "Warehouse paperwork" : "Cancelled"}</CardTitle>
                <CardDescription>
                  {draft
                    ? loadingDone
                      ? "Check the bale count and mass, then Post. Posted notes are never deleted."
                      : "Click Done when the truck is loaded."
                    : posted
                      ? "Generate the warehouse's shipment file (demo format — UQ-12)."
                      : "No further actions."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 pt-3">
              {draft ? (
                <PermissionButton
                  permission="dispatch.scan"
                  variant={loadingDone ? "secondary" : "dark"}
                  size="lg"
                  loading={done.isPending}
                  disabled={note.totalBales === 0 || loadingDone}
                  disabledReason={note.totalBales === 0 ? "Scan at least one bale first." : loadingDone ? "Loading is already marked Done." : undefined}
                  onClick={() => void done.run({ dispatchId: note.id })}
                  data-testid="done-loading"
                >
                  <Check /> Done — truck loaded <Kbd className="ml-1 border-white/20 bg-white/10 text-inherit">F2</Kbd>
                </PermissionButton>
              ) : null}
              <DispatchActionBar note={note} latestExport={latestExport} size="lg" />
              {posted && latestExport ? (
                <Button asChild variant="ghost">
                  <Link href="/dispatch/shipments">
                    Shipment files <ExternalLink />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </RequirePermission>
  );
}

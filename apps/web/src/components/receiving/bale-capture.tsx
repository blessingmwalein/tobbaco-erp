"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowLeft, CheckCircle2, Scale as ScaleIcon, Undo2 } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataTable,
  DemoBadge,
  EmptyState,
  Field,
  Input,
  KeyValue,
  NativeSelect,
  ScanHistory,
  type ColumnDef,
} from "@tobacco/ui";
import { AppError, formatMessage, formatTime, type Bale, type DeliveryNote } from "@tobacco/shared";
import { baleCaptureFormSchema, type BaleCaptureForm } from "@tobacco/validation";
import { StatusBadge } from "@/components/domain/status-badge";
import { SimulateScan, TallyCard, WorkspaceHeader } from "@/components/floor/workspace";
import { PermissionButton } from "@/lib/permissions";
import { useUi } from "@/lib/ui-store";
import { captureBale, completeGrowerDelivery, deliveryTally, weighNextBale } from "@/mock/domain/receiving";
import { useAction, useDb } from "@/mock/hooks";
import { GrowerNoInput } from "./add-grower-form";
import { DeliveryStatusBar } from "./delivery-status-bar";
import { EjectBaleDialog } from "./eject-bale-dialog";

type Output = z.output<typeof baleCaptureFormSchema>;
const SCOPE = "receiving-bales";
const digits = (growerNo: string) => growerNo.replace(/^V/, "");

interface Feedback {
  ok: boolean;
  text: string;
  balanced?: boolean;
  key: number;
}

/** Bale capture for one grower delivery (Manual 03, Steps 4–5): scan the scale barcode, grower, group, lot → Save. */
export function BaleCaptureWorkspace({ gdnId }: { gdnId: string }) {
  const router = useRouter();
  const view = useDb((db) => {
    const note = db.deliveryNotes.find((d) => d.id === gdnId);
    if (!note) return null;
    const bales = db.bales.filter((b) => b.gdnId === gdnId && !b.ejected);
    return {
      note,
      grower: db.growers.find((g) => g.growerNo === note.growerNo),
      bales,
      tally: deliveryTally(db, note),
      readings: [...db.scaleReadings]
        .sort((a, b) => b.scaleBarcode.localeCompare(a.scaleBarcode))
        .map((r) => ({ ...r, bale: db.bales.find((b) => b.scaleBarcode === r.scaleBarcode && !b.ejected), gdn: db.deliveryNotes.find((d) => d.id === db.bales.find((b) => b.scaleBarcode === r.scaleBarcode && !b.ejected)?.gdnId) })),
      openNotes: db.deliveryNotes.filter((d) => d.state === "OPEN").map((d) => ({ note: d, tally: deliveryTally(db, d) })),
    };
  });
  const scanEntries = useUi((s) => s.scanHistory[SCOPE]) ?? [];
  const pushScan = useUi((s) => s.pushScan);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [eject, setEject] = useState<string | null>(null);
  const keyRef = useRef(0);
  /** The form registers a "fill the barcode field" callback here (scale-feed picks and simulated scans). */
  const fillRef = useRef<((barcode: string) => void) | null>(null);

  if (!view) return <EmptyState title="Delivery note not found" description="Return to receiving and pick a delivery." className="rounded-2xl border border-border bg-surface" />;
  const { note, grower, bales, tally, readings, openNotes } = view;
  const isOpen = note.state === "OPEN";
  const last = [...bales].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || Number(b.id.replace("bale-", "")) - Number(a.id.replace("bale-", "")))[0];
  const pending = readings.filter((r) => !r.bale);

  const columns: ColumnDef<Bale, unknown>[] = [
    { id: "n", header: "#", cell: ({ row }) => <span className="tabular text-muted-foreground">{row.index + 1}</span>, enableSorting: false },
    { accessorKey: "scaleBarcode", header: "Scale barcode", cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span> },
    { accessorKey: "group", header: "Group #" },
    { accessorKey: "lot", header: "Lot #" },
    { accessorKey: "mass", header: "Mass (kg)", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "capturedAt", header: "Captured", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatTime(getValue<string>())}</span> },
    {
      id: "eject",
      header: () => <span className="sr-only">Eject</span>,
      enableHiding: false,
      cell: ({ row }) => (
        <PermissionButton
          permission="receiving.eject-bale"
          variant="ghost"
          size="sm"
          aria-label={`Eject bale ${row.original.scaleBarcode}`}
          onClick={() => setEject(row.original.scaleBarcode)}
        >
          <Undo2 /> Eject
        </PermissionButton>
      ),
    },
  ];

  return (
    <>
      <WorkspaceHeader
        title="Bale capture"
        subtitle={
          <>
            <span className="font-mono">{note.docNo}</span> · {note.growerNo} {grower ? `${grower.firstName} ${grower.surname}` : ""} · Location {note.location}
          </>
        }
        chips={<StatusBadge kind="deliveryNote" value={note.state} />}
        actions={
          <>
            <label htmlFor="delivery-switch" className="sr-only">
              Switch delivery
            </label>
            <NativeSelect id="delivery-switch" value={note.id} onChange={(e) => router.push(`/floor/receiving/${e.target.value}/bales`)} wrapperClassName="w-72">
              {openNotes.some((o) => o.note.id === note.id) ? null : <option value={note.id}>{note.docNo} · {note.growerNo} (closed)</option>}
              {openNotes.map(({ note: n, tally: t }) => (
                <option key={n.id} value={n.id}>
                  {n.docNo} · {n.growerNo} · {t.captured}/{t.declared} bales
                </option>
              ))}
            </NativeSelect>
            <Button asChild variant="secondary">
              <Link href="/floor/receiving">
                <ArrowLeft /> Receiving
              </Link>
            </Button>
          </>
        }
      />
      <DeliveryStatusBar state={note.state} className="mb-6" />

      {!isOpen ? (
        <Callout tone="info" title={`Delivery ${note.docNo} is ${note.state === "TICKETS_PRINTING" ? "closed — in Tickets Printing" : note.state === "CHECKED" ? "Checked" : "Laid"}`} className="mb-6" action={
          note.state === "TICKETS_PRINTING" ? (
            <Button asChild size="sm"><Link href={`/floor/tickets/${note.id}`}>Go to ticket printing</Link></Button>
          ) : undefined
        }>
          Bale capture is finished for this delivery. A supervisor can eject a bale if a correction is needed.
        </Callout>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle className="text-lg">Save Bale Details</CardTitle>
              <CardDescription>
                Scan the scale barcode, then <kbd className="rounded border px-1 font-mono text-[11px]">Tab</kbd> through Grower, Group and Lot; <kbd className="rounded border px-1 font-mono text-[11px]">Enter</kbd> saves. The grower stays filled in.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CaptureForm
              key={note.id}
              note={note}
              disabled={!isOpen}
              onResult={(f, scanValue, message) => {
                setFeedback({ ...f, key: ++keyRef.current });
                pushScan(SCOPE, { value: scanValue, ok: f.ok, message });
              }}
              fillRef={fillRef}
              pendingReadings={pending.map((r) => ({ value: r.scaleBarcode, hint: `${r.mass} kg${r.isDemo ? " (demo)" : ""}` }))}
            />
            <div className="mt-4 min-h-[3.5rem]" role="status" aria-live="polite" data-testid="capture-feedback">
              {feedback ? (
                <div key={feedback.key} data-result={feedback.ok ? "ok" : "error"}>
                  <Callout tone={feedback.ok ? "success" : "danger"} title={feedback.text}>
                    {feedback.balanced ? (
                      <Badge tone="success" dot className="mt-1" data-testid="delivery-balanced">
                        Delivery Balanced
                      </Badge>
                    ) : null}
                  </Callout>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <TallyCard label="Bale Tally" value={tally.captured} total={tally.declared} doneLabel="Delivery Balanced" />
          <Card>
            <CardHeader>
              <CardTitle>Last Bale Details</CardTitle>
            </CardHeader>
            <CardContent data-testid="last-bale">
              {last ? (
                <div className="flex flex-col gap-3">
                  <p className="tabular text-4xl font-semibold leading-none">
                    {last.mass} <span className="text-lg font-medium text-muted-foreground">kg</span>
                  </p>
                  <KeyValue
                    columns={2}
                    items={[
                      { label: "Barcode", value: <span className="font-mono">{last.scaleBarcode}</span> },
                      { label: "Document No.", value: <span className="font-mono">{note.docNo}</span> },
                      { label: "Group #", value: last.group },
                      { label: "Lot #", value: last.lot },
                    ]}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No bale saved yet on this delivery.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <DataTable
            aria-label="Captured bales"
            data-testid="captured-bales"
            columns={columns}
            data={bales}
            getRowId={(b) => b.id}
            pageSize={8}
            hidePagerWhenSinglePage
            enableColumnVisibility={false}
            emptyTitle="No bales captured yet"
            emptyDescription="Each bale must be weighed first, then scanned here."
            toolbar={<p className="text-sm font-semibold">Captured bales · {bales.length}</p>}
          />
          <CompleteSection note={note} tally={tally} openNotes={openNotes.map((o) => o.note)} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <ScaleFeed readings={readings} onPick={(barcode) => fillRef.current?.(barcode)} disabled={!isOpen} />
          <ScanHistory entries={scanEntries} emptyLabel="Saved and rejected bales appear here" />
        </div>
      </div>

      <EjectBaleDialog open={eject !== null} onOpenChange={(o) => !o && setEject(null)} scaleBarcode={eject} />
    </>
  );
}

function CaptureForm({
  note,
  disabled,
  onResult,
  pendingReadings,
  fillRef,
}: {
  note: DeliveryNote;
  disabled: boolean;
  onResult: (f: Omit<Feedback, "key">, scanValue: string, message: string) => void;
  pendingReadings: Array<{ value: string; hint?: string }>;
  fillRef: React.MutableRefObject<((barcode: string) => void) | null>;
}) {
  const form = useForm<BaleCaptureForm, unknown, Output>({
    resolver: zodResolver(baleCaptureFormSchema),
    defaultValues: { scaleBarcode: "", growerNo: digits(note.growerNo), group: "", lot: "" },
  });
  const { run } = useAction(captureBale, { latency: 30, silent: true });
  const { errors } = form.formState;
  const { setValue, setFocus } = form;

  // A simulated scan (or a pick from the scale feed) fills the barcode like a keyboard-wedge scanner would, then moves on.
  useEffect(() => {
    fillRef.current = (barcode: string) => {
      setValue("scaleBarcode", barcode, { shouldValidate: false });
      setFocus("group");
    };
    return () => {
      fillRef.current = null;
    };
  }, [fillRef, setValue, setFocus]);

  const process = async (raw: BaleCaptureForm, values: Output) => {
    // Clear immediately so rapid consecutive scans are never lost; restore on failure.
    form.reset({ scaleBarcode: "", growerNo: raw.growerNo, group: "", lot: "" });
    // reset() clears RHF's field registry until the next render, so focus AFTER the re-render (keyboard/scanner flow).
    requestAnimationFrame(() => form.setFocus("scaleBarcode"));
    const res = await run({ scaleBarcode: values.scaleBarcode, growerNo: values.growerNo, group: values.group, lot: values.lot });
    if (res.ok) {
      const r = res.data;
      onResult({ ok: true, text: `${r.message} — Bale Tally: ${r.captured} of ${r.declared}`, balanced: r.balanced }, values.scaleBarcode, `${r.message} (${r.captured} of ${r.declared})`);
    } else {
      form.reset(raw);
      const field = res.error instanceof AppError ? res.error.field : undefined;
      if (field === "scaleBarcode" || field === "growerNo" || field === "group" || field === "lot") {
        requestAnimationFrame(() => {
          form.setError(field, { message: res.error.message });
          form.setFocus(field);
        });
      } else {
        requestAnimationFrame(() => form.setFocus("scaleBarcode"));
      }
      onResult({ ok: false, text: res.error.message }, values.scaleBarcode, res.error.message);
    }
  };

  const submit = form.handleSubmit((values) => process(form.getValues(), values));

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      data-testid="bale-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || (e.target as HTMLElement).tagName === "BUTTON") return;
        e.preventDefault();
        const v = form.getValues();
        const order = ["scaleBarcode", "growerNo", "group", "lot"] as const;
        const empty = order.find((k) => !String(v[k] ?? "").trim());
        if (empty) form.setFocus(empty);
        else void submit();
      }}
    >
      <Field label="Bale Barcode (scale barcode)" htmlFor="bc-scale" required error={errors.scaleBarcode?.message}>
        <Input id="bc-scale" size="xl" autoFocus autoComplete="off" disabled={disabled} placeholder="Scan the scale barcode…" aria-invalid={!!errors.scaleBarcode} data-testid="bale-barcode" {...form.register("scaleBarcode")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Grower #" htmlFor="bc-grower" required error={errors.growerNo?.message}>
          <GrowerNoInput id="bc-grower" disabled={disabled} error={!!errors.growerNo} data-testid="bale-grower" {...form.register("growerNo")} />
        </Field>
        <Field label="Group #" htmlFor="bc-group" required error={errors.group?.message} hint="A whole number, 1 or more">
          <Input id="bc-group" size="lg" inputMode="numeric" autoComplete="off" disabled={disabled} aria-invalid={!!errors.group} data-testid="bale-group" {...form.register("group")} />
        </Field>
        <Field label="Lot #" htmlFor="bc-lot" required error={errors.lot?.message} hint="Digits and / only, e.g. 3 or 12/3">
          <Input id="bc-lot" size="lg" autoComplete="off" disabled={disabled} aria-invalid={!!errors.lot} data-testid="bale-lot" {...form.register("lot")} />
        </Field>
      </div>
      <PermissionButton permission="receiving.capture-bale" type="submit" size="xl" disabled={disabled} data-testid="save-bale">
        Save Bale Details
      </PermissionButton>
      <SimulateScan
        barcodes={pendingReadings}
        disabled={disabled}
        label="Simulate scanning a weighed bale"
        onScan={(value) => fillRef.current?.(value)}
      />
    </form>
  );
}

function ScaleFeed({
  readings,
  onPick,
  disabled,
}: {
  readings: Array<{ scaleBarcode: string; mass: number; weighedAt: string; isDemo?: boolean; bale?: Bale; gdn?: DeliveryNote }>;
  onPick: (barcode: string) => void;
  disabled: boolean;
}) {
  const { run, isPending } = useAction(weighNextBale, { latency: 30, success: (r) => `Weighed ${r.scaleBarcode}: ${r.mass} kg (simulated)` });
  return (
    <Card data-testid="scale-feed">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <ScaleIcon className="size-4" aria-hidden /> Scale feed
          </CardTitle>
          <CardDescription>
            <Badge tone="warning">Simulated — not connected</Badge> No physical scale is attached; weigh events are generated for the demo.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <PermissionButton permission="receiving.capture-bale" variant="secondary" loading={isPending} disabled={disabled} onClick={() => run({})} data-testid="weigh-next">
          <ScaleIcon /> Weigh next bale (simulated)
        </PermissionButton>
        <ul className="divide-y divide-border rounded-xl border border-border text-sm">
          {readings.slice(0, 8).map((r) => (
            <li key={r.scaleBarcode} className="flex items-center gap-3 px-3 py-2">
              <button type="button" disabled={!!r.bale || disabled} onClick={() => onPick(r.scaleBarcode)} className="font-mono text-[13px] enabled:hover:text-primary enabled:hover:underline disabled:opacity-60">
                {r.scaleBarcode}
              </button>
              <span className="tabular text-muted-foreground">{r.mass} kg</span>
              {r.isDemo ? <DemoBadge /> : null}
              <span className="ml-auto">
                {r.bale ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success-text">
                    <CheckCircle2 className="size-3.5" aria-hidden /> {r.gdn?.docNo ?? "captured"}
                  </span>
                ) : (
                  <Badge tone="outline">Waiting</Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CompleteSection({ note, tally, openNotes }: { note: DeliveryNote; tally: { captured: number; declared: number; balanced: boolean }; openNotes: DeliveryNote[] }) {
  const [growerNo, setGrowerNo] = useState(digits(note.growerNo));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { run, isPending } = useAction(completeGrowerDelivery, { silent: true });
  const next = openNotes.find((n) => n.id !== note.id);

  const doComplete = async () => {
    setError(null);
    const res = await run({ growerNo, gdnId: note.id });
    setConfirm(false);
    if (res.ok) setDone(res.data.message);
    else setError(res.error.message);
  };

  return (
    <Card data-testid="complete-section">
      <CardHeader>
        <div>
          <CardTitle>Complete the grower's delivery</CardTitle>
          <CardDescription>
            Checks that bales captured equal bales declared ({tally.captured} of {tally.declared}), every group is 1 or more, lot numbers are valid and no group and lot pair repeats.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <div data-testid="complete-error">
            <Callout tone="danger" title={error}>
              Fix the problem (capture the missing bale, or ask a supervisor to eject the extra one), then complete again.
            </Callout>
          </div>
        ) : null}
        {done || note.state !== "OPEN" ? (
          <div data-testid="delivery-closed">
            <Callout tone="success" title={done ?? formatMessage("DELIVERY_CLOSED", { gdn: note.docNo, grower: note.growerNo })}>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/floor/tickets/${note.id}`}>Go to ticket printing</Link>
                </Button>
                {next ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/floor/receiving/${next.id}/bales`}>Next delivery · {next.growerNo}</Link>
                  </Button>
                ) : null}
              </div>
            </Callout>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Grower Number" htmlFor="cg-grower" required className="w-64">
              <GrowerNoInput id="cg-grower" value={growerNo} onChange={(e) => setGrowerNo(e.target.value)} data-testid="complete-grower" />
            </Field>
            <PermissionButton permission="receiving.complete-delivery" size="lg" onClick={() => setConfirm(true)} data-testid="complete-grower-delivery">
              Complete Delivery
            </PermissionButton>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Complete delivery for V${growerNo.replace(/^V/i, "")}?`}
        description={`${tally.captured} of ${tally.declared} bales captured. The delivery moves to Tickets Printing and appears in the Ticket Printing app.`}
        confirmLabel="Complete Delivery"
        loading={isPending}
        onConfirm={doComplete}
      />
    </Card>
  );
}

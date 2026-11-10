"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, DoorOpen, Power, PowerOff, Search } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  type ScanOutcome,
} from "@tobacco/ui";
import { RequirePermission } from "@/components/page-guard";
import { ScanPanel, TallyCard, WorkspaceHeader } from "@/components/floor/workspace";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDb } from "@/mock/hooks";
import { setFloorScanning } from "@/mock/domain/daily-setup";
import { scanTicket, selectScanScreen, type ScanTicketResult } from "@/mock/domain/floor-summary";

/** Floor Summary workspace (Manual 05): choose selling point → sale room → scan tickets with the row. */
export function FloorSummaryWorkspace() {
  const sellingPoints = useDb((db) => db.sellingPoints.filter((s) => s.active));
  const [spId, setSpId] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const sp = sellingPoints.find((s) => s.id === spId);

  return (
    <RequirePermission permission="floor-summary.view">
      {!sp ? (
        <>
          <WorkspaceHeader title="Floor summary" subtitle="Please select a selling point" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="select-selling-point">
            {sellingPoints.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpId(s.id)}
                data-testid={`select-selling-point-${s.id}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-left shadow-card transition-colors hover:border-primary hover:bg-primary-soft/40"
              >
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Building2 className="size-7" aria-hidden />
                </span>
                <span>
                  <span className="block text-xl font-semibold">{s.name} - {s.code}</span>
                  <span className="text-sm text-muted-foreground">{s.saleRooms.length} sale room(s)</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : !room ? (
        <>
          <WorkspaceHeader
            title="Floor summary"
            subtitle={`${sp.name} · Please select a Sale`}
            actions={
              <Button variant="secondary" onClick={() => setSpId(null)}>
                <ArrowLeft /> Change selling point
              </Button>
            }
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="select-sale-room">
            {sp.saleRooms.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoom(r)}
                data-testid={`select-sale-room-${r}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-left shadow-card transition-colors hover:border-primary hover:bg-primary-soft/40"
              >
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <DoorOpen className="size-7" aria-hidden />
                </span>
                <span className="text-xl font-semibold">Sale {r}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <ScanScreen sellingPointId={sp.id} sellingPointName={sp.name} room={room} onChangeRoom={() => setRoom(null)} />
      )}
    </RequirePermission>
  );
}

function ScanScreen({
  sellingPointId,
  sellingPointName,
  room,
  onChangeRoom,
}: {
  sellingPointId: string;
  sellingPointName: string;
  room: string;
  onChangeRoom: () => void;
}) {
  const state = useDb((db) => selectScanScreen(db, sellingPointId));
  const [row, setRow] = useState("1");
  const [last, setLast] = useState<ScanTicketResult | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const scannerWrap = useRef<HTMLDivElement>(null);
  const scan = useAction(scanTicket, { latency: 30, silent: true });
  const toggle = useAction(setFloorScanning, { success: (_, i) => (i.enabled ? "Floor summary scanning turned on" : "Floor summary scanning turned off") });

  const onScan = useCallback(
    async (barcode: string): Promise<ScanOutcome> => {
      const res = await scan.run({ row, barcode, sellingPointId, saleRoom: room });
      if (!res.ok) return { ok: false, message: res.error.message };
      setLast(res.data);
      return { ok: true, message: res.data.message };
    },
    [scan, row, sellingPointId, room],
  );

  // Current grower for the tally: the last scanned delivery, else the first partly-scanned, else the first waiting.
  const focus =
    state.deliveries.find((d) => d.gdnId === last?.gdnId) ??
    state.deliveries.find((d) => d.scanned > 0 && d.scanned < d.total) ??
    state.deliveries.find((d) => d.scanned < d.total) ??
    state.deliveries[0];

  const blocked = !state.saleDateIsToday ? "Please Add a Current Sale Date,." : !state.canScan ? "Floor Summary scanning is currently off. Ask the receiving manager to turn it on." : null;
  const simulate = [
    ...state.waiting.map((w) => ({ value: w.barcode, hint: `${w.growerNo} · ${w.gdnDocNo} · group ${w.group} lot ${w.lot}` })),
    ...(state.scaleDecoy ? [{ value: state.scaleDecoy, hint: "Scale label — scanning this should be rejected (scan the ticket, not the scale label)" }] : []),
    ...(state.duplicateDecoy ? [{ value: state.duplicateDecoy, hint: "Already scanned — should be rejected as a duplicate" }] : []),
  ];

  return (
    <>
      <WorkspaceHeader
        title="Floor summary"
        subtitle={`${sellingPointName} · Sale ${room}`}
        chips={
          <Badge tone={blocked ? "danger" : "success"} dot data-testid="scanning-status">
            {blocked ? "Scanning off" : "Scanning on"}
          </Badge>
        }
        actions={
          <>
            <Button variant="secondary" onClick={onChangeRoom}>
              <ArrowLeft /> Change sale
            </Button>
            <Button asChild variant="secondary">
              <Link href="/floor/floor-summary/check">
                <Search /> Check Floor Summary
              </Link>
            </Button>
            <PermissionButton permission="floor-summary.toggle-scanning" variant="dark" onClick={() => setConfirmToggle(true)} data-testid="toggle-scanning">
              {state.canScan ? <PowerOff /> : <Power />}
              {state.canScan ? "Turn Off Floor Summary Scanning" : "Turn On Floor Summary Scanning"}
            </PermissionButton>
          </>
        }
      />

      {blocked ? (
        <Callout tone="danger" title="Scanning is not available" className="mb-6">
          {blocked}
        </Callout>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-5 p-6">
              <Field label="Row" htmlFor="floor-row" required hint="The row stays filled in — change it only when you move to the next row.">
                <Input
                  id="floor-row"
                  data-testid="floor-row"
                  size="xl"
                  inputMode="numeric"
                  value={row}
                  onChange={(e) => setRow(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      scannerWrap.current?.querySelector<HTMLInputElement>("input")?.focus();
                    }
                  }}
                  className="max-w-48"
                />
              </Field>
              <div ref={scannerWrap}>
                <ScanPanel
                  scope="floor-summary"
                  label="Scan ticket barcode (not the scale barcode)"
                  placeholder="Scan ticket barcode…"
                  submitLabel="Scan to Summary"
                  onScan={onScan}
                  simulate={simulate}
                  disabled={Boolean(blocked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {focus ? (
            <TallyCard label={`Scanned · ${focus.growerNo} ${focus.growerName}`} value={focus.scanned} total={focus.total} doneLabel="Floor summary complete" />
          ) : (
            <Card className="p-5">
              <EmptyState title="No checked deliveries" description="Deliveries appear here once the ticket clerk has confirmed printing (Manual 04)." className="py-6" />
            </Card>
          )}

          <Card data-testid="last-scan">
            <CardHeader>
              <CardTitle>Last scan</CardTitle>
            </CardHeader>
            <CardContent>
              {last ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Item label="Last Grower" value={`${last.growerNo} · ${last.growerName}`} />
                  <Item label="Last Barcode" value={last.barcode} mono />
                  <Item label="Lot" value={last.lot} />
                  <Item label="Group" value={String(last.group)} />
                  <Item label="Row" value={String(last.row)} />
                  <Item label="Delivery" value={last.gdnDocNo} mono />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing scanned yet this session.</p>
              )}
              {last?.outcome === "COMPLETE" ? (
                <Callout tone="success" className="mt-4" title="Floor summary complete">
                  {last.growerNo}'s delivery is Laid. Draft sale #{last.saleRefNo} and price batch {last.batchRefNo} were created for data capture.{" "}
                  <Link className="font-medium underline" href={`/sales/${last.saleId}`}>
                    Open sale
                  </Link>
                </Callout>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rows today</CardTitle>
            </CardHeader>
            <CardContent>
              {state.perRow.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bales scanned into a row yet.</p>
              ) : (
                <ul className="flex flex-col gap-2" data-testid="row-summary">
                  {state.perRow.map((r) => (
                    <li key={r.row} className="flex items-center justify-between rounded-xl bg-surface-secondary px-3 py-2 text-sm">
                      <span className="font-medium">Row {r.row}</span>
                      <span className="text-muted-foreground">
                        {r.growers.join(", ")} · <span className="tabular font-medium text-foreground">{r.bales}</span> bales
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {state.deliveries.length > 0 ? (
                <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
                  {state.deliveries.map((d) => (
                    <li key={d.gdnId} className="flex items-center justify-between">
                      <span>
                        {d.growerNo} <span className="font-mono text-xs text-muted-foreground">{d.docNo}</span>
                      </span>
                      {d.state === "LAID" ? (
                        <span className="flex items-center gap-1 text-success-text">
                          <CheckCircle2 className="size-4" aria-hidden /> Laid
                        </span>
                      ) : (
                        <span className="tabular text-muted-foreground">
                          {d.scanned} of {d.total}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={state.canScan ? "Turn off floor summary scanning?" : "Turn on floor summary scanning?"}
        description={state.canScan ? "This stops scanning for the whole floor until it is turned on again." : "This restarts scanning for the whole floor."}
        confirmLabel={state.canScan ? "Turn off scanning" : "Turn on scanning"}
        tone={state.canScan ? "danger" : "primary"}
        loading={toggle.isPending}
        onConfirm={async () => {
          await toggle.run({ enabled: !state.canScan });
          setConfirmToggle(false);
        }}
      />
    </>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-[13px] font-medium" : "font-medium"}>{value}</dd>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ShieldCheck, Undo2 } from "lucide-react";
import { Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, Field, Input, KeyValue, PageHeader, UnverifiedBadge, type ColumnDef } from "@tobacco/ui";
import { formatDateTime } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { GdnLink, GrowerLink } from "@/components/domain/entity-links";
import { StatusBadge } from "@/components/domain/status-badge";
import { EjectBaleDialog } from "@/components/receiving/eject-bale-dialog";
import { PermissionButton } from "@/lib/permissions";
import { scaleReadingBale } from "@/mock/domain/receiving";
import { useDb, useDbQuery } from "@/mock/hooks";

interface EjectionRow {
  id: string;
  at: string;
  scaleBarcode: string;
  by: string;
  reason: string;
  gdn: string;
}

/** Receiving Supervisors page (Manual 03): "Eject Bale using Scale Barcode". */
export default function ReceivingCorrectionsPage() {
  const [barcode, setBarcode] = useState("");
  const [open, setOpen] = useState(false);
  const match = useDb((db) => {
    const code = barcode.trim();
    if (code.length < 4) return null;
    const bale = scaleReadingBale(db, code);
    if (!bale) return { found: false as const };
    return { found: true as const, bale, note: db.deliveryNotes.find((d) => d.id === bale.gdnId) };
  });
  const { data: ejections, isLoading } = useDbQuery(["ejections"], (db): EjectionRow[] =>
    db.audit
      .filter((a) => a.action === "receiving.eject-bale")
      .map((a) => ({
        id: a.id,
        at: a.at,
        scaleBarcode: a.entityRef ?? "",
        by: a.userName,
        reason: a.reason ?? "",
        gdn: String((a.previous as { gdn?: string } | undefined)?.gdn ?? ""),
      })),
  );

  const columns: ColumnDef<EjectionRow, unknown>[] = [
    { accessorKey: "at", header: "When", cell: ({ getValue }) => <span className="tabular">{formatDateTime(getValue<string>())}</span> },
    { accessorKey: "scaleBarcode", header: "Scale barcode", cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span> },
    { accessorKey: "gdn", header: "Delivery", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue<string>()}</span> },
    { accessorKey: "by", header: "Supervisor" },
    { accessorKey: "reason", header: "Reason" },
  ];

  return (
    <RequirePermission permission="receiving.eject-bale">
      <PageHeader title="Receiving corrections" description="Supervisor tools. Every correction needs a reason and is audited with the user and the time." badges={<UnverifiedBadge uq="UQ-17" />} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" aria-hidden /> Eject Bale using Scale Barcode
              </CardTitle>
              <CardDescription>Removes a bale captured by mistake, so it can be captured again.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Scale barcode" htmlFor="corr-barcode" hint="Scan or type the bale's scale barcode">
              <Input id="corr-barcode" size="lg" autoFocus autoComplete="off" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="2609170001" data-testid="correction-barcode" />
            </Field>
            {match?.found === false ? (
              <Callout tone="warning" title="No captured bale with this scale barcode">
                It may already be ejected, or it was never captured.
              </Callout>
            ) : null}
            {match?.found ? (
              <div className="rounded-xl border border-border p-4" data-testid="correction-match">
                <KeyValue
                  columns={2}
                  items={[
                    { label: "Grower", value: <GrowerLink growerNo={match.bale.growerNo} /> },
                    { label: "Delivery", value: match.note ? <GdnLink id={match.note.id} docNo={match.note.docNo} /> : "—" },
                    { label: "State", value: match.note ? <StatusBadge kind="deliveryNote" value={match.note.state} /> : "—" },
                    { label: "Group · Lot · Mass", value: `${match.bale.group} · ${match.bale.lot} · ${match.bale.mass} kg` },
                  ]}
                />
              </div>
            ) : null}
            <PermissionButton permission="receiving.eject-bale" variant="danger" size="lg" disabled={!match?.found} onClick={() => setOpen(true)} data-testid="eject-bale">
              <Undo2 /> Eject Bale
            </PermissionButton>
            <p className="text-xs text-muted-foreground">
              A delivery that is closed but has no ticket barcodes yet reopens; once barcodes are allocated, reverse the printing status first. Whether the original system allows this, or needs an approval, is not documented.
            </p>
          </CardContent>
        </Card>
        <div className="xl:col-span-3">
          <DataTable
            aria-label="Recent ejections"
            data-testid="ejections-table"
            columns={columns}
            data={ejections ?? []}
            loading={isLoading}
            getRowId={(r) => r.id}
            pageSize={10}
            hidePagerWhenSinglePage
            enableColumnVisibility={false}
            emptyIcon={Undo2}
            emptyTitle="No bales ejected"
            emptyDescription="Ejections appear here with their reason."
            toolbar={<p className="text-sm font-semibold">Recent ejections</p>}
          />
        </div>
      </div>
      <EjectBaleDialog open={open} onOpenChange={setOpen} scaleBarcode={match?.found ? barcode.trim() : null} onDone={() => setBarcode("")} />
    </RequirePermission>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Pencil, Plus, ScanLine, Trash2 } from "lucide-react";
import {
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  KeyValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@tobacco/ui";
import type { DeliveryNote, TransporterNote } from "@tobacco/shared";
import { StatusBadge } from "@/components/domain/status-badge";
import { GdnLink } from "@/components/domain/entity-links";
import { PermissionButton } from "@/lib/permissions";
import { completeTransporterNote, removeGrowerFromNote, updateTransporterDetails } from "@/mock/domain/receiving";
import { useAction, useDb } from "@/mock/hooks";
import { AddGrowerForm } from "./add-grower-form";
import { TransporterForm } from "./transporter-form";

function totalBales(note: TransporterNote) {
  return note.growers.reduce((a, g) => a + g.bales, 0);
}

/** Document header + the stats the manual shows on the note: Last Grower, State, Number of Growers, Total Bales. */
export function NoteSummary({ note, onEdit }: { note: TransporterNote; onEdit?: () => void }) {
  const last = note.growers.at(-1);
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Delivery Note for</p>
            <h2 className="text-2xl font-semibold tracking-tight">{note.transporterName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge kind="transporterNote" value={note.state} />
            {onEdit ? (
              <PermissionButton permission="receiving.create-delivery" variant="secondary" size="sm" onClick={onEdit}>
                <Pencil /> Edit Transporter Details
              </PermissionButton>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="note-stats">
          {[
            ["Last Grower", last ? last.growerNo : "—"],
            ["State", note.state === "OPEN" ? "Open" : "Completed"],
            ["Number of Growers", String(note.growers.length)],
            ["Total Bales", String(totalBales(note))],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-secondary px-4 py-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="tabular text-xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <KeyValue
          columns={4}
          items={[
            { label: "Doc No.", value: <span className="font-mono">{note.docNo}</span> },
            { label: "Name", value: note.transporterName },
            { label: "Vehicle Reg", value: <span className="font-mono">{note.vehicleReg}</span> },
            { label: "ID Number", value: note.idNumber },
            { label: "Cellphone", value: note.phone },
            { label: "Permit No.", value: note.permitNo || "—" },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function GrowersTable({ note, editable }: { note: TransporterNote; editable: boolean }) {
  const growers = useDb((db) => db.growers);
  const notes = useDb((db) => db.deliveryNotes);
  const { run: remove, isPending } = useAction(removeGrowerFromNote, { success: "Grower removed from the note" });
  return (
    <Table aria-label="Growers on this delivery note" data-testid="note-growers">
      <TableHeader>
        <TableRow>
          <TableHead>Grower #</TableHead>
          <TableHead>Loc</TableHead>
          <TableHead className="text-right">Bales</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Date</TableHead>
          {!editable ? <TableHead>D/Note</TableHead> : null}
          {editable ? <TableHead className="text-right">Remove</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {note.growers.map((line, i) => {
          const g = growers.find((x) => x.growerNo === line.growerNo);
          const gdn: DeliveryNote | undefined = line.gdnId ? notes.find((d) => d.id === line.gdnId) : undefined;
          return (
            <TableRow key={`${line.growerNo}-${i}`}>
              <TableCell className="font-mono font-medium">{line.growerNo}</TableCell>
              <TableCell>{line.location}</TableCell>
              <TableCell className="tabular text-right">{line.bales}</TableCell>
              <TableCell>{g ? `${g.surname} ${g.firstName}` : "—"}</TableCell>
              <TableCell className="tabular text-muted-foreground">
                {String(line.saleDay).padStart(2, "0")}/{String(line.saleMonth).padStart(2, "0")}
              </TableCell>
              {!editable ? <TableCell>{gdn ? <GdnLink id={gdn.id} docNo={gdn.docNo} /> : "—"}</TableCell> : null}
              {editable ? (
                <TableCell className="text-right">
                  <PermissionButton
                    permission="receiving.add-grower"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${line.growerNo}`}
                    disabled={isPending}
                    onClick={() => remove({ noteId: note.id, index: i })}
                  >
                    <Trash2 />
                  </PermissionButton>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
        {note.growers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="p-0">
              <EmptyState title="No growers added yet" description="Add each grower on the truck with the form on the left." className="py-8" />
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

export function NoteView({ note, onNew }: { note: TransporterNote; onNew: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { run: complete, isPending } = useAction(completeTransporterNote, { silent: true });
  const { run: update, isPending: updating } = useAction(updateTransporterDetails, { success: "Transporter details updated", silent: true });
  const gdns = useDb((db) => note.growers.map((g) => db.deliveryNotes.find((d) => d.id === g.gdnId)).filter((d): d is DeliveryNote => Boolean(d)));

  if (note.state === "COMPLETED") {
    return (
      <div className="flex flex-col gap-6" data-testid="note-closed">
        <Callout tone="success" title="Document successfully closed">
          {note.docNo} is completed. Each grower now has a grower delivery note in state Open, ready for bale capture.
        </Callout>
        <NoteSummary note={note} />
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Growers and delivery notes</CardTitle>
              <CardDescription>Capture the bales for each grower delivery note.</CardDescription>
            </div>
            <Button size="lg" onClick={onNew} data-testid="new-note">
              <Plus /> Create New Transporter Delivery Note
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <GrowersTable note={note} editable={false} />
          </CardContent>
          <CardContent className="flex flex-wrap gap-2 border-t border-border">
            {gdns.map((d) => (
              <Button key={d.id} asChild variant="secondary">
                <Link href={`/floor/receiving/${d.id}/bales`}>
                  <ScanLine /> Capture bales · {d.docNo} · {d.growerNo}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-6" data-testid="confirm-complete">
        <Callout tone="warning" title="Check the list, then confirm">
          Completing the note closes it and creates a grower delivery note for each grower. Growers can't be added or removed afterwards.
        </Callout>
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <NoteSummary note={note} />
        <Card>
          <CardContent className="px-0 py-0">
            <GrowersTable note={note} editable={false} />
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-3">
          <PermissionButton
            permission="receiving.complete-delivery"
            size="xl"
            loading={isPending}
            data-testid="confirm-delivery-complete"
            onClick={async () => {
              setError(null);
              const res = await complete({ noteId: note.id });
              if (res.ok) {
                setConfirming(false);
                toast.success("Document successfully closed");
              } else setError(res.error.message);
            }}
          >
            <CheckCircle2 /> Confirm Delivery Complete
          </PermissionButton>
          <Button size="xl" variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <NoteSummary note={note} onEdit={() => setEditing(true)} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle className="text-lg">Add each grower on the truck</CardTitle>
              <CardDescription>Click Add Grower once for each grower. The delivery must balance to this exact bale count.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AddGrowerForm noteId={note.id} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle className="text-lg">Growers on this note</CardTitle>
              <CardDescription>Remove takes out a grower who was added by mistake.</CardDescription>
            </div>
            <PermissionButton
              permission="receiving.complete-delivery"
              size="lg"
              disabled={note.growers.length === 0}
              disabledReason={note.growers.length === 0 ? "Add at least one grower first" : undefined}
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              data-testid="complete-delivery"
            >
              Complete Delivery
            </PermissionButton>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <GrowersTable note={note} editable />
          </CardContent>
        </Card>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transporter Details</DialogTitle>
            <DialogDescription>Correct the transporter's details while the note is Open.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <TransporterForm
              idPrefix="edit"
              size="md"
              submitLabel="Save details"
              loading={updating}
              defaultValues={{ transporterName: note.transporterName, idNumber: note.idNumber, vehicleReg: note.vehicleReg, phone: note.phone, permitNo: note.permitNo ?? "" }}
              onSubmit={async (values) => {
                const res = await update({ noteId: note.id, ...values });
                if (res.ok) {
                  setEditing(false);
                  return null;
                }
                return res.error.message;
              }}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

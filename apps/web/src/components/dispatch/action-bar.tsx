"use client";

import { useState } from "react";
import { Download, FileOutput, RotateCcw, Send, XCircle } from "lucide-react";
import { Button, ConfirmDialog, toast, type ButtonProps } from "@tobacco/ui";
import type { DispatchNote, ShipmentExport } from "@tobacco/shared";
import { PermissionButton } from "@/lib/permissions";
import { downloadTextFile } from "@/lib/csv";
import { useAction } from "@/mock/hooks";
import { cancelDispatch, generateShipmentFile, postDispatch, resetDispatchToDraft } from "@/mock/domain/dispatch";
import { ReasonDialog } from "./reason-dialog";

/**
 * The state-dependent actions of a dispatch note — the same component serves the floor workspace and the back-office
 * detail page. Every button is permission-gated with an explanation, and every transition is audited by the operation.
 *  Draft:  Post · Cancel Dispatch (reason)
 *  Posted: Generate Shipment File · Download CSV · Reset to draft (supervisor, reason)
 */
export function DispatchActionBar({
  note,
  latestExport,
  size = "md",
  allowPostWithoutDone = false,
  onCancelled,
  onPosted,
}: {
  note: DispatchNote;
  latestExport?: ShipmentExport;
  size?: ButtonProps["size"];
  /** Back-office detail: allow posting a note whose "Done" was never clicked (explicit confirmation in the dialog). */
  allowPostWithoutDone?: boolean;
  onCancelled?: () => void;
  onPosted?: () => void;
}) {
  const [postOpen, setPostOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const post = useAction(postDispatch, { success: (n) => `Dispatch note ${n.ref} posted`, onSuccess: () => onPosted?.() });
  const cancel = useAction(cancelDispatch, { silent: true });
  const reset = useAction(resetDispatchToDraft, { silent: true });
  const generate = useAction(generateShipmentFile, { success: (e) => `Shipment file ${e.filename} generated (${e.rowCount} rows)` });

  const draft = note.state === "DRAFT";
  const posted = note.state === "POSTED";
  const loadingDone = Boolean(note.loadingDoneAt);

  const postBlock =
    note.totalBales === 0
      ? "Scan at least one bale first."
      : !loadingDone && !allowPostWithoutDone
        ? "Click Done when the truck is loaded, then post."
        : undefined;

  return (
    <>
      {draft ? (
        <>
          <PermissionButton
            permission="dispatch.post"
            size={size}
            onClick={() => setPostOpen(true)}
            disabled={Boolean(postBlock)}
            disabledReason={postBlock}
            data-testid="post-dispatch"
          >
            <Send /> Post dispatch note
          </PermissionButton>
          <PermissionButton
            permission="dispatch.cancel"
            variant="secondary"
            size={size}
            onClick={() => setCancelOpen(true)}
            data-testid="cancel-dispatch"
          >
            <XCircle /> Cancel Dispatch
          </PermissionButton>
        </>
      ) : null}

      {posted ? (
        <>
          <PermissionButton
            permission="dispatch.generate-shipment-file"
            size={size}
            loading={generate.isPending}
            onClick={() => void generate.run({ dispatchId: note.id })}
            data-testid="generate-shipment"
          >
            <FileOutput /> {latestExport ? "Regenerate Shipment File" : "Generate Shipment File"}
          </PermissionButton>
          {latestExport ? (
            <Button
              variant="secondary"
              size={size}
              onClick={() => {
                downloadTextFile(latestExport.filename, latestExport.csv);
                toast.success(`Downloaded ${latestExport.filename}`);
              }}
              data-testid="download-shipment"
            >
              <Download /> Download CSV
            </Button>
          ) : null}
          <PermissionButton
            permission="dispatch.reset"
            variant="secondary"
            size={size}
            onClick={() => setResetOpen(true)}
            data-testid="reset-dispatch"
          >
            <RotateCcw /> Reset to draft
          </PermissionButton>
        </>
      ) : null}

      <ConfirmDialog
        open={postOpen}
        onOpenChange={setPostOpen}
        title="Post dispatch note?"
        description={
          <>
            <strong>{note.totalBales}</strong> bales · <strong>{note.totalMass} kg</strong> to <strong>{note.warehouseCode}</strong>. Check the bale
            count and mass — a posted note is never deleted.
            {!loadingDone ? " Loading was not marked Done; posting anyway on your confirmation." : ""}
          </>
        }
        confirmLabel="Post"
        loading={post.isPending}
        onConfirm={async () => {
          const res = await post.run({ dispatchId: note.id, confirmWithoutDone: allowPostWithoutDone });
          if (res.ok) setPostOpen(false);
        }}
      />

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel dispatch ${note.ref}?`}
        description="The note is kept as Cancelled (dispatch notes are never deleted) and its bales are released so they can go on another note."
        confirmLabel="Cancel Dispatch"
        loading={cancel.isPending}
        testId="cancel-dialog"
        onSubmit={async (reason) => {
          const res = await cancel.run({ dispatchId: note.id, reason });
          if (res.ok) {
            toast.success(`Dispatch note ${note.ref} cancelled`);
            onCancelled?.();
            return { ok: true };
          }
          return { ok: false, error: res.error.message };
        }}
      />

      <ReasonDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={`Reset ${note.ref} to draft?`}
        description="Supervisor correction: a posted note goes back to Draft so bales can be removed. The reason is audited."
        confirmLabel="Reset to draft"
        tone="primary"
        loading={reset.isPending}
        testId="reset-dialog"
        onSubmit={async (reason) => {
          const res = await reset.run({ dispatchId: note.id, reason });
          if (res.ok) {
            toast.success(`Dispatch note ${note.ref} reset to draft`);
            return { ok: true };
          }
          return { ok: false, error: res.error.message };
        }}
      />
    </>
  );
}

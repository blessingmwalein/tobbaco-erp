"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Callout, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Textarea } from "@tobacco/ui";
import { reasonSchema, type ReasonForm } from "@tobacco/validation";
import { PermissionButton } from "@/lib/permissions";
import { ejectBale } from "@/mock/domain/receiving";
import { useAction } from "@/mock/hooks";

/** Eject Bale using Scale Barcode — supervisor correction. Reason, user and time are audited. */
export function EjectBaleDialog({
  scaleBarcode,
  open,
  onOpenChange,
  onDone,
}: {
  scaleBarcode: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const { run, isPending } = useAction(ejectBale, { success: "Bale ejected — it can be captured again", silent: true });
  const form = useForm<ReasonForm>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ reason }) => {
    if (!scaleBarcode) return;
    setError(null);
    const res = await run({ scaleBarcode, reason });
    if (res.ok) {
      form.reset({ reason: "" });
      onOpenChange(false);
      onDone?.();
    } else setError(res.error.message);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setError(null);
          form.reset({ reason: "" });
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Eject bale {scaleBarcode}</DialogTitle>
            <DialogDescription>
              Removes a bale captured by mistake so it can be captured again. A reason is required and the correction is audited.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <Field label="Reason" htmlFor="eject-reason" required error={errors.reason?.message}>
              <Textarea id="eject-reason" autoFocus placeholder="e.g. Captured against the wrong grower" aria-invalid={!!errors.reason} {...form.register("reason")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <PermissionButton permission="receiving.eject-bale" type="submit" variant="danger" loading={isPending} data-testid="confirm-eject">
              Eject bale
            </PermissionButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

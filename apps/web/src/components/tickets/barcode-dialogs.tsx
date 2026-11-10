"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppError } from "@tobacco/shared";
import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
  UnverifiedBadge,
  type ButtonProps,
} from "@tobacco/ui";
import { interruptedTicketFormSchema, reasonSchema, startBarcodeFormSchema, type ReasonForm } from "@tobacco/validation";
import { PermissionButton } from "@/lib/permissions";
import { recordInterruptedTicket, setStartBarcode, splitSaleNote } from "@/mock/domain/tickets";
import { useAction } from "@/mock/hooks";
import type { Permission } from "@tobacco/shared";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gdnId: string;
  /** Called with the success message so the page can show it in its status area. */
  onDone: (message: string) => void;
}

function FooterButtons({ onCancel, permission, label, loading, testId, variant }: { onCancel: () => void; permission: Permission; label: string; loading?: boolean; testId: string; variant?: ButtonProps["variant"] }) {
  return (
    <DialogFooter>
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <PermissionButton permission={permission} type="submit" variant={variant} loading={loading} data-testid={testId}>
        {label}
      </PermissionButton>
    </DialogFooter>
  );
}

/** Set Starting Barcode: the full 10-character barcode on the first ticket of the roll. */
export function SetStartBarcodeDialog({ open, onOpenChange, gdnId, onDone }: DialogProps) {
  const [error, setError] = useState<string | null>(null);
  const { run, isPending } = useAction(setStartBarcode, { silent: true });
  const form = useForm<{ startBarcode: string }>({ resolver: zodResolver(startBarcodeFormSchema), defaultValues: { startBarcode: "" } });
  const { errors } = form.formState;
  const submit = form.handleSubmit(async ({ startBarcode }) => {
    setError(null);
    const res = await run({ gdnId, startBarcode });
    if (res.ok) {
      form.reset();
      onOpenChange(false);
      onDone(res.data.message);
    } else setError(res.error.message);
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setError(null); form.reset(); } onOpenChange(o); }}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Change Start Barcode</DialogTitle>
            <DialogDescription>Enter the full 10-character barcode printed on your first ticket: 9 digits plus the check character. This delivery's bales get their barcodes now.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <Field label="Start Barcode" htmlFor="start-barcode" required error={errors.startBarcode?.message} hint="For example 1000001013">
              <Input id="start-barcode" size="xl" autoFocus autoComplete="off" maxLength={14} placeholder="1000001013" aria-invalid={!!errors.startBarcode} data-testid="start-barcode-input" {...form.register("startBarcode")} />
            </Field>
          </DialogBody>
          <FooterButtons onCancel={() => onOpenChange(false)} permission="tickets.allocate" label="Set Start Barcode" loading={isPending} testId="confirm-start-barcode" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Interrupted Ticket: the printer jammed or stock ran out part-way. */
export function InterruptedTicketDialog({ open, onOpenChange, gdnId, onDone }: DialogProps) {
  const [error, setError] = useState<string | null>(null);
  const { run, isPending } = useAction(recordInterruptedTicket, { silent: true });
  const form = useForm<{ lastPrintedBarcode: string; newStartBarcode: string }>({
    resolver: zodResolver(interruptedTicketFormSchema),
    defaultValues: { lastPrintedBarcode: "", newStartBarcode: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    setError(null);
    const res = await run({ gdnId, ...values });
    if (res.ok) {
      form.reset();
      onOpenChange(false);
      onDone(res.data.message);
    } else {
      const field = res.error instanceof AppError ? res.error.field : undefined;
      if (field === "lastPrintedBarcode" || field === "newStartBarcode") form.setError(field, { message: res.error.message });
      else setError(res.error.message);
    }
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setError(null); form.reset(); } onOpenChange(o); }}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Interrupted Ticket <UnverifiedBadge uq="UQ-11" />
            </DialogTitle>
            <DialogDescription>
              The printer jammed or stock ran out part-way. Record the last barcode printed and the new starting barcode; the tickets after it get new barcodes.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <Field label="Last barcode printed" htmlFor="int-last" required error={errors.lastPrintedBarcode?.message}>
              <Input id="int-last" size="lg" autoFocus autoComplete="off" aria-invalid={!!errors.lastPrintedBarcode} {...form.register("lastPrintedBarcode")} />
            </Field>
            <Field label="New starting barcode" htmlFor="int-new" required error={errors.newStartBarcode?.message}>
              <Input id="int-new" size="lg" autoComplete="off" aria-invalid={!!errors.newStartBarcode} {...form.register("newStartBarcode")} />
            </Field>
          </DialogBody>
          <FooterButtons onCancel={() => onOpenChange(false)} permission="tickets.interrupt" label="Record interruption" loading={isPending} testId="confirm-interrupted" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Split this Sale: documented button, undocumented behaviour — simulated, records a note only. */
export function SplitSaleDialog({ open, onOpenChange, gdnId, onDone }: DialogProps) {
  const [error, setError] = useState<string | null>(null);
  const { run, isPending } = useAction(splitSaleNote, { silent: true });
  const form = useForm<{ note: string }>({ defaultValues: { note: "" } });
  const submit = form.handleSubmit(async ({ note }) => {
    setError(null);
    const res = await run({ gdnId, note });
    if (res.ok) {
      form.reset();
      onOpenChange(false);
      onDone("Split-sale note recorded (simulated — no sale was split)");
    } else setError(res.error.message);
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setError(null); form.reset(); } onOpenChange(o); }}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Split this Sale <UnverifiedBadge uq="UQ-11" />
            </DialogTitle>
            <DialogDescription>Use when the grower's bales are going to more than one sale.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Callout tone="warning" title="Simulated">
              The manual lists this button but not what it does. In this demo it only records an audited note — it does not split the sale.
            </Callout>
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <Field label="How are the bales split?" htmlFor="split-note" required>
              <Textarea id="split-note" autoFocus placeholder="e.g. Group 1 to Sale 1, group 2 to Sale 2" {...form.register("note")} />
            </Field>
          </DialogBody>
          <FooterButtons onCancel={() => onOpenChange(false)} permission="tickets.allocate" label="Record note" loading={isPending} testId="confirm-split" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Generic "give a reason" dialog (reverse printing status, reprint). */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  permission,
  variant = "primary",
  onSubmit,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  permission: Permission;
  variant?: ButtonProps["variant"];
  /** Return an error message to show inline, or null on success. */
  onSubmit: (reason: string) => Promise<string | null>;
  testId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<ReasonForm>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } });
  const { errors } = form.formState;
  const submit = form.handleSubmit(async ({ reason }) => {
    setError(null);
    setPending(true);
    const message = await onSubmit(reason);
    setPending(false);
    if (message) setError(message);
    else {
      form.reset();
      onOpenChange(false);
    }
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setError(null); form.reset(); } onOpenChange(o); }}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <Field label="Reason" htmlFor="reason-text" required error={errors.reason?.message}>
              <Textarea id="reason-text" autoFocus aria-invalid={!!errors.reason} {...form.register("reason")} />
            </Field>
          </DialogBody>
          <FooterButtons onCancel={() => onOpenChange(false)} permission={permission} label={confirmLabel} loading={pending} testId={testId} variant={variant} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

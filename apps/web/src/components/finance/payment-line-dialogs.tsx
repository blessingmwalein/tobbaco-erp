"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "@tobacco/ui";
import type { PaymentScheduleLine } from "@tobacco/shared";
import { bankConfirmationFormSchema, reasonSchema } from "@tobacco/validation";
import type { z } from "zod";
import { useAction } from "@/mock/hooks";
import { recordPaymentConfirmation, recordPaymentFailure } from "@/mock/domain/payments";
import { formatMoney } from "./money";

type ConfirmValues = z.infer<typeof bankConfirmationFormSchema>;
type ReasonValues = z.infer<typeof reasonSchema>;

/**
 * Record a VERIFIED payment confirmation. This is the only way a line becomes Paid — the reference and the exact amount
 * must come from the bank/CloudPay confirmation, not from our own schedule (so the field is intentionally not prefilled).
 * The form lives inside DialogContent, which Radix unmounts on close, so its state resets on every open.
 */
export function ConfirmPaymentDialog({
  line,
  onOpenChange,
}: {
  line: PaymentScheduleLine | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={line !== null} onOpenChange={onOpenChange}>
      <DialogContent>{line ? <ConfirmForm line={line} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function ConfirmForm({ line, onClose }: { line: PaymentScheduleLine; onClose: () => void }) {
  const { run, isPending } = useAction(recordPaymentConfirmation, { silent: true, success: "Payment confirmation recorded" });
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ConfirmValues>({ resolver: zodResolver(bankConfirmationFormSchema), defaultValues: { reference: "", amount: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    const res = await run({ lineId: line.id, reference: v.reference, amount: v.amount });
    if (res.ok) onClose();
    else setError(res.error.message);
  });

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Record bank confirmation</DialogTitle>
        <DialogDescription>
          {line.beneficiary} · {line.growerNo} · scheduled <strong>{formatMoney(line.amountCents, line.currency)}</strong>
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <Callout tone="warning" title="Only record what the bank or CloudPay actually confirmed">
          Downloading the CSV or submitting through the mock never marks a grower paid. Enter the reference and amount from the real confirmation.
        </Callout>
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="Confirmation reference" htmlFor="pc-ref" required error={errors.reference?.message}>
          <Input id="pc-ref" autoComplete="off" aria-invalid={!!errors.reference} {...form.register("reference")} />
        </Field>
        <Field label={`Confirmed amount (${line.currency})`} htmlFor="pc-amount" required hint="Must equal the scheduled amount to the cent" error={errors.amount?.message}>
          <Input id="pc-amount" inputMode="decimal" autoComplete="off" aria-invalid={!!errors.amount} {...form.register("amount")} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} data-testid="submit-confirmation">
          Record confirmation
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FailPaymentDialog({
  line,
  onOpenChange,
}: {
  line: PaymentScheduleLine | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={line !== null} onOpenChange={onOpenChange}>
      <DialogContent>{line ? <FailForm line={line} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function FailForm({ line, onClose }: { line: PaymentScheduleLine; onClose: () => void }) {
  const { run, isPending } = useAction(recordPaymentFailure, { silent: true, success: "Payment failure recorded" });
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ReasonValues>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    const res = await run({ lineId: line.id, reason: v.reason });
    if (res.ok) onClose();
    else setError(res.error.message);
  });

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Record payment failure</DialogTitle>
        <DialogDescription>
          {line.beneficiary} · {line.growerNo} · {formatMoney(line.amountCents, line.currency)}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="Reason" htmlFor="pf-reason" required error={errors.reason?.message}>
          <Textarea id="pf-reason" aria-invalid={!!errors.reason} {...form.register("reason")} />
        </Field>
        <p className="text-xs text-muted-foreground">The failure is added to the payment history; nothing is deleted. The line can be submitted again.</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" type="submit" loading={isPending} data-testid="submit-failure">
          Record failure
        </Button>
      </DialogFooter>
    </form>
  );
}

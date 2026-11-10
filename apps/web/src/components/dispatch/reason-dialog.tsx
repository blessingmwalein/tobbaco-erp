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
  Textarea,
  type ButtonProps,
} from "@tobacco/ui";
import { reasonSchema, type ReasonForm } from "@tobacco/validation";

/** Dialog that captures a mandatory reason (cancel / reset). The reason is audited. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "danger",
  onSubmit,
  loading,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: ButtonProps["variant"];
  /** Resolve `{ ok: true }` to close, or `{ ok: false, error }` to show the error inline. */
  onSubmit: (reason: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  loading?: boolean;
  testId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ReasonForm>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ reason }) => {
    setError(null);
    const res = await onSubmit(reason);
    if (res.ok) {
      form.reset({ reason: "" });
      onOpenChange(false);
    } else setError(res.error);
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
      <DialogContent data-testid={testId}>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <Field label="Reason" htmlFor="dispatch-reason" required error={errors.reason?.message}>
              <Textarea id="dispatch-reason" rows={3} aria-invalid={!!errors.reason} {...form.register("reason")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Keep note
            </Button>
            <Button type="submit" variant={tone} loading={loading}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

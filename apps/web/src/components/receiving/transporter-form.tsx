"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Callout, Field, Input } from "@tobacco/ui";
import { normaliseVehicleReg, transporterNoteFormSchema, type TransporterNoteForm } from "@tobacco/validation";
import { PermissionButton } from "@/lib/permissions";

type Output = z.output<typeof transporterNoteFormSchema>;

/**
 * Transporter delivery note fields (Manual 03, Step 1): Transporter Name, ID Number, Vehicle Reg (spaces removed
 * automatically), Phone Number, Permit No. (where applicable).
 */
export function TransporterForm({
  defaultValues,
  submitLabel,
  size = "lg",
  onSubmit,
  loading,
  autoFocus,
  idPrefix = "tn",
}: {
  defaultValues?: Partial<TransporterNoteForm>;
  submitLabel: string;
  size?: "md" | "lg";
  onSubmit: (values: Output) => Promise<string | null | void>;
  loading?: boolean;
  autoFocus?: boolean;
  idPrefix?: string;
}) {
  const form = useForm<TransporterNoteForm, unknown, Output>({
    resolver: zodResolver(transporterNoteFormSchema),
    defaultValues: { transporterName: "", idNumber: "", vehicleReg: "", phone: "", permitNo: "", ...defaultValues },
  });
  const [error, setError] = useState<string | null>(null);
  const { errors } = form.formState;
  const reg = useWatch({ control: form.control, name: "vehicleReg" });
  useEffect(() => {
    if (autoFocus) form.setFocus("transporterName");
  }, [autoFocus, form]);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    const message = await onSubmit(values);
    if (message) setError(message);
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" data-testid="transporter-form">
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Field label="Transporter Name" htmlFor={`${idPrefix}-name`} required error={errors.transporterName?.message} hint="The driver's name">
        <Input id={`${idPrefix}-name`} size={size} autoComplete="off" aria-invalid={!!errors.transporterName} {...form.register("transporterName")} />
      </Field>
      <Field label="ID Number" htmlFor={`${idPrefix}-id`} required error={errors.idNumber?.message} hint="The driver's national ID">
        <Input id={`${idPrefix}-id`} size={size} autoComplete="off" aria-invalid={!!errors.idNumber} {...form.register("idNumber")} />
      </Field>
      <Field
        label="Vehicle Reg"
        htmlFor={`${idPrefix}-reg`}
        required
        error={errors.vehicleReg?.message}
        hint={reg ? `Saved as ${normaliseVehicleReg(String(reg)) || "—"} — spaces are removed automatically` : "Number plate — spaces are removed automatically"}
      >
        <Input id={`${idPrefix}-reg`} size={size} autoComplete="off" aria-invalid={!!errors.vehicleReg} {...form.register("vehicleReg")} />
      </Field>
      <Field label="Phone Number" htmlFor={`${idPrefix}-phone`} required error={errors.phone?.message} hint="The driver's cellphone">
        <Input id={`${idPrefix}-phone`} size={size} inputMode="tel" autoComplete="off" aria-invalid={!!errors.phone} {...form.register("phone")} />
      </Field>
      <Field label="Permit No." htmlFor={`${idPrefix}-permit`} hint="Where applicable (optional)" error={errors.permitNo?.message}>
        <Input id={`${idPrefix}-permit`} size={size} autoComplete="off" {...form.register("permitNo")} />
      </Field>
      <PermissionButton permission="receiving.create-delivery" type="submit" size={size === "lg" ? "lg" : "md"} loading={loading} data-testid="transporter-submit">
        {submitLabel}
      </PermissionButton>
    </form>
  );
}

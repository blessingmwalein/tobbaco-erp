"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AlertTriangle, UserCheck, UserX } from "lucide-react";
import { AppError, normaliseGrowerNo } from "@tobacco/shared";
import { Callout, Field, Input, NativeSelect, toast } from "@tobacco/ui";
import { addGrowerFormSchema, type AddGrowerForm } from "@tobacco/validation";
import { useAction, useDb } from "@/mock/hooks";
import { addGrowerToNote } from "@/mock/domain/receiving";
import { selectSaleContext } from "@/lib/sale-context";
import { PermissionButton } from "@/lib/permissions";

type Output = z.output<typeof addGrowerFormSchema>;

/** "V" is a fixed prefix on the receiving screens: the clerk types the digits (a full V100060 is accepted too). */
export function GrowerNoInput({ id, error, ...props }: React.ComponentProps<typeof Input> & { error?: boolean }) {
  return (
    <div className="flex items-stretch">
      <span className="flex items-center rounded-l-2xl border border-r-0 border-border-strong bg-surface-tertiary px-4 font-mono text-lg font-semibold text-muted-foreground" aria-hidden>
        V
      </span>
      <Input id={id} size="lg" inputMode="text" autoComplete="off" aria-invalid={error || undefined} className="rounded-l-none font-mono" {...props} />
    </div>
  );
}

/** Add Grower: Grower No., Location, Number of Bales, Sale Day / Sale Month (Manual 03, Step 2). */
export function AddGrowerForm({ noteId }: { noteId: string }) {
  const ctx = useDb(selectSaleContext);
  const locations = useDb((db) => db.baleLocations);
  const { run, isPending } = useAction(addGrowerToNote, { silent: true });
  const [error, setError] = useState<string | null>(null);

  const saleDay = ctx.activeSaleDate ? Number(ctx.activeSaleDate.date.slice(8, 10)) : Number(ctx.today.slice(8, 10));
  const saleMonth = ctx.activeSaleDate ? Number(ctx.activeSaleDate.date.slice(5, 7)) : Number(ctx.today.slice(5, 7));

  const form = useForm<AddGrowerForm, unknown, Output>({
    resolver: zodResolver(addGrowerFormSchema),
    defaultValues: { growerNo: "", location: locations[0]?.code ?? "A", bales: "", saleDay, saleMonth },
  });
  const { errors } = form.formState;
  const typed = String(useWatch({ control: form.control, name: "growerNo" }) ?? "");
  const lookup = useDb((db) => {
    const no = normaliseGrowerNo(typed);
    if (!/^V\d{6}[A-Z]?$/.test(no)) return null;
    const g = db.growers.find((x) => x.growerNo === no);
    const booked = db.bookings.filter((b) => b.growerNo === no && b.sellDate === ctx.activeSaleDate?.date).reduce((a, b) => a + b.balesBooked, 0);
    return { no, grower: g, booked };
  });

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    const res = await run({ noteId, growerNo: v.growerNo, location: v.location, bales: v.bales, saleDay: v.saleDay, saleMonth: v.saleMonth });
    if (res.ok) {
      if (res.data.warning) toast.warning(res.data.warning);
      form.reset({ growerNo: "", location: v.location, bales: "", saleDay, saleMonth });
      form.setFocus("growerNo");
    } else {
      const field = res.error instanceof AppError ? res.error.field : undefined;
      if (field === "growerNo" || field === "bales") {
        form.setError(field, { message: res.error.message });
        form.setFocus(field);
      } else setError(res.error.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" data-testid="add-grower-form">
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Field label="Grower No." htmlFor="ag-grower" required error={errors.growerNo?.message}>
        <GrowerNoInput id="ag-grower" error={!!errors.growerNo} placeholder="100060" autoFocus {...form.register("growerNo")} />
      </Field>
      {lookup ? (
        <p className={`-mt-2 flex items-center gap-2 text-sm ${lookup.grower ? "text-success-text" : "text-danger-text"}`} aria-live="polite" data-testid="grower-lookup">
          {lookup.grower ? <UserCheck className="size-4" aria-hidden /> : <UserX className="size-4" aria-hidden />}
          {lookup.grower ? (
            <span>
              {lookup.grower.firstName} {lookup.grower.surname} · district {lookup.grower.district} ·{" "}
              {lookup.booked > 0 ? `${lookup.booked} bales booked today` : (
                <span className="inline-flex items-center gap-1 text-warning-text">
                  <AlertTriangle className="size-3.5" aria-hidden /> no booking for today
                </span>
              )}
            </span>
          ) : (
            "Not in the grower register"
          )}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Location" htmlFor="ag-location" required hint="The receiving row" error={errors.location?.message}>
          <NativeSelect id="ag-location" size="lg" {...form.register("location")}>
            {locations.map((l) => (
              <option key={l.code} value={l.code}>
                {l.code}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Number of Bales" htmlFor="ag-bales" required error={errors.bales?.message} hint="Count the bales off the truck">
          <Input id="ag-bales" size="lg" inputMode="numeric" aria-invalid={!!errors.bales} {...form.register("bales")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Sale Day" htmlFor="ag-day" hint="Today's sale date — change only if told to" error={errors.saleDay?.message}>
          <Input id="ag-day" size="md" inputMode="numeric" {...form.register("saleDay")} />
        </Field>
        <Field label="Sale Month" htmlFor="ag-month" error={errors.saleMonth?.message}>
          <Input id="ag-month" size="md" inputMode="numeric" {...form.register("saleMonth")} />
        </Field>
      </div>
      <PermissionButton permission="receiving.add-grower" type="submit" size="lg" loading={isPending} data-testid="add-grower">
        Add Grower
      </PermissionButton>
    </form>
  );
}

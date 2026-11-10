"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import {
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CheckField,
  Checkbox,
  Field,
  Input,
  NativeSelect,
} from "@tobacco/ui";
import { dispatchInitiateFormSchema, type DispatchInitiateForm } from "@tobacco/validation";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDb } from "@/mock/hooks";
import { PRODUCT_LABEL, initiateDispatch } from "@/mock/domain/dispatch";

/** "Initiate Dispatch" (Manual 09, Step 1). Large fields — this is a floor form. */
export function InitiateDispatchCard() {
  const router = useRouter();
  const warehouses = useDb((db) =>
    db.warehouses
      .filter((w) => w.active)
      .map((w) => ({ ...w, buyerNames: db.buyers.filter((b) => b.packingWarehouseCode === w.code).map((b) => b.code) })),
  );
  const [error, setError] = useState<string | null>(null);
  const { run, isPending } = useAction(initiateDispatch, { silent: true });

  const form = useForm<DispatchInitiateForm>({
    resolver: zodResolver(dispatchInitiateFormSchema),
    defaultValues: {
      warehouseCode: "",
      product: "GREEN",
      noTransportDetails: false,
      transportName: "",
      truckReg: "",
      driver: "",
      driverNationalId: "",
      driverCell: "",
    },
  });
  const { errors } = form.formState;
  const noTransport = useWatch({ control: form.control, name: "noTransportDetails" });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    const res = await run(values);
    if (res.ok) router.push(`/floor/dispatch/${res.data.id}`);
    else setError(res.error.message);
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">Initiate Dispatch</CardTitle>
          <CardDescription>Choose the buyer's packing warehouse and record the truck, then scan the bales onto it.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5" data-testid="initiate-dispatch-form">
          {error ? (
            <Callout tone="danger" title="Cannot create the dispatch note">
              {error}
            </Callout>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Destination Warehouse" htmlFor="di-warehouse" required error={errors.warehouseCode?.message}>
              <NativeSelect id="di-warehouse" size="lg" aria-invalid={!!errors.warehouseCode} {...form.register("warehouseCode")}>
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.code} — {w.name}
                    {w.buyerNames.length ? ` (buyers: ${w.buyerNames.join(", ")})` : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Product" htmlFor="di-product" required>
              <NativeSelect id="di-product" size="lg" {...form.register("product")}>
                <option value="GREEN">{PRODUCT_LABEL.GREEN}</option>
              </NativeSelect>
            </Field>
          </div>

          <CheckField id="di-no-transport" label="No Transportation Details" hint="Tick only if there's no truck to record">
            <Checkbox
              id="di-no-transport"
              checked={noTransport}
              onCheckedChange={(v) => form.setValue("noTransportDetails", v === true, { shouldValidate: form.formState.isSubmitted })}
            />
          </CheckField>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Transport Name" htmlFor="di-transport" required={!noTransport} error={errors.transportName?.message}>
              <Input id="di-transport" size="lg" disabled={noTransport} aria-invalid={!!errors.transportName} {...form.register("transportName")} />
            </Field>
            <Field label="Truck Reg Number" htmlFor="di-truck" required={!noTransport} error={errors.truckReg?.message}>
              <Input id="di-truck" size="lg" disabled={noTransport} aria-invalid={!!errors.truckReg} {...form.register("truckReg")} />
            </Field>
            <Field label="Driver" htmlFor="di-driver" required={!noTransport} error={errors.driver?.message}>
              <Input id="di-driver" size="lg" disabled={noTransport} aria-invalid={!!errors.driver} {...form.register("driver")} />
            </Field>
            <Field label="Driver National ID" htmlFor="di-driver-id">
              <Input id="di-driver-id" size="lg" disabled={noTransport} {...form.register("driverNationalId")} />
            </Field>
            <Field label="Driver Cellphone" htmlFor="di-driver-cell">
              <Input id="di-driver-cell" size="lg" inputMode="tel" disabled={noTransport} {...form.register("driverCell")} />
            </Field>
          </div>

          <div className="flex justify-end">
            <PermissionButton permission="dispatch.create" type="submit" size="lg" loading={isPending} data-testid="create-dispatch">
              Create &amp; Add Bales <ArrowRight />
            </PermissionButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

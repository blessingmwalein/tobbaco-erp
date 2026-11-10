"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  NativeSelect,
} from "@tobacco/ui";
import type { Buyer } from "@tobacco/shared";
import { upperCode } from "@tobacco/validation";
import { useAction, useDb } from "@/mock/hooks";
import { saveBuyer } from "@/mock/domain/timb";

const schema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9]{1,8}$/, "Buyer code must be 1–8 letters or digits"),
  name: z.string().trim().min(1, "Buyer name is required"),
  packingWarehouseCode: z.string().optional(),
  grades: z.string().trim(),
});
type Form = z.infer<typeof schema>;

export const parseGrades = (text: string): string[] => [...new Set(text.split(/[\s,;]+/).map(upperCode).filter(Boolean))];

/** Create or edit a buyer: code, packing warehouse and the buyer grades valid for that buyer (Manual 06). */
export function BuyerDialog({ open, onOpenChange, buyer }: { open: boolean; onOpenChange: (o: boolean) => void; buyer?: Buyer }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <BuyerForm buyer={buyer} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BuyerForm({ buyer, onDone, onCancel }: { buyer?: Buyer; onDone: () => void; onCancel: () => void }) {
  const warehouses = useDb((db) => db.warehouses.filter((w) => w.active));
  const [error, setError] = useState<string | null>(null);
  const { run, isPending } = useAction(saveBuyer, { silent: true, success: (b) => `Buyer ${b.code} saved` });
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: buyer?.code ?? "",
      name: buyer?.name ?? "",
      packingWarehouseCode: buyer?.packingWarehouseCode ?? "",
      grades: buyer?.grades.join(", ") ?? "",
    },
  });
  const { errors } = form.formState;
  const grades = parseGrades(useWatch({ control: form.control, name: "grades" }) ?? "");

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    const res = await run({
      code: v.code,
      name: v.name,
      packingWarehouseCode: v.packingWarehouseCode || undefined,
      grades: parseGrades(v.grades),
      isNew: !buyer,
    });
    if (res.ok) onDone();
    else setError(res.error.message);
  });

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{buyer ? `Edit buyer ${buyer.code}` : "Add buyer"}</DialogTitle>
        <DialogDescription>
          Buyer grades are validated against the selected buyer at data capture. The packing warehouse decides where a buyer's bales can be dispatched.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Buyer code" htmlFor="by-code" required error={errors.code?.message} hint="Converted to capitals">
            <Input id="by-code" disabled={Boolean(buyer)} aria-invalid={!!errors.code} {...form.register("code")} />
          </Field>
          <Field label="Buyer name" htmlFor="by-name" required error={errors.name?.message}>
            <Input id="by-name" aria-invalid={!!errors.name} {...form.register("name")} />
          </Field>
        </div>
        <Field label="Packing warehouse" htmlFor="by-wh" hint="Destination for dispatch">
          <NativeSelect id="by-wh" {...form.register("packingWarehouseCode")}>
            <option value="">None</option>
            {warehouses.map((w) => (
              <option key={w.code} value={w.code}>
                {w.code} — {w.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Buyer grades" htmlFor="by-grades" error={errors.grades?.message} hint={`Separate with commas or spaces. ${grades.length} grade(s): ${grades.join(" ") || "none"}`}>
          <Input id="by-grades" placeholder="11OF, 12OF" aria-invalid={!!errors.grades} {...form.register("grades")} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} data-testid="save-buyer">
          Save buyer
        </Button>
      </DialogFooter>
    </form>
  );
}

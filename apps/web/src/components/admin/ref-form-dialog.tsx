"use client";

import { useState } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  Button,
  Callout,
  CheckField,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Switch,
} from "@tobacco/ui";

export interface RefField {
  name: string;
  label: string;
  type: "text" | "number" | "switch" | "multicheck";
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  disabled?: boolean;
  uppercase?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  fields: RefField[];
  initial: FieldValues;
  schema: z.ZodType;
  submitLabel?: string;
  /** Resolve to an error message to keep the dialog open, or null on success. */
  onSubmit: (values: FieldValues) => Promise<string | null>;
}

/**
 * Small generic dialog for reference-data records. React Hook Form + Zod for inline validation;
 * the mock operation re-validates (uniqueness, references) and its message is shown inline.
 * The form body is mounted only while open, so it always starts from `initial`.
 */
export function RefFormDialog(props: Props) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="ref-dialog">{open ? <RefFormBody {...props} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function RefFormBody({ title, description, fields, initial, schema, submitLabel = "Save", onSubmit, onClose }: Props & { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<FieldValues>({ resolver: zodResolver(schema as never), defaultValues: initial });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    setError(null);
    const msg = await onSubmit(values);
    setPending(false);
    if (msg) setError(msg);
    else onClose();
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        {fields.map((f) => {
          const err = errors[f.name]?.message as string | undefined;
          const id = `ref-${f.name}`;
          if (f.type === "switch")
            return (
              <CheckField key={f.name} id={id} label={f.label} hint={f.hint}>
                <Switch id={id} checked={Boolean(form.watch(f.name))} disabled={f.disabled} onCheckedChange={(v) => form.setValue(f.name, v, { shouldDirty: true })} />
              </CheckField>
            );
          if (f.type === "multicheck") {
            const current = (form.watch(f.name) as string[] | undefined) ?? [];
            return (
              <fieldset key={f.name} className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-medium text-muted-foreground">{f.label}</legend>
                {(f.options ?? []).map((o) => (
                  <CheckField key={o.value} id={`${id}-${o.value}`} label={o.label}>
                    <Checkbox
                      id={`${id}-${o.value}`}
                      checked={current.includes(o.value)}
                      onCheckedChange={(v) => form.setValue(f.name, v === true ? [...new Set([...current, o.value])] : current.filter((x) => x !== o.value), { shouldDirty: true })}
                    />
                  </CheckField>
                ))}
                {f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
              </fieldset>
            );
          }
          return (
            <Field key={f.name} label={f.label} htmlFor={id} required={f.required} hint={f.hint} error={err}>
              <Input
                id={id}
                type={f.type === "number" ? "number" : "text"}
                placeholder={f.placeholder}
                disabled={f.disabled}
                className={f.uppercase ? "uppercase" : undefined}
                aria-invalid={!!err}
                {...form.register(f.name, f.type === "number" ? { valueAsNumber: true } : undefined)}
              />
            </Field>
          );
        })}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={pending} data-testid="ref-save">
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BadgeDollarSign, Pencil } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  CheckField,
  Checkbox,
  DataTable,
  DemoBadge,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  Field,
  Input,
  PageHeader,
  UnverifiedBadge,
  type ColumnDef,
} from "@tobacco/ui";
import { formatUsd, type GrowerCharge } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { useGuard } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import { saveGrowerCharge } from "@/mock/domain/stop-orders";

export default function GrowerChargesPage() {
  return (
    <RequirePermission permission="deductions.view">
      <Inner />
    </RequirePermission>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "Charge name is required"),
  order: z.coerce.number().int("Whole number").min(1, "Order starts at 1").max(99),
  active: z.boolean(),
});
type Values = z.input<typeof schema>;

function Inner() {
  const [editing, setEditing] = useState<GrowerCharge | null>(null);
  const canEdit = useGuard("deductions.process");
  const { data, isLoading } = useDbQuery(["finance", "grower-charges"], (db) => [...db.growerCharges].sort((a, b) => a.order - b.order));

  const columns: ColumnDef<GrowerCharge, unknown>[] = [
    { accessorKey: "order", header: "Order", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue<number>()}</span> },
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    { accessorKey: "name", header: "Charge", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "creditorCode", header: "Creditor code" },
    { accessorKey: "currency", header: "Currency" },
    { id: "basis", header: "Basis", accessorFn: (c) => c.basis, cell: () => <UnverifiedBadge uq="UQ-05" /> },
    {
      id: "amounts",
      header: "Illustrative amounts",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {Object.entries(row.original.demoAmountCentsByGrower).map(([g, c]) => (
            <span key={g} className="tabular">
              <span className="font-mono text-muted-foreground">{g}</span> {formatUsd(c)}
            </span>
          ))}
          <DemoBadge />
        </span>
      ),
    },
    { id: "active", header: "Status", accessorFn: (c) => (c.active ? "active" : "inactive"), cell: ({ row }) => <Badge tone={row.original.active ? "success" : "outline"} dot>{row.original.active ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Grower charges"
        description="Statutory and floor charges taken first at Stop Order Processing (Manual 07, deduction order 1)."
      />
      <div className="flex flex-col gap-4">
        <Callout tone="warning" title="Phase 1 posts illustrative fixed amounts">
          The manuals document the order of deductions and the dashboard totals ($123.11 floor charges across the two test growers) but <strong>not how each
          charge is calculated</strong>. Basis, rate and rounding are therefore unverified (UQ-05) and the per-grower amounts below are demo values. You can
          rename, reorder or switch a charge off; the formula itself cannot be configured until it is confirmed.
        </Callout>
        <DataTable
          aria-label="Grower charges"
          data-testid="charges-table"
          columns={columns}
          data={data ?? []}
          loading={isLoading}
          emptyIcon={BadgeDollarSign}
          emptyTitle="No grower charges configured"
          hidePagerWhenSinglePage
          enableColumnVisibility={false}
          initialSorting={[{ id: "order", desc: false }]}
          rowMenu={(row) => (
            <DropdownMenuItem disabled={!canEdit.allowed} onSelect={() => setEditing(row)}>
              <Pencil /> Edit charge
            </DropdownMenuItem>
          )}
        />
      </div>
      <EditDialog charge={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  );
}

function EditDialog({ charge, onOpenChange }: { charge: GrowerCharge | null; onOpenChange: (open: boolean) => void }) {
  const { run, isPending } = useAction(saveGrowerCharge, { silent: true, success: "Grower charge updated" });
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), values: charge ? { name: charge.name, order: charge.order, active: charge.active } : { name: "", order: 1, active: true } });
  const { errors } = form.formState;
  const active = useWatch({ control: form.control, name: "active" });
  const submit = form.handleSubmit(async (v) => {
    if (!charge) return;
    setError(null);
    const parsed = schema.parse(v);
    const res = await run({ code: charge.code, name: parsed.name, order: parsed.order, active: parsed.active });
    if (res.ok) onOpenChange(false);
    else setError(res.error.message);
  });
  return (
    <Dialog open={charge !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Edit grower charge</DialogTitle>
            <DialogDescription>{charge ? `${charge.code} · creditor ${charge.creditorCode}` : null}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <Field label="Charge name" htmlFor="gc-name" required error={errors.name?.message}>
              <Input id="gc-name" aria-invalid={!!errors.name} {...form.register("name")} />
            </Field>
            <Field label="Order" htmlFor="gc-order" required hint="Position within the floor-charge group" error={errors.order?.message}>
              <Input id="gc-order" inputMode="numeric" aria-invalid={!!errors.order} {...form.register("order")} />
            </Field>
            <CheckField id="gc-active" label="Active" hint="Inactive charges are not deducted">
              <Checkbox id="gc-active" checked={active} onCheckedChange={(v) => form.setValue("active", v === true)} />
            </CheckField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Save charge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

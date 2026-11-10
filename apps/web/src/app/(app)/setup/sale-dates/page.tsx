"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  CheckField,
  Checkbox,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  DateInput,
  PageHeader,
  Switch,
  type ColumnDef,
} from "@tobacco/ui";
import { formatDateTime, longDate, type ReceivingSaleDate } from "@tobacco/shared";
import { saleDateFormSchema, type SaleDateForm } from "@tobacco/validation";
import { PermissionButton, useGuard } from "@/lib/permissions";
import { useAction, useDb, useDbQuery } from "@/mock/hooks";
import { userName } from "@/mock/ctx";
import { createSaleDate, setFloorScanning, setSaleDateActive } from "@/mock/domain/daily-setup";

type Row = ReceivingSaleDate & { createdByName: string; expired: boolean };

export default function SaleDatesPage() {
  const today = useDb((db) => db.settings.demoToday);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useDbQuery(["sale-dates"], (db): Row[] =>
    db.receivingSaleDates
      .map((d) => ({ ...d, createdByName: userName(db, d.createdBy), expired: d.isActive && d.date < db.settings.demoToday }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  );
  const activate = useAction(setSaleDateActive, { success: (_, i) => (i.isActive ? "Sale date activated — the previous date was deactivated" : "Sale date deactivated") });
  const scanning = useAction(setFloorScanning, { success: (_, i) => (i.enabled ? "Floor summary scanning turned on" : "Floor summary scanning turned off") });
  const canActivate = useGuard("sale-day.activate");
  const canToggleScan = useGuard("floor-summary.toggle-scanning");

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "date", header: "Date of sale", cell: ({ row }) => <span className="font-medium">{longDate(row.original.date)}</span> },
    {
      id: "active",
      header: "Active",
      accessorFn: (r) => (r.isActive ? "active" : "inactive"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.isActive}
            disabled={!canActivate.allowed}
            aria-label={`Active: ${row.original.date}`}
            onCheckedChange={(v) => activate.run({ id: row.original.id, isActive: v })}
          />
          {row.original.expired ? <Badge tone="danger">Expired</Badge> : row.original.isActive ? <Badge tone="success" dot>Current</Badge> : null}
        </div>
      ),
    },
    {
      id: "scan",
      header: "Can scan floor summary?",
      accessorFn: (r) => (r.canScanFloorSummary ? "yes" : "no"),
      cell: ({ row }) =>
        row.original.isActive ? (
          <Switch
            checked={row.original.canScanFloorSummary}
            disabled={!canToggleScan.allowed}
            aria-label="Floor summary scanning"
            onCheckedChange={(v) => scanning.run({ enabled: v })}
          />
        ) : (
          <span className="text-sm text-muted-foreground">{row.original.canScanFloorSummary ? "Yes" : "No"}</span>
        ),
    },
    { accessorKey: "createdByName", header: "Created by" },
    { accessorKey: "createdAt", header: "Created", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Sale dates — receiving"
        description="The receiving sale date must exist and be active every sale day. Ticket printing and floor summary scanning depend on it."
        actions={
          <PermissionButton permission="sale-day.create" onClick={() => setOpen(true)} data-testid="new-sale-date">
            <Plus /> New sale date
          </PermissionButton>
        }
      />
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="How it works (Manual 01, Step 1)">
          Tick <strong>Is Active</strong> to make a date current — this unticks the previous date. If the active date is in the past, ticket
          printing refuses with “Date has expired. Please set a valid sale date”. Floor-summary scanning can be switched off for the whole floor
          by the receiving manager.
        </Callout>
        <DataTable
          data-testid="sale-dates-table"
          aria-label="Receiving sale dates"
          columns={columns}
          data={data ?? []}
          loading={isLoading}
          emptyIcon={CalendarDays}
          emptyTitle="No sale dates yet"
          emptyDescription="Create today's receiving sale date to start the day."
          hidePagerWhenSinglePage
          enableColumnVisibility={false}
        />
      </div>
      <SaleDateDialog open={open} onOpenChange={setOpen} today={today} />
    </>
  );
}

function SaleDateDialog({ open, onOpenChange, today }: { open: boolean; onOpenChange: (o: boolean) => void; today: string }) {
  const { run, isPending } = useAction(createSaleDate, { success: (r) => `Sale date ${r.date} created${r.isActive ? " and activated" : ""}`, silent: true });
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SaleDateForm>({
    resolver: zodResolver(saleDateFormSchema),
    defaultValues: { date: today, isActive: true, canScanFloorSummary: true },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const res = await run(values);
    if (res.ok) onOpenChange(false);
    else setError(res.error.message);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>New sale date — receiving</DialogTitle>
            <DialogDescription>Enter today's date and mark it active so receiving and ticket printing can run.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error ? <Callout tone="danger">{error}</Callout> : null}
            <Field label="Date of sale" htmlFor="sd-date" required error={errors.date?.message}>
              <DateInput id="sd-date" aria-invalid={!!errors.date} {...form.register("date")} />
            </Field>
            <CheckField id="sd-active" label="Is Active" hint="Ticking this unticks the previous date">
              <Checkbox id="sd-active" checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v === true)} />
            </CheckField>
            <CheckField id="sd-scan" label="Can Scan Floor Summary?" hint="Tick so floor summary scanning is allowed">
              <Checkbox id="sd-scan" checked={form.watch("canScanFloorSummary")} onCheckedChange={(v) => form.setValue("canScanFloorSummary", v === true)} />
            </CheckField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Save sale date
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

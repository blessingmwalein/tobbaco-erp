"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import {
  Badge,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataTable,
  DateInput,
  Field,
  Input,
  PageHeader,
  UnverifiedBadge,
  type ColumnDef,
} from "@tobacco/ui";
import { MESSAGES, formatDateTime, formatRate, longDate, type StartOfDay } from "@tobacco/shared";
import { startOfDayFormSchema, validateStartOfDayPrerequisites, type StartOfDayForm } from "@tobacco/validation";
import { StatusBadge } from "@/components/domain/status-badge";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDb, useDbQuery } from "@/mock/hooks";
import { userName } from "@/mock/ctx";
import { postStartOfDay } from "@/mock/domain/daily-setup";

type Row = StartOfDay & { createdByName: string };

export default function StartOfDayPage() {
  const today = useDb((db) => db.settings.demoToday);
  const { data, isLoading } = useDbQuery(["start-of-days"], (db): Row[] =>
    db.startOfDays.map((s) => ({ ...s, createdByName: userName(db, s.createdBy) })).sort((a, b) => b.sellingDate.localeCompare(a.sellingDate)),
  );
  const [confirm, setConfirm] = useState<StartOfDayForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { run, isPending } = useAction(postStartOfDay, { silent: true });

  const form = useForm<StartOfDayForm>({
    resolver: zodResolver(startOfDayFormSchema),
    defaultValues: { sellingDate: today, exchangeRate: "" },
  });
  const sellingDate = form.watch("sellingDate");
  const rateText = form.watch("exchangeRate");
  const { errors } = form.formState;

  // Live prerequisites (the same rules the "backend" enforces on post).
  const checks = useDb((db) => {
    const sales = db.sales.map((s) => ({ saleDate: s.saleDate, status: s.status }));
    const prereq = validateStartOfDayPrerequisites({ selectedDate: sellingDate, sales });
    const blocking = db.sales.filter((s) => s.saleDate < sellingDate && (s.status === "DRAFT" || s.status === "BALANCED"));
    const saleDate = db.receivingSaleDates.find((d) => d.date === sellingDate);
    const posted = db.startOfDays.find((s) => s.sellingDate === sellingDate && s.status === "POSTED");
    return { prereq, blocking, saleDate, posted };
  });
  const rateOk = Number.isFinite(Number(rateText)) && Number(rateText) > 0;

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "sellingDate", header: "Selling date", cell: ({ getValue }) => <span className="font-medium">{longDate(getValue<string>())}</span> },
    { accessorKey: "exchangeRate", header: "Exchange rate", cell: ({ getValue }) => <span className="tabular font-mono">{getValue<string>()}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge kind="startOfDay" value={getValue<string>()} /> },
    { accessorKey: "createdByName", header: "Created by" },
    { accessorKey: "postedAt", header: "Posted", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
  ];

  const doPost = async (values: StartOfDayForm) => {
    setError(null);
    setSuccess(null);
    const res = await run(values);
    if (res.ok) {
      setSuccess(MESSAGES.SOD_COMPLETED.text);
      form.reset({ sellingDate: today, exchangeRate: "" });
    } else setError(res.error.message);
    setConfirm(null);
  };

  return (
    <>
      <PageHeader
        title="Start of Day"
        description="Post the day's exchange rate. Data capture, balancing and stop-order processing need a posted Start of Day."
      />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Post Start of Day</CardTitle>
              <CardDescription>Choose the selling date and enter the day's exchange rate.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit((v) => {
                setError(null);
                setSuccess(null);
                setConfirm(v);
              })}
            >
              {error ? <Callout tone="danger" title="Cannot post Start of Day">{error}</Callout> : null}
              {success ? <Callout tone="success">{success}</Callout> : null}
              <Field label="Selling date" htmlFor="sod-date" required error={errors.sellingDate?.message}>
                <DateInput id="sod-date" aria-invalid={!!errors.sellingDate} {...form.register("sellingDate")} />
              </Field>
              <Field
                label="Exchange rate"
                htmlFor="sod-rate"
                required
                hint="Local currency units per 1 USD, e.g. 26.6845"
                error={errors.exchangeRate?.message}
              >
                <Input id="sod-rate" inputMode="decimal" placeholder="26.6845" aria-invalid={!!errors.exchangeRate} {...form.register("exchangeRate")} />
              </Field>

              <div className="rounded-xl bg-surface-secondary p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Checks before posting</p>
                <ul className="flex flex-col gap-1.5 text-sm" data-testid="sod-checks">
                  <Check ok={rateOk} label="Exchange rate is bigger than zero" pendingLabel="Enter the day's exchange rate" />
                  <Check
                    ok={checks.prereq.ok}
                    fail={!checks.prereq.ok}
                    label="Earlier sales are all Balanced or Processed"
                    detail={checks.blocking.length ? `${checks.blocking.length} earlier sale(s) still Draft or Balanced` : undefined}
                  />
                  <Check ok={Boolean(checks.saleDate?.isActive)} label={`Receiving sale date for ${longDate(sellingDate || today)} is active`} pendingLabel="Not required to post, but needed for ticket printing" soft />
                  {checks.posted ? <Check ok={false} fail label={`Start of Day already posted (${formatRate(checks.posted.exchangeRate)})`} /> : null}
                </ul>
              </div>

              <PermissionButton permission="sale-day.post" type="submit" disabled={!!checks.posted} data-testid="post-sod">
                Post Start of Day
              </PermissionButton>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <UnverifiedBadge uq="UQ-16" /> Whether a posted rate can be corrected is not documented.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="xl:col-span-3">
          <DataTable
            aria-label="Start of Day records"
            data-testid="sod-table"
            columns={columns}
            data={data ?? []}
            loading={isLoading}
            emptyTitle="No Start of Day records"
            hidePagerWhenSinglePage
            enableColumnVisibility={false}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Post Start of Day?"
        description={
          confirm ? (
            <>
              Selling date <strong>{longDate(confirm.sellingDate)}</strong> at exchange rate <strong>{confirm.exchangeRate}</strong>. Data capture,
              balancing and stop order processing will use this rate.
            </>
          ) : undefined
        }
        confirmLabel="Post Start of Day"
        loading={isPending}
        onConfirm={() => (confirm ? doPost(confirm) : undefined)}
      />
    </>
  );
}

function Check({ ok, fail, label, detail, pendingLabel, soft }: { ok: boolean; fail?: boolean; label: string; detail?: string; pendingLabel?: string; soft?: boolean }) {
  const Icon = ok ? CheckCircle2 : fail ? XCircle : Circle;
  return (
    <li className="flex items-start gap-2">
      <Icon className={`mt-0.5 size-4 shrink-0 ${ok ? "text-success-text" : fail ? "text-danger-text" : "text-muted-foreground"}`} aria-hidden />
      <span>
        <span className={ok ? "" : fail ? "text-danger-text" : "text-muted-foreground"}>{label}</span>
        {!ok && (detail || pendingLabel) ? <span className="block text-xs text-muted-foreground">{detail ?? pendingLabel}</span> : null}
        {soft && !ok ? <Badge tone="outline" className="ml-1">advisory</Badge> : null}
      </span>
    </li>
  );
}

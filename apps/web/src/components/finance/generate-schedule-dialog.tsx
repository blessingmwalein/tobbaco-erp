"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Download, Info, ShieldAlert } from "lucide-react";
import {
  Button,
  Callout,
  ConfirmDialog,
  DateInput,
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
  UnverifiedBadge,
} from "@tobacco/ui";
import { MESSAGES } from "@tobacco/shared";
import { PermissionButton } from "@/lib/permissions";
import { downloadCsv } from "@/lib/csv";
import { useAction, useDb } from "@/mock/hooks";
import {
  generatePaymentSchedule,
  payWithCloudPayMock,
  recordCsvDownload,
  type GenerateScheduleResult,
} from "@/mock/domain/payments";

const formSchema = z.object({
  invoicesDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invoices date is required"),
  sellingPointId: z.string().min(1, "Selling point is required"),
  batchNo: z.string().trim().regex(/^\d+$/, "Batch # must be 0 (every unpaid sale that date) or a pay batch number"),
  currency: z.string().min(1),
  gateway: z.enum(["NONE", "CLOUDPAY"]),
});
type FormValues = z.infer<typeof formSchema>;

export interface GenerateDefaults {
  batchNo?: number;
  currency?: string;
  invoicesDate?: string;
}

/**
 * "Generate Payment Schedule" (Manual 08 Step 2): Invoices Date, Selling Point, Batch #, Currency, Payment Gateway.
 * Generate Payment Schedule → bank CSV (the download is explicit and never marks anyone paid).
 * Pay with CloudPay → MOCK in the demo; nothing is sent to any bank.
 */
export function GenerateScheduleDialog({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: GenerateDefaults;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {/* Mounted only while open, so the form state resets on every open. */}
        <GenerateForm defaults={defaults} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function GenerateForm({ defaults, onClose }: { defaults?: GenerateDefaults; onClose: () => void }) {
  const today = useDb((db) => db.settings.demoToday);
  const sellingPoints = useDb((db) => db.sellingPoints);
  const local = useDb((db) => db.settings.localCurrencyCode);
  const schedules = useDb((db) => db.paymentSchedules);
  const [result, setResult] = useState<GenerateScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCloudPay, setConfirmCloudPay] = useState(false);
  const gen = useAction(generatePaymentSchedule, { silent: true });
  const csv = useAction(recordCsvDownload, { silent: true });
  const cloud = useAction(payWithCloudPayMock, { silent: true });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoicesDate: defaults?.invoicesDate ?? today,
      sellingPointId: sellingPoints[0]?.id ?? "EL",
      batchNo: String(defaults?.batchNo ?? 0),
      currency: defaults?.currency ?? "USD",
      gateway: "NONE",
    },
  });
  const { errors } = form.formState;
  const batchText = useWatch({ control: form.control, name: "batchNo" });
  const currency = useWatch({ control: form.control, name: "currency" });
  const batchNo = Number(batchText || 0);
  const existing = batchNo > 0 ? schedules.find((s) => s.payBatchNo === batchNo && s.currency === currency && s.status !== "FAILED") : undefined;

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    setResult(null);
    const res = await gen.run({ invoicesDate: v.invoicesDate, sellingPointId: v.sellingPointId, batchNo: Number(v.batchNo), currency: v.currency });
    if (res.ok) setResult(res.data);
    else setError(res.error.message);
  });

  const download = async (scheduleId: string) => {
    const res = await csv.run({ scheduleId });
    if (res.ok) downloadCsv(res.data.filename, res.data.headers, res.data.rows);
    else setError(res.error.message);
  };

  const submitCloudPay = async () => {
    if (!existing) return;
    setError(null);
    const res = await cloud.run({ scheduleId: existing.id });
    setConfirmCloudPay(false);
    if (res.ok) setResult({ schedules: [existing], excluded: [] });
    else setError(res.error.message);
  };

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        <DialogHeader>
          <DialogTitle>Generate Payment Schedule</DialogTitle>
          <DialogDescription>One schedule per currency for a pay batch. Growers without bank details are left out of the file.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error ? (
            <Callout tone="danger" title="Cannot generate the schedule">
              {error}
            </Callout>
          ) : null}
          {result ? (
            <Callout tone="success" title={`${result.schedules.length} schedule(s) ready`}>
              <ul className="mt-1 flex flex-col gap-1.5" data-testid="schedule-result">
                {result.schedules.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/finance/payments/${s.payBatchNo}`} className="font-mono text-[13px] font-semibold underline">
                      {s.ref}
                    </Link>
                    <span> · {s.status.toLowerCase().replace("_", " ")}</span>
                    <Button type="button" size="sm" variant="secondary" onClick={() => download(s.id)} data-testid="download-csv-dialog">
                      <Download /> Download bank CSV
                    </Button>
                  </li>
                ))}
              </ul>
              {result.excluded.length > 0 ? (
                <p className="mt-2 text-xs">Left out: {result.excluded.map((e) => `${e.growerNo} (${e.reason})`).join("; ")}</p>
              ) : null}
              <p className="mt-2 text-xs">{MESSAGES.PAY_CSV_NOT_PAID.text}</p>
            </Callout>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoices Date" htmlFor="gs-date" required hint="The sale date" error={errors.invoicesDate?.message}>
              <DateInput id="gs-date" aria-invalid={!!errors.invoicesDate} {...form.register("invoicesDate")} />
            </Field>
            <Field label="Selling Point" htmlFor="gs-sp" required error={errors.sellingPointId?.message}>
              <NativeSelect id="gs-sp" {...form.register("sellingPointId")}>
                {sellingPoints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Batch #" htmlFor="gs-batch" required hint="The pay batch, or 0 for every unpaid sale on that date" error={errors.batchNo?.message}>
              <Input id="gs-batch" inputMode="numeric" aria-invalid={!!errors.batchNo} {...form.register("batchNo")} />
            </Field>
            <Field
              label={
                <span className="inline-flex items-center gap-2">
                  Currency <UnverifiedBadge uq="UQ-04" />
                </span>
              }
              htmlFor="gs-cur"
              required
              hint="Run the schedule once for each currency"
            >
              <NativeSelect id="gs-cur" {...form.register("currency")}>
                <option value="USD">USD</option>
                <option value={local}>{local}</option>
              </NativeSelect>
            </Field>
            <Field
              label="Payment Gateway"
              htmlFor="gs-gw"
              hint="Blank = bank CSV only. CloudPay is a mock here: nothing is sent to any bank."
              className="sm:col-span-2"
            >
              <NativeSelect id="gs-gw" {...form.register("gateway")}>
                <option value="NONE">— none (bank CSV) —</option>
                <option value="CLOUDPAY">CloudPay (mock)</option>
              </NativeSelect>
            </Field>
          </div>

          {existing ? (
            <Callout tone="info" title={`${existing.ref} already exists`}>
              A schedule for pay batch {batchNo} in {currency} was generated already ({existing.status.toLowerCase().replace("_", " ")}). Duplicates are not
              created — open it from the pay batch page. You can still submit it with CloudPay (mock).
            </Callout>
          ) : null}
          {currency !== "USD" ? (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Phase 1 converts each grower's net at the Start-of-Day rate for the {local} schedule; how the real payout splits between USD and local currency
              is not documented.
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <PermissionButton
            permission="payments.export"
            type="button"
            variant="dark"
            disabled={!existing}
            disabledReason={!existing ? "Generate the schedule first (pick the pay batch number)." : undefined}
            onClick={() => setConfirmCloudPay(true)}
            data-testid="pay-cloudpay"
          >
            <ShieldAlert /> Pay with CloudPay (mock)
          </PermissionButton>
          <PermissionButton permission="payments.generate-schedule" type="submit" loading={gen.isPending} data-testid="generate-schedule">
            Generate Payment Schedule
          </PermissionButton>
        </DialogFooter>
      </form>

      <ConfirmDialog
        open={confirmCloudPay}
        onOpenChange={setConfirmCloudPay}
        title="Submit through CloudPay (mock)?"
        description={
          <>
            {MESSAGES.PAY_CLOUDPAY_MOCK.text} In production this button sends <strong>real payment instructions</strong>
            {existing ? ` for ${existing.ref}` : ""}. Lines move to “Submitted”, never to “Paid”.
          </>
        }
        confirmLabel="Submit (mock)"
        tone="dark"
        loading={cloud.isPending}
        onConfirm={submitCloudPay}
      />
    </>
  );
}

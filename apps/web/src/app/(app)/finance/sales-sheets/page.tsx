"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileSpreadsheet, Printer } from "lucide-react";
import {
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DateInput,
  EmptyState,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  UnverifiedBadge,
} from "@tobacco/ui";
import { SalesSheet } from "@/components/finance/sales-sheet";
import { RequirePermission } from "@/components/page-guard";
import { PermissionButton } from "@/lib/permissions";
import { useDb, useDbQuery } from "@/mock/hooks";
import { selectSalesSheets } from "@/mock/domain/payments";

export default function SalesSheetsPage() {
  return (
    <RequirePermission permission="payments.view">
      <Inner />
    </RequirePermission>
  );
}

const schema = z.object({
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sale date is required"),
  sellingPointId: z.string().min(1, "Selling point is required"),
  refNo: z.string().trim().regex(/^\d+$/, "REF# is a number — 0 for every grower"),
  batchNo: z.string().trim().regex(/^\d+$/, "Batch # is a number — 0 for every batch"),
});
type Values = z.infer<typeof schema>;
type Applied = { saleDate: string; sellingPointId: string; refNo: number; batchNo: number };

function Inner() {
  const today = useDb((db) => db.settings.demoToday);
  const sellingPoints = useDb((db) => db.sellingPoints);
  const [applied, setApplied] = useState<Applied | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { saleDate: today, sellingPointId: sellingPoints[0]?.id ?? "EL", refNo: "0", batchNo: "0" },
  });
  const { errors } = form.formState;
  const { data, isLoading, isFetching } = useDbQuery(["finance", "sales-sheets", applied], (db) => selectSalesSheets(db, applied!), { enabled: applied !== null });
  const spName = (id: string) => sellingPoints.find((s) => s.id === id)?.name ?? id;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Sales sheet Report"
          description="Print each grower's sales sheet after the sale is Processed: tickets, gross, deductions and net payout."
          badges={<UnverifiedBadge uq="UQ-12" />}
          actions={
            data && data.length > 0 ? (
              <Button onClick={() => window.print()} data-testid="print-sheets">
                <Printer /> Print sheets
              </Button>
            ) : null
          }
        />
        <div className="flex flex-col gap-4">
          <Callout tone="warning" title="Which report does Ethical use? (Manual 08, open item 1)">
            On the e-Port sandbox the installed report printed a blank page. This sheet is built from the data held here so the step can be reviewed; confirm
            the report Ethical signs off before relying on its layout.
          </Callout>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Get report</CardTitle>
                <CardDescription>Choose the sale date and selling point; optionally one sale (REF#) or a pay batch (Batch #).</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form
                noValidate
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end"
                onSubmit={form.handleSubmit((v) => setApplied({ saleDate: v.saleDate, sellingPointId: v.sellingPointId, refNo: Number(v.refNo), batchNo: Number(v.batchNo) }))}
              >
                <Field label="Sale Date" htmlFor="ss-date" required error={errors.saleDate?.message}>
                  <DateInput id="ss-date" aria-invalid={!!errors.saleDate} {...form.register("saleDate")} />
                </Field>
                <Field label="Selling Point" htmlFor="ss-sp" required error={errors.sellingPointId?.message}>
                  <NativeSelect id="ss-sp" {...form.register("sellingPointId")}>
                    {sellingPoints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="REF#" htmlFor="ss-ref" hint="One grower's sale (Salesmaster #), or 0" error={errors.refNo?.message}>
                  <Input id="ss-ref" inputMode="numeric" aria-invalid={!!errors.refNo} {...form.register("refNo")} />
                </Field>
                <Field label="Batch #" htmlFor="ss-batch" hint="Pay batch, or 0" error={errors.batchNo?.message}>
                  <Input id="ss-batch" inputMode="numeric" aria-invalid={!!errors.batchNo} {...form.register("batchNo")} />
                </Field>
                <PermissionButton permission="payments.view" type="submit" data-testid="get-report">
                  Get Report
                </PermissionButton>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6" data-testid="sheets">
        {applied === null ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No report yet"
            description="Choose a sale date and click Get Report."
            className="rounded-2xl border border-border bg-surface print:hidden"
          />
        ) : isLoading || (isFetching && !data) ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : data && data.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No processed sales match"
            description="Sales sheets are available once a sale is Processed (Manual 07). Check the date, REF# and batch number."
            className="rounded-2xl border border-border bg-surface print:hidden"
          />
        ) : (
          data?.map((sheet) => <SalesSheet key={sheet.sale.id} sheet={sheet} sellingPointName={spName(sheet.sale.sellingPointId)} />)
        )}
      </div>
    </>
  );
}

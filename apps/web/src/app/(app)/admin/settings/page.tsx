"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, RotateCcw } from "lucide-react";
import {
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CheckField,
  Checkbox,
  ConfirmDialog,
  DemoBadge,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  Switch,
  UnverifiedBadge,
} from "@tobacco/ui";
import { longDate, type Settings } from "@tobacco/shared";
import { settingsFormSchema, type SettingsForm } from "@/components/admin/schemas";
import { RequirePermission } from "@/components/page-guard";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import { APPROVABLE_ACTIONS, pickEditable, resetSettings, saveSettings } from "@/mock/domain/admin";

function WithBadge({ children, badge }: { children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      {badge}
    </span>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useDbQuery(["admin", "settings"], (db) => db.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = useAction(resetSettings, { success: "Settings reset to the documented defaults" });
  const editableKey = settings ? JSON.stringify(pickEditable(settings)) : "";

  return (
    <RequirePermission permission="admin.settings">
      <PageHeader
        title="Settings"
        description="System configuration that the manuals do not fix. Each value is configurable here and marked UNVERIFIED until the business confirms it."
        actions={
          <Button variant="secondary" onClick={() => setConfirmReset(true)} data-testid="reset-settings">
            <RotateCcw /> Reset to documented defaults
          </Button>
        }
      />
      {isLoading || !settings ? <Skeleton className="h-96 rounded-2xl" /> : <SettingsFormBody key={editableKey} settings={settings} />}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset settings to the documented defaults?"
        description="Currency, sale codes, policies, approval triggers and bank CSV defaults return to their starting values. The change is audited."
        confirmLabel="Reset settings"
        loading={reset.isPending}
        onConfirm={async () => {
          await reset.run(undefined);
          setConfirmReset(false);
        }}
      />
    </RequirePermission>
  );
}

/** Remounted (via `key`) whenever the saved values change, so the form always reflects what is stored. */
function SettingsFormBody({ settings }: { settings: Settings }) {
  const s = pickEditable(settings);
  const [approvals, setApprovals] = useState<string[]>(s.approvalRequiredFor);
  const [error, setError] = useState<string | null>(null);
  const save = useAction(saveSettings, { silent: true, success: "Settings saved" });

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      localCurrencyCode: s.localCurrencyCode,
      rejectedSaleCodes: s.rejectedSaleCodes.join(", "),
      unbookedPolicy: s.unbookedPolicy,
      requireDifferentBatchUser: s.requireDifferentBatchUser,
      companyName: s.companyName,
      debitAccount: s.debitAccount,
      bankCsvTransactionType: s.bankCsvTransactionType,
    },
  });
  const { errors, isDirty } = form.formState;
  const approvalsDirty = JSON.stringify([...approvals].sort()) !== JSON.stringify([...s.approvalRequiredFor].sort());

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    const res = await save.run({
      localCurrencyCode: v.localCurrencyCode,
      rejectedSaleCodes: v.rejectedSaleCodes.split(",").map((c) => c.trim()).filter(Boolean),
      unbookedPolicy: v.unbookedPolicy,
      requireDifferentBatchUser: v.requireDifferentBatchUser,
      approvalRequiredFor: approvals,
      companyName: v.companyName,
      debitAccount: v.debitAccount,
      bankCsvTransactionType: v.bankCsvTransactionType,
    });
    if (!res.ok) setError(res.error.message);
  });

  const known = new Set(APPROVABLE_ACTIONS.map((a) => a.key));
  const unknownApprovals = approvals.filter((a) => !known.has(a));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" data-testid="settings-form">
      {error ? <Callout tone="danger">{error}</Callout> : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Operating context</CardTitle>
            <CardDescription>Read-only in the demo.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Demo sale day" htmlFor="s-demo-day" hint="The documented test day; the mock clock is pinned to it">
            <Input id="s-demo-day" value={longDate(settings.demoToday)} readOnly disabled data-testid="demo-today" />
          </Field>
          <Field label="Current selling point" htmlFor="s-selling-point">
            <Input id="s-selling-point" value={settings.sellingPointId} readOnly disabled />
          </Field>
          <Field label="Current season" htmlFor="s-season">
            <Input id="s-season" value={String(settings.seasonYear)} readOnly disabled />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Currency and sale codes</CardTitle>
            <CardDescription>Used by Start of Day, payments and dispatch.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label={<WithBadge badge={<UnverifiedBadge uq="UQ-04" />}>Local currency code</WithBadge>}
            htmlFor="s-currency"
            required
            hint="The manuals say ZWL (Manual 08), “ZWG Payment Ref” on the sale form and “RTGS Value” in lists."
            error={errors.localCurrencyCode?.message}
          >
            <Input id="s-currency" maxLength={3} className="uppercase" aria-invalid={!!errors.localCurrencyCode} {...form.register("localCurrencyCode")} />
          </Field>
          <Field
            label="Rejected sale codes"
            htmlFor="s-codes"
            required
            hint="Documented: RO, RH, CO — never dispatched. Other sale codes are not documented (UQ-08). Comma-separated."
            error={errors.rejectedSaleCodes?.message}
          >
            <Input id="s-codes" aria-invalid={!!errors.rejectedSaleCodes} {...form.register("rejectedSaleCodes")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Receiving and capture rules</CardTitle>
            <CardDescription>Behaviours the manuals leave open.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field
            label={<WithBadge badge={<UnverifiedBadge uq="UQ-09" />}>Unbooked bales at receiving</WithBadge>}
            htmlFor="s-unbooked"
            hint="Manual 02 says receiving checks deliveries against bookings, but not whether it blocks."
          >
            <NativeSelect id="s-unbooked" {...form.register("unbookedPolicy")}>
              <option value="WARN">Warn — allow, flag the exception</option>
              <option value="BLOCK">Block — refuse the delivery</option>
            </NativeSelect>
          </Field>
          <CheckField
            id="s-diff"
            label={<WithBadge badge={<UnverifiedBadge uq="UQ-21" />}>Batch price needs a different clerk</WithBadge>}
            hint="Manual 06: “a second clerk re-enters every price”. Whether this is enforced is not documented. Default off."
          >
            <Switch id="s-diff" checked={form.watch("requireDifferentBatchUser")} onCheckedChange={(v) => form.setValue("requireDifferentBatchUser", v, { shouldDirty: true })} />
          </CheckField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              Actions that need approval <UnverifiedBadge uq="UQ-06" />
            </CardTitle>
            <CardDescription>
              Manual 07 mentions “Pending Approvals” but not what creates them. Choose which sensitive actions create an approval request instead of executing.
              The requester can never approve their own request.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2" data-testid="approval-actions">
          {[...APPROVABLE_ACTIONS, ...unknownApprovals.map((k) => ({ key: k, label: k }))].map((a) => (
            <CheckField key={a.key} id={`s-appr-${a.key}`} label={a.label} hint={a.key}>
              <Checkbox
                id={`s-appr-${a.key}`}
                checked={approvals.includes(a.key)}
                onCheckedChange={(v) => setApprovals((l) => (v === true ? [...new Set([...l, a.key])] : l.filter((x) => x !== a.key)))}
              />
            </CheckField>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              Bank CSV defaults <DemoBadge>DEMO VALUES</DemoBadge>
            </CardTitle>
            <CardDescription>
              Manual 08 lists the CSV columns (Transaction_Type, Beneficiary, Currency, Credit_Account, transaction_date, Amount, Debit_Account, Company_Name,
              Batch_Reference, Transaction_Id, Bank_Code, Bank, Branch_Code) but not the values. These feed the demo file only.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Company_Name" htmlFor="s-company" required error={errors.companyName?.message}>
            <Input id="s-company" aria-invalid={!!errors.companyName} {...form.register("companyName")} />
          </Field>
          <Field label="Debit_Account" htmlFor="s-debit" required error={errors.debitAccount?.message}>
            <Input id="s-debit" aria-invalid={!!errors.debitAccount} {...form.register("debitAccount")} />
          </Field>
          <Field label="Transaction_Type" htmlFor="s-txtype" required error={errors.bankCsvTransactionType?.message}>
            <Input id="s-txtype" aria-invalid={!!errors.bankCsvTransactionType} {...form.register("bankCsvTransactionType")} />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-3 shadow-float">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          {isDirty || approvalsDirty ? "You have unsaved changes." : "All changes saved."} Saved changes are audited.
        </p>
        <PermissionButton permission="admin.settings" type="submit" loading={save.isPending} disabled={!isDirty && !approvalsDirty} data-testid="save-settings">
          Save settings
        </PermissionButton>
      </div>
    </form>
  );
}

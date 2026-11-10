"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Callout,
  DemoBadge,
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
import type { GrowerBankAccount } from "@tobacco/shared";
import { useAction, useDb } from "@/mock/hooks";
import { saveGrowerBankAccount } from "@/mock/domain/timb";

const schema = z.object({
  currency: z.string().min(1, "Currency is required"),
  bankName: z.string().trim().min(1, "Bank name is required"),
  bankCode: z.string().trim().min(1, "Bank code is required"),
  branchCode: z.string().trim().min(1, "Branch code is required"),
  accountNo: z.string().trim().regex(/^[0-9A-Za-z-]{4,24}$/, "Account number must be 4–24 letters, digits or dashes"),
  accountName: z.string().trim().min(1, "Account name is required"),
});
type Form = z.infer<typeof schema>;

/**
 * Add / edit a grower bank account. Growers without bank details are left out of the payment schedule (Manual 08).
 * Field formats (account number, bank and branch codes) are not documented — only presence is enforced (UQ-12).
 */
export function BankAccountDialog({
  open,
  onOpenChange,
  growerNo,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  growerNo: string;
  account?: GrowerBankAccount;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <BankForm growerNo={growerNo} account={account} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BankForm({ growerNo, account, onDone, onCancel }: { growerNo: string; account?: GrowerBankAccount; onDone: () => void; onCancel: () => void }) {
  const localCurrency = useDb((db) => db.settings.localCurrencyCode);
  const takenCurrencies = useDb((db) => db.growerBankAccounts.filter((a) => a.growerNo === growerNo && a.id !== account?.id).map((a) => a.currency));
  const [error, setError] = useState<string | null>(null);
  const currencies = ["USD", localCurrency].filter((c) => !takenCurrencies.includes(c) || c === account?.currency);
  const { run, isPending } = useAction(saveGrowerBankAccount, {
    silent: true,
    success: () => (account ? "Bank account updated" : "Bank account added"),
  });
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: account?.currency ?? currencies[0] ?? "USD",
      bankName: account?.bankName ?? "",
      bankCode: account?.bankCode ?? "",
      branchCode: account?.branchCode ?? "",
      accountNo: account?.accountNo ?? "",
      accountName: account?.accountName ?? "",
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    const res = await run({ ...v, id: account?.id, growerNo });
    if (res.ok) onDone();
    else setError(res.error.message);
  });

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {account ? "Edit bank account" : "Add bank account"} <span className="font-mono text-sm text-muted-foreground">{growerNo}</span>
          {account?.isDemo ? <DemoBadge /> : null}
        </DialogTitle>
        <DialogDescription>
          One account per currency. Growers without bank details are left out of the payment schedule. <UnverifiedBadge uq="UQ-12" />
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4 sm:grid-cols-2">
        {error ? <Callout tone="danger" className="sm:col-span-2">{error}</Callout> : null}
        {currencies.length === 0 ? <Callout tone="info" className="sm:col-span-2">This grower already has an account in every supported currency.</Callout> : null}
        <Field label="Currency" htmlFor="ba-currency" required error={errors.currency?.message}>
          <NativeSelect id="ba-currency" disabled={Boolean(account)} {...form.register("currency")}>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Bank name" htmlFor="ba-bank" required error={errors.bankName?.message}>
          <Input id="ba-bank" aria-invalid={!!errors.bankName} {...form.register("bankName")} />
        </Field>
        <Field label="Bank code" htmlFor="ba-bcode" required error={errors.bankCode?.message}>
          <Input id="ba-bcode" aria-invalid={!!errors.bankCode} {...form.register("bankCode")} />
        </Field>
        <Field label="Branch code" htmlFor="ba-branch" required error={errors.branchCode?.message}>
          <Input id="ba-branch" aria-invalid={!!errors.branchCode} {...form.register("branchCode")} />
        </Field>
        <Field label="Account number" htmlFor="ba-acc" required error={errors.accountNo?.message}>
          <Input id="ba-acc" inputMode="numeric" aria-invalid={!!errors.accountNo} {...form.register("accountNo")} />
        </Field>
        <Field label="Account name" htmlFor="ba-name" required error={errors.accountName?.message}>
          <Input id="ba-name" aria-invalid={!!errors.accountName} {...form.register("accountName")} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} disabled={currencies.length === 0} data-testid="save-bank-account">
          Save bank account
        </Button>
      </DialogFooter>
    </form>
  );
}

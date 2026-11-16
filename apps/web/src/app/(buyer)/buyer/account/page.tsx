"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, KeyValue, PageHeader } from "@tobacco/ui";
import { BUYER_ROLES } from "@tobacco/shared";
import { changePasswordSchema } from "@tobacco/validation";
import { PasswordInput } from "@/components/buyer/password-field";
import { buyerApi, isApiError, useBuyerPrincipal, useBuyerSession, useBuyerMutation } from "@/lib/api";

const schema = changePasswordSchema
  .extend({ confirm: z.string().min(1, "Confirm your new password") })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type Values = z.infer<typeof schema>;

export default function AccountSettingsPage() {
  const principal = useBuyerPrincipal();
  const signOut = useBuyerSession((s) => s.signOut);
  const [serverError, setServerError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });

  const change = useBuyerMutation(({ currentPassword, newPassword }: Values) => buyerApi.post("/auth/change-password", { currentPassword, newPassword }), {
    toastError: false,
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await change.mutateAsync(values);
      reset();
      setChanged(true);
    } catch (e) {
      setChanged(false);
      setServerError(isApiError(e) ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not change the password");
    }
  });

  if (!principal) return null;
  const roles = (principal.roles ?? []).map((r) => BUYER_ROLES.find((x) => x.id === r)?.name ?? r);

  return (
    <>
      <PageHeader title="Account settings" description="Your sign-in details and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>Roles are assigned by your company&apos;s Buyer Administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <KeyValue
              columns={1}
              items={[
                { label: "Name", value: principal.name },
                { label: "Email", value: principal.email },
                { label: "Company", value: `${principal.organisation?.name} (${principal.organisation?.code})` },
                {
                  label: "Roles",
                  value: (
                    <span className="flex flex-wrap gap-1.5">
                      {roles.map((r) => (
                        <Badge key={r} tone="primary">
                          {r}
                        </Badge>
                      ))}
                    </span>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Changing your password signs you out of every other device.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate aria-label="Change password">
              {serverError ? (
                <Callout tone="danger" title="Could not change your password">
                  {serverError}
                </Callout>
              ) : null}
              {changed ? (
                <Callout tone="success" title="Password changed">
                  Use the new password the next time you sign in.
                </Callout>
              ) : null}
              <Field label="Current password" htmlFor="currentPassword" required error={errors.currentPassword?.message}>
                <PasswordInput id="currentPassword" autoComplete="current-password" {...register("currentPassword")} aria-invalid={Boolean(errors.currentPassword)} />
              </Field>
              <Field label="New password" htmlFor="newPassword" required error={errors.newPassword?.message} hint="At least 10 characters, with a letter and a number.">
                <PasswordInput id="newPassword" autoComplete="new-password" {...register("newPassword")} aria-invalid={Boolean(errors.newPassword)} />
              </Field>
              <Field label="Confirm new password" htmlFor="confirm" required error={errors.confirm?.message}>
                <PasswordInput id="confirm" autoComplete="new-password" {...register("confirm")} aria-invalid={Boolean(errors.confirm)} />
              </Field>
              <div className="flex items-center justify-between gap-3">
                <Button type="submit" disabled={change.isPending}>
                  {change.isPending ? "Saving…" : "Change password"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

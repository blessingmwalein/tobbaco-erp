"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { Button, Callout, Field } from "@tobacco/ui";
import { PASSWORD_MIN_LENGTH, newPasswordSchema } from "@tobacco/validation";
import { isApiError, publicApi } from "@/lib/api";
import { PasswordInput } from "./password-field";

const schema = z
  .object({ password: newPasswordSchema, confirm: z.string().min(1, "Confirm your password") })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type Values = z.infer<typeof schema>;

const RULES: Array<{ label: string; ok: (p: string) => boolean }> = [
  { label: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { label: "At least one letter", ok: (p) => /[A-Za-z]/.test(p) },
  { label: "At least one number", ok: (p) => /\d/.test(p) },
];

/** Shared by "reset password" and "activate account": choose a password with a live policy checklist. */
export function SetPasswordForm({
  token,
  endpoint,
  submitLabel,
  doneTitle,
  doneText,
}: {
  token: string | null;
  endpoint: "/auth/reset-password" | "/auth/activate";
  submitLabel: string;
  doneTitle: string;
  doneText: string;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });
  const password = useWatch({ control, name: "password" }) ?? "";

  if (!token) {
    return (
      <Callout tone="danger" title="This link is not valid">
        The link is missing its token. Open the link from your email again, or request a new one.
      </Callout>
    );
  }
  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Callout tone="success" title={doneTitle}>
          <span className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {doneText}
          </span>
        </Callout>
        <Button asChild>
          <Link href="/buyer/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = handleSubmit(async ({ password: value }) => {
    setError(null);
    try {
      await publicApi.post(endpoint, { token, password: value }, { anonymous: true });
      setDone(true);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Could not save your password");
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate aria-label={submitLabel}>
      {error ? (
        <Callout tone="danger" title="Could not set your password">
          {error}
        </Callout>
      ) : null}
      <Field label="New password" htmlFor="password" required error={errors.password?.message}>
        <PasswordInput id="password" autoComplete="new-password" autoFocus {...register("password")} aria-invalid={Boolean(errors.password)} />
      </Field>
      <ul className="-mt-2 flex flex-col gap-0.5 text-xs" aria-label="Password requirements">
        {RULES.map((rule) => {
          const ok = rule.ok(password);
          return (
            <li key={rule.label} className={ok ? "text-success-text" : "text-muted-foreground"}>
              <span aria-hidden>{ok ? "✓" : "○"}</span> {rule.label}
              <span className="sr-only">{ok ? " — met" : " — not met"}</span>
            </li>
          );
        })}
      </ul>
      <Field label="Confirm password" htmlFor="confirm" required error={errors.confirm?.message}>
        <PasswordInput id="confirm" autoComplete="new-password" {...register("confirm")} aria-invalid={Boolean(errors.confirm)} />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

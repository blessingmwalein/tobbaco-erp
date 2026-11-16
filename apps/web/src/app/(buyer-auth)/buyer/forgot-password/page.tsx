"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { Button, Callout, Field, Input } from "@tobacco/ui";
import { emailSchema } from "@tobacco/validation";
import { AuthCard } from "@/components/buyer/auth-card";
import { isApiError, publicApi } from "@/lib/api";

const formSchema = z.object({ email: emailSchema });
type FormValues = z.infer<typeof formSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await publicApi.post("/auth/forgot-password", { email, audience: "BUYER" }, { anonymous: true });
      setSent(true);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Could not send the reset link");
    }
  });

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we will send a link that lets you choose a new password."
      footer={
        <Link href="/buyer/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Callout tone="success" title="Check your email">
          <span className="flex items-start gap-2">
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            If that address belongs to an active account, a reset link has been sent. The link works once and expires in one hour.
          </span>
        </Callout>
      ) : (
        <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate aria-label="Request a password reset">
          {error ? (
            <Callout tone="danger" title="Something went wrong">
              {error}
            </Callout>
          ) : null}
          <Field label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="username" autoFocus inputMode="email" {...register("email")} aria-invalid={Boolean(errors.email)} />
          </Field>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Callout, Field, Input } from "@tobacco/ui";
import { loginSchema, type LoginInput } from "@tobacco/validation";
import { AuthCard } from "@/components/buyer/auth-card";
import { PasswordInput } from "@/components/buyer/password-field";
import { isApiError, useBuyerSession } from "@/lib/api";

const DEMO_HINT = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

function safeNext(next: string | null): string {
  return next && next.startsWith("/buyer") && !next.startsWith("/buyer/login") ? next : "/buyer/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const status = useBuyerSession((s) => s.status);
  const restore = useBuyerSession((s) => s.restore);
  const signIn = useBuyerSession((s) => s.signIn);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (status === "authenticated") router.replace(safeNext(params.get("next")));
  }, [status, router, params]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      router.replace(safeNext(params.get("next")));
    } catch (e) {
      setFormError(isApiError(e) ? e.message : e instanceof Error ? e.message : "Could not sign in");
    }
  });

  return (
    <AuthCard
      title="Sign in"
      description="Use the account your company administrator created for you."
      footer={
        <Link href="/buyer/forgot-password" className="font-medium text-primary hover:underline">
          Forgot your password?
        </Link>
      }
    >
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate aria-label="Sign in">
        {formError ? (
          <Callout tone="danger" title="Sign-in failed">
            {formError}
          </Callout>
        ) : null}
        <Field label="Email" htmlFor="email" required error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" autoFocus inputMode="email" {...register("email")} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field label="Password" htmlFor="password" required error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" {...register("password")} aria-invalid={Boolean(errors.password)} />
        </Field>
        <Button type="submit" disabled={isSubmitting} data-testid="buyer-sign-in" className="w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      {DEMO_HINT ? (
        <Callout tone="info" title="Demo environment" className="mt-5">
          Demo accounts share the seeded demo password (<code>SEED_PASSWORD</code> in <code>apps/api/.env</code>). Try{" "}
          <code>admin@moroz-demo.test</code>, <code>warehouse@moroz-demo.test</code> or <code>viewer@moroz-demo.test</code>.
        </Callout>
      ) : null}
    </AuthCard>
  );
}

export default function BuyerLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

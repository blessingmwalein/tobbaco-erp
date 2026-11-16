"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/buyer/auth-card";
import { SetPasswordForm } from "@/components/buyer/set-password-form";

function ResetForm() {
  const token = useSearchParams().get("token");
  return (
    <AuthCard title="Choose a new password" description="This link works once. After saving you can sign in with the new password.">
      <SetPasswordForm
        token={token}
        endpoint="/auth/reset-password"
        submitLabel="Save new password"
        doneTitle="Password updated"
        doneText="Your other sessions were signed out. Sign in with your new password."
      />
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}

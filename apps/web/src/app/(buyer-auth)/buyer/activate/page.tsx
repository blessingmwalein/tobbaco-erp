"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/buyer/auth-card";
import { SetPasswordForm } from "@/components/buyer/set-password-form";

function ActivateForm() {
  const token = useSearchParams().get("token");
  return (
    <AuthCard title="Activate your account" description="Choose a password to finish setting up your Buyer Portal account.">
      <SetPasswordForm
        token={token}
        endpoint="/auth/activate"
        submitLabel="Activate account"
        doneTitle="Account activated"
        doneText="Your account is ready. Sign in with the password you just chose."
      />
    </AuthCard>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivateForm />
    </Suspense>
  );
}

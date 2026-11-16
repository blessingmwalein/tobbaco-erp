"use client";

import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/brand";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Centered card used by every external-buyer authentication screen.
 * `data-hydrated` flips to "true" once the client has taken over — before that a click would fall through to the
 * browser's native form submit (which is why every auth form is also `method="post"`: a password must never end up in a URL).
 */
export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const hydrated = useHydrated();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <main id="main" data-hydrated={hydrated ? "true" : "false"} className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <BrandMark className="size-11" />
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-tight">Buyer Portal</p>
            <p className="text-sm text-muted-foreground">Tobacco purchases, receiving and traceability</p>
          </div>
        </div>
        <section aria-labelledby="auth-title" className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h1 id="auth-title" className="text-xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          <div className="mt-5">{children}</div>
        </section>
        {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
      </main>
    </div>
  );
}

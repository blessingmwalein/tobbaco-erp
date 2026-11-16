"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { EmptyState, Spinner } from "@tobacco/ui";
import type { BuyerPermission } from "@tobacco/shared";
import { useBuyerGuard, useBuyerSession } from "@/lib/api";

/** Resume the session on load; send anonymous visitors to the buyer sign-in page (remembering where they were going). */
export function RequireBuyerSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useBuyerSession((s) => s.status);
  const restore = useBuyerSession((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (status === "anonymous") router.replace(`/buyer/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Signing you in">
        <Spinner label="Signing you in" />
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * Page-level permission guard. The sidebar hides links a role cannot use, but deep links must also be safe —
 * and the API enforces every permission regardless of what the UI shows.
 */
export function RequireBuyerPermission({ permission, children }: { permission: BuyerPermission; children: ReactNode }) {
  const { allowed, reason } = useBuyerGuard(permission);
  if (!allowed) {
    return (
      <EmptyState icon={Lock} title="You don't have access to this page" description={reason} className="rounded-2xl border border-border bg-surface" />
    );
  }
  return <>{children}</>;
}

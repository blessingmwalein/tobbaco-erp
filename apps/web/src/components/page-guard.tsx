"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { EmptyState } from "@tobacco/ui";
import type { Permission } from "@tobacco/shared";
import { useGuard } from "@/lib/permissions";

/**
 * Page-level permission guard. The sidebar already hides links a role cannot use, but deep links must also be safe.
 * (Phase 2: the API enforces permissions; this is only the UX layer.)
 */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { allowed, reason } = useGuard(permission);
  if (!allowed) {
    return (
      <EmptyState
        icon={Lock}
        title="You don't have access to this page"
        description={reason}
        className="rounded-2xl border border-border bg-surface"
      />
    );
  }
  return <>{children}</>;
}

"use client";

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@tobacco/ui";
import type { AppUser, MockDb, Permission } from "@tobacco/shared";
import { useDb } from "@/mock/hooks";
import { effectivePermissions, rolesOf } from "@/mock/ctx";
import { useSession } from "./session";

export function useCurrentUser(): AppUser | undefined {
  const userId = useSession((s) => s.userId);
  return useDb((db) => db.users.find((u) => u.id === userId));
}

export function usePermissions(): Set<Permission> {
  const userId = useSession((s) => s.userId);
  return useDb((db) => effectivePermissions(db, db.users.find((u) => u.id === userId)));
}

export function useCan(): (permission: Permission) => boolean {
  const perms = usePermissions();
  return (p) => perms.has(p);
}

function holders(db: MockDb, permission: Permission): string {
  return db.roles
    .filter((r) => r.permissions.includes(permission))
    .map((r) => r.name)
    .slice(0, 3)
    .join(", ");
}

/** { allowed, reason } — `reason` is a helpful "why disabled" sentence for tooltips. */
export function useGuard(permission: Permission | undefined): { allowed: boolean; reason?: string } {
  const userId = useSession((s) => s.userId);
  return useDb((db) => {
    if (!permission) return { allowed: true };
    const user = db.users.find((u) => u.id === userId);
    if (effectivePermissions(db, user).has(permission)) return { allowed: true };
    const mine = user ? rolesOf(db, user).map((r) => r.name).join(", ") : "no role";
    return {
      allowed: false,
      reason: `Your role (${mine}) lacks “${permission}”. Held by: ${holders(db, permission) || "no role"}.`,
    };
  });
}

export function Gate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { allowed } = useGuard(permission);
  return <>{allowed ? children : fallback}</>;
}

/** Button that disables itself (with an explanation) when the current role lacks `permission`. */
export function PermissionButton({
  permission,
  disabled,
  disabledReason,
  ...props
}: ButtonProps & { permission: Permission }) {
  const { allowed, reason } = useGuard(permission);
  const blocked = !allowed;
  return (
    <Button
      {...props}
      disabled={disabled || blocked}
      disabledReason={blocked ? reason : disabledReason}
      data-permission={permission}
    />
  );
}

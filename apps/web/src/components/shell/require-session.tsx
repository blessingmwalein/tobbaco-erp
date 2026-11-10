"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useDb } from "@/mock/hooks";

/** Demo-session guard. Real authentication/JWT arrives with the backend (Phase 2). */
export function RequireSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const userId = useSession((s) => s.userId);
  const signOut = useSession((s) => s.signOut);
  const userOk = useDb((db) => {
    const u = db.users.find((x) => x.id === userId);
    return Boolean(u?.active);
  });

  useEffect(() => {
    if (!userId) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (!userOk) {
      signOut();
    }
  }, [userId, userOk, pathname, router, signOut]);

  if (!userId || !userOk) return null;
  return <>{children}</>;
}

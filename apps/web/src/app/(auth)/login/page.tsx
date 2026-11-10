"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical } from "lucide-react";
import { Callout, DemoBadge, cn } from "@tobacco/ui";
import { BrandMark } from "@/components/shell/brand";
import { landingFor } from "@/lib/landing";
import { useSession } from "@/lib/session";
import { useDb } from "@/mock/hooks";

export default function LoginPage() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const users = useDb((db) =>
    db.users
      .filter((u) => u.active)
      .map((u) => ({
        user: u,
        role: db.roles.find((r) => r.id === u.roleIds[0]),
      })),
  );

  const choose = (userId: string, roleId: string | undefined) => {
    signIn(userId);
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") ? next : landingFor(roleId));
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <BrandMark className="size-11" />
            <div className="leading-tight">
              <h1 className="text-2xl font-semibold tracking-tight">Tobacco ERP</h1>
              <p className="text-sm text-muted-foreground">Zimbabwe tobacco floor operations · Phase 1 UI preview</p>
            </div>
          </div>
          <Callout tone="warning" title="Simulated sign-in — no real authentication">
            This preview runs entirely on local mock data (the documented 17 September 2026 Ethical sale day). Choose a
            role to see what that user can see and do. Real JWT sign-in, roles and server-side permission checks arrive with
            the backend, after you approve the UI.
          </Callout>
        </header>

        <section aria-labelledby="who">
          <h2 id="who" className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="size-4 text-primary" aria-hidden /> Sign in as…
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {users.map(({ user, role }) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => choose(user.id, role?.id)}
                  data-testid={`login-as-${role?.id}`}
                  className={cn(
                    "group flex h-full w-full flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left shadow-card transition-colors",
                    "hover:border-primary hover:bg-primary-soft/40",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{role?.name}</span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                  </span>
                  <span className="text-xs text-muted-foreground">{role?.description}</span>
                  <span className="mt-auto flex items-center gap-2 pt-1 text-xs">
                    <span className="font-medium">{user.name}</span>
                    {role?.isDemoOnly ? <DemoBadge>DEMO ONLY</DemoBadge> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

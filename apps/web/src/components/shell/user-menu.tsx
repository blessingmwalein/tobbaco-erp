"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, LogOut, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tobacco/ui";
import { useCurrentUser } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { useDb } from "@/mock/hooks";
import { rolesOf } from "@/mock/ctx";
import { DemoControlsDialog } from "./demo-controls";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ inverted }: { inverted?: boolean }) {
  const router = useRouter();
  const user = useCurrentUser();
  const signIn = useSession((s) => s.signIn);
  const signOut = useSession((s) => s.signOut);
  const users = useDb((db) => db.users.filter((u) => u.active));
  const roleNames = useDb((db) => {
    const u = db.users.find((x) => x.id === user?.id);
    return u ? rolesOf(db, u).map((r) => r.name).join(", ") : "";
  });
  const [demoOpen, setDemoOpen] = useState(false);
  const roleLabels = useDb((db) => Object.fromEntries(db.users.map((u) => [u.id, rolesOf(db, u)[0]?.name ?? ""])));

  if (!user) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="user-menu"
            className={`flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-3 text-left transition-colors ${inverted ? "hover:bg-primary-foreground/10" : "hover:bg-surface-tertiary"}`}
          >
            <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-neutral-dark text-xs font-semibold text-neutral-dark-foreground">
              {initials(user.name)}
            </span>
            <span className="sr-only sm:hidden">{user.name}</span>
            <span className="hidden leading-tight sm:block">
              <span className={`block text-sm font-medium ${inverted ? "text-primary-foreground" : ""}`}>{user.name}</span>
              <span className={`block text-xs ${inverted ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{roleNames}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" align="end">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Users className="size-3.5" aria-hidden /> Switch demo user (changes permissions)
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={user.id}
            onValueChange={(id) => {
              signIn(id);
              router.refresh();
            }}
          >
            {users.map((u) => (
              <DropdownMenuRadioItem key={u.id} value={u.id} onSelect={(e) => e.preventDefault()}>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm">{roleLabels[u.id]}</span>
                  <span className="text-xs text-muted-foreground">{u.name}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDemoOpen(true)}>
            <FlaskConical /> Demo controls…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              signOut();
              router.replace("/login");
            }}
          >
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DemoControlsDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
}

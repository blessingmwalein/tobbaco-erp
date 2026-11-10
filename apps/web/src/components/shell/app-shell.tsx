"use client";

import type { ReactNode } from "react";
import { GlobalSearch } from "./global-search";
import { RequireSession } from "./require-session";
import { DesktopSidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Back-office shell: sidebar + top bar + content. Used by the `(app)` route group. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen bg-background">
        <DesktopSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
      <GlobalSearch />
    </RequireSession>
  );
}

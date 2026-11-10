"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, TooltipProvider } from "@tobacco/ui";
import { Leaf } from "lucide-react";
import { applyScenario } from "./scenarios";
import { getDb, resetDb, setDb, subscribe } from "./store";

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading demo data">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Leaf className="size-6" aria-hidden />
        </div>
        <p className="text-sm">Loading demo data…</p>
      </div>
    </div>
  );
}

/**
 * Client-only provider: hydrates the mock DB from localStorage AFTER mount (avoids hydration mismatches),
 * wires TanStack Query invalidation to every committed write, and mounts toasts/tooltips.
 * `?latency=0` in the URL removes artificial latency (used by automated tests).
 */
export function MockProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 0, refetchOnWindowFocus: false, retry: false } },
      }),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const db = getDb();
    const param = new URLSearchParams(window.location.search).get("latency");
    if (param !== null && Number.isFinite(Number(param)) && Number(param) !== db.settings.latencyMs) {
      setDb({ ...db, settings: { ...db.settings, latencyMs: Math.max(0, Number(param)) } });
    }
    const unsubscribe = subscribe(() => {
      void client.invalidateQueries({ queryKey: ["db"] });
    });
    // Demo/test hook: jump to a sale-day stage or reset (used by Playwright and the screenshot script).
    (window as unknown as { __demo?: unknown }).__demo = {
      applyScenario,
      resetDb,
      getDb,
    };
    setReady(true);
    return unsubscribe;
  }, [client]);

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>{ready ? children : <BootScreen />}</TooltipProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

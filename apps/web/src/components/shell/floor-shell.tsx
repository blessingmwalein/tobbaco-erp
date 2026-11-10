"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Cpu, ScanBarcode, Scale as ScaleIcon } from "lucide-react";
import { Tooltip, cn } from "@tobacco/ui";
import { formatRate, longDate } from "@tobacco/shared";
import { FLOOR_STATIONS } from "@/lib/nav";
import { usePermissions } from "@/lib/permissions";
import { selectSaleContext } from "@/lib/sale-context";
import { useDb } from "@/mock/hooks";
import { Brand } from "./brand";
import { NotificationCenter } from "./notification-center";
import { RequireSession } from "./require-session";
import { UserMenu } from "./user-menu";
import { GlobalSearch } from "./global-search";

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular font-mono text-sm text-primary-foreground/90">{now}</span>;
}

/**
 * Floor workspace shell: minimal chrome, purple bar (the e-Port "purple bar and large fields" concept modernised),
 * station switcher, honest device status chips. Used by the `(floor)` route group.
 */
export function FloorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const perms = usePermissions();
  const ctx = useDb(selectSaleContext);
  const stations = FLOOR_STATIONS.filter((s) => perms.has(s.permission));

  return (
    <RequireSession>
      <div className="flex min-h-screen flex-col bg-background">
        <header data-chrome className="bg-primary text-primary-foreground">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-4 px-4 lg:px-8">
            <Link href="/floor" className="shrink-0">
              <Brand inverted />
            </Link>
            <nav aria-label="Floor stations" className="ml-2 hidden items-center gap-1 lg:flex">
              {stations.map((s) => {
                const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
                const Icon = s.icon;
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-primary-foreground text-primary" : "text-primary-foreground/90 hover:bg-primary-foreground/10",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {s.label}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right leading-tight xl:block">
                <p className="text-sm font-medium">{longDate(ctx.today)}</p>
                <p className="text-xs text-primary-foreground/85">
                  {ctx.sellingPoint.name} · {ctx.startOfDayPosted ? `Rate ${formatRate(ctx.exchangeRate ?? "0")}` : "SoD not posted"}
                </p>
              </div>
              <Clock />
              <Tooltip content="Keyboard-wedge scanner input — simulated. No physical scanner is connected in the demo." side="bottom">
                <span className="hidden items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs md:inline-flex">
                  <ScanBarcode className="size-3.5" aria-hidden /> Scanner: simulated
                </span>
              </Tooltip>
              <Tooltip content="No physical scale is connected. Weights come from simulated weigh events." side="bottom">
                <span className="hidden items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs md:inline-flex">
                  <ScaleIcon className="size-3.5" aria-hidden /> Scale: simulated
                </span>
              </Tooltip>
              <NotificationCenter inverted />
              <UserMenu inverted />
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-primary-foreground/90 hover:bg-primary-foreground/10"
              >
                <ArrowLeft className="size-4" aria-hidden />
                <span className="hidden sm:inline">Back office</span>
              </Link>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-8">
          {children}
        </main>
        <footer className="no-print border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
          <Cpu className="mr-1 inline size-3" aria-hidden />
          Demo workspace — simulated scanner, scale and printer. Data is local to this browser.
        </footer>
      </div>
      <GlobalSearch />
    </RequireSession>
  );
}

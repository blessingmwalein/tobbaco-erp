"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronsLeft, ChevronsRight, ScanLine } from "lucide-react";
import { Badge, Button, Tooltip, cn } from "@tobacco/ui";
import { formatRate, longDate } from "@tobacco/shared";
import { NAV_GROUPS, FLOOR_STATIONS, isActivePath, navBadges } from "@/lib/nav";
import { usePermissions } from "@/lib/permissions";
import { selectSaleContext } from "@/lib/sale-context";
import { useUi } from "@/lib/ui-store";
import { useDb } from "@/mock/hooks";
import { Brand } from "./brand";

export function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const perms = usePermissions();
  const badges = useDb(navBadges);

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.permission || perms.has(i.permission)),
  })).filter((g) => g.items.length > 0);

  const hasFloor = FLOOR_STATIONS.some((s) => perms.has(s.permission));

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2">
      {hasFloor ? (
        <Tooltip content={collapsed ? "Floor workspaces" : null} side="right">
          <Link
            href="/floor"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl bg-neutral-dark px-3 py-2.5 text-sm font-medium text-neutral-dark-foreground transition-colors hover:bg-black",
              collapsed && "justify-center px-0",
            )}
          >
            <ScanLine className="size-4 shrink-0" aria-hidden />
            {collapsed ? <span className="sr-only">Floor workspaces</span> : "Floor workspaces"}
          </Link>
        </Tooltip>
      ) : null}

      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <div className="mx-2 mb-1 h-px bg-border" aria-hidden />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active = isActivePath(pathname, item.href);
            const badge = badges[item.href] ?? 0;
            const Icon = item.icon;
            return (
              <Tooltip key={item.href} content={collapsed ? item.label : null} side="right">
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary-soft font-medium text-primary-soft-foreground"
                      : "text-muted-foreground hover:bg-surface-tertiary hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                  {badge > 0 ? (
                    collapsed ? (
                      <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" aria-hidden />
                    ) : (
                      <span className="tabular ml-auto rounded-full bg-surface-tertiary px-1.5 text-xs font-medium text-foreground group-hover:bg-surface">
                        {badge}
                      </span>
                    )
                  ) : null}
                </Link>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Floating sale-day context card at the bottom of the sidebar. */
export function SaleDayCard() {
  const ctx = useDb(selectSaleContext);
  return (
    <div className="mx-3 mb-3 rounded-2xl border border-border bg-surface-secondary p-3" data-testid="sale-day-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" aria-hidden />
        Sale day
      </div>
      <p className="mt-1 text-sm font-semibold">{longDate(ctx.today)}</p>
      <p className="text-xs text-muted-foreground">
        {ctx.sellingPoint.name} · Season {ctx.seasonYear}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={ctx.saleDateIsCurrent ? "success" : "warning"} dot>
          {ctx.saleDateIsCurrent ? "Sale date active" : "No sale date"}
        </Badge>
        <Badge tone={ctx.startOfDayPosted ? "success" : "warning"} dot>
          {ctx.startOfDayPosted ? `SoD ${formatRate(ctx.exchangeRate ?? "0")}` : "SoD not posted"}
        </Badge>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  return (
    <aside
      data-chrome
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-[264px]",
      )}
    >
      <div className={cn("flex h-16 items-center px-4", collapsed && "justify-center px-0")}>
        <Brand collapsed={collapsed} />
      </div>
      <SidebarNav collapsed={collapsed} />
      {collapsed ? null : <SaleDayCard />}
      <div className={cn("border-t border-border p-2", collapsed && "flex justify-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(!collapsed && "w-full justify-start text-muted-foreground")}
        >
          {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          {collapsed ? null : "Collapse"}
        </Button>
      </div>
    </aside>
  );
}

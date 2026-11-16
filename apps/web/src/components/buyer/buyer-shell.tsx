"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsLeft, ChevronsRight, KeyRound, LogOut, Menu, Store } from "lucide-react";
import {
  Badge,
  Breadcrumbs,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  Tooltip,
  cn,
} from "@tobacco/ui";
import { BUYER_ROLES } from "@tobacco/shared";
import { useBuyerPrincipal, useBuyerSession } from "@/lib/api";
import { BUYER_NAV_GROUPS, isBuyerNavActive } from "@/lib/buyer-nav";
import { buyerBreadcrumbsFor } from "@/lib/buyer-breadcrumbs";
import { useUi } from "@/lib/ui-store";
import { BrandMark } from "@/components/shell/brand";
import { RequireBuyerSession } from "./require-buyer-session";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PortalBrand({ collapsed }: { collapsed?: boolean }) {
  const principal = useBuyerPrincipal();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark />
      {collapsed ? null : (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight" title={principal?.organisation?.name}>
            {principal?.organisation?.name ?? "Buyer Portal"}
          </p>
          <p className="text-[11px] text-muted-foreground">Buyer Portal</p>
        </div>
      )}
    </div>
  );
}

function BuyerSidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const permissions = useBuyerSession((s) => s.principal?.permissions);
  const allowed = new Set<string>(permissions ?? []);

  const groups = BUYER_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.permission || allowed.has(i.permission)),
  })).filter((g) => g.items.length > 0);

  return (
    <nav aria-label="Buyer Portal" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <div className="mx-2 mb-1 h-px bg-border" aria-hidden />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group.label}</p>
          )}
          {group.items.map((item) => {
            const active = isBuyerNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Tooltip key={item.href} content={collapsed ? item.label : null} side="right">
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary-soft font-medium text-primary-soft-foreground"
                      : "text-muted-foreground hover:bg-surface-tertiary hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                </Link>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function BuyerUserMenu() {
  const router = useRouter();
  const principal = useBuyerPrincipal();
  const signOut = useBuyerSession((s) => s.signOut);
  if (!principal) return null;
  const roleNames = (principal.roles ?? []).map((r) => BUYER_ROLES.find((x) => x.id === r)?.name ?? r).join(", ");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-testid="buyer-user-menu" className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-3 text-left transition-colors hover:bg-surface-tertiary">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-neutral-dark text-xs font-semibold text-neutral-dark-foreground">
            {initials(principal.name)}
          </span>
          <span className="sr-only sm:hidden">{principal.name}</span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-medium">{principal.name}</span>
            <span className="block text-xs text-muted-foreground">{roleNames}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel className="flex flex-col leading-tight">
          <span>{principal.email}</span>
          <span className="text-xs font-normal text-muted-foreground">{principal.organisation?.name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/buyer/account")}>
          <KeyRound /> Account settings
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="buyer-sign-out"
          onSelect={() => {
            void signOut().then(() => router.replace("/buyer/login"));
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BuyerTopbar() {
  const pathname = usePathname();
  const principal = useBuyerPrincipal();
  const [open, setOpen] = useState(false);
  return (
    <header data-chrome className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Buyer Portal navigation</SheetDescription>
          <div className="flex h-16 items-center px-4">
            <PortalBrand />
          </div>
          <BuyerSidebarNav collapsed={false} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <Breadcrumbs
        items={buyerBreadcrumbsFor(pathname)}
        className="hidden min-w-0 md:flex"
        renderLink={(item, children) => (
          <Link href={item.href ?? "#"} className="hover:text-foreground">
            {children}
          </Link>
        )}
      />

      <div className="ml-auto flex items-center gap-2">
        <Badge tone="neutral" className="hidden md:inline-flex" title="You can only see your own company's data">
          <Store className="size-3" aria-hidden /> {principal?.organisation?.code} · {principal?.organisation?.name}
        </Badge>
        <BuyerUserMenu />
      </div>
    </header>
  );
}

function BuyerSidebar() {
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
        <PortalBrand collapsed={collapsed} />
      </div>
      <BuyerSidebarNav collapsed={collapsed} />
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

/** External buyer shell: company-branded sidebar + top bar. Separate from the internal back-office shell. */
export function BuyerShell({ children }: { children: ReactNode }) {
  return (
    <RequireBuyerSession>
      <a href="#main" className="sr-only z-50 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to main content
      </a>
      <div className="flex min-h-screen bg-background">
        <BuyerSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <BuyerTopbar />
          <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </RequireBuyerSession>
  );
}

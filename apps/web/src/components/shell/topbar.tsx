"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import {
  Badge,
  Breadcrumbs,
  Button,
  Kbd,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@tobacco/ui";
import { breadcrumbsFor } from "@/lib/breadcrumbs";
import { useUi } from "@/lib/ui-store";
import { Brand } from "./brand";
import { NotificationCenter } from "./notification-center";
import { SaleDayCard, SidebarNav } from "./sidebar";
import { UserMenu } from "./user-menu";

export function Topbar() {
  const pathname = usePathname();
  const setSearchOpen = useUi((s) => s.setSearchOpen);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      data-chrome
      className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-8"
    >
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <div className="flex h-16 items-center px-4">
            <Brand />
          </div>
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          <SaleDayCard />
        </SheetContent>
      </Sheet>

      <Breadcrumbs
        items={breadcrumbsFor(pathname)}
        className="hidden min-w-0 md:flex"
        renderLink={(item, children) => (
          <Link href={item.href ?? "#"} className="hover:text-foreground">
            {children}
          </Link>
        )}
      />

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => setSearchOpen(true)}
          className="hidden h-10 w-80 justify-start gap-3 rounded-xl text-muted-foreground md:inline-flex"
          data-testid="open-search"
        >
          <Search />
          <span className="flex-1 truncate text-left font-normal">Search growers, barcodes…</span>
          <Kbd>Ctrl K</Kbd>
        </Button>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
          <Search />
        </Button>
        <Badge tone="warning" className="hidden xl:inline-flex" title="Local mock data — no backend, bank, scale, scanner or printer">
          Demo · mock data
        </Badge>
        <NotificationCenter />
        <UserMenu />
      </div>
    </header>
  );
}

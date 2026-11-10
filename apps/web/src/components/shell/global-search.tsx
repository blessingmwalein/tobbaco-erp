"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Kbd } from "@tobacco/ui";
import { FileText, Hash, Layers, Package, Truck, User, Warehouse, Wallet } from "lucide-react";
import { useCan } from "@/lib/permissions";
import { buildSearchIndex, searchItems, type SearchItem, type SearchKind } from "@/lib/search-index";
import { useUi } from "@/lib/ui-store";
import { useDb } from "@/mock/hooks";

const KIND_ICON: Record<SearchKind, React.ComponentType<{ className?: string }>> = {
  Page: FileText,
  Grower: User,
  Booking: Hash,
  "Transporter note": Truck,
  "Delivery note": Package,
  Bale: Hash,
  Sale: Wallet,
  "Price batch": Layers,
  Dispatch: Warehouse,
  "Pay batch": Wallet,
  Import: FileText,
};

export function GlobalSearch() {
  const router = useRouter();
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const can = useCan();
  const db = useDb((d) => d);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUi.getState().searchOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const index = useMemo(() => buildSearchIndex(db, can), [db, can]);
  const results = useMemo(() => searchItems(index, query), [index, query]);
  const groups = useMemo(() => {
    const m = new Map<SearchKind, SearchItem[]>();
    for (const r of results) m.set(r.kind, [...(m.get(r.kind) ?? []), r]);
    return [...m.entries()];
  }, [results]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false} title="Global search" description="Search growers, bookings, delivery notes, barcodes, sales, batches and pages">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search grower no., booking ref, TDN, GDN, barcode, sale, batch…"
        data-testid="global-search-input"
      />
      <CommandList>
        <CommandEmpty>No results for “{query}”.</CommandEmpty>
        {groups.map(([kind, items]) => (
          <CommandGroup key={kind} heading={kind}>
            {items.map((r) => {
              const Icon = KIND_ICON[r.kind];
              return (
                <CommandItem
                  key={r.id}
                  value={r.id}
                  onSelect={() => {
                    setOpen(false);
                    router.push(r.href);
                  }}
                >
                  <Icon className="size-4" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.label}</span>
                    {r.sub ? <span className="block truncate text-xs text-muted-foreground">{r.sub}</span> : null}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate · <Kbd>Enter</Kbd> open · <Kbd>Esc</Kbd> close
        </span>
        <span>Searches the local demo data</span>
      </div>
    </CommandDialog>
  );
}

"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger, Timeline, cn } from "@tobacco/ui";
import { formatDateTime } from "@tobacco/shared";
import { useAction, useDb } from "@/mock/hooks";

export function NotificationCenter({ inverted }: { inverted?: boolean }) {
  const items = useDb((db) => db.notifications);
  const unread = items.filter((n) => !n.read).length;
  const { run: markAll } = useAction((ctx) => {
    for (const n of ctx.db.notifications) n.read = true;
  }, { latency: 0 });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          className={cn("relative", inverted && "text-primary-foreground hover:bg-primary-foreground/10")}
        >
          <Bell />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-danger-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" onClick={() => markAll(undefined)} disabled={unread === 0}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <Timeline
              items={items.slice(0, 12).map((n) => ({
                id: n.id,
                tone: n.level === "error" ? "danger" : n.level === "warning" ? "warning" : n.level === "success" ? "success" : "primary",
                title: n.href ? (
                  <Link href={n.href} className={cn("hover:underline", !n.read && "font-semibold")}>
                    {n.title}
                  </Link>
                ) : (
                  <span className={cn(!n.read && "font-semibold")}>{n.title}</span>
                ),
                meta: formatDateTime(n.at),
                body: n.body,
              }))}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

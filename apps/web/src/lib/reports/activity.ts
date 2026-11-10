import { formatInt } from "@tobacco/shared";
import { inRange } from "./helpers";
import type { ReportDef, ReportResult } from "./types";

export const userActivityReport: ReportDef = {
  slug: "user-activity",
  title: "User activity report",
  description: "What each user did: number of audited actions, entities touched, first/last action and most frequent action.",
  area: "Administration",
  filters: ["date", "user"],
  permission: "audit.view",
  run(db, f): ReportResult {
    const entries = db.audit.filter((a) => inRange(a.at, f) && (!f.user || a.userId === f.user));
    const userIds = [...new Set(entries.map((a) => a.userId))];
    const rows = userIds
      .map((id) => {
        const mine = entries.filter((a) => a.userId === id);
        const user = db.users.find((u) => u.id === id);
        const counts = new Map<string, number>();
        for (const a of mine) counts.set(a.action, (counts.get(a.action) ?? 0) + 1);
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        const times = mine.map((a) => a.at).sort();
        return {
          user: mine[0]?.userName ?? id,
          roles: user ? user.roleIds.map((r) => db.roles.find((x) => x.id === r)?.name ?? r).join(", ") : "—",
          actions: mine.length,
          entities: new Set(mine.map((a) => `${a.entityType}:${a.entityId}`)).size,
          first: times[0] ?? null,
          last: times[times.length - 1] ?? null,
          topAction: top ? `${top[0]} ×${top[1]}` : null,
        };
      })
      .sort((a, b) => b.actions - a.actions || a.user.localeCompare(b.user));
    return {
      columns: [
        { key: "user", header: "User" },
        { key: "roles", header: "Role(s)" },
        { key: "actions", header: "Audited actions", format: "int", align: "right" },
        { key: "entities", header: "Entities touched", format: "int", align: "right" },
        { key: "first", header: "First action", format: "datetime" },
        { key: "last", header: "Last action", format: "datetime" },
        { key: "topAction", header: "Most frequent action" },
      ],
      rows,
      tiles: [
        { label: "Active users", value: formatInt(rows.length) },
        { label: "Audit entries", value: formatInt(entries.length) },
        { label: "Most active", value: rows[0]?.user ?? "—", hint: rows[0] ? `${rows[0].actions} actions` : undefined },
      ],
      notes: ["Built from the audit log, which is append-only. Sign-in events are not audited in the demo (no real authentication)."],
    };
  },
};

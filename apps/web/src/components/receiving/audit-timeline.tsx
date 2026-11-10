"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton, Timeline } from "@tobacco/ui";
import { formatDateTime } from "@tobacco/shared";
import { useDbQuery } from "@/mock/hooks";

/** Audited actions on one or more entities, newest first. */
export function AuditTimeline({ entityIds, title = "Audit trail", description = "Every transition is recorded with who, when and why." }: { entityIds: string[]; title?: string; description?: string }) {
  const key = entityIds.join("|");
  const { data, isLoading } = useDbQuery(["audit-for", key], (db) => db.audit.filter((a) => entityIds.includes(a.entityId)).slice(0, 30));
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-24" />
        ) : data.length === 0 ? (
          <EmptyState title="No audited actions yet" className="py-6" />
        ) : (
          <Timeline
            items={data.map((a) => ({
              id: a.id,
              tone: a.action.includes("eject") || a.action.includes("reverse") ? "warning" : "primary",
              title: a.action,
              meta: formatDateTime(a.at),
              body: (
                <>
                  {a.userName}
                  {a.reason ? ` — ${a.reason}` : ""}
                </>
              ),
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { ShieldCheck } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, KeyValue } from "@tobacco/ui";
import { formatDateTime, type AuditEntry } from "@tobacco/shared";
import { JsonDiff } from "./json-diff";

/** Read-only detail of one audit entry. The log is append-only: there is no edit or delete anywhere. */
export function AuditDetailDialog({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  return (
    <Dialog open={entry !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" data-testid="audit-detail">
        {entry ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-mono text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden /> {entry.action}
              </DialogTitle>
              <DialogDescription>Audit entry {entry.id} — immutable.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-5">
              <KeyValue
                columns={2}
                items={[
                  { label: "When", value: formatDateTime(entry.at) },
                  { label: "User", value: entry.userName },
                  { label: "Entity type", value: entry.entityType },
                  { label: "Entity", value: <span className="font-mono text-[13px]">{entry.entityRef ?? entry.entityId}</span> },
                  { label: "Entity id", value: <span className="font-mono text-[13px]">{entry.entityId}</span> },
                  { label: "Reason", value: entry.reason ?? "—" },
                ]}
              />
              <div>
                <p className="mb-2 text-sm font-semibold">Changes</p>
                <JsonDiff previous={entry.previous} next={entry.next} />
              </div>
              {entry.meta ? (
                <div>
                  <p className="mb-2 text-sm font-semibold">Request metadata</p>
                  <pre tabIndex={0} aria-label="Audit metadata (scrollable)" className="overflow-x-auto rounded-xl bg-surface-secondary p-3 text-xs">{JSON.stringify(entry.meta, null, 2)}</pre>
                </div>
              ) : null}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Raw entry (JSON)</summary>
                <pre tabIndex={0} aria-label="Audit entry JSON (scrollable)" className="mt-2 overflow-x-auto rounded-xl bg-surface-secondary p-3 text-xs">{JSON.stringify(entry, null, 2)}</pre>
              </details>
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

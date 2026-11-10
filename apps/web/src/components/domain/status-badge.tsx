import { Badge, type BadgeTone } from "@tobacco/ui";

export type StatusKind =
  | "transporterNote"
  | "deliveryNote"
  | "sale"
  | "priceBatch"
  | "startOfDay"
  | "dispatch"
  | "import"
  | "paymentSchedule"
  | "paymentLine"
  | "approval"
  | "stage";

type Entry = { label: string; tone: BadgeTone };

const MAP: Record<StatusKind, Record<string, Entry>> = {
  transporterNote: {
    OPEN: { label: "Open", tone: "primary" },
    COMPLETED: { label: "Completed", tone: "success" },
  },
  deliveryNote: {
    OPEN: { label: "Open", tone: "primary" },
    TICKETS_PRINTING: { label: "Tickets Printing", tone: "warning" },
    CHECKED: { label: "Checked", tone: "neutral" },
    LAID: { label: "Laid", tone: "success" },
  },
  sale: {
    DRAFT: { label: "Draft", tone: "danger" }, // Draft sales are shown in red in e-Port (Manual 06)
    BALANCED: { label: "Balanced", tone: "warning" },
    PROCESSED: { label: "Processed", tone: "success" },
  },
  priceBatch: {
    DRAFT: { label: "Draft", tone: "neutral" },
    POSTED: { label: "Posted", tone: "success" },
  },
  startOfDay: {
    DRAFT: { label: "Draft", tone: "neutral" },
    POSTED: { label: "Posted", tone: "success" },
  },
  dispatch: {
    DRAFT: { label: "Draft", tone: "warning" },
    POSTED: { label: "Posted", tone: "success" },
    CANCELLED: { label: "Cancelled", tone: "outline" },
  },
  import: {
    UPLOADED: { label: "Uploaded", tone: "neutral" },
    VALIDATING: { label: "Validating", tone: "primary" },
    PROCESSING: { label: "Processing", tone: "primary" },
    COMPLETED: { label: "Completed", tone: "success" },
    COMPLETED_WITH_ERRORS: { label: "Completed with errors", tone: "warning" },
    FAILED: { label: "Failed", tone: "danger" },
  },
  paymentSchedule: {
    DRAFT: { label: "Draft", tone: "neutral" },
    GENERATED: { label: "Generated", tone: "primary" },
    SUBMITTED: { label: "Submitted", tone: "warning" },
    PARTIALLY_PAID: { label: "Partially paid", tone: "warning" },
    PAID: { label: "Paid", tone: "success" },
    FAILED: { label: "Failed", tone: "danger" },
  },
  paymentLine: {
    PENDING: { label: "Unpaid", tone: "neutral" },
    SUBMITTED: { label: "Submitted", tone: "warning" },
    PAID: { label: "Paid", tone: "success" },
    FAILED: { label: "Failed", tone: "danger" },
  },
  approval: {
    PENDING: { label: "Pending", tone: "warning" },
    APPROVED: { label: "Approved", tone: "success" },
    REJECTED: { label: "Rejected", tone: "danger" },
    CANCELLED: { label: "Cancelled", tone: "outline" },
  },
  stage: {
    NOT_STARTED: { label: "Not started", tone: "outline" },
    ACTIVE: { label: "In progress", tone: "primary" },
    COMPLETE: { label: "Complete", tone: "success" },
    BLOCKED: { label: "Blocked", tone: "danger" },
    ATTENTION: { label: "Needs attention", tone: "warning" },
  },
};

export function StatusBadge({ kind, value, className }: { kind: StatusKind; value: string; className?: string }) {
  const entry = MAP[kind][value] ?? { label: value, tone: "neutral" as BadgeTone };
  return (
    <Badge tone={entry.tone} dot className={className} data-status={value}>
      {entry.label}
    </Badge>
  );
}

export function statusLabel(kind: StatusKind, value: string): string {
  return MAP[kind][value]?.label ?? value;
}

"use client";

import { Check, Download, FileWarning } from "lucide-react";
import { Callout, DataTable, cn, type ColumnDef } from "@tobacco/ui";
import { IMPORT_TYPE_LABEL, type ImportJob, type ImportRowError, type ImportType } from "@tobacco/shared";
import { PermissionButton } from "@/lib/permissions";
import { downloadCsv } from "@/lib/csv";

export const IMPORT_TYPE_ORDER: ImportType[] = ["GROWER_BOOKING", "STOP_ORDER", "GROWER_REGISTER", "CREDITOR_REGISTER"];

export function isImportType(v: string | null | undefined): v is ImportType {
  return Boolean(v && (IMPORT_TYPE_ORDER as string[]).includes(v));
}

export function importTypeLabel(t: ImportType): string {
  return IMPORT_TYPE_LABEL[t];
}

/** Permanent honesty notice: this is a development adapter, not the real TIMB file handling. */
export function DevFormatCallout({ className }: { className?: string }) {
  return (
    <Callout tone="warning" title="Development sample format" className={className}>
      Real TIMB files are encrypted, with a key chosen by the file-name prefix; real decryption is not implemented (UQ-13). The sample files here
      are plain text and importing them is <strong>not</strong> equivalent to processing a real TIMB file. <strong>Do not rename source files.</strong>
    </Callout>
  );
}

/** Horizontal stepper. Earlier steps are clickable (when `onStep` is given) until the import has run. */
export function Stepper({
  steps,
  current,
  onStep,
}: {
  steps: string[];
  current: number;
  onStep?: (step: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Import steps" data-testid="import-stepper">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const clickable = done && onStep;
        const content = (
          <>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-success text-success-foreground ring-1 ring-success-text/30",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-surface-tertiary text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : n}
            </span>
            <span className={cn("text-sm", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
          </>
        );
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined} data-step={n} data-state={done ? "done" : active ? "active" : "todo"}>
            {clickable ? (
              <button type="button" onClick={() => onStep(n)} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-surface-tertiary">
                {content}
              </button>
            ) : (
              <span className="flex items-center gap-2 px-1 py-0.5">{content}</span>
            )}
            {i < steps.length - 1 ? <span className="mx-1 hidden h-px w-6 bg-border sm:block" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function CountTile({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "success" | "warning" | "danger" | "primary" }) {
  const toneClass = {
    neutral: "text-foreground",
    primary: "text-primary",
    success: "text-success-text",
    warning: "text-warning-text",
    danger: "text-danger-text",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface p-4" data-testid={`count-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 text-2xl font-semibold leading-none", toneClass)}>{value}</p>
    </div>
  );
}

const errorColumns: ColumnDef<ImportRowError, unknown>[] = [
  { accessorKey: "row", header: "Row", size: 70, cell: ({ getValue }) => <span className="tabular">{getValue<number>() === 0 ? "File" : getValue<number>()}</span> },
  { accessorKey: "field", header: "Field", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue<string>() ?? "—"}</span> },
  { accessorKey: "value", header: "Value", cell: ({ getValue }) => <span className="font-mono text-[13px] text-muted-foreground">{getValue<string>() || "—"}</span> },
  { accessorKey: "message", header: "Problem", cell: ({ getValue }) => <span className="text-danger-text">{getValue<string>()}</span> },
];

/** Row-level errors, with an optional download of the error report. */
export function RowErrorsTable({ errors, className }: { errors: ImportRowError[]; className?: string }) {
  return (
    <DataTable
      className={className}
      aria-label="Row-level errors"
      data-testid="row-errors"
      columns={errorColumns}
      data={errors}
      pageSize={10}
      hidePagerWhenSinglePage
      enableColumnVisibility={false}
      emptyIcon={FileWarning}
      emptyTitle="No row errors"
    />
  );
}

/** Download the error report for a job as CSV (requires timb.download-errors). */
export function DownloadErrorsButton({ job, size = "md" }: { job: Pick<ImportJob, "ref" | "filename" | "rowErrors">; size?: "sm" | "md" }) {
  return (
    <PermissionButton
      permission="timb.download-errors"
      variant="secondary"
      size={size}
      disabled={job.rowErrors.length === 0}
      disabledReason={job.rowErrors.length === 0 ? "No errors to download" : undefined}
      data-testid="download-errors"
      onClick={() =>
        downloadCsv(
          `${job.ref}_errors.csv`,
          ["import_ref", "file", "row", "field", "value", "problem"],
          job.rowErrors.map((e) => [job.ref, job.filename, e.row === 0 ? "file" : e.row, e.field ?? "", e.value ?? "", e.message]),
        )
      }
    >
      <Download /> Download error report
    </PermissionButton>
  );
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

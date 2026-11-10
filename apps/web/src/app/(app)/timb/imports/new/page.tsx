"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Circle, FileText, UploadCloud, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataTable,
  DemoBadge,
  KeyValue,
  PageHeader,
  Skeleton,
  Spinner,
  UnverifiedBadge,
  toast,
  type ColumnDef,
} from "@tobacco/ui";
import { IMPORT_TYPE_LABEL, MESSAGES, type ImportType } from "@tobacco/shared";
import { SAMPLE_FILES } from "@tobacco/shared/fixtures";
import { RequirePermission } from "@/components/page-guard";
import {
  CountTile,
  DevFormatCallout,
  DownloadErrorsButton,
  IMPORT_TYPE_ORDER,
  RowErrorsTable,
  Stepper,
  formatSize,
  isImportType,
} from "@/components/timb/import-parts";
import { useCan, PermissionButton } from "@/lib/permissions";
import { useAction, useDb } from "@/mock/hooks";
import { IMPORT_PERMISSION, IMPORT_TYPE_INFO, importTimbFile, previewTimbFile, type ImportOutcome, type PreviewRow } from "@/mock/domain/timb";

const STEPS = ["Type", "Upload", "Validate", "Preview", "Confirm", "Result"];

interface Source {
  kind: "sample" | "upload";
  key?: string;
  filename: string;
  content: string;
  sizeBytes: number;
}

export default function NewImportPage() {
  return (
    <RequirePermission permission="timb.view">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Workspace />
      </Suspense>
    </RequirePermission>
  );
}

function Workspace() {
  const params = useSearchParams();
  const typeParam = params.get("type");
  const can = useCan();
  const fileInput = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<ImportType | null>(isImportType(typeParam) ? typeParam : null);
  const [step, setStep] = useState<number>(isImportType(typeParam) ? 2 : 1);
  const [source, setSource] = useState<Source | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const preview = useDb((db) =>
    type && source ? previewTimbFile(db, { type, filename: source.filename, content: source.content, sizeBytes: source.sizeBytes }) : null,
  );

  const { run, isPending } = useAction(importTimbFile, { silent: true });

  const info = type ? IMPORT_TYPE_INFO[type] : null;
  const allowedToImport = type ? can(IMPORT_PERMISSION[type]) : false;

  const chooseType = (t: ImportType) => {
    setType(t);
    setSource(null);
    setOutcome(null);
    setStep(2);
  };

  const selectSource = (s: Source) => {
    setSource(s);
    setOutcome(null);
    setReadError(null);
    setStep(3);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const content = await file.text();
      selectSource({ kind: "upload", filename: file.name, content, sizeBytes: file.size });
    } catch {
      setReadError("The file could not be read as text.");
    }
  };

  const doImport = async () => {
    if (!type || !source) return;
    setStep(5);
    const res = await run({ type, filename: source.filename, content: source.content, sizeBytes: source.sizeBytes, isSample: source.kind === "sample" });
    setConfirmOpen(false);
    if (res.ok) {
      setOutcome(res.data);
      if (res.data.ok) toast.success(res.data.message);
      else toast.error(res.data.message);
      setStep(6);
    } else {
      toast.error(res.error.message);
      setStep(4);
    }
  };

  const reset = () => {
    setSource(null);
    setOutcome(null);
    setStep(type ? 2 : 1);
  };

  return (
    <>
      <PageHeader
        title="New TIMB import"
        description="Select a file type, upload (or pick a development sample), validate, preview, then confirm. Nothing is written until you confirm."
        actions={
          <Button asChild variant="secondary">
            <Link href="/timb/imports">
              <ArrowLeft /> Import history
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-6">
        <Card className="p-4">
          <Stepper steps={STEPS} current={step} onStep={step < 5 ? setStep : undefined} />
        </Card>
        <DevFormatCallout />

        {step === 1 || !type ? (
          <TypeStep selected={type} onSelect={chooseType} />
        ) : null}

        {step === 2 && type && info ? (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Upload — {info.label}</CardTitle>
                <CardDescription>{info.description}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Change type
              </Button>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Upload a file</p>
                <label
                  htmlFor="import-file"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-strong bg-surface-secondary px-6 py-10 text-center transition-colors hover:border-primary hover:bg-primary-soft/40"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void onFile(e.dataTransfer.files?.[0]);
                  }}
                >
                  <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium">Choose a file or drop it here</span>
                  <span className="text-xs text-muted-foreground">Use the file exactly as TIMB sent it — don't rename it.</span>
                  <input
                    id="import-file"
                    ref={fileInput}
                    data-testid="file-input"
                    type="file"
                    accept=".txt,.csv,text/plain,text/csv"
                    className="sr-only"
                    onChange={(e) => void onFile(e.target.files?.[0])}
                  />
                </label>
                {readError ? <Callout tone="danger">{readError}</Callout> : null}
                <p className="text-xs text-muted-foreground">
                  File-name rule: {info.prefixRule}
                  {info.prefixDocumented ? null : <UnverifiedBadge className="ml-2" uq="UQ-13" />}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expected columns: <span className="font-mono">{[...info.columns, ...info.optionalColumns.map((c) => `${c}?`)].join(", ")}</span>
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Or use a development sample file</p>
                <ul className="flex flex-col gap-2">
                  {SAMPLE_FILES.filter((s) => s.importType === type).map((s) => (
                    <li key={s.key}>
                      <button
                        type="button"
                        data-testid={`sample-${s.key}`}
                        onClick={() => selectSource({ kind: "sample", key: s.key, filename: s.filename, content: s.content, sizeBytes: new TextEncoder().encode(s.content).length })}
                        className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[13px] font-medium">{s.filename}</span>
                            {s.description.startsWith("DEMO") ? <DemoBadge /> : <Badge tone="success">Documented</Badge>}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{s.description.replace(/^DEMO: /, "")}</span>
                        </span>
                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 3 && type && info && source && preview ? (
          <ValidateStep
            source={source}
            preview={preview}
            infoColumns={info.columns}
            prefixRule={info.prefixRule}
            onBack={() => setStep(2)}
            onContinue={() => setStep(4)}
            onRecordFailed={doImport}
            canImport={allowedToImport}
            pending={isPending}
          />
        ) : null}

        {step === 4 && type && info && source && preview ? (
          <PreviewStep
            type={type}
            preview={preview}
            onBack={() => setStep(3)}
            onImport={() => setConfirmOpen(true)}
          />
        ) : null}

        {step === 5 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14" role="status" aria-live="polite">
              <Spinner className="size-8" label="Processing records" />
              <p className="text-sm font-medium">Processing records…</p>
              <p className="text-xs text-muted-foreground">Validating, then creating and updating records in one transaction.</p>
            </CardContent>
          </Card>
        ) : null}

        {step === 6 && outcome && type ? <ResultStep outcome={outcome} type={type} onAgain={reset} /> : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Import ${source?.filename ?? "file"}?`}
        description={
          preview ? (
            <>
              This will create <strong>{preview.wouldCreate}</strong> and update <strong>{preview.wouldUpdate}</strong> record(s).{" "}
              {preview.rowErrors.length > 0 ? (
                <>
                  <strong>{preview.rowErrors.length}</strong> row(s) with errors will be skipped and listed in the error report.
                </>
              ) : (
                "No row errors were found."
              )}
            </>
          ) : undefined
        }
        confirmLabel="Import records"
        loading={isPending}
        onConfirm={doImport}
      />
    </>
  );
}

function TypeStep({ selected, onSelect }: { selected: ImportType | null; onSelect: (t: ImportType) => void }) {
  const can = useCan();
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>1 · What are you importing?</CardTitle>
          <CardDescription>Each file type has its own permission and file-name rule.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 md:grid-cols-2">
          {IMPORT_TYPE_ORDER.map((t) => {
            const info = IMPORT_TYPE_INFO[t];
            const allowed = can(IMPORT_PERMISSION[t]);
            return (
              <li key={t}>
                <button
                  type="button"
                  data-testid={`import-type-${t}`}
                  onClick={() => onSelect(t)}
                  className={`flex h-full w-full flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft/30 ${selected === t ? "border-primary bg-primary-soft/40" : "border-border"} ${allowed ? "" : "opacity-70"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{info.label}</span>
                    <span className="text-xs text-muted-foreground">{info.manual}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{info.description}</span>
                  {allowed ? null : <span className="text-xs text-warning-text">You can browse, but importing needs “{IMPORT_PERMISSION[t]}”.</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2.5">
      <Icon className={`mt-0.5 size-4 shrink-0 ${ok ? "text-success-text" : "text-danger-text"}`} aria-label={ok ? "passed" : "failed"} />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </li>
  );
}

function ValidateStep({
  source,
  preview,
  infoColumns,
  prefixRule,
  onBack,
  onContinue,
  onRecordFailed,
  canImport,
  pending,
}: {
  source: Source;
  preview: NonNullable<ReturnType<typeof previewTimbFile>>;
  infoColumns: string[];
  prefixRule: string;
  onBack: () => void;
  onContinue: () => void;
  onRecordFailed: () => void;
  canImport: boolean;
  pending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>3 · Validate</CardTitle>
          <CardDescription>The same checks run again when you confirm the import.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <KeyValue
          columns={4}
          items={[
            { label: "File name", value: <span className="break-all font-mono text-[13px]">{source.filename}</span> },
            { label: "Size", value: formatSize(source.sizeBytes) },
            { label: "Data rows", value: preview.rows.length || Math.max(0, preview.lineCount - 1) },
            { label: "Source", value: source.kind === "sample" ? "Development sample" : "Uploaded file" },
          ]}
        />
        <ul className="flex flex-col gap-3 rounded-xl bg-surface-secondary p-4" data-testid="validation-checks">
          <Check
            ok={preview.prefix.ok}
            label="File name prefix selects a decryption key"
            detail={preview.prefix.ok ? prefixRule : <span className="text-danger-text">{prefixRule}</span>}
          />
          <Check
            ok={preview.headerOk}
            label="Header has every required column"
            detail={
              preview.headerOk ? (
                <span className="font-mono">{infoColumns.join(", ")}</span>
              ) : (
                <span className="text-danger-text">
                  {preview.headers.length === 0 ? "No header found." : `Missing: ${preview.missingColumns.join(", ")}`}
                </span>
              )
            }
          />
          <Check ok={preview.rows.length > 0 || preview.blockingMessage === undefined} label="File contains records" detail={`${preview.rows.length} data row(s) read`} />
        </ul>
        {preview.blockingMessage ? (
          <Callout tone="danger" title="This file would be refused">
            <span data-testid="validation-error">{preview.blockingMessage}</span>
            <span className="mt-1 block">
              {preview.prefix.ok ? "Fix the file or ask TIMB to resend it. Don't edit the file." : "Use the original file name, which selects the floor's decryption key. Don't rename source files."}
            </span>
          </Callout>
        ) : (
          <Callout tone="success" title="File accepted">
            Prefix and header are valid. Continue to preview the records before anything is written.
          </Callout>
        )}
      </CardContent>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <div className="flex items-center gap-2">
          {preview.blockingMessage ? (
            <PermissionButton
              permission="timb.import-bookings"
              variant="ghost"
              loading={pending}
              disabled={!canImport}
              onClick={onRecordFailed}
              data-testid="record-failed"
              title="Runs the import so the refusal is recorded in the history as Failed"
            >
              Record this attempt as Failed
            </PermissionButton>
          ) : null}
          <Button onClick={onContinue} disabled={Boolean(preview.blockingMessage)} data-testid="validate-continue">
            Continue to preview <ArrowRight />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PreviewStep({
  type,
  preview,
  onBack,
  onImport,
}: {
  type: ImportType;
  preview: NonNullable<ReturnType<typeof previewTimbFile>>;
  onBack: () => void;
  onImport: () => void;
}) {
  const erroredRows = useMemo(() => new Set(preview.rows.filter((r) => r.errors.length > 0).map((r) => r.row)), [preview.rows]);
  const columns = useMemo<ColumnDef<PreviewRow, unknown>[]>(
    () => [
      { id: "row", header: "#", size: 56, accessorFn: (r) => r.row, cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue<number>()}</span> },
      ...preview.headers.map<ColumnDef<PreviewRow, unknown>>((h) => ({
        id: h,
        header: h,
        accessorFn: (r) => r.record[h] ?? "",
        cell: ({ getValue, row }) => {
          const bad = row.original.errors.some((e) => e.field === h);
          return <span className={bad ? "font-medium text-danger-text" : ""}>{getValue<string>() || "—"}</span>;
        },
      })),
      {
        id: "__status",
        header: "Result",
        enableSorting: false,
        accessorFn: (r) => (r.errors.length ? "error" : (r.action ?? "")),
        cell: ({ row }) =>
          row.original.errors.length > 0 ? (
            <Badge tone="danger" title={row.original.errors.map((e) => e.message).join(" ")}>
              Error
            </Badge>
          ) : (
            <Badge tone={row.original.action === "update" ? "primary" : "success"}>{row.original.action === "update" ? "Will update" : "Will create"}</Badge>
          ),
      },
    ],
    [preview.headers],
  );
  const info = IMPORT_TYPE_INFO[type];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>4 · Preview</CardTitle>
          <CardDescription>
            {info.label} · <span className="font-mono">{preview.filename}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <CountTile label="Rows in file" value={preview.rows.length} />
          <CountTile label="Will create" value={preview.wouldCreate} tone="success" />
          <CountTile label="Will update" value={preview.wouldUpdate} tone="primary" />
          <CountTile label="Rows with errors" value={preview.rowErrors.length} tone={preview.rowErrors.length ? "danger" : "neutral"} />
        </div>
        {preview.duplicateOf ? (
          <Callout tone="info" title={`This exact file was already imported (${preview.duplicateOf.ref})`}>
            Importing it again updates the matched records and does not duplicate them (Manual 02).
          </Callout>
        ) : null}
        {type === "STOP_ORDER" && preview.fileDate ? (
          <div className="flex flex-col gap-2">
            <Callout tone="info" title={`Linked to the sales of ${preview.fileDate}`}>
              The date in the file name links these stop orders to that day's sales. If the date doesn't match the sale date, the stop order is not deducted.
            </Callout>
            {preview.autoCreate.growers + preview.autoCreate.creditors > 0 ? (
              <Callout tone="info">
                {preview.autoCreate.growers} grower(s) and {preview.autoCreate.creditors} creditor(s) not yet in the system will be created automatically (Manual 07).
              </Callout>
            ) : null}
            <Callout tone="warning" title={preview.wouldRemove > 0 ? `${preview.wouldRemove} earlier unpaid line(s) for this date will be replaced` : "Re-importing replaces the earlier import for this date"}>
              Importing a file for the same date replaces the earlier import. Lines already deducted are kept. <UnverifiedBadge uq="UQ-07" /> The manual says "the same eight characters"; we assume this
              means the date.
            </Callout>
          </div>
        ) : null}
        <DataTable
          aria-label="Records preview"
          data-testid="preview-table"
          columns={columns}
          data={preview.rows}
          getRowId={(r) => String(r.row)}
          pageSize={10}
          hidePagerWhenSinglePage
          enableColumnVisibility={false}
          dense
          rowClassName={(r) => (erroredRows.has(r.row) ? "bg-danger-soft/50" : undefined)}
        />
        {preview.rowErrors.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-danger-text">
              <AlertTriangle className="size-4" aria-hidden /> {preview.rowErrors.length} row-level error(s)
            </p>
            <RowErrorsTable errors={preview.rowErrors} />
          </div>
        ) : null}
      </CardContent>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <PermissionButton permission={IMPORT_PERMISSION[type]} onClick={onImport} data-testid="import-confirm-open" disabled={!preview.canImport}>
          Import {preview.validCount} record{preview.validCount === 1 ? "" : "s"} <ArrowRight />
        </PermissionButton>
      </div>
    </Card>
  );
}

function ResultStep({ outcome, type, onAgain }: { outcome: ImportOutcome; type: ImportType; onAgain: () => void }) {
  const { job } = outcome;
  const info = IMPORT_TYPE_INFO[type];
  const tone = !outcome.ok ? "danger" : job.errorCount > 0 ? "warning" : "success";
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>6 · Result</CardTitle>
          <CardDescription>
            {job.ref} · {IMPORT_TYPE_LABEL[type]} · <span className="font-mono">{job.filename}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Callout tone={tone} title={!outcome.ok ? "Import failed" : job.errorCount > 0 ? MESSAGES.IMPORT_COMPLETE_WITH_ERRORS.text : "Import complete"}>
          <span data-testid="import-result-message">{outcome.message}</span>
          {job.errorCount > 0 && outcome.ok ? (
            <span className="mt-1 block">{MESSAGES.IMPORT_COMPLETE_WITH_ERRORS.action}</span>
          ) : null}
        </Callout>
        <div className="grid grid-cols-3 gap-3">
          <CountTile label="Created" value={job.created} tone="success" />
          <CountTile label="Updated" value={job.updated} tone="primary" />
          <CountTile label="Errors" value={job.errorCount} tone={job.errorCount ? "danger" : "neutral"} />
        </div>
        {job.rowErrors.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Row-level errors</p>
              <DownloadErrorsButton job={job} />
            </div>
            <RowErrorsTable errors={job.rowErrors} />
          </div>
        ) : null}
      </CardContent>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
        <Button variant="secondary" onClick={onAgain}>
          <Circle /> Import another file
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/timb/imports/${job.id}`}>Open import {job.ref}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/timb/imports">Import history</Link>
          </Button>
          {outcome.ok ? (
            <Button asChild data-testid="view-results">
              <Link href={info.resultHref}>View {info.label.toLowerCase()}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

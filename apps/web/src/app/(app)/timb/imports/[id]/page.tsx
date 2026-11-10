"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileX, RotateCcw } from "lucide-react";
import {
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  DemoBadge,
  EmptyState,
  KeyValue,
  PageHeader,
  Skeleton,
  Timeline,
  type ColumnDef,
} from "@tobacco/ui";
import { IMPORT_TYPE_LABEL, MESSAGES, formatDateTime, type ImportJob } from "@tobacco/shared";
import { StatusBadge } from "@/components/domain/status-badge";
import { CountTile, DevFormatCallout, DownloadErrorsButton, RowErrorsTable, formatSize } from "@/components/timb/import-parts";
import { RequirePermission } from "@/components/page-guard";
import { useDbQuery } from "@/mock/hooks";
import { userName } from "@/mock/ctx";
import { IMPORT_TYPE_INFO } from "@/mock/domain/timb";

export default function ImportDetailPage() {
  return (
    <RequirePermission permission="timb.view">
      <Detail />
    </RequirePermission>
  );
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useDbQuery(["timb", "import", id], (db) => {
    const job = db.importJobs.find((j) => j.id === id);
    return job ? { job, userName: userName(db, job.userId) } : null;
  });

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (!data) {
    return (
      <EmptyState
        icon={FileX}
        title="Import not found"
        description={`No import with id “${id}”. It may belong to a different demo state.`}
        action={
          <Button asChild variant="secondary">
            <Link href="/timb/imports">Back to import history</Link>
          </Button>
        }
        className="rounded-2xl border border-border bg-surface"
      />
    );
  }
  return <JobView job={data.job} importedBy={data.userName} />;
}

function JobView({ job, importedBy }: { job: ImportJob; importedBy: string }) {
  const info = IMPORT_TYPE_INFO[job.type];
  const failed = job.status === "FAILED";
  const recordColumns = useMemo<ColumnDef<Record<string, string>, unknown>[]>(() => {
    const keys = job.records[0] ? Object.keys(job.records[0]) : [];
    return keys.map((k) => ({ id: k, header: k, accessorFn: (r) => r[k] ?? "", cell: ({ getValue }) => <span>{getValue<string>() || "—"}</span> }));
  }, [job.records]);

  const timeline = [
    { id: "up", title: "Uploaded", meta: formatDateTime(job.startedAt), body: `${job.filename} (${formatSize(job.sizeBytes)})`, tone: "neutral" as const },
    { id: "val", title: "Validated", meta: formatDateTime(job.startedAt), body: failed ? job.resultMessage : "File name prefix and header accepted", tone: failed ? ("danger" as const) : ("neutral" as const) },
    ...(failed
      ? []
      : [{ id: "proc", title: "Processed", meta: formatDateTime(job.finishedAt), body: `${job.created} created, ${job.updated} updated, ${job.errorCount} errors`, tone: "primary" as const }]),
    {
      id: "end",
      title: failed ? "Failed" : job.status === "COMPLETED_WITH_ERRORS" ? "Completed with errors" : "Completed",
      meta: formatDateTime(job.finishedAt),
      body: importedBy,
      tone: failed ? ("danger" as const) : job.errorCount > 0 ? ("warning" as const) : ("success" as const),
    },
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {job.ref} <span className="font-mono text-xl font-medium text-muted-foreground">{job.filename}</span>
          </span>
        }
        description={`${IMPORT_TYPE_LABEL[job.type]} import · ${info.manual}`}
        badges={
          <>
            <StatusBadge kind="import" value={job.status} />
            {job.isSample ? <DemoBadge>DEV SAMPLE</DemoBadge> : null}
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/timb/imports">
                <ArrowLeft /> Import history
              </Link>
            </Button>
            <DownloadErrorsButton job={job} />
          </>
        }
      />
      <div className="flex flex-col gap-6">
        <Callout tone={failed ? "danger" : job.errorCount > 0 ? "warning" : "success"} title={failed ? "Import failed" : job.errorCount > 0 ? MESSAGES.IMPORT_COMPLETE_WITH_ERRORS.text : "Import complete"}>
          <span data-testid="job-result-message">{job.resultMessage}</span>
        </Callout>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <CountTile label="Created" value={job.created} tone="success" />
          <CountTile label="Updated" value={job.updated} tone="primary" />
          <CountTile label="Errors" value={job.errorCount} tone={job.errorCount ? "danger" : "neutral"} />
          <CountTile label="Rows in file" value={job.records.length || "—"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>File</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValue
                columns={2}
                items={[
                  { label: "Reference", value: job.ref },
                  { label: "Type", value: IMPORT_TYPE_LABEL[job.type] },
                  { label: "File name", value: <span className="break-all font-mono text-[13px]">{job.filename}</span> },
                  { label: "Size", value: formatSize(job.sizeBytes) },
                  { label: "Imported by", value: importedBy },
                  { label: "Started", value: formatDateTime(job.startedAt) },
                  { label: "Finished", value: formatDateTime(job.finishedAt) },
                  { label: "Content fingerprint", value: <span className="font-mono text-xs">{job.checksum}</span> },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Status timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline items={timeline} />
            </CardContent>
          </Card>
        </div>

        {job.rowErrors.length > 0 ? (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Row-level errors</CardTitle>
                <CardDescription>{failed ? "The file was refused as a whole." : `${job.rowErrors.length} row(s) were skipped. Fix them and import again.`}</CardDescription>
              </div>
              <DownloadErrorsButton job={job} size="sm" />
            </CardHeader>
            <CardContent>
              <RowErrorsTable errors={job.rowErrors} className="border-0 shadow-none" />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Records in the file</CardTitle>
              <CardDescription>
                {job.records.length > 0 ? "As read from the file (development sample format)." : "No records were kept for this import."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {job.records.length > 0 ? (
              <DataTable
                aria-label="Records in the file"
                columns={recordColumns}
                data={job.records}
                pageSize={10}
                hidePagerWhenSinglePage
                dense
                enableColumnVisibility={false}
                className="border-0 shadow-none"
              />
            ) : (
              <EmptyState title="No records kept" description="Historical demo imports do not keep their file contents." className="py-8" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Importing this file again</span> updates the matched records and does not duplicate them
                {job.type === "STOP_ORDER" ? " (stop orders for the same date are replaced)." : "."}
              </p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/timb/imports/new?type=${job.type}`}>Import another {IMPORT_TYPE_LABEL[job.type].toLowerCase()} file</Link>
            </Button>
          </CardContent>
        </Card>
        <DevFormatCallout />
      </div>
    </>
  );
}

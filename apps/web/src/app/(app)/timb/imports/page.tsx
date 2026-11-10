"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FileDown, Plus } from "lucide-react";
import {
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  NativeSelect,
  PageHeader,
  type ColumnDef,
} from "@tobacco/ui";
import { IMPORT_STATUSES, IMPORT_TYPE_LABEL, IMPORT_TYPES, formatDateTime, type ImportJob, type ImportStatus, type ImportType } from "@tobacco/shared";
import { StatusBadge, statusLabel } from "@/components/domain/status-badge";
import { ImportLink } from "@/components/domain/entity-links";
import { DevFormatCallout, IMPORT_TYPE_ORDER, formatSize } from "@/components/timb/import-parts";
import { RequirePermission } from "@/components/page-guard";
import { useCan } from "@/lib/permissions";
import { useDbQuery } from "@/mock/hooks";
import { userName } from "@/mock/ctx";
import { IMPORT_PERMISSION, IMPORT_TYPE_INFO } from "@/mock/domain/timb";

type Row = ImportJob & { userName: string };

export default function ImportsPage() {
  return (
    <RequirePermission permission="timb.view">
      <ImportHistory />
    </RequirePermission>
  );
}

function ImportHistory() {
  const router = useRouter();
  const can = useCan();
  const [type, setType] = useState<"" | ImportType>("");
  const [status, setStatus] = useState<"" | ImportStatus>("");
  const { data, isLoading } = useDbQuery(["timb", "imports"], (db): Row[] =>
    db.importJobs.map((j) => ({ ...j, userName: userName(db, j.userId) })).sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.ref.localeCompare(a.ref)),
  );
  const rows = useMemo(() => (data ?? []).filter((j) => (!type || j.type === type) && (!status || j.status === status)), [data, type, status]);

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "ref", header: "Reference", cell: ({ row }) => <ImportLink id={row.original.id} label={row.original.ref} /> },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => IMPORT_TYPE_LABEL[getValue<ImportType>()] },
    {
      accessorKey: "filename",
      header: "File",
      cell: ({ row }) => (
        <div className="max-w-[28rem]">
          <p className="truncate font-mono text-[13px]">{row.original.filename}</p>
          {row.original.resultMessage ? <p className={`truncate text-xs ${row.original.status === "FAILED" ? "text-danger-text" : "text-muted-foreground"}`}>{row.original.resultMessage}</p> : null}
        </div>
      ),
    },
    { accessorKey: "sizeBytes", header: "Size", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatSize(getValue<number>())}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge kind="import" value={getValue<string>()} /> },
    { accessorKey: "created", header: "Created", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "updated", header: "Updated", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    {
      accessorKey: "errorCount",
      header: "Errors",
      cell: ({ getValue }) => <span className={`tabular ${getValue<number>() > 0 ? "font-semibold text-danger-text" : ""}`}>{getValue<number>()}</span>,
    },
    { accessorKey: "userName", header: "Imported by" },
    { accessorKey: "startedAt", header: "When", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
  ];

  return (
    <>
      <PageHeader
        title="TIMB imports"
        description="Data transfers from TIMB: grower bookings, stop orders, grower register and creditor register. Every attempt is kept in this history."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="new-import">
                <Plus /> New import <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <DropdownMenuLabel>Choose what to import</DropdownMenuLabel>
              {IMPORT_TYPE_ORDER.map((t) => {
                const allowed = can(IMPORT_PERMISSION[t]);
                return (
                  <DropdownMenuItem key={t} asChild disabled={!allowed}>
                    <Link href={`/timb/imports/new?type=${t}`} aria-disabled={!allowed} tabIndex={allowed ? 0 : -1} data-testid={`new-import-${t}`}>
                      <FileDown />
                      <span className="flex flex-col leading-tight">
                        <span>{IMPORT_TYPE_INFO[t].label}</span>
                        <span className="text-xs text-muted-foreground">{allowed ? IMPORT_TYPE_INFO[t].manual : `Requires ${IMPORT_PERMISSION[t]}`}</span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="flex flex-col gap-4">
        <DevFormatCallout />
        <DataTable
          data-testid="imports-table"
          aria-label="Import history"
          columns={columns}
          data={rows}
          loading={isLoading}
          searchPlaceholder="Search file, reference or user"
          onRowClick={(r) => router.push(`/timb/imports/${r.id}`)}
          getRowId={(r) => r.id}
          initialSorting={[]}
          emptyIcon={FileDown}
          emptyTitle="No imports yet"
          emptyDescription="Import the day's booking file to get started."
          emptyAction={
            <Button asChild size="sm">
              <Link href="/timb/imports/new?type=GROWER_BOOKING">Import bookings</Link>
            </Button>
          }
          toolbar={
            <>
              <NativeSelect value={type} onChange={(e) => setType(e.target.value as "" | ImportType)} wrapperClassName="w-48" size="sm" aria-label="Filter by type">
                <option value="">All types</option>
                {IMPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {IMPORT_TYPE_LABEL[t]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as "" | ImportStatus)} wrapperClassName="w-52" size="sm" aria-label="Filter by status">
                <option value="">All statuses</option>
                {IMPORT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel("import", s)}
                  </option>
                ))}
              </NativeSelect>
            </>
          }
        />
      </div>
    </>
  );
}

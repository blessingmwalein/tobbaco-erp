"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, Users } from "lucide-react";
import { Badge, Button, DataTable, DemoBadge, NativeSelect, PageHeader, type ColumnDef } from "@tobacco/ui";
import { formatDate, type Grower } from "@tobacco/shared";
import { GrowerLink } from "@/components/domain/entity-links";
import { RequirePermission } from "@/components/page-guard";
import { useDbQuery } from "@/mock/hooks";

type Row = Grower & { name: string; currencies: string[]; bookings: number; lastDelivery?: string };

export default function GrowersPage() {
  return (
    <RequirePermission permission="growers.view">
      <Register />
    </RequirePermission>
  );
}

function Register() {
  const router = useRouter();
  const [active, setActive] = useState<"" | "active" | "inactive">("");
  const [bank, setBank] = useState<"" | "yes" | "no">("");
  const { data, isLoading } = useDbQuery(["growers", "list"], (db): Row[] =>
    db.growers.map((g) => ({
      ...g,
      name: `${g.firstName} ${g.surname}`,
      currencies: db.growerBankAccounts.filter((a) => a.growerNo === g.growerNo).map((a) => a.currency),
      bookings: db.bookings.filter((b) => b.growerNo === g.growerNo).length,
      lastDelivery: db.deliveryNotes
        .filter((d) => d.growerNo === g.growerNo && d.state !== "OPEN")
        .map((d) => d.sellingDate)
        .sort()
        .at(-1),
    })),
  );
  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (g) => (!active || (active === "active") === g.active) && (!bank || (bank === "yes") === (g.currencies.length > 0)),
      ),
    [data, active, bank],
  );

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "growerNo", header: "Grower no.", cell: ({ getValue }) => <GrowerLink growerNo={getValue<string>()} /> },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.isDemo ? <DemoBadge /> : null}
        </span>
      ),
    },
    { accessorKey: "district", header: "District", cell: ({ getValue }) => <span className="tabular">{getValue<number>() || "—"}</span> },
    { accessorKey: "season", header: "Season" },
    { accessorKey: "cellphone", header: "Cellphone", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue<string>() ?? "—"}</span> },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ getValue }) => (getValue<boolean>() ? <Badge tone="success" dot>Active</Badge> : <Badge tone="outline">Inactive</Badge>),
    },
    {
      id: "bank",
      header: "Bank details",
      accessorFn: (r) => r.currencies.join(","),
      cell: ({ row }) =>
        row.original.currencies.length ? (
          <span className="inline-flex gap-1">
            {row.original.currencies.map((c) => (
              <Badge key={c} tone="neutral">
                {c}
              </Badge>
            ))}
          </span>
        ) : (
          <Badge tone="warning" title="Growers without bank details are left out of the payment schedule">
            None
          </Badge>
        ),
    },
    { accessorKey: "bookings", header: "Bookings", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
    { accessorKey: "lastDelivery", header: "Last delivery", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue<string>() ? formatDate(getValue<string>()) : "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Growers"
        description="The grower register. Every grower in a booking file must already be here; import the grower register first if not."
        actions={
          <Button asChild variant="secondary">
            <Link href="/timb/imports/new?type=GROWER_REGISTER">Import grower register</Link>
          </Button>
        }
      />
      <DataTable
        data-testid="growers-table"
        aria-label="Grower register"
        columns={columns}
        data={rows}
        loading={isLoading}
        searchPlaceholder="Search grower no. or name"
        pageSize={10}
        getRowId={(g) => g.growerNo}
        onRowClick={(g) => router.push(`/growers/${g.growerNo}`)}
        emptyIcon={Users}
        emptyTitle="No growers match"
        emptyDescription="Adjust the filters, or import the grower register."
        toolbar={
          <>
            <NativeSelect size="sm" wrapperClassName="w-40" aria-label="Filter by status" value={active} onChange={(e) => setActive(e.target.value as typeof active)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </NativeSelect>
            <NativeSelect size="sm" wrapperClassName="w-48" aria-label="Filter by bank details" value={bank} onChange={(e) => setBank(e.target.value as typeof bank)}>
              <option value="">Any bank details</option>
              <option value="yes">Has bank details</option>
              <option value="no">No bank details</option>
            </NativeSelect>
          </>
        }
        toolbarActions={
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:inline-flex">
            <Landmark className="size-3.5" aria-hidden /> Bank details feed the payment schedule
          </span>
        }
      />
    </>
  );
}

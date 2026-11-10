"use client";

import { useState } from "react";
import { Handshake, Pencil, Plus } from "lucide-react";
import { Badge, Callout, DataTable, DemoBadge, PageHeader, type ColumnDef } from "@tobacco/ui";
import type { Buyer, Warehouse } from "@tobacco/shared";
import { BuyerDialog } from "@/components/growers/buyer-dialog";
import { RequirePermission } from "@/components/page-guard";
import { PermissionButton } from "@/lib/permissions";
import { useDbQuery } from "@/mock/hooks";

type Row = Buyer & { warehouse?: Warehouse };

export default function BuyersPage() {
  return (
    <RequirePermission permission="growers.view">
      <Buyers />
    </RequirePermission>
  );
}

function Buyers() {
  const [editing, setEditing] = useState<Buyer | undefined>();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useDbQuery(["buyers"], (db): Row[] =>
    db.buyers.map((b) => ({ ...b, warehouse: db.warehouses.find((w) => w.code === b.packingWarehouseCode) })),
  );

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono text-[13px] font-semibold">{getValue<string>()}</span> },
    {
      accessorKey: "name",
      header: "Buyer",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.isDemo ? <DemoBadge /> : null}
        </span>
      ),
    },
    {
      id: "warehouse",
      header: "Packing warehouse",
      accessorFn: (r) => r.packingWarehouseCode ?? "",
      cell: ({ row }) =>
        row.original.packingWarehouseCode ? (
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-[13px]">{row.original.packingWarehouseCode}</span>
            {row.original.warehouse?.isDemo ? <DemoBadge /> : null}
          </span>
        ) : (
          <Badge tone="warning" title="Bales of this buyer cannot be dispatched until a packing warehouse is set">
            Not set
          </Badge>
        ),
    },
    {
      id: "grades",
      header: "Buyer grades",
      accessorFn: (r) => r.grades.join(" "),
      cell: ({ row }) => (
        <span className="flex max-w-md flex-wrap gap-1">
          {row.original.grades.length ? row.original.grades.map((g) => <Badge key={g} tone="neutral" className="font-mono">{g}</Badge>) : <span className="text-muted-foreground">None</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <PermissionButton
            permission="admin.reference-data"
            variant="ghost"
            size="sm"
            aria-label={`Edit buyer ${row.original.code}`}
            data-testid={`edit-buyer-${row.original.code}`}
            onClick={() => {
              setEditing(row.original);
              setOpen(true);
            }}
          >
            <Pencil /> Edit
          </PermissionButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Buyers"
        description="Buyers, the buyer grades valid for each, and each buyer's packing warehouse (the dispatch destination)."
        actions={
          <PermissionButton
            permission="admin.reference-data"
            data-testid="add-buyer"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus /> Add buyer
          </PermissionButton>
        }
      />
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="Where this is used">
          At data capture an invalid buyer grade is refused (“Invalid Buyer Grade: X” — the grade doesn't belong to that buyer). At dispatch, a bale is refused if its buyer
          packs at a different warehouse. Only buyer JM (grade 11OF, warehouse CURVERID) is documented; other buyers are demo data.
        </Callout>
        <DataTable
          data-testid="buyers-table"
          aria-label="Buyers"
          columns={columns}
          data={data ?? []}
          loading={isLoading}
          searchPlaceholder="Search buyer code, name or grade"
          pageSize={10}
          getRowId={(b) => b.code}
          emptyIcon={Handshake}
          emptyTitle="No buyers"
          emptyDescription="Add the buyers who purchase on the floor."
        />
      </div>
      <BuyerDialog open={open} onOpenChange={setOpen} buyer={editing} />
    </>
  );
}

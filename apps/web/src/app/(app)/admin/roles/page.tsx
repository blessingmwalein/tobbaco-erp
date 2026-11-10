"use client";

import { useState } from "react";
import { Copy, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import {
  Badge,
  Callout,
  ConfirmDialog,
  DataTable,
  DropdownMenuItem,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ColumnDef,
} from "@tobacco/ui";
import type { RoleDef } from "@tobacco/shared";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { RoleDialog } from "@/components/admin/role-dialog";
import { RequirePermission } from "@/components/page-guard";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import { deleteRole, isCustomRole } from "@/mock/domain/admin";

type Row = RoleDef & { userCount: number };

export default function RolesAdminPage() {
  const { data, isLoading } = useDbQuery(["admin", "roles"], (db): Row[] =>
    db.roles.map((r) => ({ ...r, userCount: db.users.filter((u) => u.roleIds.includes(r.id)).length })),
  );
  const [editing, setEditing] = useState<RoleDef | undefined>();
  const [cloneFrom, setCloneFrom] = useState<RoleDef | undefined>();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Row | null>(null);
  const { run, isPending } = useAction(deleteRole, { success: "Role deleted" });

  const openNew = (opts: { role?: RoleDef; clone?: RoleDef } = {}) => {
    setEditing(opts.role);
    setCloneFrom(opts.clone);
    setOpen(true);
  };

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "name",
      header: "Role",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="max-w-xl truncate text-xs text-muted-foreground">{row.original.description}</p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessorFn: (r) => (r.isSystem ? "System" : r.isDemoOnly ? "Demo only" : "Custom"),
      cell: ({ row }) =>
        row.original.isSystem ? <Badge tone="outline">System</Badge> : row.original.isDemoOnly ? <Badge tone="warning">Demo only</Badge> : <Badge tone="primary">Custom</Badge>,
    },
    { accessorKey: "source", header: "Manual actor / source", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue<string>()}</span> },
    { id: "perms", header: "Permissions", accessorFn: (r) => r.permissions.length, cell: ({ row }) => <span className="tabular">{row.original.permissions.length}</span> },
    { accessorKey: "userCount", header: "Users", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
  ];

  return (
    <RequirePermission permission="admin.roles">
      <PageHeader
        title="Roles & permissions"
        description="The 12 documented roles plus any custom roles. Permissions are action-level and enforced by the backend in Phase 2."
        actions={
          <PermissionButton permission="admin.roles" onClick={() => openNew()} data-testid="new-role">
            <Plus /> New custom role
          </PermissionButton>
        }
      />
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="Where the roles come from">
          System roles follow the “Who” tables of the nine e-Port manuals (see <span className="font-mono text-[12px]">docs/research/role-permission-matrix.md</span>).
          Where the manuals and the brief differ the manual wins — e.g. the Sale Date is set by the Receiving Supervisor and Start of Day by the Data
          Processing Supervisor. The manuals do not list permissions; those are this project's proposal.
        </Callout>
        <Tabs defaultValue="roles">
          <TabsList>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="matrix" data-testid="tab-matrix">
              Permission matrix
            </TabsTrigger>
          </TabsList>
          <TabsContent value="roles">
            <DataTable
              data-testid="roles-table"
              aria-label="Roles"
              columns={columns}
              data={data ?? []}
              loading={isLoading}
              searchPlaceholder="Search roles…"
              emptyIcon={ShieldCheck}
              emptyTitle="No roles"
              onRowClick={(r) => openNew({ role: r })}
              rowMenu={(r) => (
                <>
                  <DropdownMenuItem onSelect={() => openNew({ role: r })}>
                    <Pencil /> {r.isSystem ? "Edit (asks to confirm)" : "Edit"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openNew({ clone: r })}>
                    <Copy /> Clone as custom role
                  </DropdownMenuItem>
                  <DropdownMenuItem danger disabled={!isCustomRole(r) || (r as Row).userCount > 0} onSelect={() => setDel(r as Row)}>
                    <Trash2 /> {!isCustomRole(r) ? "Delete (system role)" : (r as Row).userCount > 0 ? "Delete (still assigned)" : "Delete"}
                  </DropdownMenuItem>
                </>
              )}
            />
          </TabsContent>
          <TabsContent value="matrix">{data ? <PermissionMatrix roles={data} /> : null}</TabsContent>
        </Tabs>
      </div>
      <RoleDialog open={open} onOpenChange={setOpen} role={editing} cloneFrom={cloneFrom} />
      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete role “${del?.name}”?`}
        description="Only unassigned custom roles can be deleted. The deletion is recorded in the audit log."
        confirmLabel="Delete role"
        tone="danger"
        loading={isPending}
        onConfirm={async () => {
          if (del) await run({ id: del.id });
          setDel(null);
        }}
      />
    </RequirePermission>
  );
}

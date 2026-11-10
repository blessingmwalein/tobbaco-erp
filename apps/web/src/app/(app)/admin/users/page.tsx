"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, UserCheck, UserX, Users } from "lucide-react";
import {
  Badge,
  ConfirmDialog,
  DataTable,
  DropdownMenuItem,
  NativeSelect,
  PageHeader,
  type ColumnDef,
} from "@tobacco/ui";
import { formatDateTime, type AppUser } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { PermissionButton } from "@/lib/permissions";
import { UserDialog } from "@/components/admin/user-dialog";
import { useSession } from "@/lib/session";
import { useAction, useDbQuery } from "@/mock/hooks";
import { setUserActive } from "@/mock/domain/admin";

type Row = AppUser & { roleNames: string[]; spNames: string };

export default function UsersAdminPage() {
  const me = useSession((s) => s.userId);
  const { data, isLoading } = useDbQuery(["admin", "users"], (db): { rows: Row[]; roles: Array<{ id: string; name: string }> } => ({
    rows: db.users.map((u) => ({
      ...u,
      roleNames: u.roleIds.map((id) => db.roles.find((r) => r.id === id)?.name ?? id),
      spNames: u.sellingPointIds.length ? u.sellingPointIds.join(", ") : "All",
    })),
    roles: db.roles.map((r) => ({ id: r.id, name: r.name })),
  }));
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<AppUser | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toggle, setToggle] = useState<Row | null>(null);
  const { run, isPending } = useAction(setUserActive, { success: (u) => `${u.name} ${u.active ? "reactivated" : "deactivated"}` });

  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (u) => (!roleFilter || u.roleIds.includes(roleFilter)) && (!statusFilter || (statusFilter === "active") === u.active),
      ),
    [data, roleFilter, statusFilter],
  );

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.name}
          {row.original.id === me ? <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span> : null}
        </span>
      ),
    },
    { accessorKey: "email", header: "Email", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
    {
      id: "roles",
      header: "Roles",
      accessorFn: (r) => r.roleNames.join(", "),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roleNames.map((n) => (
            <Badge key={n} tone="primary">
              {n}
            </Badge>
          ))}
          {row.original.permissionOverrides.grant.length + row.original.permissionOverrides.deny.length > 0 ? (
            <Badge tone="outline" title="Has per-user permission overrides">
              overrides
            </Badge>
          ) : null}
        </div>
      ),
    },
    { accessorKey: "spNames", header: "Selling points" },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => (r.active ? "Active" : "Inactive"),
      cell: ({ row }) => (
        <Badge tone={row.original.active ? "success" : "outline"} dot>
          {row.original.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "last",
      header: "Last login",
      accessorFn: (r) => r.lastLoginAt ?? "",
      cell: ({ row }) => <span className="tabular text-muted-foreground">{row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : "Never"}</span>,
    },
  ];

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setDialogOpen(true);
  };

  return (
    <RequirePermission permission="admin.users">
      <PageHeader
        title="Users"
        description="Create users, assign roles, restrict selling points and fine-tune permissions — no code changes, every change audited."
        actions={
          <PermissionButton
            permission="admin.users"
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
            data-testid="new-user"
          >
            <Plus /> New user
          </PermissionButton>
        }
      />
      <DataTable
        data-testid="users-table"
        aria-label="Users"
        columns={columns}
        data={rows}
        loading={isLoading}
        searchPlaceholder="Search name or email…"
        emptyIcon={Users}
        emptyTitle="No users match"
        onRowClick={openEdit}
        initialColumnVisibility={{}}
        toolbar={
          <>
            <NativeSelect size="sm" wrapperClassName="w-52" aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {(data?.roles ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect size="sm" wrapperClassName="w-36" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </NativeSelect>
          </>
        }
        rowMenu={(u) => (
          <>
            <DropdownMenuItem onSelect={() => openEdit(u)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem danger={u.active} disabled={u.id === me && u.active} onSelect={() => setToggle(u)}>
              {u.active ? <UserX /> : <UserCheck />}
              {u.active ? (u.id === me ? "Deactivate (not yourself)" : "Deactivate") : "Reactivate"}
            </DropdownMenuItem>
          </>
        )}
      />

      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editing} />
      <ConfirmDialog
        open={toggle !== null}
        onOpenChange={(o) => !o && setToggle(null)}
        title={toggle?.active ? `Deactivate ${toggle?.name}?` : `Reactivate ${toggle?.name}?`}
        description={
          toggle?.active
            ? "They will no longer be able to sign in or act. Their history stays in the audit log. At least one System Administrator must always remain active."
            : "They will be able to sign in again with their roles and overrides."
        }
        confirmLabel={toggle?.active ? "Deactivate" : "Reactivate"}
        tone={toggle?.active ? "danger" : "primary"}
        loading={isPending}
        onConfirm={async () => {
          if (toggle) await run({ id: toggle.id, active: !toggle.active });
          setToggle(null);
        }}
      />
    </RequirePermission>
  );
}

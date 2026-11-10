"use client";

import { Fragment } from "react";
import { Lock } from "lucide-react";
import { Badge, Checkbox, Tooltip, cn } from "@tobacco/ui";
import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission, type RoleDef } from "@tobacco/shared";
import { useAction } from "@/mock/hooks";
import { isCustomRole, saveRole } from "@/mock/domain/admin";
import { useGuard } from "@/lib/permissions";

/** Roles × permissions grid. Custom roles are checkable inline (audited); system roles are read-only here. */
export function PermissionMatrix({ roles }: { roles: RoleDef[] }) {
  const { allowed } = useGuard("admin.roles");
  const { run } = useAction(saveRole, { latency: 0, success: (r) => `${r.name} updated` });

  const toggle = (role: RoleDef, p: Permission, on: boolean) => {
    const next = on ? [...role.permissions, p] : role.permissions.filter((x) => x !== p);
    void run({ id: role.id, name: role.name, description: role.description, permissions: next });
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card" data-testid="permission-matrix">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-secondary">
            <th className="sticky left-0 z-10 min-w-64 bg-surface-secondary px-4 py-3 text-left text-xs font-medium text-muted-foreground">Permission</th>
            {roles.map((r) => (
              <th key={r.id} className="w-24 min-w-24 px-2 py-3 align-bottom text-center text-[11px] font-medium leading-tight" scope="col">
                <span className="block">{r.name}</span>
                <span className="mt-1 flex justify-center">
                  {r.isSystem ? (
                    <Badge tone="outline" className="px-1.5 py-0 text-[10px]">system</Badge>
                  ) : r.isDemoOnly ? (
                    <Badge tone="warning" className="px-1.5 py-0 text-[10px]">demo</Badge>
                  ) : (
                    <Badge tone="primary" className="px-1.5 py-0 text-[10px]">custom</Badge>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map((g) => (
            <Fragment key={g.group}>
              <tr className="border-b border-border bg-surface-tertiary/60">
                <th colSpan={roles.length + 1} scope="colgroup" className="sticky left-0 px-4 py-1.5 text-left text-xs font-semibold">
                  {g.group}
                </th>
              </tr>
              {g.permissions.map((perm) => {
                const p = perm[0] as Permission;
                return (
                  <tr key={p} className="border-b border-border last:border-0 hover:bg-surface-secondary/60">
                    <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal">
                      <span className="block font-mono text-[12px]">{p}</span>
                      <span className="block text-xs text-muted-foreground">{PERMISSION_LABELS[p]}</span>
                    </th>
                    {roles.map((r) => {
                      const has = r.permissions.includes(p);
                      const editable = allowed && isCustomRole(r);
                      return (
                        <td key={r.id} className={cn("px-2 py-2 text-center", has && !editable && "bg-primary-soft/40")} data-role={r.id} data-permission={p}>
                          {editable ? (
                            <Checkbox checked={has} aria-label={`${r.name}: ${p}`} onCheckedChange={(v) => toggle(r, p, v === true)} />
                          ) : (
                            <Tooltip content={r.isSystem ? "System role — change it from the role editor (asks for confirmation)" : r.isDemoOnly ? "Demo-only role" : "No permission to edit roles"}>
                              <span className="inline-flex items-center justify-center" aria-label={`${r.name}: ${p}: ${has ? "granted" : "not granted"}`}>
                                {has ? <span className="size-2.5 rounded-full bg-primary" aria-hidden /> : <span className="size-1.5 rounded-full bg-border-strong" aria-hidden />}
                              </span>
                            </Tooltip>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <Lock className="size-3" aria-hidden /> System and demo roles are read-only in the matrix. Custom roles save instantly and are audited.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Callout,
  CheckField,
  Checkbox,
  DemoBadge,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Switch,
} from "@tobacco/ui";
import type { AppUser, Permission } from "@tobacco/shared";
import { useAction, useDb } from "@/mock/hooks";
import { saveUser } from "@/mock/domain/admin";
import { EffectivePermissions, PermissionChips } from "./permission-picker";
import { userFormSchema, type UserForm } from "./schemas";

/** Create / edit a user: roles, selling-point restriction, permission overrides, active flag + live effective-permissions preview. */
export function UserDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user?: AppUser }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" data-testid="user-dialog">
        {/* Mounted only while open, so the form state starts fresh from `user` each time. */}
        {open ? <UserDialogBody key={user?.id ?? "new"} user={user} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function UserDialogBody({ user, onClose }: { user?: AppUser; onClose: () => void }) {
  const roles = useDb((db) => db.roles);
  const sellingPoints = useDb((db) => db.sellingPoints);
  const [roleIds, setRoleIds] = useState<string[]>(user?.roleIds ?? []);
  const [spIds, setSpIds] = useState<string[]>(user?.sellingPointIds ?? []);
  const [grant, setGrant] = useState<Permission[]>(user?.permissionOverrides.grant ?? []);
  const [deny, setDeny] = useState<Permission[]>(user?.permissionOverrides.deny ?? []);
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const { run, isPending } = useAction(saveUser, { silent: true, success: (u) => `User ${u.name} saved` });

  const form = useForm<UserForm>({ resolver: zodResolver(userFormSchema), defaultValues: { name: user?.name ?? "", email: user?.email ?? "" } });
  const { errors } = form.formState;

  const rolePerms = new Set<Permission>(roleIds.flatMap((id) => roles.find((r) => r.id === id)?.permissions ?? []));
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    const res = await run({ id: user?.id, name: values.name, email: values.email, roleIds, sellingPointIds: spIds, grant, deny, active });
    if (res.ok) onClose();
    else setError(res.error.message);
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{user ? `Edit user — ${user.name}` : "New user"}</DialogTitle>
        <DialogDescription>Roles define what a user can do; overrides add or remove single permissions for this person. Every change is audited.</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          {error ? <Callout tone="danger">{error}</Callout> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="u-name" required error={errors.name?.message}>
              <Input id="u-name" aria-invalid={!!errors.name} {...form.register("name")} />
            </Field>
            <Field label="Email" htmlFor="u-email" required error={errors.email?.message}>
              <Input id="u-email" type="email" aria-invalid={!!errors.email} {...form.register("email")} />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">
              Roles <span className="text-danger-text">*</span> <span className="sr-only">(required)</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((r) => (
                <CheckField
                  key={r.id}
                  id={`u-role-${r.id}`}
                  label={
                    <span className="flex items-center gap-1.5">
                      {r.name}
                      {r.isDemoOnly ? <DemoBadge>DEMO ONLY</DemoBadge> : null}
                    </span>
                  }
                  hint={`${r.permissions.length} permissions`}
                >
                  <Checkbox id={`u-role-${r.id}`} checked={roleIds.includes(r.id)} onCheckedChange={(v) => setRoleIds((l) => toggle(l, r.id, v === true))} />
                </CheckField>
              ))}
            </div>
            {roleIds.length === 0 ? <p className="text-xs text-muted-foreground">Assign at least one role.</p> : null}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Selling-point restriction</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {sellingPoints.map((s) => (
                <CheckField key={s.id} id={`u-sp-${s.id}`} label={`${s.code} · ${s.name}`}>
                  <Checkbox id={`u-sp-${s.id}`} checked={spIds.includes(s.id)} onCheckedChange={(v) => setSpIds((l) => toggle(l, s.id, v === true))} />
                </CheckField>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{spIds.length === 0 ? "No selection = access to all selling points." : `Limited to ${spIds.length} selling point(s).`}</p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <PermissionChips label="Extra permissions (grant)" tone="success" value={grant} onChange={setGrant} exclude={deny} testId="grant-chips" />
            <PermissionChips label="Removed permissions (deny)" tone="danger" value={deny} onChange={setDeny} exclude={grant} testId="deny-chips" />
          </div>

          <CheckField id="u-active" label="Active" hint="Inactive users cannot sign in or act; their history is kept.">
            <Switch id="u-active" checked={active} onCheckedChange={setActive} />
          </CheckField>
        </div>
        <div className="rounded-2xl border border-border bg-surface-secondary p-4 lg:col-span-2">
          <EffectivePermissions role={rolePerms} granted={grant} denied={deny} />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} data-testid="save-user">
          {user ? "Save changes" : "Create user"}
        </Button>
      </DialogFooter>
    </form>
  );
}

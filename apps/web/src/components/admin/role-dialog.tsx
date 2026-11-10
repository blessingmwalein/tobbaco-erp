"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Callout,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
} from "@tobacco/ui";
import type { Permission, RoleDef } from "@tobacco/shared";
import { useAction } from "@/mock/hooks";
import { saveRole } from "@/mock/domain/admin";
import { PermissionPicker } from "./permission-picker";
import { roleFormSchema, type RoleForm } from "./schemas";

/**
 * Create / edit / clone a role.
 * DESIGN CHOICE: system roles (the 12 documented roles) are editable — administrators must be able to adapt access without
 * code changes — but only after an explicit confirmation, and the change is audited with that reason.
 */
export function RoleDialog({
  open,
  onOpenChange,
  role,
  cloneFrom,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  role?: RoleDef;
  cloneFrom?: RoleDef;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" data-testid="role-dialog">
        {/* Mounted only while open, so the form starts fresh from `role` / `cloneFrom` each time. */}
        {open ? <RoleDialogBody key={`${role?.id ?? "new"}:${cloneFrom?.id ?? ""}`} role={role} cloneFrom={cloneFrom} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RoleDialogBody({ role, cloneFrom, onClose }: { role?: RoleDef; cloneFrom?: RoleDef; onClose: () => void }) {
  const src = role ?? cloneFrom;
  const [perms, setPerms] = useState<Permission[]>(src ? [...src.permissions] : []);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<RoleForm | null>(null);
  const { run, isPending } = useAction(saveRole, { silent: true, success: (r) => `Role “${r.name}” saved` });
  const form = useForm<RoleForm>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: cloneFrom && !role ? `${cloneFrom.name} (copy)` : (role?.name ?? ""), description: src?.description ?? "" },
  });
  const { errors } = form.formState;

  const persist = async (values: RoleForm, confirmSystemEdit: boolean) => {
    setError(null);
    const res = await run({ id: role?.id, name: values.name, description: values.description, permissions: perms, confirmSystemEdit });
    setConfirm(null);
    if (res.ok) onClose();
    else setError(res.error.message);
  };

  const submit = form.handleSubmit(async (values) => {
    if (role?.isSystem) setConfirm(values);
    else await persist(values, false);
  });

  return (
    <>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <DialogHeader>
          <DialogTitle>{role ? `Edit role — ${role.name}` : cloneFrom ? `Clone role — ${cloneFrom.name}` : "New custom role"}</DialogTitle>
          <DialogDescription>Choose exactly which actions this role may perform. Changes apply to every user holding the role.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {role?.isSystem ? (
            <Callout tone="warning" title="This is a system role">
              It is one of the documented e-Port roles. You can change it, but you will be asked to confirm and the change is audited.
            </Callout>
          ) : null}
          {error ? <Callout tone="danger">{error}</Callout> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role name" htmlFor="r-name" required error={errors.name?.message}>
              <Input id="r-name" aria-invalid={!!errors.name} {...form.register("name")} />
            </Field>
            <Field label="Description" htmlFor="r-desc" error={errors.description?.message}>
              <Textarea id="r-desc" rows={2} {...form.register("description")} />
            </Field>
          </div>
          <PermissionPicker value={perms} onChange={setPerms} idPrefix="role" />
        </DialogBody>
        <DialogFooter>
          <p className="mr-auto self-center text-xs text-muted-foreground" data-testid="role-perm-count">
            {perms.length} permission{perms.length === 1 ? "" : "s"} selected
          </p>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending} data-testid="save-role">
            {role ? "Save role" : "Create role"}
          </Button>
        </DialogFooter>
      </form>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Change a system role?"
        description={`“${role?.name}” is a documented system role. Changing it affects every user who holds it. This will be recorded in the audit log.`}
        confirmLabel="Change system role"
        tone="danger"
        loading={isPending}
        onConfirm={() => (confirm ? persist(confirm, true) : undefined)}
      />
    </>
  );
}

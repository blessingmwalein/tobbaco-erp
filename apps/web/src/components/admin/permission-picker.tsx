"use client";

import { X } from "lucide-react";
import { Badge, Button, Checkbox, NativeSelect, cn } from "@tobacco/ui";
import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from "@tobacco/shared";

/** Grouped permission checklist (role editor). */
export function PermissionPicker({
  value,
  onChange,
  disabled,
  idPrefix = "perm",
}: {
  value: Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const set = new Set(value);
  const toggle = (p: Permission, on: boolean) => onChange(on ? [...new Set([...value, p])] : value.filter((x) => x !== p));
  return (
    <div className="flex flex-col gap-4" data-testid="permission-picker">
      {PERMISSION_GROUPS.map((g) => {
        const perms = g.permissions.map((p) => p[0] as Permission);
        const all = perms.every((p) => set.has(p));
        const some = perms.some((p) => set.has(p));
        return (
          <fieldset key={g.group} className="rounded-xl border border-border p-3">
            <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
              <Checkbox
                id={`${idPrefix}-group-${g.group}`}
                checked={all ? true : some ? "indeterminate" : false}
                disabled={disabled}
                aria-label={`All ${g.group} permissions`}
                onCheckedChange={(v) => onChange(v === true ? [...new Set([...value, ...perms])] : value.filter((x) => !perms.includes(x)))}
              />
              <label htmlFor={`${idPrefix}-group-${g.group}`}>{g.group}</label>
              <span className="text-xs font-normal text-muted-foreground">
                {perms.filter((p) => set.has(p)).length}/{perms.length}
              </span>
            </legend>
            <ul className="mt-1 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {perms.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Checkbox id={`${idPrefix}-${p}`} checked={set.has(p)} disabled={disabled} onCheckedChange={(v) => toggle(p, v === true)} className="mt-0.5" />
                  <label htmlFor={`${idPrefix}-${p}`} className="text-sm leading-5">
                    <span className="block font-mono text-[12px]">{p}</span>
                    <span className="block text-xs text-muted-foreground">{PERMISSION_LABELS[p]}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}

/** Chips + "add" select for per-user overrides (grant / deny). */
export function PermissionChips({
  label,
  tone,
  value,
  onChange,
  exclude,
  testId,
}: {
  label: string;
  tone: "success" | "danger";
  value: Permission[];
  onChange: (next: Permission[]) => void;
  /** Permissions already used by the other list. */
  exclude: Permission[];
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 ? <span className="text-xs text-muted-foreground">None</span> : null}
        {value.map((p) => (
          <Badge key={p} tone={tone} className="gap-1 pr-1 font-mono text-[11px]">
            {p}
            <button type="button" aria-label={`Remove ${p}`} className="rounded-full p-0.5 hover:bg-black/10" onClick={() => onChange(value.filter((x) => x !== p))}>
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <NativeSelect
        size="sm"
        value=""
        aria-label={`Add to: ${label}`}
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value as Permission]);
        }}
      >
        <option value="">Add permission…</option>
        {PERMISSION_GROUPS.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.permissions
              .map((p) => p[0] as Permission)
              .filter((p) => !value.includes(p) && !exclude.includes(p))
              .map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
          </optgroup>
        ))}
      </NativeSelect>
    </div>
  );
}

/** Read-only effective-permissions preview, grouped. `source` explains where each permission comes from. */
export function EffectivePermissions({
  role,
  granted,
  denied,
  className,
}: {
  role: Set<Permission>;
  granted: Permission[];
  denied: Permission[];
  className?: string;
}) {
  const eff = new Set<Permission>([...role, ...granted]);
  for (const d of denied) eff.delete(d);
  return (
    <div className={cn("flex flex-col gap-3", className)} data-testid="effective-permissions">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Effective permissions</p>
        <p className="text-xs text-muted-foreground" data-testid="effective-count">
          {eff.size} of {PERMISSION_GROUPS.reduce((a, g) => a + g.permissions.length, 0)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Role permissions + granted − denied. Denied always wins.</p>
      <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
        {PERMISSION_GROUPS.map((g) => {
          const rows = g.permissions.map((p) => p[0] as Permission);
          const visible = rows.filter((p) => eff.has(p) || denied.includes(p));
          if (visible.length === 0) return null;
          return (
            <div key={g.group}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{g.group}</p>
              <ul className="flex flex-col gap-0.5">
                {visible.map((p) => {
                  const isDenied = denied.includes(p);
                  const isGranted = granted.includes(p) && !isDenied;
                  return (
                    <li key={p} className="flex items-center gap-2 text-xs">
                      <span className={cn("size-1.5 rounded-full", isDenied ? "bg-danger" : isGranted ? "bg-success ring-1 ring-success-text/40" : "bg-muted-foreground/50")} aria-hidden />
                      <span className={cn("font-mono", isDenied && "text-danger-text line-through")}>{p}</span>
                      {isGranted ? <span className="text-success-text">granted</span> : null}
                      {isDenied ? <span className="text-danger-text">denied</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {eff.size === 0 ? <p className="text-sm text-muted-foreground">No permissions. The user can sign in but sees nothing.</p> : null}
      </div>
    </div>
  );
}

export function ClearButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

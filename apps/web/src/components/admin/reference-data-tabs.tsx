"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, MapPin, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { z } from "zod";
import {
  Badge,
  Callout,
  ConfirmDialog,
  DataTable,
  DemoBadge,
  DropdownMenuItem,
  UnverifiedBadge,
  type ColumnDef,
} from "@tobacco/ui";
import type { BaleLocation, Season, SellingPoint, TimbGrade, Warehouse } from "@tobacco/shared";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import {
  activateSeason,
  deleteBaleLocation,
  deleteTimbGrade,
  saveBaleLocation,
  saveSeason,
  saveSellingPoint,
  saveTimbGrade,
  saveWarehouse,
  setWarehouseActive,
} from "@/mock/domain/admin";
import { RefFormDialog } from "./ref-form-dialog";

const PERM = "admin.reference-data" as const;
const ActiveBadge = ({ active }: { active: boolean }) => (
  <Badge tone={active ? "success" : "outline"} dot>
    {active ? "Active" : "Inactive"}
  </Badge>
);
const splitList = (v: unknown) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Shared "result → dialog error message" bridge. */
async function toMessage<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: Error }>): Promise<string | null> {
  const r = await p;
  return r.ok ? null : r.error.message;
}

// ── Seasons ─────────────────────────────────────────────────────
export function SeasonsTab() {
  const { data, isLoading } = useDbQuery(["admin", "ref", "seasons"], (db) => ({ seasons: db.seasons, current: db.settings.seasonYear }));
  const [open, setOpen] = useState(false);
  const [activate, setActivate] = useState<Season | null>(null);
  const create = useAction(saveSeason, { silent: true, success: "Season added" });
  const act = useAction(activateSeason, { success: (s) => `Season ${s.year} is now the active season` });

  const columns: ColumnDef<Season, unknown>[] = [
    { accessorKey: "year", header: "Season", cell: ({ getValue }) => <span className="font-medium tabular">{getValue<number>()}</span> },
    { id: "active", header: "Status", accessorFn: (s) => (s.active ? "Active" : "Inactive"), cell: ({ row }) => <ActiveBadge active={row.original.active} /> },
  ];
  return (
    <>
      <DataTable
        data-testid="seasons-table"
        aria-label="Seasons"
        columns={columns}
        data={data?.seasons ?? []}
        loading={isLoading}
        enableColumnVisibility={false}
        hidePagerWhenSinglePage
        emptyTitle="No seasons"
        toolbarActions={
          <PermissionButton permission={PERM} size="sm" onClick={() => setOpen(true)} data-testid="add-season">
            <Plus /> Add season
          </PermissionButton>
        }
        rowMenu={(s) => (
          <DropdownMenuItem disabled={s.active} onSelect={() => setActivate(s)}>
            <Check /> {s.active ? "Current season" : "Make active season"}
          </DropdownMenuItem>
        )}
      />
      <RefFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Add season"
        description="One season is active at a time; add the next one in advance and activate it when the season starts."
        fields={[{ name: "year", label: "Season (year)", type: "number", required: true, placeholder: "2027" }]}
        initial={{ year: (data?.current ?? 2026) + 1 }}
        schema={z.object({ year: z.number({ error: "Enter a year" }).int().min(2000, "2000 or later").max(2100, "2100 or earlier") })}
        submitLabel="Add season"
        onSubmit={(v) => toMessage(create.run({ year: Number(v.year) }))}
      />
      <ConfirmDialog
        open={activate !== null}
        onOpenChange={(o) => !o && setActivate(null)}
        title={`Make ${activate?.year} the active season?`}
        description="Dashboards and new records will use this season. The previous season stays in the system."
        confirmLabel="Make active"
        loading={act.isPending}
        onConfirm={async () => {
          if (activate) await act.run({ id: activate.id });
          setActivate(null);
        }}
      />
    </>
  );
}

// ── Selling points ──────────────────────────────────────────────
export function SellingPointsTab() {
  const { data, isLoading } = useDbQuery(["admin", "ref", "selling-points"], (db) => ({ list: db.sellingPoints, current: db.settings.sellingPointId }));
  const [dialog, setDialog] = useState<{ sp?: SellingPoint } | null>(null);
  const save = useAction(saveSellingPoint, { silent: true, success: "Selling point saved" });
  const toggle = useAction(saveSellingPoint, { success: "Selling point updated" });

  const columns: ColumnDef<SellingPoint, unknown>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span> },
    { accessorKey: "name", header: "Name" },
    { id: "rooms", header: "Sale rooms", accessorFn: (s) => s.saleRooms.join(", ") },
    { accessorKey: "floorRows", header: "Floor rows", cell: ({ row }) => <span className="tabular">{row.original.floorRows}</span> },
    { id: "active", header: "Status", accessorFn: (s) => (s.active ? "Active" : "Inactive"), cell: ({ row }) => <ActiveBadge active={row.original.active} /> },
  ];

  return (
    <>
      <Callout tone="info" className="mb-4">
        Floor rows per room are a <DemoBadge>DEMO</DemoBadge> value; the manuals show rows only as numbers typed at floor summary (UQ-10).
      </Callout>
      <DataTable
        data-testid="selling-points-table"
        aria-label="Selling points"
        columns={columns}
        data={data?.list ?? []}
        loading={isLoading}
        enableColumnVisibility={false}
        hidePagerWhenSinglePage
        emptyTitle="No selling points"
        onRowClick={(sp) => setDialog({ sp })}
        toolbarActions={
          <PermissionButton permission={PERM} size="sm" onClick={() => setDialog({})} data-testid="add-selling-point">
            <Plus /> Add selling point
          </PermissionButton>
        }
        rowMenu={(sp) => (
          <>
            <DropdownMenuItem onSelect={() => setDialog({ sp })}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={sp.active && sp.id === data?.current}
              onSelect={() => toggle.run({ id: sp.id, code: sp.code, name: sp.name, saleRooms: sp.saleRooms, floorRows: sp.floorRows, active: !sp.active })}
            >
              <Power /> {sp.active ? (sp.id === data?.current ? "Deactivate (current)" : "Deactivate") : "Activate"}
            </DropdownMenuItem>
          </>
        )}
      />
      <RefFormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.sp ? `Edit selling point — ${dialog.sp.code}` : "Add selling point"}
        fields={[
          { name: "code", label: "Code", type: "text", required: true, placeholder: "EL", disabled: Boolean(dialog?.sp), uppercase: true, hint: "2–4 letters or digits; cannot change later" },
          { name: "name", label: "Name", type: "text", required: true, placeholder: "Ethical Sales Floor" },
          { name: "saleRooms", label: "Sale rooms", type: "text", required: true, placeholder: "A, B", hint: "Comma-separated" },
          { name: "floorRows", label: "Floor rows per room", type: "number", required: true },
          { name: "active", label: "Active", type: "switch" },
        ]}
        initial={{
          code: dialog?.sp?.code ?? "",
          name: dialog?.sp?.name ?? "",
          saleRooms: dialog?.sp?.saleRooms.join(", ") ?? "A",
          floorRows: dialog?.sp?.floorRows ?? 12,
          active: dialog?.sp?.active ?? true,
        }}
        schema={z.object({
          code: z.string().trim().min(2, "Code is 2–4 characters").max(4, "Code is 2–4 characters"),
          name: z.string().trim().min(1, "Name is required"),
          saleRooms: z.string().trim().min(1, "Add at least one sale room"),
          floorRows: z.number({ error: "Enter a number" }).int().min(1, "At least 1").max(200, "At most 200"),
          active: z.boolean(),
        })}
        onSubmit={(v) =>
          toMessage(save.run({ id: dialog?.sp?.id, code: String(v.code), name: String(v.name), saleRooms: splitList(v.saleRooms), floorRows: Number(v.floorRows), active: Boolean(v.active) }))
        }
      />
    </>
  );
}

// ── Bale locations ──────────────────────────────────────────────
export function BaleLocationsTab() {
  const { data, isLoading } = useDbQuery(["admin", "ref", "locations"], (db) =>
    db.baleLocations.map((l) => ({ ...l, uses: db.deliveryNotes.filter((d) => d.location === l.code).length })),
  );
  type Row = BaleLocation & { uses: number };
  const [dialog, setDialog] = useState<{ loc?: Row } | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const save = useAction(saveBaleLocation, { silent: true, success: "Bale location saved" });
  const remove = useAction(deleteBaleLocation, { success: "Bale location deleted" });

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span> },
    { accessorKey: "description", header: "Description" },
    { accessorKey: "uses", header: "Delivery notes", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
  ];
  return (
    <>
      <Callout tone="info" className="mb-4">
        The receiving “Location” (e.g. A) is distinct from the sale room and the numbered floor row used at floor summary — how they relate is not documented (UQ-10).
        Locations in use cannot be deleted.
      </Callout>
      <DataTable
        data-testid="locations-table"
        aria-label="Bale locations"
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        enableColumnVisibility={false}
        hidePagerWhenSinglePage
        emptyIcon={MapPin}
        emptyTitle="No bale locations"
        onRowClick={(loc) => setDialog({ loc })}
        toolbarActions={
          <PermissionButton permission={PERM} size="sm" onClick={() => setDialog({})} data-testid="add-location">
            <Plus /> Add location
          </PermissionButton>
        }
        rowMenu={(loc) => (
          <>
            <DropdownMenuItem onSelect={() => setDialog({ loc })}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem danger disabled={loc.uses > 0} onSelect={() => setDel(loc)}>
              <Trash2 /> {loc.uses > 0 ? "Delete (in use)" : "Delete"}
            </DropdownMenuItem>
          </>
        )}
      />
      <RefFormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.loc ? `Edit location — ${dialog.loc.code}` : "Add bale location"}
        fields={[
          { name: "code", label: "Code", type: "text", required: true, placeholder: "A", disabled: Boolean(dialog?.loc), uppercase: true, hint: "1–3 letters or digits; cannot change later" },
          { name: "description", label: "Description", type: "text", required: true, placeholder: "Receiving row A" },
        ]}
        initial={{ code: dialog?.loc?.code ?? "", description: dialog?.loc?.description ?? "" }}
        schema={z.object({
          code: z.string().trim().min(1, "Code is required").max(3, "Code is 1–3 characters"),
          description: z.string().trim().min(1, "Description is required"),
        })}
        onSubmit={(v) => toMessage(save.run({ originalCode: dialog?.loc?.code, code: String(v.code), description: String(v.description) }))}
      />
      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete location ${del?.code}?`}
        description="This cannot be undone (the deletion is audited)."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={async () => {
          if (del) await remove.run({ code: del.code });
          setDel(null);
        }}
      />
    </>
  );
}

// ── Warehouses ──────────────────────────────────────────────────
export function WarehousesTab() {
  const { data, isLoading } = useDbQuery(["admin", "ref", "warehouses"], (db) => ({
    warehouses: db.warehouses,
    buyers: db.buyers.map((b) => ({ value: b.code, label: `${b.code} · ${b.name}` })),
  }));
  const [dialog, setDialog] = useState<{ wh?: Warehouse } | null>(null);
  const save = useAction(saveWarehouse, { silent: true, success: "Warehouse saved" });
  const toggle = useAction(setWarehouseActive, { success: (w) => `${w.code} ${w.active ? "activated" : "deactivated"}` });

  const columns: ColumnDef<Warehouse, unknown>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span> },
    { accessorKey: "name", header: "Name" },
    { id: "buyers", header: "Buyers packing here", accessorFn: (w) => w.buyerCodes.join(", ") },
    { id: "active", header: "Status", accessorFn: (w) => (w.active ? "Active" : "Inactive"), cell: ({ row }) => <ActiveBadge active={row.original.active} /> },
  ];
  return (
    <>
      <Callout tone="info" className="mb-4">
        Dispatch only accepts bales whose buyer packs at the selected destination (Manual 09). Buyers and their grades are managed on{" "}
        <Link href="/buyers" className="font-medium text-primary underline-offset-2 hover:underline">
          Buyers
        </Link>
        . Manual 09 notes buyer JM packs at CURVERID; the destination list was empty on the sandbox.
      </Callout>
      <DataTable
        data-testid="warehouses-table"
        aria-label="Warehouses"
        columns={columns}
        data={data?.warehouses ?? []}
        loading={isLoading}
        enableColumnVisibility={false}
        hidePagerWhenSinglePage
        emptyTitle="No warehouses"
        onRowClick={(wh) => setDialog({ wh })}
        toolbarActions={
          <PermissionButton permission={PERM} size="sm" onClick={() => setDialog({})} data-testid="add-warehouse">
            <Plus /> Add warehouse
          </PermissionButton>
        }
        rowMenu={(wh) => (
          <>
            <DropdownMenuItem onSelect={() => setDialog({ wh })}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggle.run({ code: wh.code, active: !wh.active })}>
              <Power /> {wh.active ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </>
        )}
      />
      <RefFormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.wh ? `Edit warehouse — ${dialog.wh.code}` : "Add destination warehouse"}
        fields={[
          { name: "code", label: "Code", type: "text", required: true, placeholder: "CURVERID", disabled: Boolean(dialog?.wh), uppercase: true, hint: "3–12 letters or digits; cannot change later" },
          { name: "name", label: "Name", type: "text", required: true },
          { name: "buyerCodes", label: "Buyers that pack here", type: "multicheck", options: data?.buyers ?? [] },
          { name: "active", label: "Active", type: "switch" },
        ]}
        initial={{ code: dialog?.wh?.code ?? "", name: dialog?.wh?.name ?? "", buyerCodes: dialog?.wh?.buyerCodes ?? [], active: dialog?.wh?.active ?? true }}
        schema={z.object({
          code: z.string().trim().min(3, "Code is 3–12 characters").max(12, "Code is 3–12 characters"),
          name: z.string().trim().min(1, "Name is required"),
          buyerCodes: z.array(z.string()),
          active: z.boolean(),
        })}
        onSubmit={(v) =>
          toMessage(save.run({ originalCode: dialog?.wh?.code, code: String(v.code), name: String(v.name), buyerCodes: (v.buyerCodes as string[]) ?? [], active: Boolean(v.active) }))
        }
      />
    </>
  );
}

// ── TIMB grades / reasons ───────────────────────────────────────
export function TimbGradesTab() {
  const { data, isLoading } = useDbQuery(["admin", "ref", "grades"], (db) =>
    db.timbGrades.map((g) => ({ ...g, uses: db.bales.filter((b) => b.timbGrade === g.code).length })),
  );
  type Row = TimbGrade & { uses: number };
  const [dialog, setDialog] = useState<{ grade?: Row } | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const save = useAction(saveTimbGrade, { silent: true, success: "Grade saved" });
  const remove = useAction(deleteTimbGrade, { success: "Grade deleted" });

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono">{row.original.code}</span>
          {row.original.isDemo ? <DemoBadge /> : null}
        </span>
      ),
    },
    { id: "type", header: "Type", accessorFn: (g) => (g.isReason ? "Reason" : "Grade"), cell: ({ row }) => <Badge tone={row.original.isReason ? "warning" : "neutral"}>{row.original.isReason ? "Reason (rejected bale)" : "Grade"}</Badge> },
    { accessorKey: "description", header: "Description", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>() ?? "—"}</span> },
    { accessorKey: "uses", header: "Bales", cell: ({ getValue }) => <span className="tabular">{getValue<number>()}</span> },
  ];
  return (
    <>
      <Callout tone="warning" className="mb-4" title="Only a few grades are documented">
        The manuals show grades A10, A1E and A1L and say a rejected bale needs a Sale Code plus a TIMB reason, but they do not list all valid grades or reasons{" "}
        <UnverifiedBadge uq="UQ-08" />. Add the real TIMB list here; grades in use cannot be deleted.
      </Callout>
      <DataTable
        data-testid="grades-table"
        aria-label="TIMB grades and reasons"
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        searchPlaceholder="Search grades…"
        enableColumnVisibility={false}
        hidePagerWhenSinglePage
        emptyTitle="No grades"
        onRowClick={(grade) => setDialog({ grade })}
        toolbarActions={
          <PermissionButton permission={PERM} size="sm" onClick={() => setDialog({})} data-testid="add-grade">
            <Plus /> Add grade / reason
          </PermissionButton>
        }
        rowMenu={(g) => (
          <>
            <DropdownMenuItem onSelect={() => setDialog({ grade: g })}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem danger disabled={g.uses > 0} onSelect={() => setDel(g)}>
              <Trash2 /> {g.uses > 0 ? "Delete (in use)" : "Delete"}
            </DropdownMenuItem>
          </>
        )}
      />
      <RefFormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.grade ? `Edit grade — ${dialog.grade.code}` : "Add TIMB grade / reason"}
        fields={[
          { name: "code", label: "Code", type: "text", required: true, placeholder: "A10", disabled: Boolean(dialog?.grade), uppercase: true, hint: "2–6 letters or digits; cannot change later" },
          { name: "description", label: "Description", type: "text" },
          { name: "isReason", label: "Reason code (for rejected bales)", type: "switch", hint: "Reasons are entered together with a sale code (RO, RH, CO)." },
        ]}
        initial={{ code: dialog?.grade?.code ?? "", description: dialog?.grade?.description ?? "", isReason: dialog?.grade?.isReason ?? false }}
        schema={z.object({
          code: z.string().trim().min(2, "Code is 2–6 characters").max(6, "Code is 2–6 characters"),
          description: z.string().trim().optional(),
          isReason: z.boolean(),
        })}
        onSubmit={(v) => toMessage(save.run({ originalCode: dialog?.grade?.code, code: String(v.code), description: String(v.description ?? ""), isReason: Boolean(v.isReason) }))}
      />
      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete grade ${del?.code}?`}
        description="This cannot be undone (the deletion is audited)."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={async () => {
          if (del) await remove.run({ code: del.code });
          setDel(null);
        }}
      />
    </>
  );
}

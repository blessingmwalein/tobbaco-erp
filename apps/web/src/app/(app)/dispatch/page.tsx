"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, PackageCheck, Plus, Send, Trash2, Truck, Warehouse as WarehouseIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  DateInput,
  DemoBadge,
  DropdownMenuItem,
  NativeSelect,
  PageHeader,
  StatCard,
  UnverifiedBadge,
  type ColumnDef,
} from "@tobacco/ui";
import { formatDate, formatDateTime } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { Gate } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import { deleteDispatch, selectDispatchHub, selectDispatchRows, type DispatchRow } from "@/mock/domain/dispatch";

export default function DispatchNotesPage() {
  const router = useRouter();
  const { data, isLoading } = useDbQuery(["dispatch", "list"], (db) => ({ rows: selectDispatchRows(db), hub: selectDispatchHub(db), warehouses: db.warehouses }));
  const del = useAction(deleteDispatch, { latency: 0 }); // always refuses with the documented message
  const [state, setState] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r) =>
          (!state || r.note.state === state) &&
          (!warehouse || r.note.warehouseCode === warehouse) &&
          (!from || r.note.createdAt.slice(0, 10) >= from) &&
          (!to || r.note.createdAt.slice(0, 10) <= to),
      ),
    [data, state, warehouse, from, to],
  );

  const columns: ColumnDef<DispatchRow, unknown>[] = [
    { id: "ref", header: "Reference", accessorFn: (r) => r.note.ref, cell: ({ row }) => <span className="font-mono text-[13px] font-medium">{row.original.note.ref}</span> },
    { id: "destination", header: "Destination", accessorFn: (r) => `${r.note.warehouseCode} ${r.warehouseName}`, cell: ({ row }) => row.original.note.warehouseCode },
    { id: "truck", header: "Truck Reg No.", accessorFn: (r) => r.note.truckReg ?? "", cell: ({ row }) => row.original.note.truckReg ?? <span className="text-muted-foreground">—</span> },
    { id: "driverId", header: "Driver National ID", accessorFn: (r) => r.note.driverNationalId ?? "", cell: ({ row }) => row.original.note.driverNationalId ?? <span className="text-muted-foreground">—</span> },
    { id: "driverCell", header: "Driver Cellphone", accessorFn: (r) => r.note.driverCell ?? "", cell: ({ row }) => row.original.note.driverCell ?? <span className="text-muted-foreground">—</span> },
    { id: "bales", header: "Total Bales", accessorFn: (r) => r.note.totalBales, cell: ({ row }) => <span className="tabular font-medium">{row.original.note.totalBales}</span> },
    { id: "mass", header: "Total Mass", accessorFn: (r) => r.note.totalMass, cell: ({ row }) => <span className="tabular">{row.original.note.totalMass} kg</span> },
    { id: "state", header: "State", accessorFn: (r) => r.note.state, cell: ({ row }) => <StatusBadge kind="dispatch" value={row.original.note.state} /> },
    { id: "created", header: "Created on", accessorFn: (r) => r.note.createdAt, cell: ({ row }) => <span className="tabular text-muted-foreground">{formatDateTime(row.original.note.createdAt)}</span> },
    { id: "dispatchDate", header: "Dispatch Date", accessorFn: (r) => r.note.dispatchDate ?? "", cell: ({ row }) => (row.original.note.dispatchDate ? formatDate(row.original.note.dispatchDate) : <span className="text-muted-foreground">—</span>) },
    { id: "mobileCreated", header: "Mobile Created", accessorFn: (r) => (r.note.mobileCreated ? "Yes" : "No"), cell: ({ row }) => (row.original.note.mobileCreated ? "Yes" : "No") },
    { id: "mobileUser", header: "Mobile User", accessorFn: (r) => r.mobileUser, cell: ({ row }) => <span className="text-muted-foreground">{row.original.mobileUser}</span> },
  ];

  const hub = data?.hub;
  const ready = hub?.overview.reduce((a, o) => a + o.readyBales, 0) ?? 0;
  const dispatchedBales = hub?.overview.reduce((a, o) => a + o.dispatchedBales, 0) ?? 0;

  return (
    <RequirePermission permission="dispatch.view">
      <PageHeader
        title="Dispatch notes"
        description="Sold bales leave the floor on trucks for the buyer's packing warehouse. Dispatch notes are posted, never deleted; drafts can be cancelled with a reason."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/dispatch/shipments">Shipment files</Link>
            </Button>
            <Gate permission="dispatch.create">
              <Button asChild data-testid="initiate-dispatch">
                <Link href="/floor/dispatch">
                  <Plus /> Initiate dispatch
                </Link>
              </Button>
            </Gate>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <section aria-label="Dispatch summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Draft notes" icon={Truck} tone={hub?.drafts.length ? "warning" : "neutral"} value={hub?.drafts.length ?? "—"} hint="still loading" />
          <StatCard label="Posted notes" icon={Send} tone="success" value={(data?.rows ?? []).filter((r) => r.note.state === "POSTED").length} hint="sent to warehouses" />
          <StatCard label="Bales dispatched" icon={PackageCheck} value={dispatchedBales} hint="on posted notes" />
          <StatCard label="Bales ready to dispatch" icon={WarehouseIcon} tone="primary" value={ready} hint={hub?.unreleasedBales ? `${hub.unreleasedBales} more in unreleased sales` : "released, not rejected"} />
        </section>

        <DataTable
          data-testid="dispatch-notes-table"
          aria-label="Dispatch notes"
          columns={columns}
          data={rows}
          loading={isLoading}
          searchPlaceholder="Search reference, truck, driver…"
          emptyIcon={Truck}
          emptyTitle={(data?.rows.length ?? 0) === 0 ? "Create your first Dispatch Note!" : "No dispatch notes match these filters"}
          emptyDescription={
            (data?.rows.length ?? 0) === 0
              ? "Dispatch Notes help you track the movement of bales from source to destination warehouses."
              : "Clear a filter to see more notes."
          }
          emptyAction={
            (data?.rows.length ?? 0) === 0 ? (
              <Gate permission="dispatch.create">
                <Button asChild>
                  <Link href="/floor/dispatch">
                    <Plus /> Initiate dispatch
                  </Link>
                </Button>
              </Gate>
            ) : undefined
          }
          onRowClick={(r) => router.push(`/dispatch/${r.note.id}`)}
          initialColumnVisibility={{ driverId: false, driverCell: false, mobileCreated: false, mobileUser: false }}
          rowMenu={(r) => (
            <>
              <DropdownMenuItem onSelect={() => router.push(`/dispatch/${r.note.id}`)}>
                <ExternalLink /> Open details
              </DropdownMenuItem>
              {r.note.state === "DRAFT" ? (
                <DropdownMenuItem onSelect={() => router.push(`/floor/dispatch/${r.note.id}`)}>
                  <Truck /> Open loading workspace
                </DropdownMenuItem>
              ) : null}
              {/* Documented rule: dispatch notes can't be deleted — attempting it shows the e-Port message. */}
              <DropdownMenuItem danger onSelect={() => void del.run({ dispatchId: r.note.id })} data-testid={`delete-${r.note.id}`}>
                <Trash2 /> Delete…
              </DropdownMenuItem>
            </>
          )}
          toolbar={
            <>
              <NativeSelect size="sm" aria-label="Filter by state" value={state} onChange={(e) => setState(e.target.value)} wrapperClassName="w-36" className="h-9 rounded-xl">
                <option value="">All states</option>
                <option value="DRAFT">Draft</option>
                <option value="POSTED">Posted</option>
                <option value="CANCELLED">Cancelled</option>
              </NativeSelect>
              <NativeSelect size="sm" aria-label="Filter by warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} wrapperClassName="w-44" className="h-9 rounded-xl">
                <option value="">All warehouses</option>
                {(data?.warehouses ?? []).map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.code}
                  </option>
                ))}
              </NativeSelect>
              <DateInput size="sm" aria-label="Created from" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36 rounded-xl" />
              <DateInput size="sm" aria-label="Created to" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36 rounded-xl" />
            </>
          }
          hidePagerWhenSinglePage
        />
        <p className="-mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <UnverifiedBadge uq="UQ-24" /> The “Mobile Created” and “Mobile User” columns (hidden by default — use Columns) come from the e-Port list; the mobile dispatch app is not explained in the manuals.
        </p>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Destination warehouses</CardTitle>
              <CardDescription>Read-only. A bale may only go to its buyer's packing warehouse.</CardDescription>
            </div>
            <UnverifiedBadge uq="UQ-12" />
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="grid gap-3 md:grid-cols-2" data-testid="warehouse-panel">
              {(hub?.overview ?? []).map((o) => (
                <li key={o.warehouse.code} className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {o.warehouse.code} <span className="font-normal text-muted-foreground">{o.warehouse.name !== o.warehouse.code ? o.warehouse.name : ""}</span>
                      {o.warehouse.isDemo ? <DemoBadge /> : null}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      Buyers packing here:
                      {o.buyers.length ? o.buyers.map((b) => <Badge key={b.code} tone="outline">{b.code}</Badge>) : <span>none</span>}
                    </p>
                  </div>
                  <div className="tabular text-right">
                    <p className="text-lg font-semibold leading-none">{o.readyBales}</p>
                    <p className="text-xs text-muted-foreground">ready · {o.dispatchedBales} sent</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Manual 09: the sandbox had no destination warehouses configured (JM's packing warehouse is CURVERID but the list was empty). CURVERID and DEMOWH2 are fixtures here.
            </p>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}

"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { Badge, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, DemoBadge, Field, Input, type ColumnDef } from "@tobacco/ui";
import { formatDateTime, type ScaleReading } from "@tobacco/shared";
import { PermissionButton } from "@/lib/permissions";
import { useAction, useDbQuery } from "@/mock/hooks";
import { simulateScaleReading } from "@/mock/domain/admin";

type Row = ScaleReading & { captured: boolean };

/** SIMULATED scale: weigh events keyed by scale barcode, consumed when a bale is captured at receiving. */
export function ScaleSimulator() {
  const { data, isLoading } = useDbQuery(["admin", "scale"], (db): Row[] =>
    [...db.scaleReadings]
      .sort((a, b) => b.scaleBarcode.localeCompare(a.scaleBarcode))
      .map((r) => ({ ...r, captured: db.bales.some((b) => b.scaleBarcode === r.scaleBarcode && !b.ejected) })),
  );
  const [mass, setMass] = useState("");
  const { run, isPending } = useAction(simulateScaleReading, { success: (r) => `Simulated weigh event ${r.scaleBarcode} — ${r.mass} kg` });

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "scaleBarcode", header: "Scale barcode", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue<string>()}</span> },
    { accessorKey: "mass", header: "Mass", cell: ({ row }) => <span className="tabular">{row.original.mass} kg</span> },
    { accessorKey: "weighedAt", header: "Weighed", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
    { accessorKey: "scaleId", header: "Scale" },
    {
      id: "state",
      header: "State",
      accessorFn: (r) => (r.captured ? "Captured" : "Waiting"),
      cell: ({ row }) =>
        row.original.captured ? (
          <Badge tone="success" dot>
            Captured on a bale
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Waiting for capture
          </Badge>
        ),
    },
    { id: "demo", header: "", enableSorting: false, accessorFn: (r) => (r.isDemo ? "demo" : ""), cell: ({ row }) => (row.original.isDemo ? <DemoBadge /> : null) },
  ];

  return (
    <Card data-testid="scale-simulator">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-4 text-primary" aria-hidden /> Scale simulator
          </CardTitle>
          <CardDescription>Weigh events as the receiving clerk would see them from the scale. No physical scale is connected.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Callout tone="warning" title="Simulated">
          Each event gets the next scale barcode (YYMMDD + 4 digits, as in 2609170001) and a demo mass. Receiving looks the mass up by scale barcode when a bale is
          captured. Real mass will come from the scale adapter in Phase 2.
        </Callout>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Mass (kg, optional)" htmlFor="sim-mass" className="w-40" hint="Blank = demo value">
            <Input id="sim-mass" type="number" min={1} max={400} value={mass} onChange={(e) => setMass(e.target.value)} placeholder="e.g. 104" />
          </Field>
          <PermissionButton permission="admin.settings" loading={isPending} onClick={() => run({ mass: mass ? Number(mass) : undefined })} data-testid="weigh-next">
            Weigh next bale
          </PermissionButton>
        </div>
        <DataTable
          aria-label="Scale weigh events"
          data-testid="scale-table"
          columns={columns}
          data={data ?? []}
          loading={isLoading}
          pageSize={6}
          enableColumnVisibility={false}
          emptyTitle="No weigh events"
          emptyDescription="Press “Weigh next bale” to simulate one."
          hidePagerWhenSinglePage
        />
      </CardContent>
    </Card>
  );
}

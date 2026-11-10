"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Search } from "lucide-react";
import { Badge, Button, DataTable, DemoBadge, Input, NativeSelect, PageHeader, Skeleton, UnverifiedBadge, type ColumnDef } from "@tobacco/ui";
import { formatDate, formatDateTime, type GrowerBooking } from "@tobacco/shared";
import { GrowerLink } from "@/components/domain/entity-links";
import { RequirePermission } from "@/components/page-guard";
import { useDbQuery } from "@/mock/hooks";

type Row = GrowerBooking & { delivered: number | null; deliveries: number };

export default function BookingsPage() {
  return (
    <RequirePermission permission="timb.view">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Bookings />
      </Suspense>
    </RequirePermission>
  );
}

function Bookings() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [sellDate, setSellDate] = useState("");
  const [grower, setGrower] = useState("");
  const [floor, setFloor] = useState("");

  const { data, isLoading } = useDbQuery(["timb", "bookings"], (db): Row[] =>
    db.bookings
      .map((b) => {
        const notes = db.deliveryNotes.filter((d) => d.growerNo === b.growerNo && d.sellingDate === b.sellDate && d.state !== "OPEN");
        const delivered = notes.reduce((a, n) => a + (n.historicalBaleCount ?? db.bales.filter((x) => x.gdnId === n.id && !x.ejected).length), 0);
        return { ...b, delivered: notes.length ? delivered : null, deliveries: notes.length };
      })
      .sort((a, b) => b.sellDate.localeCompare(a.sellDate) || b.bookedId.localeCompare(a.bookedId)),
  );

  const options = useMemo(() => {
    const rows = data ?? [];
    return {
      dates: [...new Set(rows.map((r) => r.sellDate))].sort().reverse(),
      growers: [...new Set(rows.map((r) => r.growerNo))].sort(),
      floors: [...new Set(rows.map((r) => r.floor))].sort(),
    };
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (!sellDate || r.sellDate === sellDate) &&
        (!grower || r.growerNo === grower) &&
        (!floor || r.floor === floor) &&
        (!needle || `${r.bookedId} ${r.growerNo} ${r.firstName} ${r.surname}`.toLowerCase().includes(needle)),
    );
  }, [data, q, sellDate, grower, floor]);

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "bookedId", header: "Booked id", cell: ({ getValue }) => <span className="font-mono text-[13px] font-medium">{getValue<string>()}</span> },
    { accessorKey: "sellDate", header: "Sell Date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "season", header: "Season" },
    { accessorKey: "growerNo", header: "Grower", cell: ({ getValue }) => <GrowerLink growerNo={getValue<string>()} /> },
    { accessorKey: "firstName", header: "First Name" },
    { accessorKey: "surname", header: "Surname" },
    { accessorKey: "bookDate", header: "Book Date", cell: ({ getValue }) => formatDate(getValue<string>()) },
    { accessorKey: "balesBooked", header: "Bales Booked", cell: ({ getValue }) => <span className="tabular font-medium">{getValue<number>()}</span> },
    {
      id: "delivered",
      header: "Delivered vs booked",
      accessorFn: (r) => r.delivered ?? -1,
      cell: ({ row }) => {
        const r = row.original;
        if (r.delivered === null) return <span className="text-xs text-muted-foreground">Not delivered</span>;
        const tone = r.delivered === r.balesBooked ? "success" : r.delivered > r.balesBooked ? "warning" : "primary";
        return (
          <Badge tone={tone} dot title={r.delivered > r.balesBooked ? "More bales delivered than booked (unbooked)" : r.delivered < r.balesBooked ? "Fewer bales delivered than booked" : "Delivered as booked"}>
            <span className="tabular">{r.delivered} / {r.balesBooked}</span>
          </Badge>
        );
      },
    },
    {
      accessorKey: "sourceBales",
      header: () => (
        <span className="inline-flex items-center gap-1.5">
          Source B… <UnverifiedBadge uq="UQ-09" />
        </span>
      ),
      cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue<number>()}</span>,
    },
    { accessorKey: "floor", header: "Floor" },
    { accessorKey: "bookedBy", header: "Booked By" },
    { accessorKey: "lastUpdated", header: "Last Updated on", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue<string>())}</span> },
    { id: "demo", header: "", enableSorting: false, enableHiding: false, accessorFn: (r) => (r.isDemo ? "demo" : ""), cell: ({ row }) => (row.original.isDemo ? <DemoBadge /> : null) },
  ];

  return (
    <>
      <PageHeader
        title="Grower bookings"
        description="Each line is one TIMB booking: grower, sell date and bales booked. Receiving and balancing check the bales delivered against these bookings."
        actions={
          <Button asChild>
            <Link href="/timb/imports/new?type=GROWER_BOOKING">Import booking file</Link>
          </Button>
        }
      />
      <DataTable
        data-testid="bookings-table"
        aria-label="Grower bookings"
        columns={columns}
        data={rows}
        loading={isLoading}
        pageSize={10}
        getRowId={(r) => r.id}
                emptyIcon={ClipboardList}
        emptyTitle="No bookings match"
        emptyDescription="Import the day's booking file, or adjust the filters."
        toolbar={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search booked id, grower or name" aria-label="Search bookings" className="h-9 rounded-xl pl-9 text-sm" data-testid="bookings-search" />
            </div>
            <NativeSelect size="sm" wrapperClassName="w-44" aria-label="Filter by sell date" value={sellDate} onChange={(e) => setSellDate(e.target.value)}>
              <option value="">All sell dates</option>
              {options.dates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect size="sm" wrapperClassName="w-40" aria-label="Filter by grower" value={grower} onChange={(e) => setGrower(e.target.value)}>
              <option value="">All growers</option>
              {options.growers.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect size="sm" wrapperClassName="w-32" aria-label="Filter by floor" value={floor} onChange={(e) => setFloor(e.target.value)}>
              <option value="">All floors</option>
              {options.floors.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />
    </>
  );
}

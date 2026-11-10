"use client";

import { PackageX, Trash2 } from "lucide-react";
import { Button, DataTable, type ColumnDef } from "@tobacco/ui";
import { GrowerLink, SaleLink } from "@/components/domain/entity-links";
import type { DispatchBaleRow } from "@/mock/domain/dispatch";

/** Bales on a dispatch note. `onRemove` (draft notes only) renders the documented "Remove Bale" action. */
export function DispatchBalesTable({
  rows,
  onRemove,
  removing,
  pageSize = 10,
  newestFirst,
  emptyTitle = "No bales on this note yet",
  emptyDescription,
  testId = "dispatch-bales",
}: {
  rows: DispatchBaleRow[];
  onRemove?: (row: DispatchBaleRow) => void;
  removing?: boolean;
  pageSize?: number;
  newestFirst?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  testId?: string;
}) {
  const numbered = rows.map((r, i) => ({ ...r, seq: i + 1 }));
  const data = newestFirst ? [...numbered].reverse() : numbered;

  const columns: ColumnDef<(typeof numbered)[number], unknown>[] = [
    { id: "seq", header: "#", accessorFn: (r) => r.seq, cell: ({ row }) => <span className="tabular text-muted-foreground">{row.original.seq}</span> },
    { id: "ticket", header: "Ticket barcode", accessorFn: (r) => r.bale.ticketBarcode ?? "", cell: ({ row }) => <span className="font-mono text-[13px] font-medium">{row.original.bale.ticketBarcode}</span> },
    { id: "scale", header: "Scale barcode", accessorFn: (r) => r.bale.scaleBarcode, cell: ({ row }) => <span className="font-mono text-[13px] text-muted-foreground">{row.original.bale.scaleBarcode}</span> },
    { id: "grower", header: "Grower", accessorFn: (r) => `${r.bale.growerNo} ${r.growerName}`, cell: ({ row }) => <GrowerLink growerNo={row.original.bale.growerNo} /> },
    { id: "lot", header: "Group / lot", accessorFn: (r) => `${r.bale.group}/${r.bale.lot}`, cell: ({ row }) => <span className="tabular">{row.original.bale.group} / {row.original.bale.lot}</span> },
    { id: "mass", header: "Mass (kg)", accessorFn: (r) => r.bale.mass, cell: ({ row }) => <span className="tabular font-medium">{row.original.bale.mass}</span> },
    { id: "buyer", header: "Buyer", accessorFn: (r) => r.bale.buyerCode ?? "", cell: ({ row }) => row.original.bale.buyerCode ?? "—" },
    { id: "buyerGrade", header: "Buyer grade", accessorFn: (r) => r.bale.buyerGrade ?? "", cell: ({ row }) => row.original.bale.buyerGrade ?? "—" },
    { id: "timb", header: "TIMB grade", accessorFn: (r) => r.bale.timbGrade ?? "", cell: ({ row }) => row.original.bale.timbGrade ?? "—" },
    {
      id: "sale",
      header: "Sale",
      accessorFn: (r) => (r.saleRef ? `Sale #${r.saleRef}` : ""),
      cell: ({ row }) => (row.original.saleId && row.original.saleRef ? <SaleLink id={row.original.saleId} refNo={row.original.saleRef} /> : "—"),
    },
  ];
  if (onRemove) {
    columns.push({
      id: "remove",
      header: () => <span className="sr-only">Remove</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={removing}
            onClick={() => onRemove(row.original)}
            aria-label={`Remove bale ${row.original.bale.ticketBarcode}`}
            data-testid={`remove-${row.original.bale.ticketBarcode}`}
          >
            <Trash2 /> Remove Bale
          </Button>
        </div>
      ),
    });
  }

  return (
    <DataTable
      data-testid={testId}
      aria-label="Bales on the dispatch note"
      columns={columns}
      data={data}
      searchPlaceholder="Search ticket, grower, lot…"
      pageSize={pageSize}
      pageSizeOptions={[10, 25, 50, 100]}
      emptyIcon={PackageX}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      initialColumnVisibility={{ scale: false, buyerGrade: false, timb: false }}
      dense
      hidePagerWhenSinglePage
    />
  );
}

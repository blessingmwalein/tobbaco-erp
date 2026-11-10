"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, MoreHorizontal, Search, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { Checkbox, Input } from "./form";
import { EmptyState, Skeleton } from "./feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type { ColumnDef } from "@tanstack/react-table";

export interface DataTableProps<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  data: T[];
  loading?: boolean;
  /** Enables the search box (client-side global filter). */
  searchPlaceholder?: string;
  /** Filter controls rendered next to the search box. */
  toolbar?: React.ReactNode;
  /** Buttons rendered at the right of the toolbar. */
  toolbarActions?: React.ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  enableRowSelection?: boolean;
  /** Rendered in a bar when rows are selected (bulk actions). */
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  /** Per-row "⋯" menu content (acts as the row context menu). */
  rowMenu?: (row: T) => React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  initialSorting?: SortingState;
  initialColumnVisibility?: VisibilityState;
  enableColumnVisibility?: boolean;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  dense?: boolean;
  /** Hide the footer pager when the data fits one page. */
  hidePagerWhenSinglePage?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  searchPlaceholder,
  toolbar,
  toolbarActions,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  getRowId,
  onRowClick,
  enableRowSelection,
  bulkActions,
  rowMenu,
  rowClassName,
  emptyIcon,
  emptyTitle = "No records",
  emptyDescription,
  emptyAction,
  initialSorting = [],
  initialColumnVisibility = {},
  enableColumnVisibility = true,
  className,
  dense,
  hidePagerWhenSinglePage,
  ...rest
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize });

  const allColumns = React.useMemo(() => {
    const cols: ColumnDef<T, unknown>[] = [];
    if (enableRowSelection) {
      cols.push({
        id: "__select",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all rows on this page"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label="Select row"
            checked={row.getIsSelected()}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={(v) => row.toggleSelected(v === true)}
          />
        ),
      });
    }
    cols.push(...(columns as ColumnDef<T, unknown>[]));
    if (rowMenu) {
      cols.push({
        id: "__menu",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>{rowMenu(row.original)}</DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      });
    }
    return cols;
  }, [columns, enableRowSelection, rowMenu]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, globalFilter, columnVisibility, rowSelection, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getRowId: getRowId as ((row: T, index: number) => string) | undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.toLowerCase().trim();
      if (!q) return true;
      return row
        .getAllCells()
        .some((cell) => {
          const v = cell.getValue();
          return (typeof v === "string" || typeof v === "number") && String(v).toLowerCase().includes(q);
        });
    },
    autoResetPageIndex: true,
  });

  const total = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  const from = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const to = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const colCount = allColumns.length;
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const showPager = !(hidePagerWhenSinglePage && total <= pagination.pageSize);

  return (
    <div
      data-slot="data-table"
      data-testid={rest["data-testid"]}
      className={cn("flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card", className)}
    >
      {searchPlaceholder || toolbar || toolbarActions || enableColumnVisibility ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {searchPlaceholder ? (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                size="sm"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 rounded-xl pl-9 text-sm"
              />
            </div>
          ) : null}
          {toolbar}
          <div className="ml-auto flex items-center gap-2">
            {toolbarActions}
            {enableColumnVisibility && hideable.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <Columns3 /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  {hideable.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={col.getIsVisible()}
                      onCheckedChange={(v) => col.toggleVisibility(v === true)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      ) : null}

      {enableRowSelection && selectedRows.length > 0 ? (
        <div className="flex items-center gap-3 border-b border-border bg-primary-soft px-4 py-2 text-sm text-primary-soft-foreground">
          <span className="font-medium">{selectedRows.length} selected</span>
          {bulkActions?.(selectedRows, () => table.resetRowSelection())}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => table.resetRowSelection()}>
            Clear
          </Button>
        </div>
      ) : null}

      <Table aria-label={rest["aria-label"]}>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    style={{ width: header.column.columnDef.size && header.column.columnDef.size !== 150 ? header.column.columnDef.size : undefined }}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-surface-tertiary hover:text-foreground"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3" aria-hidden />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" aria-hidden />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
              <TableRow key={`sk-${i}`} data-testid="table-skeleton-row">
                {Array.from({ length: colCount }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full max-w-40" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : pageRows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colCount} className="p-0">
                <EmptyState
                  icon={emptyIcon}
                  title={globalFilter ? "No matching records" : emptyTitle}
                  description={globalFilter ? `Nothing matches “${globalFilter}”. Try a different search.` : emptyDescription}
                  action={globalFilter ? <Button variant="secondary" size="sm" onClick={() => setGlobalFilter("")}>Clear search</Button> : emptyAction}
                />
              </TableCell>
            </TableRow>
          ) : (
            pageRows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter") onRowClick(row.original);
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  onRowClick && "cursor-pointer hover:bg-surface-secondary focus-visible:bg-surface-secondary",
                  rowClassName?.(row.original),
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={dense ? "py-1.5" : undefined}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {showPager && !loading ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <p aria-live="polite">
            {total === 0 ? "0 records" : `${from}–${to} of ${total}`}
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              Rows
              <select
                aria-label="Rows per page"
                value={pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-8 rounded-lg border border-border-strong bg-surface px-2 text-xs text-foreground"
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label="Previous page"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft />
              </Button>
              <span className="tabular min-w-16 text-center">
                {table.getPageCount() === 0 ? 0 : pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label="Next page"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

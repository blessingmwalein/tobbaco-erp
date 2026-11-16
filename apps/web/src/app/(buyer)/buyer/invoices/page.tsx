"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { Button, Card, CardContent, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { useBuyerQuery } from "@/lib/api";
import { DataTableCard, PageIntro, Pagination, QueryState, RecordLink } from "../_components/buyer-data";

type Invoice = { id: string; reference: string; invoiceNumber?: string | null; company: string; floorName: string; invoiceDate: string; totalBales: number; totalMassKg: string; totalUsdValue: string; payableUsd?: string | null };
type Page = { items: Invoice[]; total: number; page: number; pageSize: number };
type Sort = "invoiceDate" | "reference" | "floorName" | "totalBales" | "totalMassKg" | "totalUsdValue";

export default function BuyerInvoicesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [floor, setFloor] = useState("");
  const [sort, setSort] = useState<Sort>("invoiceDate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const query = useBuyerQuery<Page>("/buyer/invoices", { page, pageSize: 20, search: search || undefined, from: from || undefined, to: to || undefined, floor: floor || undefined, sort, dir }, { key: ["invoices", page, search, from, to, floor, sort, dir] });
  const activeFilters = [search && `Search: ${search}`, from && `From: ${from}`, to && `To: ${to}`, floor && `Floor: ${floor}`].filter(Boolean) as string[];
  function applyFilter(setter: (value: string) => void, value: string) { setPage(1); setter(value); }
  function changeSort(next: Sort) { setPage(1); if (sort === next) setDir((current) => current === "asc" ? "desc" : "asc"); else { setSort(next); setDir("asc"); } }
  function sortIcon(column: Sort) { return sort !== column ? <ArrowUpDown className="size-3.5" /> : dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />; }
  return <RequireBuyerPermission permission="buyer.invoices.view"><PageIntro title="Buyer invoices" description="Invoices and charges imported for your company." />
    <Card className="mb-6"><CardContent className="space-y-4 pt-6">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Search invoice or buyer</span><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => applyFilter(setSearch, event.target.value)} placeholder="Reference, buyer..." /></div></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Sale date from</span><Input type="date" value={from} onChange={(event) => applyFilter(setFrom, event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Sale date to</span><Input type="date" value={to} onChange={(event) => applyFilter(setTo, event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Floor</span><Input value={floor} onChange={(event) => applyFilter(setFloor, event.target.value)} placeholder="e.g. ETHICAL SALES FLOOR" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-medium">Current filters:</span>{activeFilters.length ? activeFilters.map((filter) => <span key={filter} className="rounded-full bg-muted px-2.5 py-1">{filter}</span>) : <span>All invoices</span>}{activeFilters.length ? <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFrom(""); setTo(""); setFloor(""); setPage(1); }}><X /> Clear filters</Button> : null}</div>
    </CardContent></Card>
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} onRetry={() => void query.refetch()} empty={!query.data?.items.length}>
      <DataTableCard><div className="overflow-x-auto"><Table aria-label="Buyer invoices"><TableHeader><TableRow><SortableHead label="Invoice" column="reference" sortIcon={sortIcon} onSort={changeSort} /><SortableHead label="Invoice date" column="invoiceDate" sortIcon={sortIcon} onSort={changeSort} /><SortableHead label="Floor" column="floorName" sortIcon={sortIcon} onSort={changeSort} /><SortableHead label="Bales" column="totalBales" sortIcon={sortIcon} onSort={changeSort} /><SortableHead label="Mass" column="totalMassKg" sortIcon={sortIcon} onSort={changeSort} /><SortableHead label="Value (USD)" column="totalUsdValue" sortIcon={sortIcon} onSort={changeSort} align="right" /></TableRow></TableHeader><TableBody>{query.data?.items.map((invoice) => <TableRow key={invoice.id}><TableCell><RecordLink href={`/buyer/invoices/${invoice.id}`}>{invoice.invoiceNumber || invoice.reference}</RecordLink><p className="text-xs text-muted-foreground">{invoice.company}</p></TableCell><TableCell>{invoice.invoiceDate}</TableCell><TableCell>{invoice.floorName}</TableCell><TableCell>{invoice.totalBales}</TableCell><TableCell>{invoice.totalMassKg} kg</TableCell><TableCell className="text-right tabular">{invoice.payableUsd ?? invoice.totalUsdValue}</TableCell></TableRow>)}</TableBody></Table></div><Pagination page={page} pageSize={query.data?.pageSize ?? 20} total={query.data?.total ?? 0} onPage={setPage} /></DataTableCard>
    </QueryState>
  </RequireBuyerPermission>;
}

function SortableHead({ label, column, sortIcon, onSort, align }: { label: string; column: Sort; sortIcon: (column: Sort) => React.ReactNode; onSort: (column: Sort) => void; align?: "right" }) {
  return <TableHead className={align === "right" ? "text-right" : undefined}><button type="button" className={`inline-flex items-center gap-1 font-medium hover:text-foreground ${align === "right" ? "ml-auto" : ""}`} onClick={() => onSort(column)}>{label}{sortIcon(column)}</button></TableHead>;
}

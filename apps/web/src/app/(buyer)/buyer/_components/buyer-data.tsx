"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tobacco/ui";
import { describeError } from "@/lib/api";

export function BuyerTable({ children, label }: { children: React.ReactNode; label: string }) {
  return <Table aria-label={label}><TableHeader>{children}</TableHeader></Table>;
}

export function DataTableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={`overflow-hidden ${className ?? ""}`}>{children}</Card>;
}

export function LoadingTable({ columns = 5 }: { columns?: number }) {
  return <DataTableCard><div className="space-y-3 p-5" aria-label="Loading data" role="status">{[1, 2, 3, 4].map((row) => <div key={row} className="flex gap-3">{Array.from({ length: columns }, (_, i) => <Skeleton key={i} className="h-5 flex-1" />)}</div>)}</div></DataTableCard>;
}

export function QueryState({ isLoading, isError, error, onRetry, children, empty }: { isLoading: boolean; isError: boolean; error: unknown; onRetry: () => void; children: React.ReactNode; empty: boolean }) {
  if (isLoading) return <LoadingTable />;
  if (isError) return <Card><ErrorState title="Could not load this page" description={describeError(error)} action={<Button variant="secondary" onClick={onRetry}><RefreshCw /> Try again</Button>} /></Card>;
  if (empty) return <Card><EmptyState icon={AlertCircle} title="Nothing here yet" description="Records will appear when your company imports or receives tobacco." /></Card>;
  return <>{children}</>;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>Page {page} of {pages} · {total} total</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button></div></div>;
}

export function RecordLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">{children}</Link>;
}

export function PageIntro({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return <PageHeader title={title} description={description} actions={actions} />;
}

export { TableBody, TableCell, TableHead, TableRow };

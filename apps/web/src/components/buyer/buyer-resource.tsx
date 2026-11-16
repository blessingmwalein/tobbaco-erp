"use client";

import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button, DataTable, EmptyState, ErrorState, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, type ColumnDef } from "@tobacco/ui";
import { describeError } from "@/lib/api";

export function BuyerResourceHeader({ title, description, permission, actions }: { title: string; description?: string; permission: string; actions?: ReactNode }) {
  return <PageHeader title={title} description={description} actions={actions} />;
}

export function BuyerQueryState({ loading, error, retry, children }: { loading: boolean; error: unknown; retry: () => void; children: ReactNode }) {
  if (loading) return <div className="rounded-2xl border border-border bg-surface p-6"><Skeleton className="h-8 w-48" /><Skeleton className="mt-4 h-40 w-full" /></div>;
  if (error) return <ErrorState title="Unable to load this page" description={describeError(error)} action={<Button variant="secondary" onClick={retry}><RefreshCw /> Try again</Button>} />;
  return <>{children}</>;
}

export function BuyerTable<T>({ columns, data, emptyTitle, emptyDescription, searchPlaceholder = "Search records" }: { columns: ColumnDef<T, unknown>[]; data: T[]; emptyTitle: string; emptyDescription?: string; searchPlaceholder?: string }) {
  return <DataTable columns={columns} data={data} searchPlaceholder={searchPlaceholder} emptyIcon={AlertCircle} emptyTitle={emptyTitle} emptyDescription={emptyDescription} aria-label={emptyTitle} />;
}

export function BuyerSelect({ value, onValueChange, placeholder, options, label }: { value: string; onValueChange: (value: string) => void; placeholder: string; options: Array<{ value: string; label: string }>; label: string }) {
  return <Select value={value} onValueChange={onValueChange}><SelectTrigger aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

export function BuyerEmpty({ title, description }: { title: string; description: string }) {
  return <EmptyState icon={AlertCircle} title={title} description={description} />;
}

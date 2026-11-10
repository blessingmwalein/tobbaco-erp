"use client";

import { FilterX } from "lucide-react";
import { Button, DateInput, Field, NativeSelect } from "@tobacco/ui";
import { useDb } from "@/mock/hooks";
import type { FilterKey, ReportDef, ReportFilters } from "@/lib/reports";

const ALL = "";

function Select({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  return (
    <Field label={label} htmlFor={id} className="w-48">
      <NativeSelect id={id} value={value ?? ALL} onChange={(e) => onChange(e.target.value || undefined)} data-testid={`filter-${id}`}>
        <option value={ALL}>{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

/** Renders only the filters that apply to the report. Values live in the URL (deep-linkable). */
export function ReportFilterBar({
  def,
  filters,
  onChange,
  onClear,
}: {
  def: ReportDef;
  filters: ReportFilters;
  onChange: (patch: Partial<ReportFilters>) => void;
  onClear: () => void;
}) {
  const opts = useDb((db) => ({
    growers: db.growers.map((g) => ({ value: g.growerNo, label: `${g.growerNo} · ${g.firstName} ${g.surname}` })).sort((a, b) => a.value.localeCompare(b.value)),
    buyers: db.buyers.map((b) => ({ value: b.code, label: `${b.code} · ${b.name}` })),
    creditors: db.creditors.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` })),
    payBatches: db.payBatches.map((p) => ({ value: String(p.no), label: `Pay batch ${p.no}` })).sort((a, b) => Number(b.value) - Number(a.value)),
    priceBatches: db.priceBatches.map((b) => ({ value: String(b.refNo), label: `Batch ${b.refNo} · ${b.growerNo}` })).sort((a, b) => Number(a.value) - Number(b.value)),
    seasons: db.seasons.map((s) => ({ value: String(s.year), label: `Season ${s.year}` })).sort((a, b) => Number(b.value) - Number(a.value)),
    sellingPoints: db.sellingPoints.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })),
    users: db.users.map((u) => ({ value: u.id, label: u.name })).sort((a, b) => a.label.localeCompare(b.label)),
  }));

  const has = (k: FilterKey) => def.filters.includes(k);
  const active = Object.values(filters).some((v) => v !== undefined && v !== "");

  return (
    <div className="no-print flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card" data-testid="report-filters">
      {has("date") ? (
        <>
          <Field label="From" htmlFor="f-from" className="w-40">
            <DateInput id="f-from" value={filters.from ?? ""} max={filters.to || undefined} onChange={(e) => onChange({ from: e.target.value || undefined })} />
          </Field>
          <Field label="To" htmlFor="f-to" className="w-40">
            <DateInput id="f-to" value={filters.to ?? ""} min={filters.from || undefined} onChange={(e) => onChange({ to: e.target.value || undefined })} />
          </Field>
        </>
      ) : null}
      {has("season") ? <Select id="season" label="Season" value={filters.season} onChange={(v) => onChange({ season: v })} options={opts.seasons} allLabel="All seasons" /> : null}
      {has("sellingPoint") ? <Select id="sellingPoint" label="Selling point" value={filters.sellingPoint} onChange={(v) => onChange({ sellingPoint: v })} options={opts.sellingPoints} allLabel="All selling points" /> : null}
      {has("grower") ? <Select id="grower" label="Grower" value={filters.grower} onChange={(v) => onChange({ grower: v })} options={opts.growers} allLabel="All growers" /> : null}
      {has("buyer") ? <Select id="buyer" label="Buyer" value={filters.buyer} onChange={(v) => onChange({ buyer: v })} options={opts.buyers} allLabel="All buyers" /> : null}
      {has("creditor") ? <Select id="creditor" label="Creditor" value={filters.creditor} onChange={(v) => onChange({ creditor: v })} options={opts.creditors} allLabel="All creditors" /> : null}
      {has("batch") ? (
        <Select
          id="batch"
          label={def.batchKind === "price" ? "Price batch" : "Pay batch"}
          value={filters.batch}
          onChange={(v) => onChange({ batch: v })}
          options={def.batchKind === "price" ? opts.priceBatches : opts.payBatches}
          allLabel={def.batchKind === "price" ? "All price batches" : "All pay batches"}
        />
      ) : null}
      {has("status") && def.statusOptions ? (
        <Select id="status" label={def.statusLabel ?? "Status"} value={filters.status} onChange={(v) => onChange({ status: v })} options={def.statusOptions} allLabel="Any" />
      ) : null}
      {has("user") ? <Select id="user" label="User" value={filters.user} onChange={(v) => onChange({ user: v })} options={opts.users} allLabel="All users" /> : null}
      <Button variant="ghost" size="md" onClick={onClear} disabled={!active} className="ml-auto" data-testid="clear-filters">
        <FilterX /> Clear filters
      </Button>
    </div>
  );
}

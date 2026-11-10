"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colors } from "@tobacco/design-system";
import { cn } from "@tobacco/ui";
import { formatUsd } from "@tobacco/shared";

const axis = { fontSize: 12, fill: colors.mutedForeground };

export interface CreditorBar {
  code: string;
  name: string;
  amountCents: number;
  count: number;
}

/**
 * "Top 10 Creditors by Deduction Amount" — horizontal bars, largest first (Manual 07).
 * Clicking a bar (or its button underneath, for keyboard/screen-reader users) opens that creditor's deductions.
 */
export function TopCreditorsChart({
  data,
  selected,
  onSelect,
}: {
  data: CreditorBar[];
  selected?: string | null;
  onSelect: (code: string | null) => void;
}) {
  const chartData = data.map((d) => ({ ...d, label: d.name, value: d.amountCents / 100 }));
  const height = Math.max(180, chartData.length * 40 + 40);
  return (
    <div className="flex flex-col gap-3">
      <div
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={`Top creditors by deduction amount: ${data.map((d) => `${d.name} ${formatUsd(d.amountCents)}`).join(", ")}`}
        data-testid="top-creditors-chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke={colors.border} />
            <XAxis type="number" tick={axis} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
            <YAxis type="category" dataKey="label" width={150} tick={axis} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: colors.surfaceSecondary }}
              formatter={(v) => [formatUsd(Math.round(Number(v) * 100)), "Deducted"]}
              contentStyle={{ borderRadius: 12, border: `1px solid ${colors.border}`, fontSize: 12 }}
            />
            <Bar
              dataKey="value"
              radius={[0, 8, 8, 0]}
              barSize={20}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(entry) => {
                const code = (entry as unknown as { payload?: { code?: string } }).payload?.code;
                if (code) onSelect(selected === code ? null : code);
              }}
            >
              {chartData.map((d) => (
                <Cell key={d.code} fill={selected && selected !== d.code ? colors.border : colors.primary} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => formatUsd(Math.round(Number(v) * 100))}
                style={{ fontSize: 12, fill: colors.foreground, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Creditors">
        {data.map((d) => (
          <li key={d.code}>
            <button
              type="button"
              onClick={() => onSelect(selected === d.code ? null : d.code)}
              aria-pressed={selected === d.code}
              data-testid={`creditor-${d.code}`}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                selected === d.code ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border bg-surface hover:border-primary",
              )}
            >
              {d.name} · <span className="tabular font-medium">{formatUsd(d.amountCents)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Simple labelled breakdown with proportion bars (by currency, by source). */
export function BreakdownList({
  items,
  format,
  testId,
}: {
  items: Array<{ key: string; label: string; amountCents: number; count: number }>;
  format: (cents: number) => string;
  testId?: string;
}) {
  const total = items.reduce((a, i) => a + i.amountCents, 0) || 1;
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No deductions in this range</p>;
  return (
    <ul className="flex flex-col gap-3" data-testid={testId}>
      {items.map((i) => (
        <li key={i.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{i.label}</span>
            <span className="tabular text-muted-foreground">
              <span className="font-semibold text-foreground">{format(i.amountCents)}</span> · {i.count} line{i.count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-tertiary" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round((i.amountCents / total) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colors } from "@tobacco/design-system";

const axis = { fontSize: 12, fill: colors.mutedForeground };

/** Bales through the day: one horizontal bar per stage — shows exactly where the day is queuing. */
export function BaleProgressChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`Bale progress: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={colors.border} />
          <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={118} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: colors.surfaceSecondary }} formatter={(v) => [`${v} bales`, ""]} contentStyle={{ borderRadius: 12, border: `1px solid ${colors.border}`, fontSize: 12 }} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={i === 0 ? colors.neutralDark : colors.primary} />
            ))}
            <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: colors.foreground, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Booked vs received per grower. */
export function GrowerDeliveryChart({ data }: { data: Array<{ grower: string; booked: number; received: number }> }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`Booked versus received bales by grower: ${data.map((d) => `${d.grower} booked ${d.booked} received ${d.received}`).join("; ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -12, right: 8, top: 12, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={colors.border} />
          <XAxis dataKey="grower" tick={axis} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: colors.surfaceSecondary }} contentStyle={{ borderRadius: 12, border: `1px solid ${colors.border}`, fontSize: 12 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="booked" name="Booked" fill={colors.neutralDark} radius={[6, 6, 0, 0]} barSize={16} isAnimationActive={false} />
          <Bar dataKey="received" name="Received" fill={colors.primary} radius={[6, 6, 0, 0]} barSize={16} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

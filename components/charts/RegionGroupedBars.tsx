"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartFrame from "@/components/ui/ChartFrame";
import { TipBox } from "@/components/ui/Tooltip";
import { usePalette } from "@/components/ui/usePalette";
import { axisMoney, clipLabel, dollars } from "@/lib/format";
import type { RegionPoint } from "@/lib/types";

/** Two measures, same unit ($) → one shared axis, grouped bars, legend. */
export default function RegionGroupedBars({
  data,
  height = 300,
}: {
  data: RegionPoint[];
  height?: number;
}) {
  const p = usePalette();

  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 26, right: 14, bottom: 4, left: 4 }}
        barCategoryGap={4}
      >
        <CartesianGrid stroke={p.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={axisMoney}
          tick={{ fontSize: 10, fill: p.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={132}
          tickFormatter={(v: string) => clipLabel(v, 21)}
          tick={{ fontSize: 9.5, fill: p.ink2 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: p.grid, fillOpacity: 0.6 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox
                title={String(label)}
                rows={payload.map((s) => ({
                  label: String(s.name),
                  value: dollars(Number(s.value)),
                  color: String(s.color ?? s.fill),
                }))}
              />
            ) : null
          }
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={22}
          iconType="square"
          wrapperStyle={{ fontSize: 11, color: p.muted }}
        />
        <Bar dataKey="sales" name="Sales" fill={p.brand} radius={[0, 3, 3, 0]} barSize={7} isAnimationActive={false} />
        <Bar dataKey="profit" name="Profit" fill={p.mint} radius={[0, 3, 3, 0]} barSize={7} isAnimationActive={false} />
      </BarChart>
    </ChartFrame>
  );
}

"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartFrame from "@/components/ui/ChartFrame";
import { TipBox } from "@/components/ui/Tooltip";
import { usePalette } from "@/components/ui/usePalette";
import { axisMoney, dollars, shortMonth } from "@/lib/format";
import type { TrendPoint } from "@/lib/types";

/**
 * Change over time → area for the primary measure, line for the secondary.
 * Both are dollars, so they share ONE y-axis; no dual scale.
 */
export default function RevenueTrend({
  data,
  height = 300,
}: {
  data: TrendPoint[];
  height?: number;
}) {
  const p = usePalette();
  const step = Math.max(1, Math.ceil(data.length / 8));

  return (
    <ChartFrame height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 10, bottom: 4, left: 4 }}
      >
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.brand} stopOpacity={0.22} />
            <stop offset="100%" stopColor={p.brand} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis
          dataKey="ym"
          tickFormatter={shortMonth}
          interval={step - 1}
          tick={{ fontSize: 10, fill: p.muted }}
          axisLine={false}
          tickLine={false}
          minTickGap={4}
        />
        <YAxis
          tickFormatter={axisMoney}
          tick={{ fontSize: 10, fill: p.muted }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: p.muted, strokeWidth: 1, strokeDasharray: "3 3" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox
                title={shortMonth(String(label))}
                rows={payload.map((s) => ({
                  label: String(s.name),
                  value: dollars(Number(s.value)),
                  color: String(s.color ?? s.stroke),
                }))}
              />
            ) : null
          }
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={26}
          iconType="plainline"
          wrapperStyle={{ fontSize: 11, color: p.muted }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          name="Sales"
          stroke={p.brand}
          strokeWidth={2}
          fill="url(#salesFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: p.card }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="profit"
          name="Profit"
          stroke={p.mint}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: p.card }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartFrame>
  );
}

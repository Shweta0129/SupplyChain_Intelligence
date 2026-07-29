"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartFrame from "@/components/ui/ChartFrame";
import { TipBox } from "@/components/ui/Tooltip";
import { usePalette } from "@/components/ui/usePalette";
import { axisCount, count } from "@/lib/format";
import type { DelayBin } from "@/lib/types";

/**
 * A distribution, so bars touch (2px surface gap only) and the zero line is
 * marked — left of it is early, right of it is late.
 */
export default function DelayHistogram({
  data,
  height = 300,
}: {
  data: DelayBin[];
  height?: number;
}) {
  const p = usePalette();

  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 18, left: 4 }} barCategoryGap={2}>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis
          dataKey="days"
          tick={{ fontSize: 10, fill: p.muted }}
          axisLine={false}
          tickLine={false}
          label={{
            value: "days late  (negative = early)",
            position: "insideBottom",
            offset: -12,
            fontSize: 10,
            fill: p.muted,
          }}
        />
        <YAxis
          tickFormatter={axisCount}
          tick={{ fontSize: 10, fill: p.muted }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: p.grid, fillOpacity: 0.6 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipBox
                title={`${payload[0].payload.days > 0 ? "+" : ""}${payload[0].payload.days} day${Math.abs(Number(payload[0].payload.days)) === 1 ? "" : "s"}`}
                rows={[
                  {
                    label: "Orders",
                    value: count(Number(payload[0].value)),
                    color:
                      Number(payload[0].payload.days) > 0 ? p.amber : p.brand,
                  },
                ]}
              />
            ) : null
          }
        />
        <ReferenceLine x={0} stroke={p.mint} strokeDasharray="4 3" strokeWidth={1.6} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.days} fill={d.days > 0 ? p.amber : p.brand} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

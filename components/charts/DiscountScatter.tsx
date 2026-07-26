"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import ChartFrame from "@/components/ui/ChartFrame";
import { TipBox } from "@/components/ui/Tooltip";
import { usePalette } from "@/components/ui/usePalette";
import { diverge } from "@/lib/palette";
import { dollars, pct } from "@/lib/format";
import type { ScatterPoint } from "@/lib/types";

/**
 * Polarity, not magnitude: margin is signed, so it gets a two-hue diverging
 * scale with a neutral midpoint at 0% — never a rainbow. The horizontal rule at
 * profit = 0 is the thing the chart exists to show.
 */
export default function DiscountScatter({
  data,
  height = 320,
}: {
  data: ScatterPoint[];
  height?: number;
}) {
  const p = usePalette();
  const points = useMemo(() => data.slice(0, 4000), [data]);

  return (
    <div className="flex h-full flex-col">
      <ChartFrame height={height - 30}>
        <ScatterChart margin={{ top: 8, right: 14, bottom: 18, left: 4 }}>
          <CartesianGrid stroke={p.grid} vertical={false} />
          <XAxis
            type="number"
            dataKey="d"
            domain={[0, "dataMax"]}
            tickFormatter={(v: number) => `${Math.round(v)}%`}
            tick={{ fontSize: 10, fill: p.muted }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "discount",
              position: "insideBottom",
              offset: -12,
              fontSize: 10,
              fill: p.muted,
            }}
          />
          <YAxis
            type="number"
            dataKey="p"
            tickFormatter={(v: number) => dollars(v)}
            tick={{ fontSize: 10, fill: p.muted }}
            axisLine={false}
            tickLine={false}
            width={58}
          />
          <ZAxis range={[26, 26]} />
          <Tooltip
            cursor={{ stroke: p.muted, strokeDasharray: "3 3" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox
                  title="Order line"
                  rows={[
                    { label: "Discount", value: pct(Number(payload[0].payload.d), 0) },
                    { label: "Profit", value: dollars(Number(payload[0].payload.p)) },
                    { label: "Margin", value: pct(Number(payload[0].payload.m), 0) },
                  ]}
                />
              ) : null
            }
          />
          <ReferenceLine y={0} stroke={p.muted} strokeDasharray="3 3" strokeOpacity={0.7} />
          <Scatter data={points} isAnimationActive={false} fillOpacity={0.55}>
            {points.map((pt, i) => (
              <Cell key={i} fill={diverge(pt.m / 50, p)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ChartFrame>

      {/* Diverging legend — the colour scale is signed, so it needs a key. */}
      <div className="flex items-center gap-2 px-4 pb-1 text-[10px] text-muted">
        <span>−50% margin</span>
        <span
          className="h-2 flex-1 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${p.divLow}, ${p.divMid}, ${p.divHigh})`,
          }}
        />
        <span>+50%</span>
      </div>
    </div>
  );
}

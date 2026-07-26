"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartFrame from "@/components/ui/ChartFrame";
import { TipBox } from "@/components/ui/Tooltip";
import { usePalette } from "@/components/ui/usePalette";
import { axisMoney, dollars, money } from "@/lib/format";
import type { Named } from "@/lib/types";

/**
 * Magnitude by identity → horizontal bars, sorted. One hue: rank is carried by
 * position, so the leader is emphasised with the saturated step rather than a
 * second hue.
 */
export default function RevenueByMarket({
  data,
  height = 300,
}: {
  data: Named<"sales">[];
  height?: number;
}) {
  const p = usePalette();
  const top = data.length ? Math.max(...data.map((d) => d.sales)) : 0;

  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 62, bottom: 4, left: 4 }}
      >
        <XAxis
          type="number"
          tickFormatter={axisMoney}
          tick={{ fontSize: 10, fill: p.muted }}
          axisLine={false}
          tickLine={false}
          stroke={p.grid}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={86}
          tick={{ fontSize: 11, fill: p.ink2 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: p.grid, fillOpacity: 0.6 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipBox
                title={String(payload[0].payload.name)}
                rows={[
                  {
                    label: "Sales",
                    value: dollars(Number(payload[0].value)),
                    color: p.brand,
                  },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="sales" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
          {data.map((d) => (
            <Cell
              key={d.name}
              fill={d.sales === top ? p.brand : p.brandSoft}
            />
          ))}
          <LabelList
            dataKey="sales"
            position="right"
            formatter={(v) => money(Number(v))}
            style={{ fontSize: 10, fill: p.ink2, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

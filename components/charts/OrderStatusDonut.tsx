"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import ChartFrame from "@/components/ui/ChartFrame";
import { TipBox } from "@/components/ui/Tooltip";
import { usePalette } from "@/components/ui/usePalette";
import { count, pct } from "@/lib/format";
import type { CountPoint } from "@/lib/types";

/**
 * Nine states is a lot of identity for one ring, so colour never works alone:
 * every slice is named in the legend with its share, and the tooltip repeats
 * the label. The 2px surface gap between segments keeps neighbours separable
 * even where two hues sit close.
 */
export default function OrderStatusDonut({
  data,
  height = 300,
}: {
  data: CountPoint[];
  height?: number;
}) {
  const p = usePalette();
  const total = data.reduce((a, b) => a + b.count, 0);

  return (
    <div className="flex h-full flex-col">
      <ChartFrame height={height - 118}>
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox
                  title={String(payload[0].name)}
                  rows={[
                    {
                      label: "Orders",
                      value: count(Number(payload[0].value)),
                      color: p.status[String(payload[0].name)] ?? p.neutral,
                    },
                    {
                      label: "Share",
                      value: pct((Number(payload[0].value) / total) * 100),
                    },
                  ]}
                />
              ) : null
            }
          />
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            innerRadius="62%"
            outerRadius="98%"
            paddingAngle={1.5}
            stroke={p.card}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={p.status[d.name] ?? p.neutral} />
            ))}
          </Pie>
        </PieChart>
      </ChartFrame>

      <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-[3px] px-3 pb-1">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-1.5 text-[10px]">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: p.status[d.name] ?? p.neutral }}
            />
            <span className="truncate text-muted" title={d.name}>
              {d.name.replace(/_/g, " ").toLowerCase()}
            </span>
            <span className="ml-auto font-semibold text-ink2 tabular-nums">
              {((d.count / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

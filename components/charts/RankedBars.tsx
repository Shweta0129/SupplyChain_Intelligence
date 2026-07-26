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
import { clipLabel } from "@/lib/format";

/**
 * The workhorse: one horizontal ranked bar chart used by every "top N by
 * measure" panel. A single sequential hue — magnitude is already encoded by
 * length and order, so hue carries nothing extra and must not imply identity.
 */
export default function RankedBars<T extends { name: string }>({
  data,
  dataKey,
  height = 300,
  labelWidth = 140,
  barSize = 14,
  colorFor,
  format,
  tipLabel,
  axisFormat,
  labelFontSize = 10,
  rightMargin = 60,
  domain,
}: {
  data: T[];
  dataKey: keyof T & string;
  height?: number;
  labelWidth?: number;
  barSize?: number;
  colorFor: (v: number, i: number) => string;
  format: (v: number) => string;
  tipLabel: string;
  axisFormat: (v: number) => string;
  labelFontSize?: number;
  rightMargin?: number;
  domain?: [number, number];
}) {
  const p = usePalette();
  const hasNegative = data.some((d) => Number(d[dataKey]) < 0);

  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: rightMargin, bottom: 4, left: hasNegative ? 30 : 4 }}
      >
        <XAxis
          type="number"
          domain={domain ?? ["auto", "auto"]}
          tickFormatter={axisFormat}
          tick={{ fontSize: 10, fill: p.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={labelWidth}
          tickFormatter={(v: string) => clipLabel(v, Math.floor(labelWidth / 6.2))}
          tick={{ fontSize: labelFontSize, fill: p.ink2 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: p.grid, fillOpacity: 0.6 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipBox
                title={String(payload[0].payload.name)}
                rows={[
                  {
                    label: tipLabel,
                    value: format(Number(payload[0].value)),
                    color: colorFor(Number(payload[0].value), 0),
                  },
                ]}
              />
            ) : null
          }
        />
        <Bar
          dataKey={(d: T) => Number(d[dataKey])}
          name={tipLabel}
          radius={4}
          barSize={barSize}
          isAnimationActive={false}
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={colorFor(Number(d[dataKey]), i)} />
          ))}
          <LabelList
            dataKey={(d: unknown) => Number((d as T)[dataKey])}
            position="right"
            formatter={(v) => format(Number(v))}
            style={{ fontSize: labelFontSize, fill: p.ink2, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

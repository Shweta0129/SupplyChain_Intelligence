"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartFrame from "@/components/ui/ChartFrame";
import { TipBox } from "@/components/ui/Tooltip";
import { usePalette } from "@/components/ui/usePalette";

/** Vertical ranked/ordinal bars — segments, shipping modes, revenue bands. */
export default function VerticalBars<T extends { name: string }>({
  data,
  dataKey,
  height = 300,
  colorFor,
  format,
  tipLabel,
  axisFormat,
  domain,
  reference,
}: {
  data: T[];
  dataKey: keyof T & string;
  height?: number;
  colorFor: (v: number, i: number, name: string) => string;
  format: (v: number) => string;
  tipLabel: string;
  axisFormat: (v: number) => string;
  domain?: [number, number];
  reference?: { value: number; label: string };
}) {
  const p = usePalette();

  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 22, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10.5, fill: p.ink2 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={domain ?? [0, "auto"]}
          tickFormatter={axisFormat}
          tick={{ fontSize: 10, fill: p.muted }}
          axisLine={false}
          tickLine={false}
          width={50}
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
                    color: colorFor(
                      Number(payload[0].value),
                      0,
                      String(payload[0].payload.name),
                    ),
                  },
                ]}
              />
            ) : null
          }
        />
        {reference !== undefined && (
          <ReferenceLine
            y={reference.value}
            stroke={p.red}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
          >
            {/* Recharts v3 wants a real <Label> child; the `label` prop is ignored. */}
            <Label
              value={reference.label}
              position="insideTopRight"
              fontSize={10}
              fill={p.red}
              offset={6}
            />
          </ReferenceLine>
        )}
        <Bar
          dataKey={(d: T) => Number(d[dataKey])}
          name={tipLabel}
          radius={[4, 4, 0, 0]}
          maxBarSize={72}
          isAnimationActive={false}
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={colorFor(Number(d[dataKey]), i, d.name)} />
          ))}
          <LabelList
            dataKey={(d: unknown) => Number((d as T)[dataKey])}
            position="top"
            formatter={(v) => format(Number(v))}
            style={{ fontSize: 10.5, fill: p.ink2, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

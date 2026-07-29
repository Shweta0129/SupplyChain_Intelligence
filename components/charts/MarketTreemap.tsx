"use client";

import { useEffect, useRef, useState } from "react";
import { usePalette } from "@/components/ui/usePalette";
import { TipBox } from "@/components/ui/Tooltip";
import { dollars, money } from "@/lib/format";
import { ramp } from "@/lib/palette";
import type { TreemapNode } from "@/lib/types";

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Squarified treemap, hand-rolled so the two levels (Market → Region) can be
 * drawn with a real 2px surface gap and readable labels. Segment split lives in
 * the tooltip — a third nested level is unreadable at this size.
 *
 * Area encodes sales; the single-hue fill encodes the same magnitude, so no
 * second variable is smuggled in through colour.
 */
function squarify(items: number[], rect: Rect): Rect[] {
  const out: Rect[] = new Array(items.length);
  const order = items.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const total = order.reduce((a, b) => a + b.v, 0);
  if (!total) return items.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));

  let { x, y, w, h } = rect;
  let remaining = total;
  let cursor = 0;

  const worst = (row: number[], side: number, scale: number) => {
    const sum = row.reduce((a, b) => a + b, 0) * scale;
    const max = Math.max(...row) * scale;
    const min = Math.min(...row) * scale;
    const s2 = sum * sum;
    return Math.max((side * side * max) / s2, s2 / (side * side * min));
  };

  while (cursor < order.length) {
    const side = Math.min(w, h);
    const scale = (w * h) / remaining;
    const row: number[] = [];
    let best = Infinity;

    while (cursor + row.length < order.length) {
      const next = [...row, order[cursor + row.length].v];
      const score = worst(next, side, scale);
      if (row.length && score > best) break;
      best = score;
      row.push(order[cursor + row.length].v);
    }

    const rowSum = row.reduce((a, b) => a + b, 0);
    const thickness = (rowSum * scale) / side;
    let offset = 0;
    row.forEach((v, k) => {
      const length = side ? (v * scale) / thickness : 0;
      const item = order[cursor + k];
      out[item.i] =
        w >= h
          ? { x, y: y + offset, w: thickness, h: length }
          : { x: x + offset, y, w: length, h: thickness };
      offset += length;
    });

    if (w >= h) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
    remaining -= rowSum;
    cursor += row.length;
  }

  return out;
}

export default function MarketTreemap({
  data,
  height = 420,
}: {
  data: TreemapNode[];
  height?: number;
}) {
  const p = usePalette();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{
    node: TreemapNode;
    market: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = 3;
  const total = data.reduce((a, b) => a + b.sales, 0);
  const marketRects = width
    ? squarify(
        data.map((d) => d.sales),
        { x: 0, y: 0, w: width, h: height },
      )
    : [];

  const maxRegion = Math.max(
    1,
    ...data.flatMap((m) => (m.children ?? []).map((r) => r.sales)),
  );
  const steps = ramp(7, p.rampFrom, p.rampTo);

  return (
    <div ref={ref} className="relative w-full px-2 pb-1" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Sales by market and region">
          {data.map((market, mi) => {
            const mr = marketRects[mi];
            const inner = {
              x: mr.x + pad,
              y: mr.y + pad + 17,
              w: Math.max(0, mr.w - pad * 2),
              h: Math.max(0, mr.h - pad * 2 - 17),
            };
            const regions = market.children ?? [];
            const rr = squarify(
              regions.map((r) => r.sales),
              inner,
            );
            return (
              <g key={market.name}>
                <text
                  x={mr.x + pad + 4}
                  y={mr.y + pad + 12}
                  fontSize={11}
                  fontWeight={700}
                  fill={p.ink}
                >
                  {market.name}
                  <tspan fontWeight={500} fill={p.muted}>
                    {"  "}
                    {money(market.sales)} · {Math.round((market.sales / total) * 100)}%
                  </tspan>
                </text>
                {regions.map((region, ri) => {
                  const r = rr[ri];
                  if (r.w < 1 || r.h < 1) return null;
                  const t = Math.min(1, region.sales / maxRegion);
                  const fill = steps[Math.round(t * (steps.length - 1))];
                  return (
                    <g
                      key={region.name}
                      onMouseEnter={(e) =>
                        setHover({
                          node: region,
                          market: market.name,
                          x: e.nativeEvent.offsetX,
                          y: e.nativeEvent.offsetY,
                        })
                      }
                      onMouseMove={(e) =>
                        setHover((h) =>
                          h
                            ? { ...h, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
                            : h,
                        )
                      }
                      onMouseLeave={() => setHover(null)}
                    >
                      <rect
                        x={r.x + 1}
                        y={r.y + 1}
                        width={Math.max(0, r.w - 2)}
                        height={Math.max(0, r.h - 2)}
                        rx={4}
                        fill={fill}
                        stroke={p.card}
                        strokeWidth={2}
                      />
                      {r.w > 62 && r.h > 26 && (
                        <text
                          x={r.x + 7}
                          y={r.y + 16}
                          fontSize={9.5}
                          fill={t > 0.55 ? "#FFFFFF" : p.ink}
                          style={{ pointerEvents: "none" }}
                        >
                          {region.name.length * 5.4 < r.w - 14
                            ? region.name
                            : `${region.name.slice(0, Math.max(2, Math.floor((r.w - 16) / 5.4)))}…`}
                        </text>
                      )}
                      {r.w > 62 && r.h > 40 && (
                        <text
                          x={r.x + 7}
                          y={r.y + 29}
                          fontSize={9}
                          fontWeight={600}
                          fill={t > 0.55 ? "rgba(255,255,255,.86)" : p.muted}
                          style={{ pointerEvents: "none" }}
                        >
                          {money(region.sales)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}

      {hover && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: Math.min(hover.x + 12, Math.max(0, width - 210)),
            top: Math.max(0, hover.y - 12),
          }}
        >
          <TipBox
            title={`${hover.market} · ${hover.node.name}`}
            rows={[
              { label: "Sales", value: dollars(hover.node.sales), color: p.brand },
              ...(hover.node.children ?? []).map((c) => ({
                label: c.name,
                value: money(c.sales),
              })),
            ]}
          />
        </div>
      )}
    </div>
  );
}

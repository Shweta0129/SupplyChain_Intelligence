"use client";

import type { Kpis } from "@/lib/types";

/**
 * A single headline number per tile — no plot, so no tooltip. The delta reads
 * against the full unfiltered dataset, exactly as the Streamlit original did.
 */
function Delta({
  value,
  base,
  goodUp = true,
  asPct = true,
  suffix = "",
}: {
  value: number;
  base: number;
  goodUp?: boolean;
  asPct?: boolean;
  suffix?: string;
}) {
  if (!base || Number.isNaN(base) || Number.isNaN(value)) {
    return <span className="text-[10.5px] font-semibold opacity-60">baseline</span>;
  }
  const diff = value - base;
  if (Math.abs(diff) < 1e-9) {
    return <span className="text-[10.5px] font-semibold opacity-60">baseline</span>;
  }
  const text = asPct
    ? `${diff >= 0 ? "+" : ""}${((diff / Math.abs(base)) * 100).toFixed(1)}%`
    : `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}${suffix}`;
  const up = diff >= 0;
  const good = goodUp ? up : !up;
  return (
    <span
      className="text-[10.5px] font-semibold whitespace-nowrap"
      style={{ color: good ? "var(--mint)" : "var(--red)" }}
    >
      {up ? "▲" : "▼"} {text} vs all
    </span>
  );
}

function Tile({
  label,
  value,
  delta,
  hero = false,
}: {
  label: string;
  value: string;
  delta: React.ReactNode;
  hero?: boolean;
}) {
  return (
    <div
      className={`fade-up flex h-[112px] flex-col justify-between overflow-hidden rounded-[18px] p-4 ${
        hero ? "kpi-hero text-white" : "surface"
      }`}
    >
      <div
        className={`label-xs leading-tight ${hero ? "!text-white/75" : ""}`}
      >
        {label}
      </div>
      <div
        className={`stat-value text-[23px] whitespace-nowrap ${hero ? "text-white" : "text-ink"}`}
      >
        {value}
      </div>
      <div className={hero ? "[&_span]:!text-white/90" : ""}>{delta}</div>
    </div>
  );
}

export default function KpiRow({ k, base }: { k: Kpis; base: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Tile
        hero
        label="Total Sales"
        value={`$${(k.totalSales / 1e6).toFixed(1)}M`}
        delta={<Delta value={k.totalSales} base={base.totalSales} />}
      />
      <Tile
        label="Total Profit"
        value={`$${(k.totalProfit / 1e6).toFixed(1)}M`}
        delta={<Delta value={k.totalProfit} base={base.totalProfit} />}
      />
      <Tile
        label="Avg Order"
        value={`$${Math.round(k.avgOrder).toLocaleString("en-US")}`}
        delta={<Delta value={k.avgOrder} base={base.avgOrder} />}
      />
      <Tile
        label="Margin"
        value={`${k.avgMargin.toFixed(1)}%`}
        delta={<Delta value={k.avgMargin} base={base.avgMargin} asPct={false} suffix="pp" />}
      />
      <Tile
        label="On-Time"
        value={`${k.onTime.toFixed(1)}%`}
        delta={<Delta value={k.onTime} base={base.onTime} asPct={false} suffix="pp" />}
      />
      <Tile
        label="Avg Delay"
        value={`${k.avgDelay >= 0 ? "+" : ""}${k.avgDelay.toFixed(1)}d`}
        delta={
          <Delta
            value={k.avgDelay}
            base={base.avgDelay}
            goodUp={false}
            asPct={false}
            suffix="d"
          />
        }
      />
    </div>
  );
}

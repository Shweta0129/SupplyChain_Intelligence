"use client";

import Card from "@/components/ui/Card";
import RankedBars from "@/components/charts/RankedBars";
import VerticalBars from "@/components/charts/VerticalBars";
import DelayHistogram from "@/components/charts/DelayHistogram";
import { usePalette } from "@/components/ui/usePalette";
import { lateColor } from "@/lib/palette";
import { axisCount, count, pct } from "@/lib/format";
import type { Aggregates } from "@/lib/types";

export default function DeliveryTab({ a }: { a: Aggregates }) {
  const p = usePalette();

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Card
          title="Late Delivery Risk by Shipping Mode"
          sub="Share of orders flagged late-risk"
        >
          <VerticalBars
            data={a.lateByShipMode}
            dataKey="pct"
            colorFor={(_, __, name) => p.shipMode[name] ?? p.neutral}
            format={(v) => pct(v, 0)}
            axisFormat={(v) => `${Math.round(v)}%`}
            tipLabel="Late risk"
            domain={[0, 100]}
            reference={{
              value: a.kpis.lateRate,
              label: `Network avg ${a.kpis.lateRate.toFixed(0)}%`,
            }}
          />
        </Card>

        <Card title="Delivery Status" sub="On-time vs delayed outcomes">
          <RankedBars
            data={a.deliveryStatus}
            dataKey="count"
            labelWidth={124}
            barSize={20}
            colorFor={(_, i) => p.delivery[a.deliveryStatus[i]?.name] ?? p.neutral}
            format={count}
            axisFormat={axisCount}
            tipLabel="Orders"
          />
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card
          title="Shipping Delay Distribution"
          sub="Real minus scheduled days (negative = early)"
        >
          <DelayHistogram data={a.delayHistogram} />
        </Card>

        <Card title="Late Delivery Rate by Market" sub="Where deliveries slip most">
          <RankedBars
            data={a.lateByMarket}
            dataKey="pct"
            labelWidth={92}
            barSize={20}
            colorFor={(v) => lateColor(v, p)}
            format={(v) => pct(v, 0)}
            axisFormat={(v) => `${Math.round(v)}%`}
            tipLabel="Late risk"
            domain={[0, 100]}
          />
        </Card>
      </div>

      <p className="px-1 text-[11px] text-muted">
        Late risk is the dataset&rsquo;s own <code>Late_delivery_risk</code> flag, which is
        set for every order whose delivery status is &ldquo;Late delivery&rdquo;.
      </p>
    </div>
  );
}

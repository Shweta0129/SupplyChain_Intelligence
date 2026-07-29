"use client";

import Card from "@/components/ui/Card";
import RankedBars from "@/components/charts/RankedBars";
import DiscountScatter from "@/components/charts/DiscountScatter";
import { usePalette } from "@/components/ui/usePalette";
import { axisMoney, money, pct } from "@/lib/format";
import type { Aggregates } from "@/lib/types";

export default function ProfitabilityTab({ a }: { a: Aggregates }) {
  const p = usePalette();

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <Card title="Profit by Market" sub="Total profit contribution">
          <RankedBars
            data={a.profitByMarket}
            dataKey="profit"
            labelWidth={92}
            barSize={20}
            colorFor={(v) => (v < 0 ? p.red : p.brand)}
            format={money}
            axisFormat={axisMoney}
            tipLabel="Profit"
          />
        </Card>

        <Card title="Profit Margin by Category" sub="Worst six and best six average margins">
          <RankedBars
            data={a.marginByCategory}
            dataKey="margin"
            labelWidth={150}
            barSize={13}
            labelFontSize={9}
            rightMargin={46}
            colorFor={(v) => (v < 0 ? p.red : p.mint)}
            format={(v) => pct(v, 0)}
            axisFormat={(v) => `${Math.round(v)}%`}
            tipLabel="Avg margin"
          />
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card
          title="Discount vs Profit"
          sub="Each point an order line — discounting that destroys margin"
        >
          <DiscountScatter data={a.discountVsProfit} />
        </Card>

        <Card title="Top 10 Loss-Making Products" sub="Biggest cumulative losses">
          {a.lossMakingProducts.length ? (
            <RankedBars
              data={a.lossMakingProducts}
              dataKey="profit"
              height={320}
              labelWidth={168}
              barSize={16}
              labelFontSize={9}
              colorFor={() => p.red}
              format={money}
              axisFormat={axisMoney}
              tipLabel="Profit"
            />
          ) : (
            <div className="flex h-[320px] items-center justify-center px-6 text-center text-[12px] text-muted">
              No loss-making products in this selection.
            </div>
          )}
        </Card>
      </div>

      <p className="px-1 text-[11px] text-muted">
        The scatter draws an evenly-strided sample of up to 4,000 order lines — a
        density device, not a statistic. Every other number on this tab is computed
        over the full selection.
      </p>
    </div>
  );
}

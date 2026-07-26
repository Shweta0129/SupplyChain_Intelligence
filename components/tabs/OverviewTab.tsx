"use client";

import Card from "@/components/ui/Card";
import Insights from "@/components/Insights";
import RevenueByMarket from "@/components/charts/RevenueByMarket";
import RevenueTrend from "@/components/charts/RevenueTrend";
import OrderStatusDonut from "@/components/charts/OrderStatusDonut";
import RankedBars from "@/components/charts/RankedBars";
import VerticalBars from "@/components/charts/VerticalBars";
import { usePalette } from "@/components/ui/usePalette";
import { ramp } from "@/lib/palette";
import { axisMoney, dollars, money } from "@/lib/format";
import type { Aggregates } from "@/lib/types";

export default function OverviewTab({ a }: { a: Aggregates }) {
  const p = usePalette();
  const catRamp = ramp(a.topCategories.length, p.rampFrom, p.rampTo);
  const segRamp = ramp(a.revenueBySegment.length, p.rampTo, p.rampFrom);

  return (
    <div className="space-y-3">
      <Insights items={a.insights} />

      <div className="grid gap-3 xl:grid-cols-[2fr_2.2fr_1.5fr]">
        <Card title="Revenue by Market" sub="Total sales per global market">
          <RevenueByMarket data={a.revenueByMarket} />
        </Card>
        <Card title="Revenue & Profit Trend" sub="Monthly sales against profit">
          <RevenueTrend data={a.trend} />
        </Card>
        <Card title="Order Status" sub="Share of orders by status">
          <OrderStatusDonut data={a.orderStatus} />
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Top 10 Product Categories" sub="By total revenue">
          <RankedBars
            data={a.topCategories}
            dataKey="sales"
            height={320}
            labelWidth={168}
            barSize={16}
            colorFor={(_, i) => catRamp[i]}
            format={money}
            axisFormat={axisMoney}
            tipLabel="Sales"
          />
        </Card>
        <Card title="Revenue by Customer Segment" sub="Sales split across segments">
          <VerticalBars
            data={a.revenueBySegment}
            dataKey="sales"
            height={320}
            colorFor={(_, i) => segRamp[i]}
            format={money}
            axisFormat={axisMoney}
            tipLabel="Sales"
          />
        </Card>
      </div>

      <p className="px-1 text-[11px] text-muted">
        Full network revenue {dollars(a.kpis.totalSales)} across{" "}
        {a.kpis.totalOrders.toLocaleString("en-US")} order lines.
      </p>
    </div>
  );
}

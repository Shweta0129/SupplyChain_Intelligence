"use client";

import Card from "@/components/ui/Card";
import MarketTreemap from "@/components/charts/MarketTreemap";
import RankedBars from "@/components/charts/RankedBars";
import VerticalBars from "@/components/charts/VerticalBars";
import RegionGroupedBars from "@/components/charts/RegionGroupedBars";
import { usePalette } from "@/components/ui/usePalette";
import { ramp } from "@/lib/palette";
import { axisCount, count } from "@/lib/format";
import type { Aggregates } from "@/lib/types";

export default function GeographyTab({ a }: { a: Aggregates }) {
  const p = usePalette();
  const countryRamp = ramp(a.topCountries.length, p.rampFrom, p.rampTo);
  const bandRamp = ramp(a.revenueBands.length, p.rampFrom, p.rampTo);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[1.7fr_1fr]">
        <Card
          title="Global Sales by Market & Region"
          sub="Area is sales · hover a region for its customer-segment split"
          bodyClassName="px-0"
        >
          <MarketTreemap data={a.treemap} />
        </Card>

        <Card title="Top 10 Countries by Orders" sub="Highest order volume">
          <RankedBars
            data={a.topCountries}
            dataKey="count"
            height={420}
            labelWidth={124}
            barSize={22}
            labelFontSize={9.5}
            rightMargin={54}
            colorFor={(_, i) => countryRamp[i]}
            format={count}
            axisFormat={axisCount}
            tipLabel="Orders"
          />
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1.4fr]">
        <Card title="Revenue Distribution by Band" sub="Order count per sales band">
          <VerticalBars
            data={a.revenueBands}
            dataKey="count"
            colorFor={(_, i) => bandRamp[i]}
            format={count}
            axisFormat={axisCount}
            tipLabel="Orders"
          />
        </Card>

        <Card title="Sales & Profit by Region" sub="Top 12 order regions">
          <RegionGroupedBars data={a.salesProfitByRegion} />
        </Card>
      </div>
    </div>
  );
}

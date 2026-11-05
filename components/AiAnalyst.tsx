"use client";

import { useMemo, useState } from "react";
import { analyze, type Driver } from "@/lib/analyst";
import type { Dataset } from "@/lib/dataset";

const money = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${s}$${Math.round(a / 1e3)}K` : `${s}$${Math.round(a)}`;
};
const monthName = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function DriverRow({ d }: { d: Driver }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="min-w-0 truncate text-ink2">
        <b className="font-semibold text-ink">{d.name}</b> <span className="text-muted">· {d.dim}</span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums" style={{ color: d.kind === "loss" ? "var(--red)" : "var(--amber)" }}>
        {d.rate.toFixed(0)}% <span className="font-normal text-muted">vs {d.baseRate.toFixed(0)}%</span>
      </span>
    </li>
  );
}

export default function AiAnalyst({ dataset, idx }: { dataset: Dataset | null; idx: Uint32Array | null }) {
  const [recover, setRecover] = useState(40);
  const a = useMemo(() => (dataset && idx ? analyze(dataset, idx) : null), [dataset, idx]);

  if (!a) {
    return (
      <section className="ai-panel fade-up rounded-[20px] p-5 text-[12.5px] text-muted">
        <span className="ai-badge">✦ AI Analyst</span>
        <p className="mt-2">{dataset ? "Too few orders in this slice to infer anything reliable." : "Warming up the inference engine…"}</p>
      </section>
    );
  }

  const top = a.lossDrivers[0];
  const late = a.lateDrivers[0];
  const rec = (-a.leakValue * recover) / 100;
  const newProfit = a.profit + rec;
  const f = a.forecast;

  return (
    <section className="ai-panel fade-up rounded-[20px] p-4 sm:p-5" aria-label="AI analyst briefing">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="ai-badge">✦ AI Analyst</span>
        <span className="text-[11px] text-muted">
          Re-reasons on every filter · on-device statistical inference · confidence{" "}
          <b className="font-semibold text-ink">{a.confidence}</b> ({a.orders.toLocaleString("en-US")} orders)
        </span>
      </div>

      <p className="text-[14px] leading-[1.55] text-ink sm:text-[15px]">
        Loss-making orders cost <b className="text-[var(--red)]">{money(a.leakValue)}</b> across{" "}
        {a.leakOrders.toLocaleString("en-US")} orders.{" "}
        {top ? (
          <>
            <b>{top.name}</b> ({top.dim.toLowerCase()}) is the biggest outlier — {top.rate.toFixed(0)}% of its orders lose money
            versus {top.baseRate.toFixed(0)}% overall
          </>
        ) : (
          <>
            No segment stands out: the leak is <b>spread evenly</b> (~{a.lossBase.toFixed(0)}% everywhere), which points to
            pricing and discount policy rather than one market or lane
          </>
        )}
        {a.discountLoss && a.discountLoss.hiLossRate > a.discountLoss.loLossRate * 1.2 && (
          <>
            ; orders discounted 20%+ lose money {a.discountLoss.hiLossRate.toFixed(0)}% of the time vs{" "}
            {a.discountLoss.loLossRate.toFixed(0)}% otherwise
          </>
        )}
        .{late && <> On delivery, <b>{late.name}</b> is the weak link at {late.rate.toFixed(0)}% late.</>}
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="ai-cell">
          <h3 className="label-xs mb-2">Why profit leaks — outliers</h3>
          <ul className="space-y-1.5">{a.lossDrivers.length ? a.lossDrivers.map((d) => <DriverRow key={d.dim + d.name} d={d} />) : <li className="text-[12px] text-muted">No material outlier — losses are evenly spread.</li>}</ul>
          <h3 className="label-xs mt-3 mb-2">Why orders run late</h3>
          <ul className="space-y-1.5">{a.lateDrivers.length ? a.lateDrivers.map((d) => <DriverRow key={d.dim + d.name} d={d} />) : <li className="text-[12px] text-muted">No material outlier.</li>}</ul>
        </div>

        <div className="ai-cell">
          <h3 className="label-xs mb-2">Forecast · next 3 months</h3>
          {f ? (
            <>
              <ul className="space-y-1.5 text-[12px]">
                {f.months.map((m, i) => (
                  <li key={m} className="flex justify-between gap-2 tabular-nums">
                    <span className="text-muted">{monthName(m)}</span>
                    <span className="text-ink">
                      <b className="font-semibold">{money(f.sales[i])}</b>{" "}
                      <span className="text-muted">({money(f.salesLow[i])}–{money(f.salesHigh[i])})</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-snug text-muted">
                Sales trend {f.slopeSalesPct >= 0 ? "+" : ""}{f.slopeSalesPct.toFixed(1)}%/mo from the last {f.basis} months
                (R² {f.r2.toFixed(2)}, band = ±1σ). Treat as direction, not a promise.
              </p>
              {f.partial.length > 0 && (
                <p className="mt-1.5 text-[11.5px] text-ink2">
                  ⚑ Excluded {f.partial.map(monthName).join(", ")}: volume far below normal — looks like a data cutoff,
                  not a demand drop.
                </p>
              )}
            </>
          ) : (
            <p className="text-[12px] text-muted">Need ≥ 6 months of data in the slice to forecast.</p>
          )}
          {a.monthlyAnomaly && (
            <p className="mt-2 text-[11.5px] text-ink2">
              ⚑ <b>{monthName(a.monthlyAnomaly.ym)}</b> profit ({money(a.monthlyAnomaly.profit)}) sits{" "}
              {Math.abs(a.monthlyAnomaly.z).toFixed(1)}σ {a.monthlyAnomaly.z < 0 ? "below" : "above"} normal.
            </p>
          )}
        </div>

        <div className="ai-cell">
          <h3 className="label-xs mb-2">What-if: plug the leak</h3>
          <label className="flex items-center justify-between text-[12px] text-ink2" htmlFor="recover">
            Recover <b className="font-semibold text-ink tabular-nums">{recover}%</b> of loss-making orders
          </label>
          <input
            id="recover"
            type="range"
            min={0}
            max={100}
            step={5}
            value={recover}
            onChange={(e) => setRecover(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--brand)]"
          />
          <div className="mt-3 flex items-end justify-between gap-2">
            <div>
              <div className="stat-value text-[22px] text-[var(--mint)]">+{money(rec)}</div>
              <div className="mt-1 text-[11px] text-muted">added profit</div>
            </div>
            <div className="text-right text-[12px] tabular-nums text-ink2">
              profit {money(a.profit)} → <b className="text-ink">{money(newProfit)}</b>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            Illustrative: assumes recovered orders reach break-even.
          </p>
        </div>
      </div>
    </section>
  );
}

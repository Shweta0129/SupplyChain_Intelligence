"use client";

import { usePalette } from "@/components/ui/usePalette";
import { count, dollars, money } from "@/lib/format";
import type { Aggregates } from "@/lib/types";

const TYPES = ["Revenue Leak", "Margin Erosion", "Severe Delay", "ML Anomaly"] as const;
const SEVERITIES = ["High", "Medium", "Low"] as const;

export default function AnomaliesTab({ a }: { a: Aggregates }) {
  const p = usePalette();
  const an = a.anomalies;
  const flagged = Object.values(an.counts).reduce((x, y) => x + y, 0);

  const sevColor: Record<string, string> = {
    High: p.red,
    Medium: p.amber,
    Low: p.brand,
  };

  return (
    <div className="space-y-3">
      <section className="anomaly-panel fade-up rounded-[20px] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold text-ink">Anomaly Detection Engine</h2>
            <p className="mt-1 max-w-2xl text-[12px] text-ink2">
              Rule-based detectors plus an Isolation Forest — revenue leaks, margin
              erosion, severe delays and statistical outliers.
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
            style={{ background: p.mint }}
          >
            {count(flagged)} flagged
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TYPES.map((t) => (
            <div key={t} className="surface rounded-2xl p-4 text-center">
              <div className="stat-value text-[26px] text-ink">
                {count(an.counts[t] ?? 0)}
              </div>
              <div className="label-xs mt-1">{t}</div>
              <div className="mt-0.5 text-[11px] text-muted">
                {t === "Revenue Leak" && an.leakImpact
                  ? `${money(an.leakImpact)} impact`
                  : " "}
              </div>
            </div>
          ))}
        </div>

        {flagged > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SEVERITIES.map((s) => (
              <span
                key={s}
                className="rounded-full px-3 py-1 text-[12px] font-semibold text-white"
                style={{ background: sevColor[s] }}
              >
                {s}: {count(an.severity[s] ?? 0)}
              </span>
            ))}
          </div>
        )}
      </section>

      {an.rows.length ? (
        <div className="surface fade-up overflow-hidden rounded-[20px]">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-[14.5px] font-semibold text-ink">
              50 worst flagged order lines
            </h3>
            <span className="text-[11.5px] text-muted">ranked by sales value</span>
          </div>
          <div className="thin-scroll max-h-[420px] overflow-auto">
            <table className="w-full min-w-[820px] border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-line">
                  {["Date", "Product", "Market", "Ship Mode", "Sales", "Profit", "Delay", "Type", "Severity"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`label-xs px-3 py-2.5 whitespace-nowrap ${
                          i >= 4 && i <= 6 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {an.rows.map((r, i) => (
                  <tr
                    key={`${r.date}-${r.product}-${i}`}
                    className="border-b border-line/60 last:border-0 hover:bg-[var(--chip)]"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted tabular-nums">{r.date}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-ink" title={r.product}>
                      {r.product}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink2">{r.market}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink2">{r.shipMode}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-ink tabular-nums">
                      {dollars(r.sales)}
                    </td>
                    <td
                      className="px-3 py-2 text-right whitespace-nowrap tabular-nums"
                      style={{ color: r.profit < 0 ? p.red : p.ink2 }}
                    >
                      {dollars(r.profit)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-ink2 tabular-nums">
                      {r.delay.toFixed(0)}d
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink2">{r.type}</td>
                    <td
                      className="px-3 py-2 font-bold whitespace-nowrap"
                      style={{ color: sevColor[r.severity] ?? p.muted }}
                    >
                      {r.severity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="surface rounded-[20px] p-8 text-center text-[12.5px] text-muted">
          No anomalies detected for this selection.
        </div>
      )}
    </div>
  );
}

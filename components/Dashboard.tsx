"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FilterBar from "@/components/FilterBar";
import KpiRow from "@/components/KpiRow";
import OverviewTab from "@/components/tabs/OverviewTab";
import DeliveryTab from "@/components/tabs/DeliveryTab";
import ProfitabilityTab from "@/components/tabs/ProfitabilityTab";
import AnomaliesTab from "@/components/tabs/AnomaliesTab";
import GeographyTab from "@/components/tabs/GeographyTab";
import { computeAggregates, loadDataset, selectRows, type Dataset } from "@/lib/dataset";
import { EMPTY_FILTERS, type Aggregates, type Filters, type Meta } from "@/lib/types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "delivery", label: "Delivery" },
  { id: "profitability", label: "Profitability" },
  { id: "anomalies", label: "Anomalies" },
  { id: "geography", label: "Geography" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Dashboard({
  initial,
  meta,
}: {
  initial: Aggregates;
  meta: Meta;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [agg, setAgg] = useState<Aggregates>(initial);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const dsRef = useRef<Dataset | null>(null);

  // The columnar snapshot is only needed to filter. Fetch it after paint so it
  // never delays the numbers that are already in the HTML.
  useEffect(() => {
    let alive = true;
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 400);

    const handle = idle(() => {
      setLoading(true);
      loadDataset(meta)
        .then((ds) => {
          if (!alive) return;
          dsRef.current = ds;
          setDataset(ds);
        })
        .catch(() => alive && setFailed(true))
        .finally(() => alive && setLoading(false));
    });

    return () => {
      alive = false;
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(handle as number);
    };
  }, [meta]);

  const active = useMemo(
    () => Object.values(filters).some((v) => v.length > 0),
    [filters],
  );

  const applyFilters = useCallback(
    (next: Filters) => {
      setFilters(next);
      const ds = dsRef.current;
      if (!ds) return;
      const anyActive = Object.values(next).some((v) => v.length > 0);
      if (!anyActive) {
        // Snap back to the build-time aggregates — same numbers, zero work.
        setAgg(initial);
        return;
      }
      const idx = selectRows(ds, next);
      setAgg(idx.length ? computeAggregates(ds, idx) : { ...initial, kpis: initial.kpis });
      if (!idx.length) setAgg({ ...initial, kpis: initial.kpis });
    },
    [initial],
  );

  const matched = useMemo(() => {
    if (!dataset) return initial.kpis.totalOrders;
    if (!active) return dataset.rows;
    return selectRows(dataset, filters).length;
  }, [dataset, filters, active, initial.kpis.totalOrders]);

  const empty = active && matched === 0;

  return (
    <main className="mx-auto w-full max-w-[1560px] px-3 pt-3 pb-10 sm:px-5 lg:px-8">
      {/* ── top nav ─────────────────────────────────────────────────────── */}
      <nav className="surface fade-up sticky top-2 z-50 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5 text-[15px] font-bold tracking-[-0.01em] text-ink">
          <span
            className="grid h-[30px] w-[30px] place-items-center rounded-[9px] text-[15px]"
            style={{
              background: "linear-gradient(135deg,#2B5FCF,#1E3A8A)",
              boxShadow: "0 4px 12px rgba(43,95,207,.35)",
            }}
            aria-hidden
          >
            📦
          </span>
          Supply Chain <span className="text-brand">Intelligence</span>
        </div>
        <p className="hidden text-[12px] text-muted lg:block">
          DataCo Global · <b className="font-semibold text-ink">2015–2018</b> ·{" "}
          {meta.rows.toLocaleString("en-US")} order lines
        </p>
        <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--mint)", boxShadow: "0 0 0 4px rgba(29,158,117,.16)" }}
            aria-hidden
          />
          Static build · {matched.toLocaleString("en-US")} orders
        </div>
      </nav>

      {/* ── page title ──────────────────────────────────────────────────── */}
      <header className="mb-4 px-1">
        <p className="eyebrow mb-1.5">Control Tower</p>
        <h1 className="text-[27px] leading-none font-bold tracking-[-0.025em] text-ink">
          Procurement &amp; Delivery Analytics
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Where revenue and time leak across the global network ·{" "}
          {agg.kpis.totalOrders.toLocaleString("en-US")} orders{" "}
          {active ? "· filters active" : "· full dataset"}
        </p>
      </header>

      <div className="mb-4">
        <FilterBar
          meta={meta}
          filters={filters}
          onChange={applyFilters}
          ready={!!dataset}
          loading={loading}
          matched={matched}
        />
        {failed && (
          <p className="mt-2 px-1 text-[11px] text-muted">
            The slice engine could not load, so filters are unavailable. Every number
            below is still the full-dataset view.
          </p>
        )}
      </div>

      <div className="mb-4">
        <KpiRow k={agg.kpis} base={initial.kpis} />
      </div>

      {/* ── tabs ────────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Dashboard sections"
        className="mb-3 flex flex-wrap gap-1.5"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`h-10 rounded-xl px-4 font-display text-[13px] font-medium transition-colors ${
              tab === t.id
                ? "surface text-brand"
                : "border border-transparent text-muted hover:bg-card hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="surface rounded-[20px] p-10 text-center">
          <p className="text-[13px] font-semibold text-ink">
            No orders match these filters.
          </p>
          <p className="mt-1 text-[12px] text-muted">
            Clear a selection above to continue.
          </p>
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          className="outline-none"
        >
          {tab === "overview" && <OverviewTab a={agg} />}
          {tab === "delivery" && <DeliveryTab a={agg} />}
          {tab === "profitability" && <ProfitabilityTab a={agg} />}
          {tab === "anomalies" && <AnomaliesTab a={agg} />}
          {tab === "geography" && <GeographyTab a={agg} />}
        </div>
      )}

      <footer className="mt-8 text-center text-[12px] text-muted">
        Supply Chain Intelligence · built by{" "}
        <strong className="font-semibold text-ink">Shweta Pasi</strong> · data: DataCo
        Smart Supply Chain (Kaggle) ·{" "}
        <a
          className="text-brand hover:underline"
          href="https://github.com/Shweta0129"
          target="_blank"
          rel="noreferrer"
        >
          github.com/Shweta0129
        </a>{" "}
        ·{" "}
        <a
          className="text-brand hover:underline"
          href="https://linkedin.com/in/shweta-pasi"
          target="_blank"
          rel="noreferrer"
        >
          linkedin.com/in/shweta-pasi
        </a>
      </footer>
    </main>
  );
}

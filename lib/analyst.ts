/**
 * "AI Analyst" — on-device statistical inference over the *currently filtered*
 * slice. No API key, no network call, no LLM: every claim below is computed
 * from the rows, so it re-reasons instantly whenever a filter changes.
 *
 *  1. Driver analysis  — which segments produce more loss-making / late orders
 *                        than their volume would predict ("excess" ranking).
 *  2. Forecast         — OLS trend on the last 12 months, with a ±1σ band.
 *  3. Recovery model   — what the leak is worth if X% of it is plugged.
 */
import type { Dataset } from "./dataset";

export type Driver = {
  dim: string;
  name: string;
  orders: number;
  rate: number; // % of that group's orders that are loss-making / late
  baseRate: number; // % across the whole slice
  excess: number; // orders above what the base rate predicts
  kind: "loss" | "late";
};

export type Forecast = {
  months: string[];
  sales: number[];
  profit: number[];
  salesLow: number[];
  salesHigh: number[];
  slopeSalesPct: number; // monthly drift as % of mean
  slopeProfitPct: number;
  r2: number;
  basis: number; // months used
  partial: string[]; // trailing months excluded as incomplete
};

export type Analysis = {
  orders: number;
  leakOrders: number;
  leakValue: number; // negative number
  lossBase: number; // % of orders that lose money
  profit: number;
  sales: number;
  lossDrivers: Driver[];
  lateDrivers: Driver[];
  discountLoss: { hiShare: number; hiLossRate: number; loLossRate: number } | null;
  forecast: Forecast | null;
  monthlyAnomaly: { ym: string; z: number; profit: number } | null;
  confidence: "High" | "Medium" | "Low";
};

const DIMS: { key: "market" | "segment" | "shipMode" | "dept" | "region"; label: string }[] = [
  { key: "market", label: "Market" },
  { key: "segment", label: "Segment" },
  { key: "shipMode", label: "Ship mode" },
  { key: "dept", label: "Department" },
  { key: "region", label: "Region" },
];

function drivers(
  ds: Dataset,
  idx: Uint32Array,
  flag: (r: number) => boolean,
  kind: "loss" | "late",
): Driver[] {
  let total = 0;
  for (let i = 0; i < idx.length; i++) if (flag(idx[i])) total++;
  const base = total / idx.length;
  const minN = Math.max(30, idx.length * 0.01); // ignore thin groups
  const out: Driver[] = [];

  for (const { key, label } of DIMS) {
    const dict = ds.meta.dims[key];
    const col = ds[key];
    const n = new Float64Array(dict.length);
    const hit = new Float64Array(dict.length);
    for (let i = 0; i < idx.length; i++) {
      const r = idx[i];
      n[col[r]]++;
      if (flag(r)) hit[col[r]]++;
    }
    for (let g = 0; g < dict.length; g++) {
      if (n[g] < minN) continue;
      const rate = hit[g] / n[g];
      const excess = hit[g] - base * n[g];
      // Material only: ≥15% relative lift AND ≥2pp absolute — otherwise it is noise.
      if (excess > 0 && rate > base * 1.15 && rate - base > 0.02)
        out.push({
          dim: label,
          name: dict[g].trim(),
          orders: n[g],
          rate: rate * 100,
          baseRate: base * 100,
          excess,
          kind,
        });
    }
  }
  return out.sort((a, b) => b.excess - a.excess).slice(0, 3);
}

function forecastFrom(ds: Dataset, idx: Uint32Array): { f: Forecast | null; anomaly: Analysis["monthlyAnomaly"] } {
  const labels = ds.ymLabels;
  const sales = new Float64Array(labels.length);
  const profit = new Float64Array(labels.length);
  const cnt = new Float64Array(labels.length);
  for (let i = 0; i < idx.length; i++) {
    const r = idx[i];
    sales[ds.ym[r]] += ds.sales[r];
    profit[ds.ym[r]] += ds.profit[r];
    cnt[ds.ym[r]]++;
  }
  const order = labels.map((l, i) => ({ l, i })).filter((o) => cnt[o.i] > 0).sort((a, b) => a.l.localeCompare(b.l));
  // A month with far fewer orders than the typical month is a data cutoff, not
  // a demand collapse — forecasting through it would fake a downtrend.
  const counts = order.map((o) => cnt[o.i]).sort((a, b) => a - b);
  const medCount = counts[counts.length >> 1];
  const full = order.map((o) => cnt[o.i] >= medCount * 0.7);
  let end = full.length;
  while (end > 0 && !full[end - 1]) end--;
  const partial = order.slice(end).map((o) => o.l);
  const ser = order.slice(0, end).map((o) => ({ ym: o.l, s: sales[o.i], p: profit[o.i] }));
  if (ser.length < 6) return { f: null, anomaly: null };

  // Anomalous month: biggest |z| of monthly profit vs the series itself.
  const pm = ser.reduce((a, b) => a + b.p, 0) / ser.length;
  const psd = Math.sqrt(ser.reduce((a, b) => a + (b.p - pm) ** 2, 0) / (ser.length - 1)) || 1;
  const worst = ser.reduce((a, b) => (Math.abs(b.p - pm) > Math.abs(a.p - pm) ? b : a));
  const z = (worst.p - pm) / psd;
  const anomaly = Math.abs(z) >= 2 ? { ym: worst.ym, z, profit: worst.p } : null;

  const win = ser.slice(-12);
  const n = win.length;
  const xs = win.map((_, i) => i);
  const fit = (ys: number[]) => {
    const mx = (n - 1) / 2;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) ** 2;
      syy += (ys[i] - my) ** 2;
    }
    const slope = sxy / sxx;
    const icpt = my - slope * mx;
    let sse = 0;
    for (let i = 0; i < n; i++) sse += (ys[i] - (icpt + slope * xs[i])) ** 2;
    return { slope, icpt, my, sd: Math.sqrt(sse / Math.max(1, n - 2)), r2: syy ? 1 - sse / syy : 0 };
  };
  const fs = fit(win.map((w) => w.s));
  const fp = fit(win.map((w) => w.p));

  const [y, m] = win[n - 1].ym.split("-").map(Number);
  const months: string[] = [];
  for (let k = 1; k <= 3; k++) {
    const d = new Date(Date.UTC(y, m - 1 + k, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const at = (f: typeof fs, k: number) => Math.max(0, f.icpt + f.slope * (n - 1 + k));
  return {
    anomaly,
    f: {
      months,
      sales: [1, 2, 3].map((k) => at(fs, k)),
      profit: [1, 2, 3].map((k) => f_(fp, k, n)),
      salesLow: [1, 2, 3].map((k) => Math.max(0, at(fs, k) - fs.sd)),
      salesHigh: [1, 2, 3].map((k) => at(fs, k) + fs.sd),
      slopeSalesPct: fs.my ? (fs.slope / fs.my) * 100 : 0,
      slopeProfitPct: fp.my ? (fp.slope / Math.abs(fp.my)) * 100 : 0,
      r2: fs.r2,
      basis: n,
      partial,
    },
  };
}
const f_ = (f: { icpt: number; slope: number }, k: number, n: number) => f.icpt + f.slope * (n - 1 + k);

export function analyze(ds: Dataset, idx: Uint32Array): Analysis | null {
  if (idx.length < 50) return null;

  let sales = 0, profit = 0, leakOrders = 0, leakValue = 0;
  let hi = 0, hiLoss = 0, lo = 0, loLoss = 0;
  for (let i = 0; i < idx.length; i++) {
    const r = idx[i];
    sales += ds.sales[r];
    profit += ds.profit[r];
    const loss = ds.profit[r] < 0;
    if (loss) { leakOrders++; leakValue += ds.profit[r]; }
    if (ds.discount[r] > 0.2) { hi++; if (loss) hiLoss++; } else { lo++; if (loss) loLoss++; }
  }

  const { f, anomaly } = forecastFrom(ds, idx);
  const n = idx.length;
  return {
    orders: n,
    leakOrders,
    leakValue,
    lossBase: (leakOrders / idx.length) * 100,
    profit,
    sales,
    lossDrivers: drivers(ds, idx, (r) => ds.profit[r] < 0, "loss"),
    lateDrivers: drivers(ds, idx, (r) => ds.late[r] === 1, "late"),
    discountLoss: hi && lo ? { hiShare: (hi / n) * 100, hiLossRate: (hiLoss / hi) * 100, loLossRate: (loLoss / lo) * 100 } : null,
    forecast: f,
    monthlyAnomaly: anomaly,
    confidence: n > 20000 ? "High" : n > 2000 ? "Medium" : "Low",
  };
}

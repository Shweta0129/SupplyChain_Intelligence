/**
 * Client-side aggregation over the columnar snapshot.
 *
 * `public/data/dataset.bin` is a gzipped, dictionary-encoded, columnar dump of
 * all 180,519 order lines (~16 bytes/row). It loads once in the background;
 * after that every filter change is a single linear scan over typed arrays —
 * a few milliseconds, no network, no server.
 *
 * Every function here is a deliberate mirror of `scripts/aggregate.py`. The
 * unfiltered output of `computeAggregates` must equal the committed
 * `aggregates.json` byte for byte on the numbers; `npm run verify` asserts it.
 */

import type {
  Aggregates,
  AnomalyRow,
  Filters,
  Insight,
  Meta,
  TreemapNode,
} from "./types";

export type Dataset = {
  meta: Meta;
  rows: number;
  date: Uint16Array;
  market: Uint8Array;
  segment: Uint8Array;
  shipMode: Uint8Array;
  dept: Uint8Array;
  status: Uint8Array;
  delivery: Uint8Array;
  category: Uint8Array;
  region: Uint8Array;
  country: Uint16Array;
  product: Uint8Array;
  /** Per-row measure values, already de-referenced from their dictionaries. */
  sales: Float64Array;
  ratio: Float64Array;
  discount: Float64Array;
  profit: Float64Array;
  delay: Int8Array;
  ml: Uint8Array;
  /** Derived per row so we do not recompute them on every scan. */
  year: Uint16Array;
  ym: Uint8Array;
  ymLabels: string[];
  band: Uint8Array;
  late: Uint8Array;
};

const DTYPE_BYTES = { u8: 1, u16: 2, i8: 1 } as const;

async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buf])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

export async function loadDataset(meta: Meta): Promise<Dataset> {
  const res = await fetch("/data/dataset.bin");
  if (!res.ok) throw new Error(`dataset.bin: ${res.status}`);
  const raw = await gunzip(await res.arrayBuffer());

  let off = 0;
  // Head of the blob: the four float32 measure dictionaries, in meta order.
  const dicts: Record<string, Float32Array> = {};
  for (const m of meta.measures) {
    dicts[m.name] = new Float32Array(raw.slice(off, off + m.length * 4));
    off += m.length * 4;
  }

  const n = meta.rows;
  const cols: Record<string, Uint8Array | Uint16Array | Int8Array> = {};
  for (const { name, dtype } of meta.layout) {
    const bytes = n * DTYPE_BYTES[dtype];
    const slice = raw.slice(off, off + bytes);
    cols[name] =
      dtype === "u16"
        ? new Uint16Array(slice)
        : dtype === "i8"
          ? new Int8Array(slice)
          : new Uint8Array(slice);
    off += bytes;
  }

  // De-reference the measure dictionaries once, into float64 working arrays.
  const deref = (codes: ArrayLike<number>, dict: Float32Array) => {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = dict[codes[i]];
    return out;
  };
  const sales = deref(cols.sales, dicts.sales);
  const ratio = deref(cols.ratio, dicts.ratio);
  const discount = deref(cols.discount, dicts.discount);
  const profit = deref(cols.profit, dicts.profit);

  // Derived columns.
  const epoch = Date.parse(`${meta.epoch}T00:00:00Z`);
  const dateCol = cols.date as Uint16Array;
  const year = new Uint16Array(n);
  const ym = new Uint8Array(n);
  const ymIndex = new Map<string, number>();
  const ymLabels: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(epoch + dateCol[i] * 86400000);
    const y = d.getUTCFullYear();
    year[i] = y;
    const key = `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    let idx = ymIndex.get(key);
    if (idx === undefined) {
      idx = ymLabels.length;
      ymIndex.set(key, idx);
      ymLabels.push(key);
    }
    ym[i] = idx;
  }

  const edges = meta.bands.edges;
  const band = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = sales[i];
    let b = 0;
    // pd.cut is right-closed: (lo, hi]
    while (b < edges.length - 2 && v > edges[b + 1]) b++;
    band[i] = b;
  }

  const lateIdx = meta.dims.delivery.indexOf("Late delivery");
  const deliveryCol = cols.delivery as Uint8Array;
  const late = new Uint8Array(n);
  for (let i = 0; i < n; i++) late[i] = deliveryCol[i] === lateIdx ? 1 : 0;

  return {
    meta,
    rows: n,
    date: dateCol,
    market: cols.market as Uint8Array,
    segment: cols.segment as Uint8Array,
    shipMode: cols.shipMode as Uint8Array,
    dept: cols.dept as Uint8Array,
    status: cols.status as Uint8Array,
    delivery: deliveryCol,
    category: cols.category as Uint8Array,
    region: cols.region as Uint8Array,
    country: cols.country as Uint16Array,
    product: cols.product as Uint8Array,
    sales,
    ratio,
    discount,
    profit,
    delay: cols.delay as Int8Array,
    ml: cols.ml as Uint8Array,
    year,
    ym,
    ymLabels,
    band,
    late,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtering
// ─────────────────────────────────────────────────────────────────────────────
function codeSet(dict: string[], selected: string[]): Set<number> | null {
  if (!selected.length) return null;
  const wanted = new Set(selected);
  const out = new Set<number>();
  dict.forEach((v, i) => {
    if (wanted.has(v)) out.add(i);
  });
  return out;
}

export function selectRows(ds: Dataset, f: Filters): Uint32Array {
  const d = ds.meta.dims;
  const market = codeSet(d.market, f.market);
  const segment = codeSet(d.segment, f.segment);
  const shipMode = codeSet(d.shipMode, f.shipMode);
  const dept = codeSet(d.dept, f.dept);
  const status = codeSet(d.status, f.status);
  const years = f.year.length ? new Set(f.year.map(Number)) : null;

  const out = new Uint32Array(ds.rows);
  let k = 0;
  for (let i = 0; i < ds.rows; i++) {
    if (market && !market.has(ds.market[i])) continue;
    if (segment && !segment.has(ds.segment[i])) continue;
    if (shipMode && !shipMode.has(ds.shipMode[i])) continue;
    if (dept && !dept.has(ds.dept[i])) continue;
    if (status && !status.has(ds.status[i])) continue;
    if (years && !years.has(ds.year[i])) continue;
    out[k++] = i;
  }
  return out.subarray(0, k);
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping primitives
// ─────────────────────────────────────────────────────────────────────────────
type Acc = { sum: number; n: number };

function groupSum(
  idx: Uint32Array,
  key: ArrayLike<number>,
  value: ArrayLike<number>,
  size: number,
): Float64Array {
  const out = new Float64Array(size);
  for (let i = 0; i < idx.length; i++) out[key[idx[i]]] += value[idx[i]];
  return out;
}

function groupCount(
  idx: Uint32Array,
  key: ArrayLike<number>,
  size: number,
): Float64Array {
  const out = new Float64Array(size);
  for (let i = 0; i < idx.length; i++) out[key[idx[i]]] += 1;
  return out;
}

function groupMean(
  idx: Uint32Array,
  key: ArrayLike<number>,
  value: ArrayLike<number>,
  size: number,
): Acc[] {
  const out: Acc[] = Array.from({ length: size }, () => ({ sum: 0, n: 0 }));
  for (let i = 0; i < idx.length; i++) {
    const r = idx[i];
    const a = out[key[r]];
    a.sum += value[r];
    a.n += 1;
  }
  return out;
}

/** Pair a dictionary with a value array, dropping groups with no rows. */
function pairs(
  dict: string[],
  values: ArrayLike<number>,
  present?: ArrayLike<number>,
): { name: string; value: number }[] {
  const out: { name: string; value: number }[] = [];
  for (let i = 0; i < dict.length; i++) {
    if (present && !present[i]) continue;
    out.push({ name: dict[i], value: values[i] });
  }
  return out;
}

type NV = { name: string; value: number };
const byValueAsc = (a: NV, b: NV) =>
  a.value - b.value || a.name.localeCompare(b.name);
const byValueDesc = (a: NV, b: NV) =>
  b.value - a.value || a.name.localeCompare(b.name);

const rename = <K extends string>(
  arr: { name: string; value: number }[],
  key: K,
) => arr.map((r) => ({ name: r.name, [key]: r.value }) as { name: string } & Record<K, number>);

// ─────────────────────────────────────────────────────────────────────────────
// Insights — mirrors src/transform.generate_insights
// ─────────────────────────────────────────────────────────────────────────────
function fmtMoney(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3).toLocaleString("en-US")}K`;
  return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function buildInsights(ds: Dataset, idx: Uint32Array): Insight[] {
  const d = ds.meta.dims;
  const out: Insight[] = [];
  if (!idx.length) return out;

  const marketSales = groupSum(idx, ds.market, ds.sales, d.market.length);
  const totalMarket = marketSales.reduce((a, b) => a + b, 0);
  let topMarket = 0;
  for (let i = 1; i < marketSales.length; i++)
    if (marketSales[i] > marketSales[topMarket]) topMarket = i;
  out.push({
    tone: "brand",
    label: "Largest market",
    text: `<b>${d.market[topMarket]}</b> drives ${fmtMoney(marketSales[topMarket])} — ${Math.round((marketSales[topMarket] / totalMarket) * 100)}% of all revenue.`,
  });

  let lossN = 0;
  let lossSum = 0;
  for (let i = 0; i < idx.length; i++) {
    const p = ds.profit[idx[i]];
    if (p < 0) {
      lossN++;
      lossSum += p;
    }
  }
  if (lossN) {
    out.push({
      tone: "red",
      label: "Profit leak",
      text: `<b>${lossN.toLocaleString("en-US")}</b> orders (${Math.round((lossN / idx.length) * 100)}%) sell at a loss, bleeding ${fmtMoney(lossSum)}.`,
    });
  }

  const lateMode = groupMean(idx, ds.shipMode, ds.late, d.shipMode.length);
  let worst = -1;
  let worstV = -Infinity;
  lateMode.forEach((a, i) => {
    if (a.n && (a.sum / a.n) * 100 > worstV) {
      worstV = (a.sum / a.n) * 100;
      worst = i;
    }
  });
  if (worst >= 0) {
    out.push({
      tone: "amber",
      label: "Delivery risk",
      text: `<b>${d.shipMode[worst]}</b> is late ${Math.round(worstV)}% of the time — the weakest lane.`,
    });
  }

  const catMargin = groupMean(idx, ds.category, ds.ratio, d.category.length);
  const catSales = groupSum(idx, ds.category, ds.sales, d.category.length);
  const liveCats = catMargin
    .map((a, i) => ({ i, m: a.n ? (a.sum / a.n) * 100 : NaN, s: catSales[i], n: a.n }))
    .filter((c) => c.n > 0);
  if (liveCats.length) {
    const med = median(liveCats.map((c) => c.s));
    const big = liveCats.filter((c) => c.s > med);
    if (big.length) {
      const best = big.reduce((a, b) => (b.m > a.m ? b : a));
      out.push({
        tone: "mint",
        label: "Margin leader",
        text: `<b>${d.category[best.i]}</b> returns the best margin at ${best.m.toFixed(1)}%.`,
      });
    }
  }

  let lateSum = 0;
  for (let i = 0; i < idx.length; i++) lateSum += ds.late[idx[i]];
  const onTime = (1 - lateSum / idx.length) * 100;
  out.push({
    tone: onTime >= 55 ? "mint" : onTime >= 45 ? "amber" : "red",
    label: "On-time delivery",
    text: `<b>${Math.round(onTime)}%</b> of orders arrive on schedule across the network.`,
  });

  let hiN = 0;
  let hiMarginSum = 0;
  for (let i = 0; i < idx.length; i++) {
    const r = idx[i];
    if (ds.discount[r] > 0.2) {
      hiN++;
      hiMarginSum += ds.ratio[r] * 100;
    }
  }
  if (hiN) {
    out.push({
      tone: "brand",
      label: "Discount pressure",
      text: `<b>${Math.round((hiN / idx.length) * 100)}%</b> of orders carry 20%+ discounts, averaging ${Math.round(hiMarginSum / hiN)}% margin.`,
    });
  }

  return out.slice(0, 6);
}

// ─────────────────────────────────────────────────────────────────────────────
// Anomalies — mirrors src/anomaly.run_detectors
// ─────────────────────────────────────────────────────────────────────────────
function severityFromSales(x: number): string {
  if (x > 5000) return "High";
  if (x > 1000) return "Medium";
  return "Low";
}

function buildAnomalies(ds: Dataset, idx: Uint32Array) {
  const empty = { counts: {}, severity: {}, leakImpact: 0, rows: [] as AnomalyRow[] };
  if (!idx.length) return empty;

  // Severe Delay uses the *filtered* mean + 2.5σ, exactly as the original does.
  let sum = 0;
  for (let i = 0; i < idx.length; i++) sum += ds.delay[idx[i]];
  const mean = sum / idx.length;
  let sq = 0;
  for (let i = 0; i < idx.length; i++) {
    const d = ds.delay[idx[i]] - mean;
    sq += d * d;
  }
  const std = idx.length > 1 ? Math.sqrt(sq / (idx.length - 1)) : 0;
  const delayCut = mean + 2.5 * std;

  // Priority order matters: a row that trips several detectors keeps the first.
  const tagged = new Map<number, { type: string; severity: string }>();
  const tag = (r: number, type: string, severity: string) => {
    if (!tagged.has(r)) tagged.set(r, { type, severity });
  };

  for (let i = 0; i < idx.length; i++) {
    const r = idx[i];
    if (ds.sales[r] > 1000 && ds.profit[r] < 0)
      tag(r, "Revenue Leak", severityFromSales(ds.sales[r]));
  }
  for (let i = 0; i < idx.length; i++) {
    const r = idx[i];
    if (ds.discount[r] > 0.35 && ds.ratio[r] * 100 < 0)
      tag(r, "Margin Erosion", "High");
  }
  if (std > 0) {
    for (let i = 0; i < idx.length; i++) {
      const r = idx[i];
      if (ds.delay[r] > delayCut) tag(r, "Severe Delay", "Medium");
    }
  }
  for (let i = 0; i < idx.length; i++) {
    const r = idx[i];
    if (ds.ml[r]) tag(r, "ML Anomaly", severityFromSales(ds.sales[r]));
  }

  const counts: Record<string, number> = {};
  const severity: Record<string, number> = {};
  let leakImpact = 0;
  for (const [r, t] of tagged) {
    counts[t.type] = (counts[t.type] ?? 0) + 1;
    severity[t.severity] = (severity[t.severity] ?? 0) + 1;
    if (t.type === "Revenue Leak") leakImpact += ds.profit[r];
  }

  const epoch = Date.parse(`${ds.meta.epoch}T00:00:00Z`);
  const top = [...tagged.entries()]
    .sort((a, b) => ds.sales[b[0]] - ds.sales[a[0]] || a[0] - b[0])
    .slice(0, 50)
    .map(([r, t]): AnomalyRow => ({
      date: new Date(epoch + ds.date[r] * 86400000).toISOString().slice(0, 10),
      product: ds.meta.dims.product[ds.product[r]],
      market: ds.meta.dims.market[ds.market[r]],
      shipMode: ds.meta.dims.shipMode[ds.shipMode[r]],
      sales: ds.sales[r],
      profit: ds.profit[r],
      delay: ds.delay[r],
      type: t.type,
      severity: t.severity,
    }));

  return { counts, severity, leakImpact, rows: top };
}

// ─────────────────────────────────────────────────────────────────────────────
// The full aggregate bundle
// ─────────────────────────────────────────────────────────────────────────────
export function computeAggregates(ds: Dataset, idx: Uint32Array): Aggregates {
  const d = ds.meta.dims;
  const n = idx.length;

  let totalSales = 0;
  let totalProfit = 0;
  let marginSum = 0;
  let lateSum = 0;
  let delaySum = 0;
  for (let i = 0; i < n; i++) {
    const r = idx[i];
    totalSales += ds.sales[r];
    totalProfit += ds.profit[r];
    marginSum += ds.ratio[r] * 100;
    lateSum += ds.late[r];
    delaySum += ds.delay[r];
  }
  const lateRate = (lateSum / n) * 100;

  const kpis = {
    totalSales,
    totalProfit,
    totalOrders: n,
    avgOrder: totalSales / n,
    avgMargin: marginSum / n,
    lateRate,
    onTime: 100 - lateRate,
    avgDelay: delaySum / n,
  };

  // ── Overview ───────────────────────────────────────────────────────────────
  const marketCounts = groupCount(idx, ds.market, d.market.length);
  const revenueByMarket = rename(
    pairs(d.market, groupSum(idx, ds.market, ds.sales, d.market.length), marketCounts).sort(byValueAsc),
    "sales",
  );

  const ymSales = groupSum(idx, ds.ym, ds.sales, ds.ymLabels.length);
  const ymProfit = groupSum(idx, ds.ym, ds.profit, ds.ymLabels.length);
  const ymCounts = groupCount(idx, ds.ym, ds.ymLabels.length);
  const trend = ds.ymLabels
    .map((ym, i) => ({ ym, sales: ymSales[i], profit: ymProfit[i], n: ymCounts[i] }))
    .filter((t) => t.n > 0)
    .sort((a, b) => a.ym.localeCompare(b.ym))
    .map(({ ym, sales, profit }) => ({ ym, sales, profit }));

  const statusCounts = groupCount(idx, ds.status, d.status.length);
  const orderStatus = pairs(d.status, statusCounts, statusCounts)
    .sort(byValueDesc)
    .map((r) => ({ name: r.name, count: r.value }));

  const catSales = groupSum(idx, ds.category, ds.sales, d.category.length);
  const catCounts = groupCount(idx, ds.category, d.category.length);
  const topCategories = rename(
    pairs(d.category, catSales, catCounts).sort(byValueAsc).slice(-10),
    "sales",
  );

  const segCounts = groupCount(idx, ds.segment, d.segment.length);
  const revenueBySegment = rename(
    pairs(d.segment, groupSum(idx, ds.segment, ds.sales, d.segment.length), segCounts).sort(byValueDesc),
    "sales",
  );

  // ── Delivery ───────────────────────────────────────────────────────────────
  const lateMode = groupMean(idx, ds.shipMode, ds.late, d.shipMode.length);
  const lateByShipMode = rename(
    d.shipMode
      .map((name, i) => ({ name, value: (lateMode[i].sum / lateMode[i].n) * 100, n: lateMode[i].n }))
      .filter((r) => r.n > 0)
      .sort(byValueDesc),
    "pct",
  );

  const deliveryCounts = groupCount(idx, ds.delivery, d.delivery.length);
  const deliveryStatus = pairs(d.delivery, deliveryCounts, deliveryCounts)
    .sort(byValueDesc)
    .map((r) => ({ name: r.name, count: r.value }));

  const hist = new Array(13).fill(0);
  for (let i = 0; i < n; i++) {
    const v = Math.min(8, Math.max(-4, ds.delay[idx[i]]));
    hist[v + 4] += 1;
  }
  const delayHistogram = hist.map((count, i) => ({ days: i - 4, count }));

  const lateMarket = groupMean(idx, ds.market, ds.late, d.market.length);
  const lateByMarket = rename(
    d.market
      .map((name, i) => ({ name, value: (lateMarket[i].sum / lateMarket[i].n) * 100, n: lateMarket[i].n }))
      .filter((r) => r.n > 0)
      .sort(byValueAsc),
    "pct",
  );

  // ── Profitability ──────────────────────────────────────────────────────────
  const profitByMarket = rename(
    pairs(d.market, groupSum(idx, ds.market, ds.profit, d.market.length), marketCounts).sort(byValueAsc),
    "profit",
  );

  const catMargin = groupMean(idx, ds.category, ds.ratio, d.category.length);
  const marginSorted = d.category
    .map((name, i) => ({ name, value: (catMargin[i].sum / catMargin[i].n) * 100, n: catMargin[i].n }))
    .filter((r) => r.n > 0)
    .sort(byValueAsc);
  // pandas: pd.concat([cm.head(6), cm.tail(6)]) — worst six, then best six.
  const marginByCategory = rename(
    [...marginSorted.slice(0, 6), ...marginSorted.slice(-6)],
    "margin",
  );

  // A density device, not a statistic: an even stride keeps the shape and is
  // deterministic (pandas' random_state=1 sample is not reproducible in JS).
  const target = Math.min(4000, n);
  const stride = Math.max(1, Math.floor(n / target));
  const discountVsProfit = [];
  for (let i = 0; i < n && discountVsProfit.length < target; i += stride) {
    const r = idx[i];
    discountVsProfit.push({
      d: ds.discount[r] * 100,
      p: ds.profit[r],
      m: ds.ratio[r] * 100,
    });
  }

  const prodProfit = groupSum(idx, ds.product, ds.profit, d.product.length);
  const prodCounts = groupCount(idx, ds.product, d.product.length);
  const lossMakingProducts = rename(
    pairs(d.product, prodProfit, prodCounts)
      .sort(byValueAsc)
      .slice(0, 10)
      .filter((r) => r.value < 0),
    "profit",
  );

  // ── Geography ──────────────────────────────────────────────────────────────
  const treemap = buildTreemap(ds, idx);

  const countryCounts = groupCount(idx, ds.country, d.country.length);
  const topCountries = pairs(d.country, countryCounts, countryCounts)
    .sort(byValueDesc)
    .slice(0, 10)
    .sort(byValueAsc)
    .map((r) => ({ name: r.name, count: r.value }));

  const bandLabels = ds.meta.bands.labels;
  const bandCounts = groupCount(idx, ds.band, bandLabels.length);
  const revenueBands = bandLabels
    .map((name, i) => ({ name, count: bandCounts[i] }))
    .filter((r) => r.count > 0);

  const regionSales = groupSum(idx, ds.region, ds.sales, d.region.length);
  const regionProfit = groupSum(idx, ds.region, ds.profit, d.region.length);
  const regionCounts = groupCount(idx, ds.region, d.region.length);
  const salesProfitByRegion = d.region
    .map((name, i) => ({ name, sales: regionSales[i], profit: regionProfit[i], n: regionCounts[i] }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name))
    .slice(0, 12)
    .sort((a, b) => a.sales - b.sales || a.name.localeCompare(b.name))
    .map(({ name, sales, profit }) => ({ name, sales, profit }));

  return {
    kpis,
    insights: buildInsights(ds, idx),
    revenueByMarket,
    trend,
    orderStatus,
    topCategories,
    revenueBySegment,
    lateByShipMode,
    deliveryStatus,
    delayHistogram,
    lateByMarket,
    profitByMarket,
    marginByCategory,
    discountVsProfit,
    lossMakingProducts,
    anomalies: buildAnomalies(ds, idx),
    treemap,
    topCountries,
    revenueBands,
    salesProfitByRegion,
  };
}

function buildTreemap(ds: Dataset, idx: Uint32Array): TreemapNode[] {
  const d = ds.meta.dims;
  const markets = new Map<number, Map<number, Map<number, number>>>();
  for (let i = 0; i < idx.length; i++) {
    const r = idx[i];
    let m = markets.get(ds.market[r]);
    if (!m) markets.set(ds.market[r], (m = new Map()));
    let g = m.get(ds.region[r]);
    if (!g) m.set(ds.region[r], (g = new Map()));
    g.set(ds.segment[r], (g.get(ds.segment[r]) ?? 0) + ds.sales[r]);
  }

  const out: TreemapNode[] = [];
  for (const [mi, regions] of markets) {
    const regionNodes: TreemapNode[] = [];
    let marketSales = 0;
    for (const [ri, segs] of regions) {
      const segNodes: TreemapNode[] = [];
      let regionSales = 0;
      for (const [si, v] of segs) {
        segNodes.push({ name: d.segment[si], sales: v });
        regionSales += v;
      }
      segNodes.sort((a, b) => b.sales - a.sales);
      regionNodes.push({ name: d.region[ri], sales: regionSales, children: segNodes });
      marketSales += regionSales;
    }
    regionNodes.sort((a, b) => b.sales - a.sales);
    out.push({ name: d.market[mi], sales: marketSales, children: regionNodes });
  }
  out.sort((a, b) => b.sales - a.sales);
  return out;
}

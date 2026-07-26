"""Build-time aggregation for the Next.js port of Supply Chain Intelligence.

Reads the gzipped DataCo export once, at build time, and emits three artefacts
into `public/data/`:

  meta.json        dictionaries (markets, products, countries, …), the binary
                   column layout, the ML-anomaly row index, and dataset stats.
  aggregates.json  every chart on the dashboard, precomputed for the unfiltered
                   dataset. This is what the page server-renders, so the first
                   paint needs no computation at all.
  dataset.bin      a gzipped, dictionary-encoded, columnar snapshot of all
                   180,519 order lines (~16 bytes/row). Loaded lazily in the
                   background; it is what makes the six sidebar filters work
                   client-side without a server round-trip.

The raw 18 MB CSV never reaches the browser and nothing is aggregated per
request — the original Streamlit app's ~26 s cold start becomes a static load.

Run:  python scripts/aggregate.py       (or: npm run aggregate)
"""

from __future__ import annotations

import gzip
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SOURCE_CANDIDATES = [
    ROOT / "data" / "DataCoSupplyChainDataset.csv",
    ROOT / "data" / "DataCoSupplyChainDataset.csv.gz",
]
OUT_DIR = ROOT / "public" / "data"

EPOCH = pd.Timestamp("2015-01-01")

# Mirrors src/transform.py so the ported numbers stay identical.
DATE_CANDIDATES = [
    "Order Date (DateOrders)",
    "order date (DateOrders)",
    "order date (DateOrders) ",
]
NUMERIC_COLS = [
    "Sales",
    "Order Profit Per Order",
    "Order Item Profit Ratio",
    "Order Item Discount Rate",
    "Days for shipping (real)",
    "Days for shipment (scheduled)",
    "Late_delivery_risk",
    "Order Item Quantity",
]
BAND_EDGES = [0, 100, 500, 1000, 5000, 9999999]
BAND_LABELS = ["<$100", "$100–500", "$500–1K", "$1K–5K", "$5K+"]


# ──────────────────────────────────────────────────────────────────────────────
# Load + clean  (a faithful port of src/loader.py + src/transform.py)
# ──────────────────────────────────────────────────────────────────────────────
def load() -> pd.DataFrame:
    src = next((p for p in SOURCE_CANDIDATES if p.exists()), None)
    if src is None:
        raise SystemExit(
            "Dataset not found. Expected data/DataCoSupplyChainDataset.csv[.gz]"
        )
    print(f"reading {src.name} …")
    try:
        return pd.read_csv(src, encoding="latin-1", low_memory=False)
    except Exception:
        return pd.read_csv(src, encoding="utf-8", low_memory=False)


def find_date_column(df: pd.DataFrame) -> str | None:
    for cand in DATE_CANDIDATES:
        if cand in df.columns:
            return cand
    for col in df.columns:
        if "order date" in col.lower():
            return col
    return None


def clean_and_engineer(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    date_col = find_date_column(df)
    df["order_date"] = (
        pd.to_datetime(df[date_col], errors="coerce", dayfirst=False)
        if date_col
        else pd.NaT
    )

    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["Sales", "order_date"])
    df = df[df["Sales"] > 0]

    df["shipping_delay"] = (
        df["Days for shipping (real)"] - df["Days for shipment (scheduled)"]
    )
    df["profit_margin_pct"] = df["Order Item Profit Ratio"] * 100
    df["order_year"] = df["order_date"].dt.year
    df["order_yearmonth"] = df["order_date"].dt.to_period("M").astype(str)
    df["revenue_band"] = pd.cut(df["Sales"], bins=BAND_EDGES, labels=BAND_LABELS)

    return df.reset_index(drop=True)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
def num(v) -> float | None:
    """JSON-safe float (NaN/inf are not valid JSON)."""
    if v is None:
        return None
    f = float(v)
    return None if (math.isnan(f) or math.isinf(f)) else f


def money(v: float) -> str:
    a = abs(v)
    sign = "-" if v < 0 else ""
    if a >= 1e6:
        return f"{sign}${a / 1e6:.1f}M"
    if a >= 1e3:
        return f"{sign}${a / 1e3:.0f}K"
    return f"{sign}${a:,.0f}"


def named(series: pd.Series, key: str = "value") -> list[dict]:
    return [{"name": str(i), key: num(v)} for i, v in series.items()]


# ──────────────────────────────────────────────────────────────────────────────
# Anomaly detection  (a faithful port of src/anomaly.py)
# ──────────────────────────────────────────────────────────────────────────────
def severity_from_sales(x: float) -> str:
    if x > 5000:
        return "High"
    if x > 1000:
        return "Medium"
    return "Low"


def ml_anomaly_mask(df: pd.DataFrame) -> np.ndarray:
    """Isolation Forest over the numeric profile, matching src/anomaly.py."""
    from sklearn.ensemble import IsolationForest

    features = ["Sales", "Order Item Discount Rate", "profit_margin_pct", "shipping_delay"]
    mask = np.zeros(len(df), dtype=bool)
    sub = df[features].dropna()
    if len(sub) > 100:
        iso = IsolationForest(contamination=0.02, random_state=42, n_jobs=-1)
        preds = iso.fit_predict(sub)
        mask[df.index.get_indexer(sub.index[preds == -1])] = True
    return mask


def run_detectors(df: pd.DataFrame, ml_mask: np.ndarray) -> pd.DataFrame:
    """Rule detectors + the precomputed ML flag, in src/anomaly.py's priority order."""
    results = []
    if df.empty:
        return pd.DataFrame()

    leak = (df["Sales"] > 1000) & (df["Order Profit Per Order"] < 0)
    if leak.any():
        t = df[leak].copy()
        t["anomaly_type"] = "Revenue Leak"
        t["severity"] = t["Sales"].apply(severity_from_sales)
        results.append(t)

    erosion = (df["Order Item Discount Rate"] > 0.35) & (df["profit_margin_pct"] < 0)
    if erosion.any():
        t = df[erosion].copy()
        t["anomaly_type"] = "Margin Erosion"
        t["severity"] = "High"
        results.append(t)

    dmean = df["shipping_delay"].mean()
    dstd = df["shipping_delay"].std()
    if pd.notna(dstd) and dstd > 0:
        severe = df["shipping_delay"] > dmean + 2.5 * dstd
        if severe.any():
            t = df[severe].copy()
            t["anomaly_type"] = "Severe Delay"
            t["severity"] = "Medium"
            results.append(t)

    if ml_mask.any():
        t = df[ml_mask].copy()
        t["anomaly_type"] = "ML Anomaly"
        t["severity"] = t["Sales"].apply(severity_from_sales)
        results.append(t)

    if not results:
        return pd.DataFrame()

    combined = pd.concat(results)
    combined = combined[~combined.index.duplicated(keep="first")]
    return combined.sort_values("Sales", ascending=False).head(50)


# ──────────────────────────────────────────────────────────────────────────────
# Insights  (a faithful port of src/transform.generate_insights)
# ──────────────────────────────────────────────────────────────────────────────
def generate_insights(f: pd.DataFrame) -> list[dict]:
    out: list[dict] = []
    if f.empty:
        return out

    ms = f.groupby("Market")["Sales"].sum()
    out.append({
        "tone": "brand",
        "label": "Largest market",
        "text": f"<b>{ms.idxmax()}</b> drives {money(ms.max())} — "
                f"{ms.max() / ms.sum() * 100:.0f}% of all revenue.",
    })

    loss = f[f["Order Profit Per Order"] < 0]
    if len(loss):
        out.append({
            "tone": "red",
            "label": "Profit leak",
            "text": f"<b>{len(loss):,}</b> orders ({len(loss) / len(f) * 100:.0f}%) "
                    f"sell at a loss, bleeding "
                    f"{money(loss['Order Profit Per Order'].sum())}.",
        })

    lm = f.groupby("Shipping Mode")["Late_delivery_risk"].mean() * 100
    out.append({
        "tone": "amber",
        "label": "Delivery risk",
        "text": f"<b>{lm.idxmax()}</b> is late {lm.max():.0f}% of the time — "
                f"the weakest lane.",
    })

    cat = f.groupby("Category Name").agg(m=("profit_margin_pct", "mean"), s=("Sales", "sum"))
    cat = cat[cat["s"] > cat["s"].median()]
    if len(cat):
        out.append({
            "tone": "mint",
            "label": "Margin leader",
            "text": f"<b>{cat['m'].idxmax()}</b> returns the best margin at "
                    f"{cat['m'].max():.1f}%.",
        })

    on_time = (1 - f["Late_delivery_risk"].mean()) * 100
    out.append({
        "tone": "mint" if on_time >= 55 else "amber" if on_time >= 45 else "red",
        "label": "On-time delivery",
        "text": f"<b>{on_time:.0f}%</b> of orders arrive on schedule across the network.",
    })

    hi = f[f["Order Item Discount Rate"] > 0.2]
    if len(hi):
        out.append({
            "tone": "brand",
            "label": "Discount pressure",
            "text": f"<b>{len(hi) / len(f) * 100:.0f}%</b> of orders carry 20%+ "
                    f"discounts, averaging {hi['profit_margin_pct'].mean():.0f}% margin.",
        })

    return out[:6]


# ──────────────────────────────────────────────────────────────────────────────
# The 17 charts + KPI row, computed for a (possibly filtered) frame
# ──────────────────────────────────────────────────────────────────────────────
def build_aggregates(f: pd.DataFrame, ml_mask: np.ndarray) -> dict:
    total_sales = f["Sales"].sum()
    total_profit = f["Order Profit Per Order"].sum()
    total_orders = len(f)

    kpis = {
        "totalSales": num(total_sales),
        "totalProfit": num(total_profit),
        "totalOrders": total_orders,
        "avgOrder": num(total_sales / total_orders),
        "avgMargin": num(f["profit_margin_pct"].mean()),
        "lateRate": num(f["Late_delivery_risk"].mean() * 100),
        "onTime": num(100 - f["Late_delivery_risk"].mean() * 100),
        "avgDelay": num(f["shipping_delay"].mean()),
    }

    # ── Overview ──────────────────────────────────────────────────────────────
    revenue_by_market = named(
        f.groupby("Market")["Sales"].sum().sort_values(), "sales")

    trend_df = (f.groupby("order_yearmonth")
                 .agg(Sales=("Sales", "sum"), Profit=("Order Profit Per Order", "sum"))
                 .reset_index().sort_values("order_yearmonth"))
    trend = [{"ym": r.order_yearmonth, "sales": num(r.Sales), "profit": num(r.Profit)}
             for r in trend_df.itertuples()]

    order_status = [{"name": str(k), "count": int(v)}
                    for k, v in f["Order Status"].value_counts().items()]

    top_categories = named(
        f.groupby("Category Name")["Sales"].sum().sort_values().tail(10), "sales")

    revenue_by_segment = named(
        f.groupby("Customer Segment")["Sales"].sum().sort_values(ascending=False), "sales")

    # ── Delivery ──────────────────────────────────────────────────────────────
    late_by_ship_mode = named(
        (f.groupby("Shipping Mode")["Late_delivery_risk"].mean() * 100)
        .sort_values(ascending=False), "pct")

    delivery_status = [{"name": str(k), "count": int(v)}
                       for k, v in f["Delivery Status"].value_counts().items()]

    clipped = f["shipping_delay"].clip(-4, 8)
    counts, _ = np.histogram(clipped.dropna(), bins=np.arange(-4.5, 9.5, 1.0))
    delay_histogram = [{"days": int(d), "count": int(c)}
                       for d, c in zip(range(-4, 9), counts)]

    late_by_market = named(
        (f.groupby("Market")["Late_delivery_risk"].mean() * 100).sort_values(), "pct")

    # ── Profitability ─────────────────────────────────────────────────────────
    profit_by_market = named(
        f.groupby("Market")["Order Profit Per Order"].sum().sort_values(), "profit")

    cm = f.groupby("Category Name")["profit_margin_pct"].mean().sort_values()
    margin_by_category = named(pd.concat([cm.head(6), cm.tail(6)]), "margin")

    # Streamlit: fdf.sample(min(4000, len(fdf)), random_state=1)
    sample = f.sample(min(4000, len(f)), random_state=1)
    discount_vs_profit = [
        {"d": round(float(a) * 100, 2), "p": round(float(b), 2), "m": round(float(c), 2)}
        for a, b, c in zip(sample["Order Item Discount Rate"],
                           sample["Order Profit Per Order"],
                           sample["profit_margin_pct"])
    ]

    lp = f.groupby("Product Name")["Order Profit Per Order"].sum().sort_values().head(10)
    lp = lp[lp < 0].sort_values(ascending=True)
    loss_making_products = named(lp, "profit")

    # ── Anomalies ─────────────────────────────────────────────────────────────
    anomalies = run_detectors(f, ml_mask)
    if anomalies.empty:
        anomaly_block = {"counts": {}, "severity": {}, "leakImpact": 0, "rows": []}
    else:
        anomaly_block = {
            "counts": {str(k): int(v)
                       for k, v in anomalies["anomaly_type"].value_counts().items()},
            "severity": {str(k): int(v)
                         for k, v in anomalies["severity"].value_counts().items()},
            "leakImpact": num(anomalies.loc[
                anomalies["anomaly_type"] == "Revenue Leak",
                "Order Profit Per Order"].sum()),
            "rows": [{
                "date": r["order_date"].strftime("%Y-%m-%d"),
                "product": str(r["Product Name"]),
                "market": str(r["Market"]),
                "shipMode": str(r["Shipping Mode"]),
                "sales": num(r["Sales"]),
                "profit": num(r["Order Profit Per Order"]),
                "delay": num(r["shipping_delay"]),
                "type": str(r["anomaly_type"]),
                "severity": str(r["severity"]),
            } for _, r in anomalies.iterrows()],
        }

    # ── Geography ─────────────────────────────────────────────────────────────
    tdf = f.dropna(subset=["Market", "Order Region", "Customer Segment"])
    treemap = []
    for market, mg in tdf.groupby("Market", observed=True):
        regions = []
        for region, rg in mg.groupby("Order Region", observed=True):
            segments = [{"name": str(s), "sales": num(v)}
                        for s, v in rg.groupby("Customer Segment", observed=True)["Sales"]
                        .sum().sort_values(ascending=False).items()]
            regions.append({"name": str(region),
                            "sales": num(rg["Sales"].sum()),
                            "children": segments})
        regions.sort(key=lambda x: -(x["sales"] or 0))
        treemap.append({"name": str(market),
                        "sales": num(mg["Sales"].sum()),
                        "children": regions})
    treemap.sort(key=lambda x: -(x["sales"] or 0))

    top_countries = [{"name": str(k), "count": int(v)} for k, v in
                     f["Order Country"].value_counts().head(10).sort_values().items()]

    bc = f["revenue_band"].value_counts().sort_index()
    revenue_bands = [{"name": str(k), "count": int(v)} for k, v in bc.items()]

    rg = (f.groupby("Order Region")
           .agg(Sales=("Sales", "sum"), Profit=("Order Profit Per Order", "sum"))
           .sort_values("Sales", ascending=False).head(12).sort_values("Sales"))
    sales_profit_by_region = [{"name": str(i), "sales": num(r.Sales), "profit": num(r.Profit)}
                              for i, r in rg.iterrows()]

    return {
        "kpis": kpis,
        "insights": generate_insights(f),
        "revenueByMarket": revenue_by_market,
        "trend": trend,
        "orderStatus": order_status,
        "topCategories": top_categories,
        "revenueBySegment": revenue_by_segment,
        "lateByShipMode": late_by_ship_mode,
        "deliveryStatus": delivery_status,
        "delayHistogram": delay_histogram,
        "lateByMarket": late_by_market,
        "profitByMarket": profit_by_market,
        "marginByCategory": margin_by_category,
        "discountVsProfit": discount_vs_profit,
        "lossMakingProducts": loss_making_products,
        "anomalies": anomaly_block,
        "treemap": treemap,
        "topCountries": top_countries,
        "revenueBands": revenue_bands,
        "salesProfitByRegion": sales_profit_by_region,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Columnar encoder
# ──────────────────────────────────────────────────────────────────────────────
def encode_dim(series: pd.Series, dtype) -> tuple[list[str], np.ndarray]:
    cats = sorted(series.astype(str).unique())
    lookup = {c: i for i, c in enumerate(cats)}
    codes = series.astype(str).map(lookup).to_numpy(dtype=dtype)
    return cats, codes


def encode_measure(series: pd.Series, dtype) -> tuple[list[float], np.ndarray]:
    vals = np.sort(series.dropna().unique())
    lookup = {v: i for i, v in enumerate(vals)}
    codes = series.map(lookup).to_numpy(dtype=dtype)
    return [float(v) for v in vals], codes


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    df = clean_and_engineer(load())
    print(f"cleaned rows: {len(df):,}")

    # Sorting is purely a compression win — grouping like values together lets
    # gzip collapse the dictionary-encoded columns. Aggregates are order-free.
    df = df.sort_values(
        ["order_date", "Market", "Order Region", "Order Country", "Product Name"],
        kind="stable",
    ).reset_index(drop=True)

    print("running Isolation Forest …")
    ml_mask = ml_anomaly_mask(df)
    print(f"ML anomalies flagged: {int(ml_mask.sum()):,}")

    print("building aggregates …")
    aggregates = build_aggregates(df, ml_mask)

    # ── dictionaries + columns ────────────────────────────────────────────────
    markets, market_codes = encode_dim(df["Market"], np.uint8)
    segments, segment_codes = encode_dim(df["Customer Segment"], np.uint8)
    ship_modes, ship_codes = encode_dim(df["Shipping Mode"], np.uint8)
    depts, dept_codes = encode_dim(df["Department Name"], np.uint8)
    statuses, status_codes = encode_dim(df["Order Status"], np.uint8)
    delivery, delivery_codes = encode_dim(df["Delivery Status"], np.uint8)
    categories, category_codes = encode_dim(df["Category Name"], np.uint8)
    regions, region_codes = encode_dim(df["Order Region"], np.uint8)
    countries, country_codes = encode_dim(df["Order Country"], np.uint16)
    products, product_codes = encode_dim(df["Product Name"], np.uint8)

    sales_vals, sales_codes = encode_measure(df["Sales"], np.uint8)
    ratio_vals, ratio_codes = encode_measure(df["Order Item Profit Ratio"], np.uint8)
    disc_vals, disc_codes = encode_measure(df["Order Item Discount Rate"], np.uint8)
    profit_vals, profit_codes = encode_measure(df["Order Profit Per Order"], np.uint16)

    date_codes = ((df["order_date"].dt.normalize() - EPOCH).dt.days).to_numpy(np.uint16)
    delay_codes = df["shipping_delay"].fillna(0).to_numpy(np.int8)
    ml_codes = ml_mask.astype(np.uint8)

    columns = [
        ("date", "u16", date_codes),
        ("market", "u8", market_codes),
        ("segment", "u8", segment_codes),
        ("shipMode", "u8", ship_codes),
        ("dept", "u8", dept_codes),
        ("status", "u8", status_codes),
        ("delivery", "u8", delivery_codes),
        ("category", "u8", category_codes),
        ("region", "u8", region_codes),
        ("country", "u16", country_codes),
        ("product", "u8", product_codes),
        ("sales", "u8", sales_codes),
        ("ratio", "u8", ratio_codes),
        ("discount", "u8", disc_codes),
        ("profit", "u16", profit_codes),
        ("delay", "i8", delay_codes),
        ("ml", "u8", ml_codes),
    ]

    # The four numeric dictionaries ride in the binary too — as JSON they were
    # ~200 KB of float literals (the profit dictionary alone has ~22k entries).
    measures = [
        ("sales", sales_vals),
        ("ratio", ratio_vals),
        ("discount", disc_vals),
        ("profit", profit_vals),
    ]
    measure_blob = b"".join(
        np.asarray(vals, dtype=np.float32).tobytes() for _, vals in measures
    )

    blob = measure_blob + b"".join(col.tobytes() for _, _, col in columns)
    packed = gzip.compress(blob, 9)
    (OUT_DIR / "dataset.bin").write_bytes(packed)

    meta = {
        "rows": len(df),
        "epoch": EPOCH.strftime("%Y-%m-%d"),
        "layout": [{"name": n, "dtype": d} for n, d, _ in columns],
        "dims": {
            "market": markets,
            "segment": segments,
            "shipMode": ship_modes,
            "dept": depts,
            "status": statuses,
            "delivery": delivery,
            "category": categories,
            "region": regions,
            "country": countries,
            "product": products,
        },
        # Read from the head of dataset.bin as float32, in this order.
        "measures": [{"name": n, "length": len(v)} for n, v in measures],
        "bands": {"edges": BAND_EDGES, "labels": BAND_LABELS},
        "years": sorted(int(y) for y in df["order_year"].unique()),
        "dateRange": [df["order_date"].min().strftime("%Y-%m-%d"),
                      df["order_date"].max().strftime("%Y-%m-%d")],
    }

    (OUT_DIR / "meta.json").write_text(json.dumps(meta, separators=(",", ":")),
                                       encoding="utf-8")
    (OUT_DIR / "aggregates.json").write_text(json.dumps(aggregates, separators=(",", ":")),
                                             encoding="utf-8")

    for name in ("aggregates.json", "meta.json", "dataset.bin"):
        kb = (OUT_DIR / name).stat().st_size / 1024
        print(f"  {name:<18} {kb:9,.1f} KB")
    print(f"  (dataset.bin uncompressed: {len(blob) / 1024 / 1024:.2f} MB)")

    k = aggregates["kpis"]
    print("\nspot-check (unfiltered):")
    print(f"  sales   ${k['totalSales']:,.2f}")
    print(f"  profit  ${k['totalProfit']:,.2f}")
    print(f"  orders  {k['totalOrders']:,}")
    print(f"  margin  {k['avgMargin']:.4f}%")
    print(f"  late    {k['lateRate']:.4f}%")
    print(f"  delay   {k['avgDelay']:.4f}d")


if __name__ == "__main__":
    main()

"""Cross-check the generated aggregates against the ORIGINAL Streamlit code.

This does not re-run `scripts/aggregate.py`. It imports the untouched
`src/transform.py` and `src/anomaly.py` that the live Streamlit app uses, runs
them over the same dataset, and asserts that every number in
`public/data/aggregates.json` matches what Streamlit would have rendered.

`src/*` imports streamlit for its caching decorators, so a minimal stub stands
in — the decorators are pass-throughs and nothing else is touched.

Run:  python scripts/verify.py
"""

from __future__ import annotations

import json
import sys
import types
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# ── streamlit stub, so the original modules import unchanged ─────────────────
if "streamlit" not in sys.modules:
    st = types.ModuleType("streamlit")

    def cache_data(*dargs, **dkwargs):
        if dargs and callable(dargs[0]):
            return dargs[0]

        def wrap(fn):
            return fn

        return wrap

    st.cache_data = cache_data
    st.secrets = {}
    st.error = lambda *a, **k: None
    st.stop = lambda: (_ for _ in ()).throw(SystemExit("st.stop()"))
    sys.modules["streamlit"] = st

from src.loader import load_data  # noqa: E402
from src.transform import clean_and_engineer, generate_insights  # noqa: E402
from src.anomaly import run_detectors  # noqa: E402

TOL = 1e-6
failures: list[str] = []
checks = 0


def close(a: float, b: float, tol: float = TOL) -> bool:
    if a is None or b is None:
        return a == b
    return abs(float(a) - float(b)) <= max(tol, abs(float(b)) * tol)


def check(name: str, got, want, tol: float = TOL) -> None:
    global checks
    checks += 1
    ok = close(got, want, tol) if isinstance(want, (int, float)) else got == want
    if not ok:
        failures.append(f"{name}: got {got!r}, expected {want!r}")


def check_series(name: str, got: list[dict], want: pd.Series, key: str) -> None:
    """Compare an emitted [{name, <key>}] list against a pandas Series."""
    global checks
    checks += 1
    if len(got) != len(want):
        failures.append(f"{name}: length {len(got)} != {len(want)}")
        return
    for row, (idx, val) in zip(got, want.items()):
        if row["name"] != str(idx):
            failures.append(f"{name}: label {row['name']!r} != {str(idx)!r}")
            return
        if not close(row[key], val):
            failures.append(f"{name}[{idx}]: {row[key]} != {val}")
            return


def main() -> None:
    agg = json.loads((ROOT / "public" / "data" / "aggregates.json").read_text("utf-8"))
    df = clean_and_engineer(load_data())
    print(f"Streamlit pipeline rows: {len(df):,}")

    # ── KPI row ──────────────────────────────────────────────────────────────
    k = agg["kpis"]
    check("kpi.totalSales", k["totalSales"], df["Sales"].sum())
    check("kpi.totalProfit", k["totalProfit"], df["Order Profit Per Order"].sum())
    check("kpi.totalOrders", k["totalOrders"], len(df))
    check("kpi.avgOrder", k["avgOrder"], df["Sales"].sum() / len(df))
    check("kpi.avgMargin", k["avgMargin"], df["profit_margin_pct"].mean())
    check("kpi.lateRate", k["lateRate"], df["Late_delivery_risk"].mean() * 100)
    check("kpi.onTime", k["onTime"], 100 - df["Late_delivery_risk"].mean() * 100)
    check("kpi.avgDelay", k["avgDelay"], df["shipping_delay"].mean())

    # ── Overview ─────────────────────────────────────────────────────────────
    check_series("revenueByMarket", agg["revenueByMarket"],
                 df.groupby("Market")["Sales"].sum().sort_values(), "sales")

    tr = (df.groupby("order_yearmonth")
            .agg(Sales=("Sales", "sum"), Profit=("Order Profit Per Order", "sum"))
            .reset_index().sort_values("order_yearmonth"))
    check("trend.length", len(agg["trend"]), len(tr))
    for row, ref in zip(agg["trend"], tr.itertuples()):
        check(f"trend[{ref.order_yearmonth}].sales", row["sales"], ref.Sales)
        check(f"trend[{ref.order_yearmonth}].profit", row["profit"], ref.Profit)

    sc = df["Order Status"].value_counts()
    check("orderStatus.length", len(agg["orderStatus"]), len(sc))
    for row, (idx, val) in zip(agg["orderStatus"], sc.items()):
        check(f"orderStatus[{idx}]", row["count"], val)

    check_series("topCategories", agg["topCategories"],
                 df.groupby("Category Name")["Sales"].sum().sort_values().tail(10), "sales")
    check_series("revenueBySegment", agg["revenueBySegment"],
                 df.groupby("Customer Segment")["Sales"].sum()
                   .sort_values(ascending=False), "sales")

    # ── Delivery ─────────────────────────────────────────────────────────────
    check_series("lateByShipMode", agg["lateByShipMode"],
                 (df.groupby("Shipping Mode")["Late_delivery_risk"].mean() * 100)
                 .sort_values(ascending=False), "pct")

    ds = df["Delivery Status"].value_counts()
    for row, (idx, val) in zip(agg["deliveryStatus"], ds.items()):
        check(f"deliveryStatus[{idx}]", row["count"], val)

    counts, _ = np.histogram(df["shipping_delay"].clip(-4, 8).dropna(),
                             bins=np.arange(-4.5, 9.5, 1.0))
    for row, want in zip(agg["delayHistogram"], counts):
        check(f"delayHistogram[{row['days']}]", row["count"], int(want))

    check_series("lateByMarket", agg["lateByMarket"],
                 (df.groupby("Market")["Late_delivery_risk"].mean() * 100)
                 .sort_values(), "pct")

    # ── Profitability ────────────────────────────────────────────────────────
    check_series("profitByMarket", agg["profitByMarket"],
                 df.groupby("Market")["Order Profit Per Order"].sum().sort_values(),
                 "profit")

    cm = df.groupby("Category Name")["profit_margin_pct"].mean().sort_values()
    check_series("marginByCategory", agg["marginByCategory"],
                 pd.concat([cm.head(6), cm.tail(6)]), "margin")

    lp = df.groupby("Product Name")["Order Profit Per Order"].sum().sort_values().head(10)
    lp = lp[lp < 0].sort_values(ascending=True)
    check_series("lossMakingProducts", agg["lossMakingProducts"], lp, "profit")

    check("discountVsProfit.length", len(agg["discountVsProfit"]),
          min(4000, len(df)))

    # ── Anomalies ────────────────────────────────────────────────────────────
    anomalies = run_detectors(df)
    got = agg["anomalies"]
    want_counts = anomalies["anomaly_type"].value_counts().to_dict()
    for key, val in want_counts.items():
        check(f"anomalies.counts[{key}]", got["counts"].get(key, 0), int(val))
    check("anomalies.rows", len(got["rows"]), min(50, len(anomalies)))
    check("anomalies.leakImpact", got["leakImpact"],
          anomalies.loc[anomalies["anomaly_type"] == "Revenue Leak",
                        "Order Profit Per Order"].sum())
    got_sales = sorted((r["sales"] for r in got["rows"]), reverse=True)
    want_sales = sorted(anomalies["Sales"].head(50).tolist(), reverse=True)
    check("anomalies.topSales", [round(v, 4) for v in got_sales],
          [round(v, 4) for v in want_sales])

    # ── Geography ────────────────────────────────────────────────────────────
    tcty = df["Order Country"].value_counts().head(10).sort_values()
    for row, (idx, val) in zip(agg["topCountries"], tcty.items()):
        check(f"topCountries[{idx}]", row["count"], val)

    bc = df["revenue_band"].value_counts().sort_index()
    for row, (idx, val) in zip(agg["revenueBands"], bc.items()):
        check(f"revenueBands[{idx}]", row["count"], val)

    rg = (df.groupby("Order Region")
            .agg(Sales=("Sales", "sum"), Profit=("Order Profit Per Order", "sum"))
            .sort_values("Sales", ascending=False).head(12).sort_values("Sales"))
    check("salesProfitByRegion.length", len(agg["salesProfitByRegion"]), len(rg))
    for row, (idx, ref) in zip(agg["salesProfitByRegion"], rg.iterrows()):
        check(f"region[{idx}].sales", row["sales"], ref.Sales)
        check(f"region[{idx}].profit", row["profit"], ref.Profit)

    treemap_total = sum(m["sales"] for m in agg["treemap"])
    check("treemap.total", treemap_total,
          df.dropna(subset=["Market", "Order Region", "Customer Segment"])["Sales"].sum())

    # ── Insights ─────────────────────────────────────────────────────────────
    want_ins = generate_insights(df)
    check("insights.length", len(agg["insights"]), len(want_ins))
    for got_i, want_i in zip(agg["insights"], want_ins):
        check(f"insight[{want_i['label']}]", got_i["text"], want_i["text"])

    # ── report ───────────────────────────────────────────────────────────────
    print(f"\n{checks} assertions")
    if failures:
        print(f"{len(failures)} MISMATCH(ES):")
        for f in failures:
            print(f"  FAIL {f}")
        raise SystemExit(1)
    print("all aggregates match the original Streamlit pipeline OK")


if __name__ == "__main__":
    main()

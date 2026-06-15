"""Cleaning, feature engineering and filtering for the dashboard."""

import pandas as pd
import streamlit as st

# The Kaggle export ships the date column lowercased as
# "order date (DateOrders)". We accept either casing so the dashboard
# keeps working if a future export changes it.
_DATE_CANDIDATES = [
    "Order Date (DateOrders)",
    "order date (DateOrders)",
    "order date (DateOrders) ",
]

_NUMERIC_COLS = [
    "Sales",
    "Order Profit Per Order",
    "Order Item Profit Ratio",
    "Order Item Discount Rate",
    "Days for shipping (real)",
    "Days for shipment (scheduled)",
    "Late_delivery_risk",
    "Order Item Quantity",
]


def _find_date_column(df: pd.DataFrame) -> str | None:
    for cand in _DATE_CANDIDATES:
        if cand in df.columns:
            return cand
    # last resort: any column that looks like an order date
    for col in df.columns:
        low = col.lower()
        if "order date" in low or "order date (dateorders)" in low:
            return col
    return None


@st.cache_data(ttl=600, show_spinner="Preparing dataset…")
def clean_and_engineer(df: pd.DataFrame) -> pd.DataFrame:
    """Parse dates, coerce numerics, drop bad rows and add features."""
    df = df.copy()

    # --- parse date (robust to casing) ---
    date_col = _find_date_column(df)
    if date_col is None:
        df["order_date"] = pd.NaT
    else:
        df["order_date"] = pd.to_datetime(
            df[date_col], errors="coerce", dayfirst=False
        )

    # --- numeric safety ---
    for col in _NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # --- drop rows we cannot analyse ---
    df = df.dropna(subset=["Sales", "order_date"])
    df = df[df["Sales"] > 0]

    # --- engineered features ---
    df["shipping_delay"] = (
        df["Days for shipping (real)"] - df["Days for shipment (scheduled)"]
    )
    df["profit_margin_pct"] = df["Order Item Profit Ratio"] * 100
    df["order_year"] = df["order_date"].dt.year
    df["order_month"] = df["order_date"].dt.strftime("%b")
    df["order_yearmonth"] = df["order_date"].dt.to_period("M").astype(str)
    df["revenue_band"] = pd.cut(
        df["Sales"],
        bins=[0, 100, 500, 1000, 5000, 9999999],
        labels=["<$100", "$100–500", "$500–1K", "$1K–5K", "$5K+"],
    )

    return df


def apply_filters(df, markets, segments, ship_modes, depts, years, statuses):
    """Return a filtered copy of df. Empty selections mean 'no filter'."""
    f = df.copy()
    if markets:
        f = f[f["Market"].isin(markets)]
    if segments:
        f = f[f["Customer Segment"].isin(segments)]
    if ship_modes:
        f = f[f["Shipping Mode"].isin(ship_modes)]
    if depts:
        f = f[f["Department Name"].isin(depts)]
    if years:
        f = f[f["order_year"].isin(years)]
    if statuses:
        f = f[f["Order Status"].isin(statuses)]
    return f


def _money(v: float) -> str:
    a = abs(v)
    sign = "-" if v < 0 else ""
    if a >= 1e6:
        return f"{sign}${a/1e6:.1f}M"
    if a >= 1e3:
        return f"{sign}${a/1e3:.0f}K"
    return f"{sign}${a:,.0f}"


def generate_insights(f: pd.DataFrame) -> list[dict]:
    """Auto-write the most decision-relevant findings for the current slice.

    Each insight is {tone, label, text} — tone drives the accent colour.
    Returns at most six, ordered by how much a reader should care.
    """
    out: list[dict] = []
    if f.empty:
        return out

    # 1. Dominant market
    try:
        ms = f.groupby("Market")["Sales"].sum()
        top = ms.idxmax()
        share = ms.max() / ms.sum() * 100
        out.append({
            "tone": "brand",
            "label": "Largest market",
            "text": f"<b>{top}</b> drives {_money(ms.max())} — {share:.0f}% of all revenue.",
        })
    except Exception:
        pass

    # 2. Loss-making orders
    try:
        loss = f[f["Order Profit Per Order"] < 0]
        if len(loss):
            out.append({
                "tone": "red",
                "label": "Profit leak",
                "text": (
                    f"<b>{len(loss):,}</b> orders ({len(loss)/len(f)*100:.0f}%) "
                    f"sell at a loss, bleeding {_money(loss['Order Profit Per Order'].sum())}."
                ),
            })
    except Exception:
        pass

    # 3. Worst shipping mode for lateness
    try:
        lm = f.groupby("Shipping Mode")["Late_delivery_risk"].mean() * 100
        worst = lm.idxmax()
        out.append({
            "tone": "amber",
            "label": "Delivery risk",
            "text": f"<b>{worst}</b> is late {lm.max():.0f}% of the time — the weakest lane.",
        })
    except Exception:
        pass

    # 4. Best-margin category (with scale)
    try:
        cat = f.groupby("Category Name").agg(
            m=("profit_margin_pct", "mean"), s=("Sales", "sum")
        )
        cat = cat[cat["s"] > cat["s"].median()]
        if len(cat):
            best = cat["m"].idxmax()
            out.append({
                "tone": "mint",
                "label": "Margin leader",
                "text": f"<b>{best}</b> returns the best margin at {cat['m'].max():.1f}%.",
            })
    except Exception:
        pass

    # 5. On-time performance
    try:
        on_time = (1 - f["Late_delivery_risk"].mean()) * 100
        tone = "mint" if on_time >= 55 else "amber" if on_time >= 45 else "red"
        out.append({
            "tone": tone,
            "label": "On-time delivery",
            "text": f"<b>{on_time:.0f}%</b> of orders arrive on schedule across the network.",
        })
    except Exception:
        pass

    # 6. Discount pressure
    try:
        hi = f[f["Order Item Discount Rate"] > 0.2]
        if len(hi):
            out.append({
                "tone": "brand",
                "label": "Discount pressure",
                "text": (
                    f"<b>{len(hi)/len(f)*100:.0f}%</b> of orders carry 20%+ discounts, "
                    f"averaging {hi['profit_margin_pct'].mean():.0f}% margin."
                ),
            })
    except Exception:
        pass

    return out[:6]

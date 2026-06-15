"""Anomaly detection: rule-based detectors + Isolation Forest outliers."""

import pandas as pd
from sklearn.ensemble import IsolationForest


def _severity_from_sales(x: float) -> str:
    if x > 5000:
        return "High"
    if x > 1000:
        return "Medium"
    return "Low"


def run_detectors(df: pd.DataFrame) -> pd.DataFrame:
    """Flag anomalous order lines and return up to 50 worst, tagged by type."""
    results = []

    if df.empty:
        return pd.DataFrame()

    # 1. Revenue Leak: high sales, negative profit
    mask = (df["Sales"] > 1000) & (df["Order Profit Per Order"] < 0)
    if mask.any():
        tmp = df[mask].copy()
        tmp["anomaly_type"] = "Revenue Leak"
        tmp["severity"] = tmp["Sales"].apply(_severity_from_sales)
        results.append(tmp)

    # 2. Margin Erosion: high discount, negative margin
    mask2 = (df["Order Item Discount Rate"] > 0.35) & (df["profit_margin_pct"] < 0)
    if mask2.any():
        tmp2 = df[mask2].copy()
        tmp2["anomaly_type"] = "Margin Erosion"
        tmp2["severity"] = "High"
        results.append(tmp2)

    # 3. Severe Delay: shipping delay > mean + 2.5 std
    delay_mean = df["shipping_delay"].mean()
    delay_std = df["shipping_delay"].std()
    if pd.notna(delay_std) and delay_std > 0:
        mask3 = df["shipping_delay"] > delay_mean + 2.5 * delay_std
        if mask3.any():
            tmp3 = df[mask3].copy()
            tmp3["anomaly_type"] = "Severe Delay"
            tmp3["severity"] = "Medium"
            results.append(tmp3)

    # 4. Isolation Forest on the numeric profile
    features = ["Sales", "Order Item Discount Rate", "profit_margin_pct", "shipping_delay"]
    if all(c in df.columns for c in features):
        sub = df[features].dropna()
        if len(sub) > 100:
            iso = IsolationForest(contamination=0.02, random_state=42, n_jobs=-1)
            preds = iso.fit_predict(sub)
            iso_idx = sub.index[preds == -1]
            tmp4 = df.loc[iso_idx].copy()
            tmp4["anomaly_type"] = "ML Anomaly"
            tmp4["severity"] = tmp4["Sales"].apply(_severity_from_sales)
            results.append(tmp4)

    if not results:
        return pd.DataFrame()

    combined = pd.concat(results)
    # Drop duplicate order lines that tripped multiple detectors, keeping the
    # first (priority order above: leak > erosion > delay > ML).
    combined = combined[~combined.index.duplicated(keep="first")]
    return combined.sort_values("Sales", ascending=False).head(50)

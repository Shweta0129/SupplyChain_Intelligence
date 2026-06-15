"""Supply Chain Intelligence — a control-tower analytics dashboard.

Design language: a fintech control tower. One job — surface where money and
time leak across a global logistics network. Navy-gradient hero stat carries
the focus; everything else stays quiet, white and precise.

Run with:  streamlit run app.py
"""

from contextlib import contextmanager

import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st

from src.loader import load_data
from src.transform import clean_and_engineer, apply_filters, generate_insights
from src.anomaly import run_detectors

# ──────────────────────────────────────────────────────────────────────────────
# Page config
# ──────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Supply Chain Intelligence",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Palette (named, derived from the control-tower direction) ──────────────────
INK = "#0B1437"        # deep navy — primary text
MUTED = "#8A93A8"      # captions / labels
BRAND = "#2B5FCF"      # signal blue — the accent
BRAND_DK = "#1E3A8A"   # hero gradient end
BRAND_SOFT = "#C8D9F5"  # pastel blue — bars at rest
MINT = "#1D9E75"       # positive
MINT_SOFT = "#D6EEE8"
AMBER = "#EF9F27"
RED = "#E24B4A"
GRID = "#EEF1F8"

CAT_SEQ = ["#2B5FCF", "#5B8DEF", "#1D9E75", "#EF9F27", "#E24B4A",
           "#8B5CF6", "#0EA5E9", "#14B8A6", "#F472B6"]

# ──────────────────────────────────────────────────────────────────────────────
# Global styling
# ──────────────────────────────────────────────────────────────────────────────
st.markdown(
    """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

:root{
  --ink:#0B1437; --muted:#8A93A8; --brand:#2B5FCF; --soft:#C8D9F5;
  --canvas:#EEF2FB; --card:#FFFFFF; --line:#E6ECF7;
}

html, body, [class*="css"], .stMarkdown, p, span, div, label, input{
  font-family:'Inter',sans-serif;
}
[data-testid="stAppViewContainer"]{ background:var(--canvas); }
[data-testid="stHeader"]{ background:transparent; }
#MainMenu, footer, [data-testid="stToolbar"], [data-testid="stDecoration"]{ display:none; }

.block-container{ padding:1.1rem 2.4rem 3rem !important; max-width:1560px !important; }

/* ── motion ─────────────────────────────────────────────────────────── */
@keyframes fadeUp{ from{opacity:0; transform:translateY(12px);} to{opacity:1; transform:none;} }
@keyframes glow{ 0%,100%{box-shadow:0 14px 34px rgba(43,95,207,.28);} 50%{box-shadow:0 18px 44px rgba(43,95,207,.42);} }
@media (prefers-reduced-motion:reduce){ *{animation:none !important; transition:none !important;} }

/* ── top nav ────────────────────────────────────────────────────────── */
.topnav{
  display:flex; align-items:center; justify-content:space-between;
  background:var(--card); border:1px solid var(--line); border-radius:18px;
  padding:13px 24px; margin-bottom:20px; box-shadow:0 1px 3px rgba(11,20,55,.04);
  animation:fadeUp .5s ease both; position:sticky; top:8px; z-index:50;
  backdrop-filter:saturate(1.1);
}
.nav-brand{ display:flex; align-items:center; gap:10px; font-weight:700;
  color:var(--ink); font-size:15px; letter-spacing:-.01em; white-space:nowrap;
  flex-shrink:0; }
.nav-brand .logo{ width:30px; height:30px; border-radius:9px;
  background:linear-gradient(135deg,#2B5FCF,#1E3A8A); display:flex;
  align-items:center; justify-content:center; font-size:16px;
  box-shadow:0 4px 12px rgba(43,95,207,.35); }
.nav-brand b{ color:var(--brand); font-weight:700; }
.nav-tag{ font-family:'Space Grotesk'; font-size:12px; font-weight:500;
  letter-spacing:.04em; color:var(--muted); }
.nav-tag b{ color:var(--ink); font-weight:600; }
.nav-status{ display:flex; align-items:center; gap:8px; font-size:12px;
  color:var(--muted); font-weight:500; }
.nav-status .dot{ width:8px; height:8px; border-radius:50%; background:#1D9E75;
  box-shadow:0 0 0 4px rgba(29,158,117,.16); }

/* ── page title ─────────────────────────────────────────────────────── */
.eyebrow{ font-family:'Space Grotesk'; font-size:11px; font-weight:600;
  letter-spacing:.18em; text-transform:uppercase; color:var(--brand); margin-bottom:6px; }
.page-h1{ font-size:27px; font-weight:700; color:var(--ink); margin:0;
  letter-spacing:-.025em; }
.page-sub{ font-size:13px; color:var(--muted); margin-top:5px; }

/* ── KPI cards ──────────────────────────────────────────────────────── */
.kpi{ background:var(--card); border:1px solid var(--line); border-radius:18px;
  padding:15px 16px; height:112px; display:flex; flex-direction:column;
  justify-content:space-between; box-shadow:0 1px 3px rgba(11,20,55,.05);
  animation:fadeUp .55s ease both; transition:transform .25s ease, box-shadow .25s ease;
  overflow:hidden; }
.kpi:hover{ transform:translateY(-3px); box-shadow:0 12px 30px rgba(11,20,55,.10); }
.kpi.hero{ background:linear-gradient(140deg,#2B5FCF 0%,#1E3A8A 100%);
  border:none; animation:fadeUp .55s ease both, glow 5s ease-in-out 1s infinite; }
.kpi .lab{ font-family:'Space Grotesk'; font-size:10px; font-weight:600;
  letter-spacing:.08em; text-transform:uppercase; color:var(--muted);
  line-height:1.25; }
.kpi.hero .lab{ color:rgba(255,255,255,.78); }
.kpi .val{ font-family:'Space Grotesk'; font-size:23px; font-weight:700;
  color:var(--ink); line-height:1; letter-spacing:-.025em; white-space:nowrap; }
.kpi.hero .val{ color:#fff; }
.kpi .sub{ font-size:10.5px; font-weight:600; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; }
.up{ color:#1D9E75; } .down{ color:#E24B4A; }
.kpi.hero .up{ color:#86F0C6; } .kpi.hero .down{ color:#FFC0BF; }

/* ── chart cards (real wrappers around st.container) ────────────────── */
[data-testid="stVerticalBlockBorderWrapper"]{
  background:var(--card); border:1px solid var(--line) !important; border-radius:20px;
  padding:6px 8px; box-shadow:0 1px 3px rgba(11,20,55,.05);
  animation:fadeUp .6s ease both; transition:transform .25s ease, box-shadow .25s ease;
}
[data-testid="stVerticalBlockBorderWrapper"]:hover{
  transform:translateY(-3px); box-shadow:0 14px 34px rgba(11,20,55,.10);
}
.ct{ font-size:14.5px; font-weight:600; color:var(--ink); letter-spacing:-.01em;
  padding:8px 8px 0; }
.cs{ font-size:11.5px; color:var(--muted); padding:2px 8px 4px; }

/* ── insight callouts ───────────────────────────────────────────────── */
.insight{ background:var(--card); border:1px solid var(--line); border-radius:16px;
  border-left:4px solid var(--brand); padding:14px 16px; height:96px;
  box-shadow:0 1px 3px rgba(11,20,55,.05); animation:fadeUp .6s ease both; }
.insight .il{ font-family:'Space Grotesk'; font-size:10px; font-weight:600;
  letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
.insight .it{ font-size:12.5px; color:#3A4258; line-height:1.45; }
.insight.brand{ border-left-color:#2B5FCF; }
.insight.mint{ border-left-color:#1D9E75; }
.insight.amber{ border-left-color:#EF9F27; }
.insight.red{ border-left-color:#E24B4A; }

/* ── anomaly panel ──────────────────────────────────────────────────── */
.anomaly-panel{ background:linear-gradient(160deg,#E4F3EE,#D6EEE8); border-radius:20px;
  padding:22px 24px; margin:6px 0 14px; border:1px solid rgba(29,158,117,.18);
  animation:fadeUp .6s ease both; }
.astat{ background:var(--card); border-radius:14px; padding:16px; text-align:center;
  border:1px solid rgba(11,20,55,.05); box-shadow:0 1px 3px rgba(11,20,55,.04); }
.astat .n{ font-family:'Space Grotesk'; font-size:26px; font-weight:700; color:var(--ink); }
.astat .l{ font-size:10.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  color:#6B7280; margin-top:4px; }
.astat .s{ font-size:11px; color:var(--muted); margin-top:3px; }
.pill{ display:inline-block; padding:5px 13px; border-radius:999px; font-size:12px;
  font-weight:600; margin-right:8px; color:#fff; }

/* ── tabs ───────────────────────────────────────────────────────────── */
[data-testid="stTabs"] [data-baseweb="tab-list"]{ gap:6px; background:transparent;
  border-bottom:none; margin-bottom:6px; }
[data-testid="stTabs"] [data-baseweb="tab"]{ height:40px; padding:0 18px; border-radius:12px;
  background:transparent; font-family:'Space Grotesk'; font-weight:500; font-size:13px;
  color:var(--muted); border:1px solid transparent; }
[data-testid="stTabs"] [data-baseweb="tab"]:hover{ background:#FFFFFF; color:var(--ink); }
[data-testid="stTabs"] [aria-selected="true"]{ background:#FFFFFF !important; color:var(--brand) !important;
  border:1px solid var(--line) !important; box-shadow:0 2px 8px rgba(11,20,55,.06); }
[data-testid="stTabs"] [data-baseweb="tab-highlight"]{ display:none; }

/* ── sidebar ────────────────────────────────────────────────────────── */
[data-testid="stSidebar"]{ background:#FFFFFF; border-right:1px solid var(--line); }
[data-testid="stSidebar"] .stMultiSelect label{ font-size:12px; font-weight:600;
  color:var(--ink); }
.side-brand{ font-family:'Space Grotesk'; font-weight:700; font-size:16px; color:var(--ink);
  display:flex; align-items:center; gap:9px; }
.side-brand .logo{ width:28px; height:28px; border-radius:8px;
  background:linear-gradient(135deg,#2B5FCF,#1E3A8A); display:flex; align-items:center;
  justify-content:center; font-size:15px; }

footer.app-foot{ text-align:center; font-size:12px; color:var(--muted); padding:18px 0 4px; }
footer.app-foot a{ color:var(--brand); text-decoration:none; }
</style>
    """,
    unsafe_allow_html=True,
)


# ──────────────────────────────────────────────────────────────────────────────
# Plotly helpers
# ──────────────────────────────────────────────────────────────────────────────
PLOTLY_CONFIG = {"displayModeBar": False}


def style_fig(fig, height=300):
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Inter", size=11, color="#5C6478"),
        margin=dict(t=14, b=10, l=8, r=12),
        height=height,
        title=dict(text=""),  # explicit — prevents Plotly rendering "undefined"
        hoverlabel=dict(bgcolor="white", font_size=12, font_family="Inter",
                        bordercolor="#E6ECF7"),
        legend=dict(font=dict(size=10), bgcolor="rgba(0,0,0,0)"),
        xaxis=dict(showgrid=False, showline=False, zeroline=False, tickfont=dict(size=10)),
        yaxis=dict(gridcolor=GRID, showline=False, zeroline=False, tickfont=dict(size=10)),
    )
    fig.update_traces(marker_line_width=0)
    return fig


def show(fig):
    st.plotly_chart(fig, use_container_width=True, config=PLOTLY_CONFIG, theme=None)


@contextmanager
def card(col=None, title=None, sub=None):
    target = col if col is not None else st
    with target.container(border=True):
        if title:
            sub_html = f"<div class='cs'>{sub}</div>" if sub else ""
            st.markdown(f"<div class='ct'>{title}</div>{sub_html}", unsafe_allow_html=True)
        yield


def fmt_money(v: float) -> str:
    a = abs(v)
    sign = "-" if v < 0 else ""
    if a >= 1e6:
        return f"{sign}${a/1e6:.1f}M"
    if a >= 1e3:
        return f"{sign}${a/1e3:.0f}K"
    return f"{sign}${a:,.0f}"


def grad(n, c0=BRAND_SOFT, c1=BRAND):
    if n <= 1:
        return [c1]
    return px.colors.sample_colorscale([[0, c0], [1, c1]], [i / (n - 1) for i in range(n)])


# ──────────────────────────────────────────────────────────────────────────────
# Load + prepare
# ──────────────────────────────────────────────────────────────────────────────
raw = load_data()
df = clean_and_engineer(raw)

# ──────────────────────────────────────────────────────────────────────────────
# Sidebar — filters
# ──────────────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        "<div class='side-brand'><span class='logo'>📦</span> Supply Chain<br>Intelligence</div>",
        unsafe_allow_html=True,
    )
    st.caption(f"DataCo Global · {len(df):,} orders · 2015–2018")
    st.divider()

    all_markets = sorted(df["Market"].dropna().unique())
    all_segments = sorted(df["Customer Segment"].dropna().unique())
    all_shipmodes = sorted(df["Shipping Mode"].dropna().unique())
    all_depts = sorted(df["Department Name"].dropna().unique())
    all_years = sorted(df["order_year"].dropna().unique().astype(int))
    all_statuses = sorted(df["Order Status"].dropna().unique())

    st.markdown("**Filters**")
    sel_markets = st.multiselect("Market", all_markets, placeholder="All markets")
    sel_segments = st.multiselect("Customer Segment", all_segments, placeholder="All segments")
    sel_shipmodes = st.multiselect("Shipping Mode", all_shipmodes, placeholder="All modes")
    sel_depts = st.multiselect("Department", all_depts, placeholder="All departments")
    sel_years = st.multiselect("Year", all_years, placeholder="All years")
    sel_statuses = st.multiselect("Order Status", all_statuses, placeholder="All statuses")

    st.divider()
    if st.button("🔄 Reset & refresh", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    st.markdown(
        """
    <div style='font-size:11px;color:#8A93A8;margin-top:18px;line-height:1.8'>
    Built by <strong style='color:#0B1437'>Shweta Pasi</strong><br>
    Data Analyst · CEAT Tyres<br>
    <a href='https://linkedin.com/in/shweta-pasi' style='color:#2B5FCF;text-decoration:none'>LinkedIn</a> ·
    <a href='https://github.com/Shweta0129' style='color:#2B5FCF;text-decoration:none'>GitHub</a>
    </div>
    """,
        unsafe_allow_html=True,
    )

fdf = apply_filters(
    df, sel_markets, sel_segments, sel_shipmodes, sel_depts, sel_years, sel_statuses
)
filters_active = any(
    [sel_markets, sel_segments, sel_shipmodes, sel_depts, sel_years, sel_statuses]
)

# ──────────────────────────────────────────────────────────────────────────────
# Top nav
# ──────────────────────────────────────────────────────────────────────────────
st.markdown(
    f"""
<div class='topnav'>
  <div class='nav-brand'><span class='logo'>📦</span> Supply Chain <b>Intelligence</b></div>
  <div class='nav-tag'>DataCo Global · <b>2015–2018</b> · use the tabs below to explore</div>
  <div class='nav-status'><span class='dot'></span> Live · {len(fdf):,} orders</div>
</div>
    """,
    unsafe_allow_html=True,
)

if fdf.empty:
    st.warning("No orders match these filters. Clear a selection in the sidebar to continue.")
    st.stop()

# ── Page title ────────────────────────────────────────────────────────────────
st.markdown(
    f"""
<div style='margin-bottom:18px'>
  <div class='eyebrow'>Control Tower</div>
  <h1 class='page-h1'>Procurement &amp; Delivery Analytics</h1>
  <div class='page-sub'>Where revenue and time leak across the global network ·
    {len(fdf):,} orders {"· filters active" if filters_active else "· full dataset"}</div>
</div>
    """,
    unsafe_allow_html=True,
)

# ──────────────────────────────────────────────────────────────────────────────
# KPI hero row
# ──────────────────────────────────────────────────────────────────────────────
total_sales = fdf["Sales"].sum()
total_profit = fdf["Order Profit Per Order"].sum()
total_orders = len(fdf)
avg_order = total_sales / total_orders
avg_margin = fdf["profit_margin_pct"].mean()
late_rate = fdf["Late_delivery_risk"].mean() * 100
on_time = 100 - late_rate
avg_delay = fdf["shipping_delay"].mean()

base = dict(
    sales=df["Sales"].sum(), profit=df["Order Profit Per Order"].sum(),
    orders=len(df), aov=df["Sales"].sum() / len(df),
    margin=df["profit_margin_pct"].mean(),
    ontime=100 - df["Late_delivery_risk"].mean() * 100,
    delay=df["shipping_delay"].mean(),
)


def delta(val, b, good_up=True, pct=True, suffix=""):
    if b in (None, 0) or pd.isna(b) or pd.isna(val):
        return "<div class='sub' style='color:#B6BECE'>baseline</div>"
    diff = val - b
    txt = f"{diff/abs(b)*100:+.1f}%" if pct else f"{diff:+.1f}{suffix}"
    up = diff >= 0
    good = up if good_up else not up
    return f"<div class='sub {'up' if good else 'down'}'>{'▲' if up else '▼'} {txt} vs all</div>"


def kpi(col, lab, val, dlt, hero=False):
    col.markdown(
        f"<div class='kpi {'hero' if hero else ''}'>"
        f"<div class='lab'>{lab}</div><div class='val'>{val}</div>{dlt}</div>",
        unsafe_allow_html=True,
    )


kc = st.columns(6)
kpi(kc[0], "Total Sales", f"${total_sales/1e6:.1f}M", delta(total_sales, base["sales"]), hero=True)
kpi(kc[1], "Total Profit", f"${total_profit/1e6:.1f}M", delta(total_profit, base["profit"]))
kpi(kc[2], "Avg Order", f"${avg_order:,.0f}", delta(avg_order, base["aov"]))
kpi(kc[3], "Margin", f"{avg_margin:.1f}%", delta(avg_margin, base["margin"], pct=False, suffix="pp"))
kpi(kc[4], "On-Time", f"{on_time:.1f}%", delta(on_time, base["ontime"], pct=False, suffix="pp"))
kpi(kc[5], "Avg Delay", f"{avg_delay:+.1f}d", delta(avg_delay, base["delay"], good_up=False, pct=False, suffix="d"))

st.markdown("<div style='height:16px'></div>", unsafe_allow_html=True)

# ──────────────────────────────────────────────────────────────────────────────
# Tabs
# ──────────────────────────────────────────────────────────────────────────────
tab_overview, tab_delivery, tab_profit, tab_anom, tab_geo = st.tabs(
    ["📊 Overview", "🚚 Delivery", "💰 Profitability", "⚠️ Anomalies", "🌍 Geography"]
)

# ══════════════════════════════════════════════════════════════════════════════
# OVERVIEW
# ══════════════════════════════════════════════════════════════════════════════
with tab_overview:
    # Auto-insight callouts
    insights = generate_insights(fdf)
    if insights:
        cols = st.columns(min(len(insights), 3))
        for i, ins in enumerate(insights[:3]):
            cols[i].markdown(
                f"<div class='insight {ins['tone']}'><div class='il'>{ins['label']}</div>"
                f"<div class='it'>{ins['text']}</div></div>",
                unsafe_allow_html=True,
            )
        if len(insights) > 3:
            cols2 = st.columns(min(len(insights) - 3, 3))
            for i, ins in enumerate(insights[3:6]):
                cols2[i].markdown(
                    f"<div class='insight {ins['tone']}'><div class='il'>{ins['label']}</div>"
                    f"<div class='it'>{ins['text']}</div></div>",
                    unsafe_allow_html=True,
                )
        st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)

    c1, c2, c3 = st.columns([2, 2.2, 1.5])

    with card(c1, "Revenue by Market", "Total sales per global market"):
        try:
            ms = fdf.groupby("Market")["Sales"].sum().sort_values()
            colors = [BRAND_SOFT] * len(ms)
            colors[-1] = BRAND
            fig = go.Figure(go.Bar(
                x=ms.values, y=ms.index, orientation="h", marker_color=colors,
                text=[fmt_money(v) for v in ms.values], textposition="outside",
                textfont=dict(size=10, color=INK),
                hovertemplate="%{y}: %{text}<extra></extra>",
            ))
            style_fig(fig, 300)
            fig.update_layout(xaxis=dict(showgrid=True, gridcolor=GRID, tickprefix="$"),
                              yaxis=dict(showgrid=False))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    with card(c2, "Revenue & Profit Trend", "Monthly sales against profit"):
        try:
            tr = (fdf.groupby("order_yearmonth")
                  .agg(Sales=("Sales", "sum"), Profit=("Order Profit Per Order", "sum"))
                  .reset_index().sort_values("order_yearmonth"))
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=tr["order_yearmonth"], y=tr["Sales"], name="Sales", mode="lines",
                fill="tozeroy", line=dict(color=BRAND, width=2.6, shape="spline"),
                fillcolor="rgba(43,95,207,0.09)",
                hovertemplate="%{x}<br>Sales %{y:$,.0f}<extra></extra>"))
            fig.add_trace(go.Scatter(
                x=tr["order_yearmonth"], y=tr["Profit"], name="Profit", mode="lines",
                line=dict(color=MINT, width=2, dash="dot", shape="spline"),
                hovertemplate="%{x}<br>Profit %{y:$,.0f}<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(
                legend=dict(orientation="h", y=1.08, x=1, xanchor="right", yanchor="bottom"),
                yaxis=dict(gridcolor=GRID, tickprefix="$"))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    with card(c3, "Order Status", "Share of orders by status"):
        try:
            sc = fdf["Order Status"].value_counts()
            cmap = {"COMPLETE": MINT, "PENDING": AMBER, "PENDING_PAYMENT": "#F4C430",
                    "CLOSED": BRAND, "CANCELED": RED, "SUSPECTED_FRAUD": "#8B5CF6",
                    "ON_HOLD": "#64748B", "PAYMENT_REVIEW": "#0EA5E9", "PROCESSING": BRAND_SOFT}
            fig = go.Figure(go.Pie(
                labels=sc.index, values=sc.values, hole=0.62, sort=True,
                direction="clockwise", domain=dict(y=[0.28, 1.0]),
                marker=dict(colors=[cmap.get(s, MUTED) for s in sc.index]),
                textinfo="percent", textposition="inside", insidetextorientation="horizontal",
                textfont=dict(size=10, color="white"),
                hovertemplate="%{label}: %{value:,} orders<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(
                showlegend=True,
                legend=dict(orientation="h", font=dict(size=9), x=0.5, xanchor="center",
                            y=-0.02, yanchor="top", traceorder="normal"))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    e1, e2 = st.columns([1.5, 1])
    with card(e1, "Top 10 Product Categories", "By total revenue"):
        try:
            tc = fdf.groupby("Category Name")["Sales"].sum().sort_values().tail(10)
            fig = go.Figure(go.Bar(
                x=tc.values, y=tc.index, orientation="h", marker_color=grad(len(tc)),
                text=[fmt_money(v) for v in tc.values], textposition="outside",
                textfont=dict(size=10, color=INK),
                hovertemplate="%{y}: %{text}<extra></extra>"))
            style_fig(fig, 320)
            fig.update_layout(xaxis=dict(showgrid=True, gridcolor=GRID, tickprefix="$"),
                              yaxis=dict(showgrid=False, tickfont=dict(size=10)))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    with card(e2, "Revenue by Customer Segment", "Sales split across segments"):
        try:
            seg = fdf.groupby("Customer Segment")["Sales"].sum().sort_values(ascending=False)
            fig = go.Figure(go.Bar(
                x=seg.index, y=seg.values,
                marker_color=[BRAND, "#5B8DEF", BRAND_SOFT][:len(seg)],
                text=[fmt_money(v) for v in seg.values], textposition="outside",
                textfont=dict(size=11, color=INK),
                hovertemplate="%{x}: %{text}<extra></extra>"))
            style_fig(fig, 320)
            fig.update_layout(yaxis=dict(gridcolor=GRID, tickprefix="$"))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

# ══════════════════════════════════════════════════════════════════════════════
# DELIVERY
# ══════════════════════════════════════════════════════════════════════════════
with tab_delivery:
    d1, d2 = st.columns([1.4, 1])

    with card(d1, "Late Delivery Risk by Shipping Mode", "Share of orders flagged late-risk"):
        try:
            lm = (fdf.groupby("Shipping Mode")["Late_delivery_risk"].mean() * 100).sort_values(ascending=False)
            cmap = {"Same Day": RED, "Standard Class": AMBER, "Second Class": BRAND, "First Class": MINT}
            fig = go.Figure(go.Bar(
                x=lm.index, y=lm.values, marker_color=[cmap.get(m, MUTED) for m in lm.index],
                text=[f"{v:.0f}%" for v in lm.values], textposition="outside",
                textfont=dict(size=11, color=INK),
                hovertemplate="%{x}: %{y:.1f}%<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(yaxis=dict(gridcolor=GRID, range=[0, 100], ticksuffix="%"))
            fig.add_hline(y=late_rate, line=dict(color=RED, dash="dash", width=1.4), opacity=0.55,
                          annotation_text=f"Network avg {late_rate:.0f}%",
                          annotation_position="top right",
                          annotation_font=dict(size=10, color=RED))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    with card(d2, "Delivery Status", "On-time vs delayed outcomes"):
        try:
            ds = fdf["Delivery Status"].value_counts()
            cmap = {"Shipping on time": MINT, "Advance shipping": BRAND,
                    "Late delivery": RED, "Shipping canceled": "#64748B"}
            fig = go.Figure(go.Bar(
                x=ds.values, y=ds.index, orientation="h",
                marker_color=[cmap.get(s, MUTED) for s in ds.index],
                text=[f"{v:,}" for v in ds.values], textposition="outside",
                textfont=dict(size=10, color=INK),
                hovertemplate="%{y}: %{x:,}<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(xaxis=dict(showgrid=True, gridcolor=GRID),
                              yaxis=dict(showgrid=False))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    f1, f2 = st.columns(2)
    with card(f1, "Shipping Delay Distribution", "Real minus scheduled days (negative = early)"):
        try:
            delays = fdf["shipping_delay"].clip(-4, 8)
            fig = go.Figure(go.Histogram(
                x=delays, xbins=dict(start=-4.5, end=8.5, size=1),
                marker_color=BRAND, opacity=0.9,
                hovertemplate="%{x} days: %{y:,} orders<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(bargap=0.08, yaxis=dict(gridcolor=GRID),
                              xaxis=dict(title="days late", titlefont=dict(size=10)))
            fig.add_vline(x=0, line=dict(color=MINT, width=1.6, dash="dash"), opacity=0.7)
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    with card(f2, "Late Delivery Rate by Market", "Where deliveries slip most"):
        try:
            lmk = (fdf.groupby("Market")["Late_delivery_risk"].mean() * 100).sort_values()
            colors = [MINT if v < 50 else AMBER if v < 60 else RED for v in lmk.values]
            fig = go.Figure(go.Bar(
                x=lmk.values, y=lmk.index, orientation="h", marker_color=colors,
                text=[f"{v:.0f}%" for v in lmk.values], textposition="outside",
                textfont=dict(size=10, color=INK),
                hovertemplate="%{y}: %{x:.1f}% late<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(xaxis=dict(showgrid=True, gridcolor=GRID, ticksuffix="%", range=[0, 100]),
                              yaxis=dict(showgrid=False))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

# ══════════════════════════════════════════════════════════════════════════════
# PROFITABILITY
# ══════════════════════════════════════════════════════════════════════════════
with tab_profit:
    p1, p2 = st.columns(2)

    with card(p1, "Profit by Market", "Total profit contribution"):
        try:
            pm = fdf.groupby("Market")["Order Profit Per Order"].sum().sort_values()
            colors = [RED if v < 0 else BRAND for v in pm.values]
            fig = go.Figure(go.Bar(
                x=pm.values, y=pm.index, orientation="h", marker_color=colors,
                text=[fmt_money(v) for v in pm.values], textposition="outside",
                textfont=dict(size=10, color=INK),
                hovertemplate="%{y}: %{text}<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(xaxis=dict(showgrid=True, gridcolor=GRID, tickprefix="$"),
                              yaxis=dict(showgrid=False))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    with card(p2, "Profit Margin by Category", "Best & worst average margins"):
        try:
            cm = fdf.groupby("Category Name")["profit_margin_pct"].mean().sort_values()
            cm = pd.concat([cm.head(6), cm.tail(6)])
            colors = [RED if v < 0 else MINT for v in cm.values]
            fig = go.Figure(go.Bar(
                x=cm.values, y=cm.index, orientation="h", marker_color=colors,
                text=[f"{v:.0f}%" for v in cm.values], textposition="outside",
                textfont=dict(size=9, color=INK),
                hovertemplate="%{y}: %{x:.1f}%<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(xaxis=dict(showgrid=True, gridcolor=GRID, ticksuffix="%"),
                              yaxis=dict(showgrid=False, tickfont=dict(size=9)))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    g1, g2 = st.columns([1, 1])
    with card(g1, "Discount vs Profit", "Each point an order — discounting that destroys margin"):
        try:
            s = fdf.sample(min(4000, len(fdf)), random_state=1)
            fig = go.Figure(go.Scattergl(
                x=s["Order Item Discount Rate"] * 100, y=s["Order Profit Per Order"],
                mode="markers",
                marker=dict(size=5, color=s["profit_margin_pct"],
                            colorscale=[[0, RED], [0.5, AMBER], [1, MINT]],
                            cmin=-50, cmax=50, opacity=0.55,
                            colorbar=dict(title="margin %", thickness=9, len=0.7)),
                hovertemplate="Disc %{x:.0f}%<br>Profit %{y:$,.0f}<extra></extra>"))
            style_fig(fig, 320)
            fig.update_layout(xaxis=dict(title="discount %", titlefont=dict(size=10), ticksuffix="%"),
                              yaxis=dict(gridcolor=GRID, title="profit $", titlefont=dict(size=10)))
            fig.add_hline(y=0, line=dict(color=MUTED, width=1, dash="dot"), opacity=0.5)
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    with card(g2, "Top 10 Loss-Making Products", "Biggest cumulative losses"):
        try:
            lp = fdf.groupby("Product Name")["Order Profit Per Order"].sum().sort_values().head(10)
            lp = lp[lp < 0].sort_values(ascending=True)
            if len(lp):
                fig = go.Figure(go.Bar(
                    x=lp.values, y=lp.index, orientation="h", marker_color=RED,
                    text=[fmt_money(v) for v in lp.values], textposition="outside",
                    textfont=dict(size=9, color=INK),
                    hovertemplate="%{y}: %{text}<extra></extra>"))
                style_fig(fig, 320)
                fig.update_layout(xaxis=dict(showgrid=True, gridcolor=GRID, tickprefix="$"),
                                  yaxis=dict(showgrid=False, tickfont=dict(size=9)))
                show(fig)
            else:
                st.info("No loss-making products in this selection. 🎉")
        except Exception:
            st.warning("Chart unavailable")

# ══════════════════════════════════════════════════════════════════════════════
# ANOMALIES
# ══════════════════════════════════════════════════════════════════════════════
with tab_anom:
    try:
        anomalies = run_detectors(fdf)
    except Exception:
        anomalies = pd.DataFrame()

    st.markdown("<div class='anomaly-panel'>", unsafe_allow_html=True)
    h1, h2 = st.columns([3, 1])
    with h1:
        st.markdown(
            "<div style='font-size:17px;font-weight:700;color:#0B1437'>⚠️ Anomaly Detection Engine</div>"
            "<div style='font-size:12px;color:#3F5A50;margin-top:3px'>"
            "Rule-based detectors + Isolation Forest · revenue leaks, margin erosion, "
            "severe delays and statistical outliers</div>",
            unsafe_allow_html=True)
    with h2:
        n = 0 if anomalies.empty else len(anomalies)
        st.markdown(f"<div style='text-align:right'><span class='pill' style='background:#1D9E75'>"
                    f"{n} flagged</span></div>", unsafe_allow_html=True)

    st.markdown("<div style='height:14px'></div>", unsafe_allow_html=True)

    counts = {} if anomalies.empty else anomalies["anomaly_type"].value_counts().to_dict()
    leak_impact = 0.0 if anomalies.empty else \
        anomalies.loc[anomalies["anomaly_type"] == "Revenue Leak", "Order Profit Per Order"].sum()

    sc = st.columns(4)

    def astat(col, n, lab, sub=""):
        sub_html = f"<div class='s'>{sub}</div>" if sub else "<div class='s'>&nbsp;</div>"
        col.markdown(f"<div class='astat'><div class='n'>{n}</div><div class='l'>{lab}</div>{sub_html}</div>",
                     unsafe_allow_html=True)

    astat(sc[0], counts.get("Revenue Leak", 0), "Revenue Leak",
          f"{fmt_money(leak_impact)} impact" if leak_impact else "—")
    astat(sc[1], counts.get("Margin Erosion", 0), "Margin Erosion")
    astat(sc[2], counts.get("Severe Delay", 0), "Severe Delay")
    astat(sc[3], counts.get("ML Anomaly", 0), "ML Anomaly")

    if not anomalies.empty:
        sev = anomalies["severity"].value_counts().to_dict()
        scol = {"High": RED, "Medium": AMBER, "Low": BRAND}
        pills = "".join(f"<span class='pill' style='background:{scol.get(k, MUTED)}'>{k}: {sev.get(k, 0)}</span>"
                        for k in ["High", "Medium", "Low"])
        st.markdown(f"<div style='margin-top:16px'>{pills}</div>", unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)

    if not anomalies.empty:
        cols = ["order_date", "Product Name", "Market", "Shipping Mode", "Sales",
                "Order Profit Per Order", "shipping_delay", "anomaly_type", "severity"]
        cols = [c for c in cols if c in anomalies.columns]
        t = anomalies[cols].copy()
        t["order_date"] = pd.to_datetime(t["order_date"]).dt.date
        t = t.rename(columns={"Order Profit Per Order": "Profit", "shipping_delay": "Delay",
                              "anomaly_type": "Type", "Product Name": "Product",
                              "Shipping Mode": "Ship Mode", "order_date": "Date"})

        def sev_color(v):
            return f"color:{ {'High': RED, 'Medium': AMBER, 'Low': BRAND}.get(v, MUTED) };font-weight:700"

        styled = (t.style.map(sev_color, subset=["severity"])
                  .format({"Sales": "${:,.0f}", "Profit": "${:,.0f}", "Delay": "{:.0f}d"}))
        st.dataframe(styled, use_container_width=True, height=340, hide_index=True)
    else:
        st.info("No anomalies detected for this selection. 🎉")

# ══════════════════════════════════════════════════════════════════════════════
# GEOGRAPHY
# ══════════════════════════════════════════════════════════════════════════════
with tab_geo:
    gg1, gg2 = st.columns([1.7, 1])
    with card(gg1, "Global Sales by Market & Region", "Market → Region → Customer Segment"):
        try:
            tdf = fdf.dropna(subset=["Market", "Order Region", "Customer Segment"])
            fig = px.treemap(
                tdf, path=[px.Constant("All Markets"), "Market", "Order Region", "Customer Segment"],
                values="Sales", color="Sales",
                color_continuous_scale=["#EEF2FB", "#C8D9F5", "#2B5FCF"])
            fig.update_layout(margin=dict(t=20, l=4, r=4, b=4), height=420,
                              paper_bgcolor="rgba(0,0,0,0)",
                              font=dict(family="Inter", size=11, color="#5C6478"),
                              coloraxis_colorbar=dict(title="", thickness=9))
            fig.update_traces(marker_line_width=1, marker_line_color="white",
                              hovertemplate="<b>%{label}</b><br>Sales %{value:$,.0f}<extra></extra>")
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    with card(gg2, "Top 10 Countries by Orders", "Highest order volume"):
        try:
            tcty = fdf["Order Country"].value_counts().head(10).sort_values()
            fig = go.Figure(go.Bar(
                x=tcty.values, y=tcty.index, orientation="h", marker_color=grad(len(tcty)),
                text=[f"{v:,}" for v in tcty.values], textposition="outside",
                textfont=dict(size=9, color=INK),
                hovertemplate="%{y}: %{x:,} orders<extra></extra>"))
            style_fig(fig, 420)
            fig.update_layout(xaxis=dict(showgrid=True, gridcolor=GRID),
                              yaxis=dict(showgrid=False, tickfont=dict(size=9)))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    h1, h2 = st.columns([1, 1.4])
    with card(h1, "Revenue Distribution by Band", "Order count per sales band"):
        try:
            bc = fdf["revenue_band"].value_counts().sort_index()
            fig = go.Figure(go.Bar(
                x=[str(b) for b in bc.index], y=bc.values, marker_color=grad(len(bc)),
                text=[f"{v:,}" for v in bc.values], textposition="outside",
                textfont=dict(size=10, color=INK),
                hovertemplate="%{x}: %{y:,} orders<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(yaxis=dict(gridcolor=GRID))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

    with card(h2, "Sales & Profit by Region", "Top 12 order regions"):
        try:
            rg = (fdf.groupby("Order Region")
                  .agg(Sales=("Sales", "sum"), Profit=("Order Profit Per Order", "sum"))
                  .sort_values("Sales", ascending=False).head(12).sort_values("Sales"))
            fig = go.Figure()
            fig.add_trace(go.Bar(x=rg["Sales"], y=rg.index, orientation="h", name="Sales",
                                 marker_color=BRAND_SOFT,
                                 hovertemplate="%{y}<br>Sales %{x:$,.0f}<extra></extra>"))
            fig.add_trace(go.Bar(x=rg["Profit"], y=rg.index, orientation="h", name="Profit",
                                 marker_color=MINT,
                                 hovertemplate="%{y}<br>Profit %{x:$,.0f}<extra></extra>"))
            style_fig(fig, 300)
            fig.update_layout(barmode="group", xaxis=dict(showgrid=True, gridcolor=GRID, tickprefix="$"),
                              yaxis=dict(showgrid=False, tickfont=dict(size=9)),
                              legend=dict(orientation="h", y=1.06, x=1, xanchor="right"))
            show(fig)
        except Exception:
            st.warning("Chart unavailable")

# ──────────────────────────────────────────────────────────────────────────────
# Footer
# ──────────────────────────────────────────────────────────────────────────────
st.markdown(
    "<footer class='app-foot'>Supply Chain Intelligence · built by <strong>Shweta Pasi</strong> · "
    "data: DataCo Smart Supply Chain (Kaggle) · "
    "<a href='https://github.com/Shweta0129'>github.com/Shweta0129</a> · "
    "<a href='https://linkedin.com/in/shweta-pasi'>linkedin.com/in/shweta-pasi</a></footer>",
    unsafe_allow_html=True,
)

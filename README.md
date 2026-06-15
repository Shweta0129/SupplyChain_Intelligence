# 📦 Supply Chain Intelligence

A modern, fintech-styled supply chain analytics dashboard built on **180K orders**
from DataCo Global. No API keys. No paid services. Runs 100% locally and offline.

![Built with](https://img.shields.io/badge/Built%20with-Streamlit%20%2B%20Plotly-2B5FCF)

## Setup

```bash
# 1. Download the dataset from Kaggle (link below)
#    DataCoSupplyChainDataset.csv  →  place it inside the data/ folder

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
streamlit run app.py
```

Dataset: https://www.kaggle.com/datasets/shashwatwork/dataco-smart-supply-chain-for-big-data-analysis

> The CSV (~95 MB) is intentionally **not** committed to the repo. Download it
> from Kaggle and drop it into `data/`.

## Features

- **6 live KPI cards** — sales, profit, orders, margin, late-delivery rate, avg
  delay — each with a green/red delta vs. the full (unfiltered) dataset.
- **Revenue by Market** — horizontal bars, top market highlighted in deep blue.
- **Revenue & Profit Trend** — smooth blue area + dotted green profit line (2015–2018).
- **Order Status** donut.
- **Late Delivery Risk by Shipping Mode** — with overall-average reference line.
- **Top 10 Product Categories** by revenue.
- **Anomaly Detection Engine** — rule-based detectors (revenue leaks, margin
  erosion, severe delays) + an Isolation Forest for statistical outliers, with a
  severity-coloured table.
- **Global treemap** — Market → Region → Customer Segment.
- **Revenue distribution by band** + **Top 10 countries by orders**.
- **Fully filterable sidebar** — Market, Segment, Shipping Mode, Department, Year,
  Order Status.

## Deploy (free, no credit card)

This app deploys on **Streamlit Community Cloud** straight from GitHub. The
dataset ships gzipped in the repo (`data/DataCoSupplyChainDataset.csv.gz`, ~18 MB),
so there's nothing else to host — the loader reads the compressed file directly.

1. Create an empty repo on GitHub named **SupplyChain_Intelligence** (no README).
2. Push this project:
   ```bash
   git remote add origin https://github.com/<your-username>/SupplyChain_Intelligence.git
   git push -u origin main
   ```
3. Go to **share.streamlit.io** → sign in with GitHub → **New app**.
4. Pick the repo, branch `main`, main file `app.py` → **Deploy**.

Your app goes live at `https://<something>.streamlit.app` in ~2 minutes.

> Hosting the data elsewhere instead? Set a `DATA_URL` secret (app → Settings →
> Secrets) to a direct CSV link and the loader will fetch from there.

## Project structure

```
supply-chain-intelligence/
├── app.py                 # Streamlit UI + all charts
├── src/
│   ├── __init__.py
│   ├── loader.py          # cached CSV loading
│   ├── transform.py       # cleaning, feature engineering, filtering
│   └── anomaly.py         # rule-based + ML anomaly detection
├── .streamlit/config.toml # theme
├── data/                  # place DataCoSupplyChainDataset.csv here
├── requirements.txt
├── Procfile               # Heroku / Render deployment
└── README.md
```

## Author

**Shweta Pasi** · Data Analyst
[LinkedIn](https://linkedin.com/in/shweta-pasi) · [GitHub](https://github.com/Shweta0129)

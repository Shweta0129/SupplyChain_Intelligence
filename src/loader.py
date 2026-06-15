"""Data loading utilities for Supply Chain Intelligence."""

import os
from pathlib import Path

import pandas as pd
import streamlit as st

# Local candidates, in priority order: the raw CSV (fast, used in local dev) or
# the gzipped copy that ships in the repo for deployment (~18 MB vs ~92 MB).
LOCAL_PATHS = [
    Path("data/DataCoSupplyChainDataset.csv"),
    Path("data/DataCoSupplyChainDataset.csv.gz"),
]


def _read_csv(source) -> pd.DataFrame:
    """Read the CSV with the encoding the DataCo export actually ships in."""
    try:
        return pd.read_csv(source, encoding="latin-1")
    except Exception:
        return pd.read_csv(source, encoding="utf-8")


def _data_url() -> str | None:
    """A remote CSV location, for cloud deploys where the file isn't in the repo.

    Set it either as a Streamlit secret (DATA_URL) or an environment variable.
    On Streamlit Community Cloud: app → Settings → Secrets → DATA_URL = "https://…".
    """
    try:
        if "DATA_URL" in st.secrets:
            return str(st.secrets["DATA_URL"])
    except Exception:
        pass
    return os.environ.get("DATA_URL")


@st.cache_data(ttl=600, show_spinner="Loading supply chain data…")
def load_data() -> pd.DataFrame:
    """Load the DataCo dataset — from the local data/ folder, or a hosted URL.

    Local file wins when present (fast, offline). Otherwise, if DATA_URL is
    configured, the file is streamed from there so the deployed app still works.
    """
    for path in LOCAL_PATHS:
        if path.exists():
            return _read_csv(path)

    url = _data_url()
    if url:
        try:
            return _read_csv(url)
        except Exception as exc:  # surface a clear, actionable message
            st.error(f"Could not load data from DATA_URL.\n\n`{exc}`")
            st.stop()

    st.error(
        """
        ⚠️ **Dataset not found.**

        **Running locally?**
        1. Download **DataCoSupplyChainDataset.csv** from
           [Kaggle](https://www.kaggle.com/datasets/shashwatwork/dataco-smart-supply-chain-for-big-data-analysis)
        2. Place it inside the **data/** folder, then refresh.

        **Deployed (Streamlit Cloud / Render / Spaces)?**
        Set a **DATA_URL** secret pointing to a hosted copy of the CSV
        (e.g. a GitHub Release asset), then reboot the app.
        """
    )
    st.stop()

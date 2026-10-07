"""Shared helpers: data loading, percentile binning, estimators and JSON output."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from fetch_data import RAW, fetch, sha256

ROOT = Path(__file__).resolve().parents[1]
WEB_DATA = ROOT / "web" / "src" / "data"
FIGURES = ROOT / "report" / "figures"
TABLES = ROOT / "report" / "tables"
CACHE = ROOT / "data" / "cache"

SEED = 0
N_BOOT = 1000


def load() -> pd.DataFrame:
    """Load the synthetic cohort and add the derived columns used everywhere."""
    fetch()
    df = pd.read_csv(RAW)
    df["black"] = (df["race"] == "black").astype(int)
    df["pct"] = score_percentile(df["risk_score_t"].to_numpy())
    df["pct_r"] = r_style_percentile(df["risk_score_t"].to_numpy())
    return df


def score_percentile(score: np.ndarray) -> np.ndarray:
    """Percentile 0..99 from the rank of the score (ties broken by row order).

    Percentile p holds the patients ranked in the (p, p+1]% band, so
    "at or above the 97th percentile" is exactly the top 3% of the population.
    """
    order = np.argsort(score, kind="stable")
    rank = np.empty(len(score), dtype=np.int64)
    rank[order] = np.arange(len(score))
    return np.floor(rank * 100 / len(score)).astype(int)


def r_style_percentile(score: np.ndarray) -> np.ndarray:
    """Replicates R's cut(x, quantile(x, 0:100/100), include.lowest=TRUE, labels=FALSE).

    Used only for the counterfactual-swap replication so that our numbers can be
    checked against the original authors' published synthetic-data output.
    Labels run 1..100, so `>= 97` keeps roughly the top 4%.
    """
    breaks = np.unique(np.quantile(score, np.linspace(0, 1, 101)))
    return np.maximum(np.searchsorted(breaks, score, side="left"), 1)


def within_gap(y: np.ndarray, x: np.ndarray, group: np.ndarray) -> float:
    """OLS coefficient on x in y ~ x + C(group) (fixed effects by group)."""
    g = np.asarray(group)
    n = np.bincount(g)
    n_safe = np.where(n == 0, 1, n)
    x_dm = x - (np.bincount(g, weights=x) / n_safe)[g]
    y_dm = y - (np.bincount(g, weights=y) / n_safe)[g]
    return float((x_dm * y_dm).sum() / (x_dm * x_dm).sum())


def bootstrap(stat, n: int, b: int = N_BOOT, seed: int = SEED) -> dict:
    """Percentile bootstrap: `stat(idx)` is evaluated on resampled row indices."""
    rng = np.random.default_rng(seed)
    est = stat(np.arange(n))
    draws = np.array([stat(rng.integers(0, n, n)) for _ in range(b)])
    lo, hi = np.nanpercentile(draws, [2.5, 97.5])
    return {"est": rnd(est), "lo": rnd(lo), "hi": rnd(hi)}


def mean_ci(values: np.ndarray) -> tuple[float, float, float]:
    """Mean with a normal-approximation 95% interval."""
    v = values[~np.isnan(values)]
    if len(v) < 2:
        return (float("nan"),) * 3
    m = v.mean()
    se = v.std(ddof=1) / np.sqrt(len(v))
    return m, m - 1.96 * se, m + 1.96 * se


def kernel_smooth(x: np.ndarray, y: np.ndarray, w: np.ndarray, bandwidth: float = 4.0) -> np.ndarray:
    """Count-weighted Gaussian kernel smoother over percentile bins."""
    ok = ~np.isnan(y) & (w > 0)
    out = np.full(len(x), np.nan)
    for i, xi in enumerate(x):
        k = np.exp(-0.5 * ((x[ok] - xi) / bandwidth) ** 2) * w[ok]
        out[i] = (k * y[ok]).sum() / k.sum()
    return out


def need_weights(need: np.ndarray, k_frac: float) -> np.ndarray:
    """Membership weight in the top-k "truly high-need" group.

    Chronic-condition counts are integers with heavy ties, so patients exactly at
    the cut-off share the remaining places fractionally. This keeps the group size
    at exactly k without a random tie-break.
    """
    n_top = int(round(k_frac * len(need)))
    if n_top == 0:
        return np.zeros(len(need))
    cutoff = np.sort(need)[::-1][n_top - 1]
    above = need > cutoff
    at = need == cutoff
    w = above.astype(float)
    w[at] = (n_top - above.sum()) / at.sum()
    return w


def top_k_mask(score: np.ndarray, k_frac: float) -> np.ndarray:
    n_top = int(round(k_frac * len(score)))
    mask = np.zeros(len(score), dtype=bool)
    mask[np.argsort(-score, kind="stable")[:n_top]] = True
    return mask


def excess_conditions(need: np.ndarray, black: np.ndarray, score: np.ndarray) -> float:
    """Total extra chronic illness carried by Black patients at the same score.

    For each score percentile: n_black * (mean conditions Black - mean conditions White),
    summed over percentiles. Zero means the score ranks both groups equally sick.
    """
    pct = score_percentile(score)
    total = 0.0
    for p in range(100):
        in_p = pct == p
        b = need[in_p & (black == 1)]
        w = need[in_p & (black == 0)]
        if len(b) and len(w):
            total += len(b) * (b.mean() - w.mean())
    return total


def rnd(x, digits: int = 4):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return round(float(x), digits)


def write_json(name: str, payload) -> Path:
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    path = WEB_DATA / f"{name}.json"
    path.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False))
    return path


def data_hash() -> str:
    return sha256(RAW)


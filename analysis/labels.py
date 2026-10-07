"""Label-choice experiment and mitigation frontier.

Trains the same model class on three different labels (total cost, avoidable
cost, active chronic conditions) using identical features, then asks who ends up
in the top of each ranking. This isolates the effect of the *label* from the
effect of the features or the model.
"""
from __future__ import annotations

import pickle
import warnings

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.linear_model import LassoCV
from sklearn.model_selection import KFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from common import (
    CACHE,
    N_BOOT,
    SEED,
    excess_conditions,
    need_weights,
    rnd,
    top_k_mask,
    write_json,
)

LABELS = {
    "cost": ("log_cost_t", "Total cost"),
    "avoidable": ("log_cost_avoidable_t", "Avoidable cost"),
    "health": ("gagne_sum_t", "Active chronic conditions"),
}

# Spurious floating-point flags raised by the macOS Accelerate BLAS inside sklearn's
# matrix products; predictions and coefficients are unaffected.
warnings.filterwarnings("ignore", message=".*encountered in matmul", category=RuntimeWarning)

# Black share among the top 3% in the paper's Table 2 (real data), for the fidelity table.
PAPER_TABLE2 = {"cost": 0.141, "avoidable": 0.210, "health": 0.267}
K_MAIN = 0.03


def feature_columns(df: pd.DataFrame) -> list[str]:
    """Year t-1 claims, labs, medications and demographics. Race is never a feature."""
    cols = [c for c in df.columns if c.endswith("_tm1")] + ["dem_female"]
    leaked = [c for c in cols if c.endswith("_t") or c in ("race", "black", "risk_score_t", "program_enrolled_t")]
    assert not leaked, leaked
    return cols


def split(df: pd.DataFrame, frac_train: float = 0.6) -> np.ndarray:
    """Deterministic 60/40 split (the synthetic data has no patient id to group on)."""
    perm = np.random.RandomState(SEED).permutation(len(df))
    is_train = np.zeros(len(df), dtype=bool)
    is_train[perm[: int(frac_train * len(df))]] = True
    return is_train


def fit(x: np.ndarray, y: np.ndarray, name: str):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"lasso_{name}.pkl"
    if path.exists():
        return pickle.loads(path.read_bytes())
    model = make_pipeline(
        StandardScaler(),
        LassoCV(cv=KFold(10, shuffle=True, random_state=SEED), alphas=100, max_iter=10000, n_jobs=-1),
    )
    model.fit(x, y)
    path.write_bytes(pickle.dumps(model))
    return model


def zscore(v: np.ndarray) -> np.ndarray:
    return (v - v.mean()) / v.std()


def concentration(score: np.ndarray, hold: pd.DataFrame, k: float) -> dict:
    """Share of each outcome captured by the top-k% of a ranking (Table 2 metrics)."""
    sel = top_k_mask(score, k)
    need = hold["gagne_sum_t"].to_numpy(float)
    black = hold["black"].to_numpy()
    return {
        "black_share": hold["black"].to_numpy()[sel].mean(),
        "cost_share": hold["cost_t"].to_numpy()[sel].sum() / hold["cost_t"].sum(),
        "avoidable_share": hold["cost_avoidable_t"].to_numpy()[sel].sum() / hold["cost_avoidable_t"].sum(),
        "health_share": need[sel].sum() / need.sum(),
        "excess": excess_conditions(need, black, score),
    }


def fairness(score: np.ndarray, hold: pd.DataFrame, k: float, high_need: np.ndarray | None = None) -> dict:
    """Who is selected, compared with who is truly high-need.

    By default "high need" is the capacity-matched top-k by realised chronic
    conditions (fractional membership at ties). `high_need` can supply any other
    0/1 or weighted definition for sensitivity checks.
    """
    sel = top_k_mask(score, k)
    black = hold["black"].to_numpy() == 1
    w = need_weights(hold["gagne_sum_t"].to_numpy(float), k) if high_need is None else high_need
    share_sel = sel[black].sum() / sel.sum()
    share_need = w[black].sum() / w.sum()
    tpr_b = (w * sel)[black].sum() / w[black].sum()
    tpr_w = (w * sel)[~black].sum() / w[~black].sum()
    ppv_b = w[sel & black].sum() / (sel & black).sum()
    ppv_w = w[sel & ~black].sum() / (sel & ~black).sum()
    return {
        "black_share": rnd(share_sel),
        "need_black_share": rnd(share_need),
        "rep_ratio": rnd(share_sel / share_need),
        "tpr_b": rnd(tpr_b),
        "tpr_w": rnd(tpr_w),
        "ppv_b": rnd(ppv_b),
        "ppv_w": rnd(ppv_w),
        "sel_ratio": rnd(sel[black].mean() / sel[~black].mean()),
    }


def boot_black_share(score: np.ndarray, black: np.ndarray, k: float, seed: int) -> list[float]:
    """Bootstrap CI for the Black share of the top-k, holding the fitted model fixed."""
    rng = np.random.default_rng(seed)
    n = len(score)
    draws = []
    for _ in range(N_BOOT):
        i = rng.integers(0, n, n)
        draws.append(black[i][top_k_mask(score[i], k)].mean())
    return [rnd(v) for v in np.percentile(draws, [2.5, 97.5])]


def run(df: pd.DataFrame) -> dict:
    df = df.copy()
    df["log_cost_t"] = np.log1p(df["cost_t"])
    df["log_cost_avoidable_t"] = np.log1p(df["cost_avoidable_t"])
    cols = feature_columns(df)
    is_train = split(df)
    train, hold = df[is_train], df[~is_train].reset_index(drop=True)

    preds = {}
    for key, (target, _) in LABELS.items():
        model = fit(train[cols].to_numpy(float), train[target].to_numpy(float), key)
        preds[key] = model.predict(hold[cols].to_numpy(float))
        print(f"  fitted {key}: {np.count_nonzero(model[-1].coef_)} non-zero coefficients")
    scores = {"commercial": hold["risk_score_t"].to_numpy(float), **preds}
    names = {"commercial": "Commercial risk score", **{k: v[1] for k, v in LABELS.items()}}
    black = hold["black"].to_numpy()

    # Table 2 analogue at the programme threshold (top 3%).
    table = []
    base_excess = None
    for i, (key, score) in enumerate(scores.items()):
        c = concentration(score, hold, K_MAIN)
        if key == "cost":
            base_excess = c["excess"]
        table.append({
            "key": key,
            "label": names[key],
            "black_share": rnd(c["black_share"]),
            "black_ci": boot_black_share(score, black, K_MAIN, seed=10 + i),
            "cost_share": rnd(c["cost_share"]),
            "avoidable_share": rnd(c["avoidable_share"]),
            "health_share": rnd(c["health_share"]),
            "excess": rnd(c["excess"], 1),
            "paper_black_share": PAPER_TABLE2.get(key),
        })
    for row in table:
        row["excess_reduction"] = rnd(1 - row["excess"] / base_excess)

    # Blend frontier: alpha * cost + (1 - alpha) * health on standardised predictions.
    alphas = [round(a, 2) for a in np.linspace(0, 1, 21)]
    ks = [0.01, 0.02, 0.03, 0.05, 0.1]
    z_cost, z_health = zscore(preds["cost"]), zscore(preds["health"])
    need = hold["gagne_sum_t"].to_numpy(float)
    blend = []
    for a in alphas:
        s = a * z_cost + (1 - a) * z_health
        ex = excess_conditions(need, black, s)
        row = {"alpha": a, "excess_reduction": rnd(1 - ex / base_excess)}
        for k in ks:
            c = concentration(s, hold, k)
            row[f"k{int(k * 100)}"] = {
                "black": rnd(c["black_share"]),
                "cost": rnd(c["cost_share"]),
                "avoidable": rnd(c["avoidable_share"]),
                "health": rnd(c["health_share"]),
                "rep_ratio": fairness(s, hold, k)["rep_ratio"],
            }
        blend.append(row)

    # Sanity check: blending predictions ~ training on the blended label.
    y_blend = 0.5 * zscore(train["log_cost_t"].to_numpy(float)) + 0.5 * zscore(train["gagne_sum_t"].to_numpy(float))
    direct = fit(train[cols].to_numpy(float), y_blend, "blend50").predict(hold[cols].to_numpy(float))
    rho = spearmanr(direct, 0.5 * z_cost + 0.5 * z_health).statistic

    # Threshold explorer: every score, every programme threshold from 50th to 99th.
    thresholds = []
    for p in range(50, 100):
        k = (100 - p) / 100
        thresholds.append({"p": p, **{key: fairness(s, hold, k) for key, s in scores.items()}})

    # Sensitivity of the headline fairness numbers to the definition of "high need".
    uncontrolled = (
        (hold["ghba1c_mean_t"].fillna(0) >= 9) | (hold["bps_mean_t"].fillna(0) >= 140)
    ).to_numpy(float)
    many_conditions = (need >= 3).astype(float)
    sensitivity = {
        "conditions_topk": {k: fairness(s, hold, K_MAIN) for k, s in scores.items()},
        "conditions_ge3": {k: fairness(s, hold, K_MAIN, many_conditions) for k, s in scores.items()},
        "uncontrolled": {k: fairness(s, hold, K_MAIN, uncontrolled) for k, s in scores.items()},
    }

    labels_out = {
        "n_holdout": len(hold),
        "n_train": int(is_train.sum()),
        "n_features": len(cols),
        "k": K_MAIN,
        "rows": table,
        "blend_check_spearman": rnd(rho),
        "vendor_replication": {"excess_before": 48772, "excess_after": 7758, "reduction": 0.84},
    }
    write_json("labels", labels_out)
    write_json("blend", {"alphas": alphas, "ks": ks, "rows": blend})
    write_json("thresholds", {"rows": thresholds, "sensitivity": sensitivity})
    return labels_out


if __name__ == "__main__":
    from common import load

    out = run(load())
    for r in out["rows"]:
        print(r)
    print("blend spearman:", out["blend_check_spearman"])

"""Bias audit of the commercial risk score on the synthetic cohort.

Reproduces the core diagnostics of Obermeyer et al. (2019): calibration of the
score against health versus cost, the cost-at-equal-health mechanism, biomarker
checks, and the counterfactual "swap" exercise (with the 2022 bug fix).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import (
    bootstrap,
    data_hash,
    kernel_smooth,
    mean_ci,
    rnd,
    within_gap,
    write_json,
)

PAPER = {
    "n_patient_years": 100009,
    "black_share_top3": 0.177,
    "swap_after_published": 0.465,
    "swap_after_corrected": 0.59,
    "conditions_top3_black": 4.8,
    "conditions_top3_white": 3.8,
    "cost_gap_equal_health": -1801,
}

BIOMARKERS = [
    ("ghba1c_mean_t", "HbA1c", "%", "higher is worse", 9.0),
    ("bps_mean_t", "Systolic blood pressure", "mmHg", "higher is worse", 140.0),
    ("cre_mean_t", "Creatinine", "mg/dL", "higher is worse", None),
    ("hct_mean_t", "Hematocrit", "%", "lower is worse", None),
    ("ldl_mean_t", "LDL cholesterol", "mg/dL", "higher is worse", None),
]


def meta(df: pd.DataFrame) -> dict:
    return {
        "n": int(len(df)),
        "n_black": int(df["black"].sum()),
        "n_white": int((1 - df["black"]).sum()),
        "share_black": rnd(df["black"].mean()),
        "n_enrolled": int(df["program_enrolled_t"].sum()),
        "sha256": data_hash(),
        "source": "https://gitlab.com/labsysmed/dissecting-bias",
        "paper": PAPER,
    }


def calibration(df: pd.DataFrame) -> dict:
    """Mean outcome by score percentile and race (Fig. 1A / 3A analogues)."""
    rows = []
    for p in range(100):
        g = df[df["pct"] == p]
        b, w = g[g["black"] == 1], g[g["black"] == 0]
        rows.append({
            "p": p,
            "nb": len(b),
            "nw": len(w),
            "hb": rnd(b["gagne_sum_t"].mean(), 3) if len(b) else None,
            "hw": rnd(w["gagne_sum_t"].mean(), 3),
            "cb": rnd(b["cost_t"].mean(), 0) if len(b) else None,
            "cw": rnd(w["cost_t"].mean(), 0),
        })
    x = np.arange(100, dtype=float)
    nb = np.array([r["nb"] for r in rows], float)
    nw = np.array([r["nw"] for r in rows], float)
    as_arr = lambda k: np.array([np.nan if r[k] is None else r[k] for r in rows], float)
    smooth = {
        "hb": kernel_smooth(x, as_arr("hb"), nb),
        "hw": kernel_smooth(x, as_arr("hw"), nw),
        "cb": kernel_smooth(x, as_arr("cb"), nb),
        "cw": kernel_smooth(x, as_arr("cw"), nw),
    }
    for i, r in enumerate(rows):
        for k, v in smooth.items():
            r[f"s_{k}"] = rnd(v[i], 3 if k.startswith("h") else 0)

    deciles = []
    for d in range(10):
        g = df[df["pct"] // 10 == d]
        entry = {"d": d}
        for race, key in ((1, "b"), (0, "w")):
            sub = g[g["black"] == race]
            for col, tag in (("gagne_sum_t", "h"), ("cost_t", "c")):
                m, lo, hi = mean_ci(sub[col].to_numpy(float))
                entry[f"{tag}{key}"] = [rnd(m, 3), rnd(lo, 3), rnd(hi, 3)]
        deciles.append(entry)

    y_h = df["gagne_sum_t"].to_numpy(float)
    y_c = df["cost_t"].to_numpy(float)
    x_b = df["black"].to_numpy(float)
    pct = df["pct"].to_numpy()
    gap_h = bootstrap(lambda i: within_gap(y_h[i], x_b[i], pct[i]), len(df))
    gap_c = bootstrap(lambda i: within_gap(y_c[i], x_b[i], pct[i]), len(df), seed=1)
    # Relative gap: Black excess as a share of the White mean at the same percentile.
    gap_c["rel"] = rnd(gap_c["est"] / df["cost_t"].mean())
    gap_h["rel"] = rnd(gap_h["est"] / df["gagne_sum_t"].mean())

    top = df[df["pct"] >= 97]
    hb, hw = top.loc[top.black == 1, "gagne_sum_t"].to_numpy(float), top.loc[top.black == 0, "gagne_sum_t"].to_numpy(float)
    top_black = top["black"].to_numpy(float)
    top_need = top["gagne_sum_t"].to_numpy(float)

    def top_gap(i):
        b = top_black[i] == 1
        return top_need[i][b].mean() - top_need[i][~b].mean()

    top3 = {
        "n": len(top),
        "black_share": bootstrap(lambda i: top_black[i].mean(), len(top), seed=2),
        "conditions_black": rnd(hb.mean(), 3),
        "conditions_white": rnd(hw.mean(), 3),
        "gap": bootstrap(top_gap, len(top), seed=3),
        "rel_gap": rnd(hb.mean() / hw.mean() - 1),
    }
    above55 = df[df["pct"] >= 55]
    return {
        "by_pct": rows,
        "by_decile": deciles,
        "gap_health": gap_h,
        "gap_cost": gap_c,
        "top3": top3,
        "black_share_55": rnd(above55["black"].mean()),
    }


def mechanism(df: pd.DataFrame) -> dict:
    """At the same number of chronic conditions, how much is spent on each group?"""
    capped = df["gagne_sum_t"].clip(upper=10).to_numpy()
    rows = []
    for k in range(11):
        g = df[capped == k]
        b, w = g[g.black == 1], g[g.black == 0]
        rows.append({
            "k": k,
            "nb": len(b),
            "nw": len(w),
            "cb": rnd(b["cost_t"].mean(), 0),
            "cw": rnd(w["cost_t"].mean(), 0),
            "ab": rnd(b["cost_avoidable_t"].mean(), 0),
            "aw": rnd(w["cost_avoidable_t"].mean(), 0),
        })
    x_b = df["black"].to_numpy(float)
    y_c = df["cost_t"].to_numpy(float)
    y_a = df["cost_avoidable_t"].to_numpy(float)
    black_need = df.loc[df.black == 1, "gagne_sum_t"]
    return {
        "by_conditions": rows,
        "black_share_le5": rnd((black_need <= 5).mean()),
        "gap_cost": bootstrap(lambda i: within_gap(y_c[i], x_b[i], capped[i]), len(df), seed=4),
        "gap_avoidable": bootstrap(lambda i: within_gap(y_a[i], x_b[i], capped[i]), len(df), seed=5),
    }


def biomarkers(df: pd.DataFrame) -> dict:
    """Biomarkers by score decile and race, plus missingness (unequal testing)."""
    out = []
    dec = df["pct"] // 10
    for col, label, unit, direction, threshold in BIOMARKERS:
        series = []
        for d in range(10):
            entry = {"d": d}
            for race, key in ((1, "b"), (0, "w")):
                v = df.loc[(dec == d) & (df.black == race), col].to_numpy(float)
                m, lo, hi = mean_ci(v)
                entry[key] = [rnd(m, 3), rnd(lo, 3), rnd(hi, 3)]
            series.append(entry)
        miss = {
            "b": rnd(df.loc[df.black == 1, col].isna().mean()),
            "w": rnd(df.loc[df.black == 0, col].isna().mean()),
        }
        x_b = df["black"].to_numpy(float)
        y = df[col].to_numpy(float)
        ok = ~np.isnan(y)
        gap = within_gap(y[ok], x_b[ok], df["pct"].to_numpy()[ok])
        out.append({
            "key": col,
            "label": label,
            "unit": unit,
            "direction": direction,
            "threshold": threshold,
            "by_decile": series,
            "missing": miss,
            "gap": rnd(gap, 3),
        })
    return {"markers": out}


def swap_exercise(df: pd.DataFrame, threshold: int, buggy: bool = False) -> tuple[float, float, int]:
    """Counterfactual swap from the original study, re-implemented in Python.

    Starting from the patients at/above the threshold, the healthiest enrolled White
    patient is replaced by the next-highest-scored Black patient below the threshold
    whenever that Black patient has strictly more active chronic conditions.

    `buggy=True` reproduces the pre-2022 code, which advanced the White pointer after
    removing a patient and so skipped every other comparison.
    """
    above = df["pct_r"] >= threshold
    upper_w = df[above & (df.black == 0)].sort_values("gagne_sum_t", kind="stable")
    lower_b = df[~above & (df.black == 1)].sort_values(
        ["risk_score_t", "gagne_sum_t"], ascending=False, kind="stable"
    )
    w_need = list(upper_w["gagne_sum_t"].to_numpy())
    b_need = lower_b["gagne_sum_t"].to_numpy()
    n_black_before = int((above & (df.black == 1)).sum())
    n_total = int(above.sum())

    sw, sb, switched = 0, 0, 0
    # Loop bounds mirror the original 1-indexed `sw < nrow(upperw) & sb < nrow(lowerb)`.
    while sw + 1 < len(w_need) and sb + 1 < len(b_need):
        if w_need[sw] < b_need[sb]:
            del w_need[sw]
            if buggy:
                sw += 1
            switched += 1
        sb += 1
    before = n_black_before / n_total
    after = (n_black_before + switched) / n_total
    return before, after, switched


def swap(df: pd.DataFrame) -> dict:
    rows = []
    for t in range(55, 100):
        before, fixed, _ = swap_exercise(df, t)
        _, buggy, _ = swap_exercise(df, t, buggy=True)
        rows.append({"p": t, "before": rnd(before), "fixed": rnd(fixed), "buggy": rnd(buggy)})

    at97 = next(r for r in rows if r["p"] == 97)
    # Regression test against the authors' published synthetic-data output (pre-fix code).
    assert abs(at97["before"] - 0.1841) < 0.001, at97
    assert abs(at97["buggy"] - 0.4477) < 0.001, at97

    # Symmetric alternative: fill the same number of places purely by realised need.
    n_top = int((df["pct_r"] >= 97).sum())
    need = df["gagne_sum_t"].to_numpy()
    black = df["black"].to_numpy()
    cutoff = np.sort(need)[::-1][n_top - 1]
    above = need > cutoff
    at = need == cutoff
    weight = above.astype(float)
    weight[at] = (n_top - above.sum()) / at.sum()
    oracle = float((weight * black).sum() / weight.sum())

    return {
        "by_threshold": rows,
        "at97": {**at97, "oracle": rnd(oracle), "n": n_top},
        "published": {"before": 0.177, "after": 0.465, "corrected": 0.59},
    }


def human_in_loop(df: pd.DataFrame) -> dict:
    """Did the human enrolment step correct the score?

    Clinicians decide enrolment for patients the score flags. If they were fully
    correcting the bias, enrolled Black and White patients would be equally sick.
    """
    enrolled = df[df["program_enrolled_t"] == 1]
    flagged = df[df["pct"] >= 55]
    x_b = flagged["black"].to_numpy(float)
    y_e = flagged["program_enrolled_t"].to_numpy(float)
    pct = flagged["pct"].to_numpy()
    eb = enrolled.loc[enrolled.black == 1, "gagne_sum_t"].to_numpy(float)
    ew = enrolled.loc[enrolled.black == 0, "gagne_sum_t"].to_numpy(float)
    e_black = enrolled["black"].to_numpy(float)
    e_need = enrolled["gagne_sum_t"].to_numpy(float)

    def enrolled_gap(i):
        b = e_black[i] == 1
        return e_need[i][b].mean() - e_need[i][~b].mean()

    return {
        "n_enrolled": len(enrolled),
        "share_enrolled_above_55": rnd((enrolled["pct"] >= 55).mean()),
        "black_share_enrolled": rnd(enrolled["black"].mean()),
        "black_share_top3": rnd(df.loc[df["pct"] >= 97, "black"].mean()),
        # Difference in enrolment probability at the same score percentile (flagged pool).
        "enrol_gap_same_score": bootstrap(lambda i: within_gap(y_e[i], x_b[i], pct[i]), len(flagged), seed=6),
        "conditions_enrolled": {"b": rnd(eb.mean(), 3), "w": rnd(ew.mean(), 3)},
        "conditions_gap": bootstrap(enrolled_gap, len(enrolled), seed=7),
    }


def run(df: pd.DataFrame) -> dict:
    results = {
        "meta": meta(df),
        "calibration": calibration(df),
        "mechanism": mechanism(df),
        "biomarkers": biomarkers(df),
        "swap": swap(df),
        "human": human_in_loop(df),
    }
    for name, payload in results.items():
        write_json(name, payload)
    return results


if __name__ == "__main__":
    from common import load

    out = run(load())
    c, s = out["calibration"], out["swap"]["at97"]
    print("Black share top 3%:", c["top3"]["black_share"])
    print("Conditions at top 3% (B/W):", c["top3"]["conditions_black"], c["top3"]["conditions_white"])
    print("Health gap:", c["gap_health"], " Cost gap:", c["gap_cost"])
    print("Cost at equal health:", out["mechanism"]["gap_cost"])
    print("Swap @97:", s)
    print("Human in loop:", out["human"])

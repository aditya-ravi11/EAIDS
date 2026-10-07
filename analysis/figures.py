"""Static figures for the IEEE report, drawn from the same JSON the website uses."""
from __future__ import annotations

import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from common import FIGURES, WEB_DATA  # noqa: E402

BLACK = "#4B3F8C"
WHITE = "#D98E04"
INK = "#161616"
RULE = "#9C9484"
ACCENT = "#B3261E"
ONE_COL, TWO_COL = 3.5, 7.16

plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["STIXGeneral", "Times New Roman", "DejaVu Serif"],
    "mathtext.fontset": "stix",
    "font.size": 8,
    "axes.titlesize": 8,
    "axes.labelsize": 8,
    "xtick.labelsize": 7,
    "ytick.labelsize": 7,
    "legend.fontsize": 7,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.edgecolor": INK,
    "axes.linewidth": 0.6,
    "xtick.major.width": 0.6,
    "ytick.major.width": 0.6,
    "pdf.fonttype": 42,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.02,
})


def load(name: str) -> dict:
    return json.loads((WEB_DATA / f"{name}.json").read_text())


def thresholds(ax, labels: bool = True) -> None:
    for p, text in ((55, "55th: referred"), (97, "97th: auto-enrolled")):
        ax.axvline(p, color=RULE, lw=0.6, ls=(0, (3, 2)), zorder=0)
        if labels:
            ax.text(p - 1.2, 0.03, text, transform=ax.get_xaxis_transform(), ha="right", va="bottom",
                    fontsize=6, color="#5b5548", rotation=90)


def series(rows, key):
    return np.array([np.nan if r[key] is None else r[key] for r in rows], float)


def calibration() -> None:
    cal = load("calibration")["by_pct"]
    p = np.arange(100)
    fig, axes = plt.subplots(1, 2, figsize=(TWO_COL, 2.3))
    for ax, outcome, ylabel, title in (
        (axes[0], "h", "Mean active chronic conditions", "(a) Health at a given risk score"),
        (axes[1], "c", "Mean total cost (USD, log scale)", "(b) Cost at a given risk score"),
    ):
        for race, color, name in (("b", BLACK, "Black"), ("w", WHITE, "White")):
            ax.scatter(p, series(cal, outcome + race), s=4, color=color, alpha=0.35, lw=0)
            ax.plot(p, series(cal, f"s_{outcome}{race}"), color=color, lw=1.4, label=name)
        if outcome == "c":
            ax.set_yscale("log")
        ax.set_xlim(0, 100)
        ax.set_xlabel("Percentile of commercial risk score")
        ax.set_ylabel(ylabel)
        ax.set_title(title, loc="left")
        thresholds(ax)
    axes[0].legend(frameon=False, loc="upper left")
    fig.tight_layout(w_pad=2)
    fig.savefig(FIGURES / "calibration.pdf")
    plt.close(fig)


def mechanism() -> None:
    rows = load("mechanism")["by_conditions"]
    k = [r["k"] for r in rows]
    fig, ax = plt.subplots(figsize=(ONE_COL, 2.1))
    ax.plot(k, [r["cb"] for r in rows], "-o", color=BLACK, ms=3, lw=1.2, label="Black")
    ax.plot(k, [r["cw"] for r in rows], "-o", color=WHITE, ms=3, lw=1.2, label="White")
    ax.set_xticks(k, [str(x) if x < 10 else "10+" for x in k])
    ax.set_xlabel("Active chronic conditions in year $t$")
    ax.set_ylabel("Mean total cost (USD)")
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v / 1000:.0f}k"))
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(FIGURES / "mechanism.pdf")
    plt.close(fig)


def biomarkers() -> None:
    markers = load("biomarkers")["markers"]
    fig, axes = plt.subplots(1, len(markers), figsize=(TWO_COL, 1.75))
    d = np.arange(10) * 10 + 5
    for ax, m in zip(axes, markers):
        for race, color in (("b", BLACK), ("w", WHITE)):
            vals = np.array([r[race] for r in m["by_decile"]], float)
            ax.fill_between(d, vals[:, 1], vals[:, 2], color=color, alpha=0.18, lw=0)
            ax.plot(d, vals[:, 0], color=color, lw=1.2)
        short = {"Systolic blood pressure": "Systolic BP", "LDL cholesterol": "LDL"}.get(m["label"], m["label"])
        arrow = "$\\uparrow$" if m["direction"].startswith("higher") else "$\\downarrow$"
        ax.set_title(f"{short} ({m['unit']}), {arrow} worse", loc="left", fontsize=7)
        ax.set_xlim(0, 100)
        ax.set_xticks([0, 50, 100])
    axes[2].set_xlabel("Risk score percentile (decile midpoints)")
    fig.tight_layout(w_pad=0.6)
    fig.savefig(FIGURES / "biomarkers.pdf")
    plt.close(fig)


def swap() -> None:
    s = load("swap")
    rows = s["by_threshold"]
    p = [r["p"] for r in rows]
    fig, ax = plt.subplots(figsize=(ONE_COL, 2.1))
    ax.plot(p, [r["before"] for r in rows], color=INK, lw=1.2, label="Actual (score)")
    ax.plot(p, [r["buggy"] for r in rows], color=RULE, lw=1.0, ls="--", label="Swap, original code")
    ax.plot(p, [r["fixed"] for r in rows], color=BLACK, lw=1.4, label="Swap, corrected code")
    ax.axvline(97, color=RULE, lw=0.6, ls=(0, (3, 2)))
    ax.set_xlabel("Programme threshold (score percentile)")
    ax.set_ylabel("Black share above threshold")
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=0))
    ax.legend(frameon=False, loc="upper left")
    fig.tight_layout()
    fig.savefig(FIGURES / "swap.pdf")
    plt.close(fig)


def frontier() -> None:
    blend = load("blend")["rows"]
    labels = load("labels")["rows"]
    fig, ax = plt.subplots(figsize=(ONE_COL, 2.3))
    x = [r["k3"]["cost"] for r in blend]
    y = [r["k3"]["black"] for r in blend]
    ax.plot(x, y, color=INK, lw=0.8, zorder=1)
    sc = ax.scatter(x, y, c=[r["alpha"] for r in blend], cmap="cividis_r", s=14, zorder=2, lw=0)
    for r in blend:
        if r["alpha"] in (0.0, 0.5, 0.6, 1.0):
            ax.annotate(f"$\\alpha$={r['alpha']:.1f}", (r["k3"]["cost"], r["k3"]["black"]), xytext=(4, 2),
                        textcoords="offset points", fontsize=6)
    com = next(r for r in labels if r["key"] == "commercial")
    ax.scatter([com["cost_share"]], [com["black_share"]], marker="s", s=16, color=ACCENT, zorder=3)
    ax.annotate("commercial score", (com["cost_share"], com["black_share"]), xytext=(-6, -1),
                textcoords="offset points", fontsize=6, ha="right", va="center", color=ACCENT,
                bbox=dict(boxstyle="square,pad=0.1", fc="white", ec="none"))
    ax.set_xlabel("Share of total cost captured by top 3%")
    ax.set_ylabel("Black share of top 3%")
    ax.xaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=1))
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=0))
    cb = fig.colorbar(sc, ax=ax, pad=0.02, aspect=25)
    cb.set_label("$\\alpha$ (weight on cost)", fontsize=7)
    cb.ax.tick_params(labelsize=6)
    fig.tight_layout()
    fig.savefig(FIGURES / "frontier.pdf")
    plt.close(fig)


def run() -> None:
    FIGURES.mkdir(parents=True, exist_ok=True)
    calibration()
    mechanism()
    biomarkers()
    swap()
    frontier()


if __name__ == "__main__":
    run()

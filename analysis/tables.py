"""LaTeX tables, number macros and BibTeX for the report, generated from the
same JSON (analysis output and curated content) that drives the website."""
from __future__ import annotations

import json
import re

from common import ROOT, TABLES, WEB_DATA

CONTENT = ROOT / "content"
REPORT = ROOT / "report"


def data(name: str) -> dict:
    return json.loads((WEB_DATA / f"{name}.json").read_text())


def content(name: str) -> dict:
    return json.loads((CONTENT / f"{name}.json").read_text())


def tex(s: str) -> str:
    """Escape plain text (and strip simple HTML) for LaTeX."""
    s = re.sub(r"<[^>]+>", "", s)
    for a, b in (("\\", r"\textbackslash{}"), ("&", r"\&"), ("%", r"\%"), ("$", r"\$"), ("#", r"\#"), ("_", r"\_")):
        s = s.replace(a, b)
    s = s.replace("§", r"\S{}").replace("≥", r"$\geq$").replace("−", "--").replace("–", "--").replace("→", r"$\rightarrow$")
    return s.replace("“", "``").replace("”", "''").replace("’", "'")


def pct(v: float, d: int = 1) -> str:
    s = f"{abs(v) * 100:.{d}f}\\%"
    return f"$-${s}" if v < 0 else s


def num(v: float, d: int = 2) -> str:
    """Decimal with a typographic minus sign."""
    return f"$-${abs(v):.{d}f}" if v < 0 else f"{v:.{d}f}"


def thousands(n: float) -> str:
    """Thousands separator that is spaced correctly in both text and math mode."""
    return f"{n:,.0f}".replace(",", "{,}")


def signed(v: float) -> str:
    return f"{'$-$' if v < 0 else '$+$'}\\${thousands(abs(v))}"


def write(name: str, body: str) -> None:
    TABLES.mkdir(parents=True, exist_ok=True)
    (TABLES / name).write_text(body.strip() + "\n")


def numbers() -> None:
    """Key results as macros, so the prose never drifts from the pipeline."""
    m, c, mech, s, h, lab, bl = (data(n) for n in ("meta", "calibration", "mechanism", "swap", "human", "labels", "blend"))
    rows = {r["key"]: r for r in lab["rows"]}
    a60 = next(r for r in bl["rows"] if r["alpha"] == 0.6)
    a100 = next(r for r in bl["rows"] if r["alpha"] == 1.0)
    thr = data("thresholds")["sensitivity"]["conditions_topk"]["commercial"]
    macros = {
        "NPatients": thousands(m["n"]),
        "NBlack": thousands(m["n_black"]),
        "ShareBlack": pct(m["share_black"]),
        "NTrain": thousands(lab["n_train"]),
        "NHoldout": thousands(lab["n_holdout"]),
        "NFeatures": str(lab["n_features"]),
        "GapHealth": f"{c['gap_health']['est']:.2f}",
        "GapHealthLo": f"{c['gap_health']['lo']:.2f}",
        "GapHealthHi": f"{c['gap_health']['hi']:.2f}",
        "GapHealthRel": pct(c["gap_health"]["rel"], 0),
        "GapCost": signed(c["gap_cost"]["est"]),
        "GapCostLo": signed(c["gap_cost"]["lo"]),
        "GapCostHi": signed(c["gap_cost"]["hi"]),
        "TopShareBlack": pct(c["top3"]["black_share"]["est"]),
        "TopShareBlackLo": pct(c["top3"]["black_share"]["lo"]),
        "TopShareBlackHi": pct(c["top3"]["black_share"]["hi"]),
        "TopCondB": f"{c['top3']['conditions_black']:.2f}",
        "TopCondW": f"{c['top3']['conditions_white']:.2f}",
        "TopCondRel": pct(c["top3"]["rel_gap"], 0),
        "CostEqualHealth": signed(mech["gap_cost"]["est"]),
        "CostEqualHealthLo": signed(mech["gap_cost"]["lo"]),
        "CostEqualHealthHi": signed(mech["gap_cost"]["hi"]),
        "AvoidGap": signed(mech["gap_avoidable"]["est"]),
        "BlackLeFive": pct(mech["black_share_le5"], 0),
        "SwapBefore": pct(s["at97"]["before"]),
        "SwapBuggy": pct(s["at97"]["buggy"]),
        "SwapFixed": pct(s["at97"]["fixed"]),
        "SwapOracle": pct(s["at97"]["oracle"]),
        "SwapN": thousands(s["at97"]["n"]),
        "NEnrolled": str(h["n_enrolled"]),
        "EnrolGap": num(h["enrol_gap_same_score"]["est"] * 100, 1),
        "EnrolGapLo": num(h["enrol_gap_same_score"]["lo"] * 100, 1),
        "EnrolGapHi": num(h["enrol_gap_same_score"]["hi"] * 100, 1),
        "EnrolCondB": f"{h['conditions_enrolled']['b']:.2f}",
        "EnrolCondW": f"{h['conditions_enrolled']['w']:.2f}",
        "EnrolCondGap": f"{h['conditions_gap']['est']:.2f}",
        "EnrolCondGapLo": f"{h['conditions_gap']['lo']:.2f}",
        "EnrolCondGapHi": f"{h['conditions_gap']['hi']:.2f}",
        "LabCost": pct(rows["cost"]["black_share"]),
        "LabAvoid": pct(rows["avoidable"]["black_share"]),
        "LabHealth": pct(rows["health"]["black_share"]),
        "LabCommercial": pct(rows["commercial"]["black_share"]),
        "ExcessHealth": pct(rows["health"]["excess_reduction"], 0),
        "ExcessAvoid": pct(rows["avoidable"]["excess_reduction"], 0),
        "BlendBlack": pct(a60["k3"]["black"]),
        "BlendCost": pct(a60["k3"]["cost"]),
        "BlendExcess": pct(a60["excess_reduction"], 0),
        "CostOnlyCost": pct(a100["k3"]["cost"]),
        "CostOnlyBlack": pct(a100["k3"]["black"]),
        "BlendRho": f"{lab['blend_check_spearman']:.3f}",
        "RepRatio": f"{thr['rep_ratio']:.2f}",
        "NeedShare": pct(thr["need_black_share"]),
        "PpvB": pct(thr["ppv_b"], 0),
        "PpvW": pct(thr["ppv_w"], 0),
    }
    lines = [f"\\newcommand{{\\{k}}}{{{v}}}" for k, v in macros.items()]
    write("numbers.tex", "% Generated by analysis/tables.py\n" + "\n".join(lines))


def label_table() -> None:
    lab = data("labels")
    body = []
    for r in lab["rows"]:
        paper = pct(r["paper_black_share"]) if r["paper_black_share"] else "--"
        red = "ref." if r["key"] == "cost" else pct(r["excess_reduction"], 0)
        body.append(
            f"{tex(r['label'])} & {pct(r['black_share'])} & {pct(r['black_ci'][0])}--{pct(r['black_ci'][1])} & {paper} & "
            f"{pct(r['cost_share'])} & {pct(r['avoidable_share'])} & {pct(r['health_share'])} & {red} \\\\"
        )
    write("labels.tex", r"""
\begin{table*}[t]
\centering
\caption{Label-choice experiment: composition and concentration of the top 3\% under each ranking (hold-out set, $n=\NHoldout$). ``Gap closed'' is the reduction in excess chronic conditions carried by Black patients at equal score, relative to the total-cost model.}
\label{tab:labels}
\begin{tabular}{@{}lrrrrrrr@{}}
\toprule
& \multicolumn{3}{c}{Black share of top 3\%} & \multicolumn{3}{c}{Share of outcome captured} & \\
\cmidrule(lr){2-4}\cmidrule(lr){5-7}
Ranking & Ours & 95\% CI & Published & Total cost & Avoid.\ cost & Conditions & Gap closed \\
\midrule
""" + "\n".join(body) + r"""
\bottomrule
\end{tabular}
\end{table*}
""")


def fairness_table() -> None:
    sens = data("thresholds")["sensitivity"]
    names = {"commercial": "Commercial", "cost": "Total cost", "avoidable": "Avoid.\\ cost", "health": "Conditions"}
    defs = [("conditions_topk", "Top 3\\% by conditions"), ("conditions_ge3", "$\\geq$3 conditions"), ("uncontrolled", "HbA1c$\\geq$9 or SBP$\\geq$140")]
    body = []
    for key, label in defs:
        body.append(f"\\multicolumn{{5}}{{@{{}}l}}{{\\textit{{High need: {label}}}}} \\\\")
        for k, n in names.items():
            r = sens[key][k]
            body.append(f"\\quad {n} & {r['rep_ratio']:.2f} & {pct(r['ppv_b'], 0)} & {pct(r['ppv_w'], 0)} & {r['tpr_b']/r['tpr_w']:.2f} \\\\")
    write("fairness.tex", r"""
\begin{table}[t]
\centering
\caption{Selection fairness at the 97th percentile under three definitions of high need. Rep.\ ratio: Black share selected $\div$ Black share of high-need. PPV: share of selected patients who are high-need.}
\label{tab:fairness}
\setlength{\tabcolsep}{4pt}
\begin{tabular}{@{}lrrrr@{}}
\toprule
Ranking & Rep.\ ratio & PPV\textsubscript{B} & PPV\textsubscript{W} & TPR\textsubscript{B}/TPR\textsubscript{W} \\
\midrule
""" + "\n".join(body) + r"""
\bottomrule
\end{tabular}
\end{table}
""")


def fidelity_table() -> None:
    c, mech, s, lab = data("calibration"), data("mechanism"), data("swap"), data("labels")
    rows = {r["key"]: r for r in lab["rows"]}
    body = [
        ("Patient-years", "100,009", f"{data('meta')['n']:,} (synthetic)"),
        ("Black share, $\\geq$97th pct.", "17.7\\%", pct(c["top3"]["black_share"]["est"])),
        ("Conditions $\\geq$97th, B vs W", "4.8 vs 3.8", f"{c['top3']['conditions_black']:.1f} vs {c['top3']['conditions_white']:.1f}"),
        ("Cost gap at equal health", "$-$\\$1{,}801", signed(mech["gap_cost"]["est"])),
        ("Swap, original code", "17.7$\\rightarrow$46.5\\%", f"{pct(s['at97']['before'])}$\\rightarrow${pct(s['at97']['buggy'])}"),
        ("Swap, corrected code", "$\\rightarrow$59\\%", f"$\\rightarrow${pct(s['at97']['fixed'])}"),
        ("Top 3\\% Black, cost label", "14.1\\%", pct(rows["cost"]["black_share"])),
        ("Top 3\\% Black, avoidable cost", "21.0\\%", pct(rows["avoidable"]["black_share"])),
        ("Top 3\\% Black, conditions", "26.7\\%", pct(rows["health"]["black_share"])),
    ]
    write("fidelity.tex", r"""
\begin{table}[t]
\centering
\caption{Replication fidelity: published values on the real cohort~\cite{obermeyer2019} and our values on the synthetic release~\cite{labsysmed}.}
\label{tab:fidelity}
\setlength{\tabcolsep}{4pt}
\begin{tabular}{@{}lrr@{}}
\toprule
Quantity & Published & This work \\
\midrule
""" + "\n".join(f"{a} & {b} & {c_} \\\\" for a, b, c_ in body) + r"""
\bottomrule
\end{tabular}
\end{table}
""")


MARK = {"y": r"\mY", "p": r"\mP", "n": r"\mN", "x": r"\mX"}


def regulatory_table() -> None:
    reg = content("regulatory")
    juris = reg["jurisdictions"]
    body = []
    for o in reg["obligations"]:
        cells = []
        for j in juris:
            for y in ("2019", "2026", "2027"):
                cells.append(MARK[o["cells"][j["key"]][y]["m"]])
        body.append(f"{tex(o['label'])} & " + " & ".join(cells) + r" \\")
    write("regulatory.tex", r"""
\begin{table*}[t]
\centering
\caption{Would the law require it? Obligations applicable to a hospital deploying a race-blind, cost-trained enrolment score, coded for October 2019, October 2026 and as scheduled for December 2027. \mY\ binding and applies; \mP\ binding but narrow, not triggered, or adopted but not yet applicable; \mN\ no binding duty (soft law noted in text); \mX\ protection removed since 2019. Status as of 7 October 2026.}
\label{tab:regulatory}
\setlength{\tabcolsep}{5pt}
\begin{tabular}{@{}l ccc ccc ccc@{}}
\toprule
& \multicolumn{3}{c}{United States} & \multicolumn{3}{c}{European Union} & \multicolumn{3}{c}{India} \\
\cmidrule(lr){2-4}\cmidrule(lr){5-7}\cmidrule(lr){8-10}
Obligation & 2019 & 2026 & 2027 & 2019 & 2026 & 2027 & 2019 & 2026 & 2027 \\
\midrule
""" + "\n".join(body) + r"""
\bottomrule
\end{tabular}
\end{table*}
""")


def aia_table() -> None:
    aia = content("aia")
    verdict = {"failed": r"\mX\ Failed", "not-performed": r"\mN\ Not done", "partial": r"\mP\ Partial"}
    body = []
    for g in aia["gates"]:
        name = f"\\textbf{{{tex(g['name'])}}}" if g["decisive"] else tex(g["name"])
        body.append(f"{g['id']} & {name} & {tex(g['criterion'])} & {verdict[g['retro']['verdict']]} \\\\")
    write("aia.tex", r"""
\begin{table*}[t]
\centering
\caption{Proposed seven-gate algorithmic impact assessment (AIA) and the retrospective verdict for the deployment studied. G1 is decisive.}
\label{tab:aia}
\renewcommand{\arraystretch}{1.15}
\begin{tabular}{@{}l >{\raggedright\arraybackslash}p{3.3cm} >{\raggedright\arraybackslash}p{9.6cm} l@{}}
\toprule
Gate & Name & Pass criterion & Retrospective \\
\midrule
""" + "\n".join(body) + r"""
\bottomrule
\end{tabular}
\end{table*}
""")


def raci_table() -> None:
    raci = content("raci")
    roles = raci["roles"]
    short = {"vendor": "Vend.", "gov": "Gov.", "ds": "DS", "clin": "Clin.", "equity": "Eq.", "payer": "Payer", "patients": "Pat.", "regulator": "Reg."}
    body = []
    for a in raci["activities"]:
        cells = []
        for r in roles:
            v = a["cells"][r["key"]]
            cells.append(f"\\textbf{{{v}}}" if "A" in v else v)
        body.append(f"{tex(a['name'])} & " + " & ".join(cells) + r" \\")
    write("raci.tex", r"""
\begin{table}[t]
\centering
\caption{Accountability matrix (R responsible, A accountable, C consulted, I informed). Gov.: hospital AI governance; DS: hospital data science; Clin.: clinicians; Eq.: equity officer; Pat.: patients.}
\label{tab:raci}
\scriptsize
\setlength{\tabcolsep}{1.6pt}
\begin{tabular}{@{}l""" + "c" * len(roles) + r"""@{}}
\toprule
Activity & """ + " & ".join(short[r["key"]] for r in roles) + r""" \\
\midrule
""" + "\n".join(body) + r"""
\bottomrule
\end{tabular}
\end{table}
""")


def principles_table() -> None:
    pr = content("principles")
    fw = [f for f in pr["frameworks"] if f["key"] in ("who", "icmr", "meity", "nist")]
    body = []
    for p in pr["principles"]:
        body.append(f"{tex(p['name'])} & " + " & ".join(tex(p["cells"][f["key"]]) for f in fw) + r" \\")
    write("principles.tex", r"""
\begin{table*}[t]
\centering
\caption{Crosswalk of the principles breached onto health- and AI-ethics frameworks~\cite{who2021,icmr2023,meity2025,nist2023}.}
\label{tab:principles}
\footnotesize
\renewcommand{\arraystretch}{1.12}
\begin{tabular}{@{}>{\raggedright\arraybackslash}p{3.1cm} >{\raggedright\arraybackslash}p{3.4cm} >{\raggedright\arraybackslash}p{3.6cm} >{\raggedright\arraybackslash}p{2.9cm} >{\raggedright\arraybackslash}p{3.2cm}@{}}
\toprule
Principle & """ + " & ".join(f"{tex(f['label'])}" for f in fw) + r""" \\
\midrule
""" + "\n".join(body) + r"""
\bottomrule
\end{tabular}
\end{table*}
""")


def bibtex() -> None:
    refs = content("references")["refs"]
    out = ["% Generated by analysis/tables.py from content/references.json"]
    kind = {"article": "article", "inproceedings": "inproceedings", "book": "book", "misc": "misc"}
    for r in refs:
        fields = {"author": r["author"], "title": "{" + r["title"] + "}" if r["kind"] == "misc" else r["title"], "year": r["year"]}
        if r["kind"] == "article":
            fields["journal"] = r.get("container", "")
        elif r["kind"] == "inproceedings":
            fields["booktitle"] = r.get("container", "")
        elif r["kind"] == "book":
            fields.update({k: r[k] for k in ("publisher", "address", "edition") if k in r})
        else:
            fields["howpublished"] = r.get("container", "")
        for k in ("volume", "number", "pages", "month", "doi", "url"):
            if k in r and not (k == "url" and "doi" in r):
                fields[k] = r[k]
        body = ",\n".join(f"  {k} = {{{v}}}" for k, v in fields.items())
        out.append(f"@{kind[r['kind']]}{{{r['id']},\n{body}\n}}")
    (REPORT / "refs.bib").write_text("\n\n".join(out) + "\n")


def run() -> None:
    numbers()
    label_table()
    fairness_table()
    fidelity_table()
    regulatory_table()
    aia_table()
    raci_table()
    principles_table()
    bibtex()


if __name__ == "__main__":
    run()

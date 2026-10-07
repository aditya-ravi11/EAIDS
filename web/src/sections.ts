import issues from "../../content/issues.json";
import aia from "../../content/aia.json";
import raci from "../../content/raci.json";
import principles from "../../content/principles.json";
import regulatory from "../../content/regulatory.json";
import timeline from "../../content/timeline.json";
import narrative from "../../content/narrative.json";
import references from "../../content/references.json";
import labels from "./data/labels.json";
import calibration from "./data/calibration.json";
import swap from "./data/swap.json";
import mechanism from "./data/mechanism.json";
import { fmt, segmented } from "./lib/chart";

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const REF_INDEX = new Map(references.refs.map((r, i) => [r.id, i + 1]));
const cite = (ids: string[]) =>
  ids
    .filter((id) => REF_INDEX.has(id))
    .map((id) => `<a class="cite" href="#ref-${id}">[${REF_INDEX.get(id)}]</a>`)
    .join("");

function renderTimeline(): void {
  $("#timeline").innerHTML = timeline.items
    .map(
      (t) => `<li class="tl-item k-${t.kind}">
        <div class="tl-date">${esc(t.date)}</div><div class="tl-dot"></div>
        <div class="tl-body"><strong>${esc(t.title)}.</strong> <span>${t.text}</span>${cite(t.refs ?? [])}</div>
        <div class="tl-juris">${esc(t.juris)}</div></li>`,
    )
    .join("");
}

function renderCharges(): void {
  $("#charges").innerHTML = issues.issues
    .map(
      (e) => `<div class="charge">
        <div class="charge-no">${e.id}</div>
        <h4>${esc(e.title)}</h4>
        <p>${esc(e.text)}</p>
        <div class="charge-tag">${esc(e.stage)}<br/><span class="sev" aria-label="Severity ${e.severity} of 3">${[1, 2, 3]
          .map((i) => `<i class="${i <= e.severity ? "on" : ""}"></i>`)
          .join("")}</span></div>
      </div>`,
    )
    .join("");
}

function renderCrosswalk(): void {
  const t = $<HTMLTableElement>("#xwalk");
  const fw = principles.frameworks;
  t.innerHTML = `<thead><tr><th>Principle · how it was breached</th>${fw
    .map((f, i) => `<th data-col="${i}">${esc(f.label)}${cite([f.ref])}<br/><span style="font-weight:400;color:var(--ink-3)">${esc(f.sub)}</span></th>`)
    .join("")}</tr></thead><tbody>${principles.principles
    .map(
      (p) => `<tr><th>${esc(p.name)}<br/><span style="font-weight:400;font-size:.74rem;color:var(--ink-3)">${esc(p.breach)}</span></th>${fw
        .map((f, i) => `<td data-col="${i}">${esc((p.cells as Record<string, string>)[f.key])}</td>`)
        .join("")}</tr>`,
    )
    .join("")}</tbody>`;
  t.addEventListener("pointerover", (ev) => {
    const cell = (ev.target as HTMLElement).closest<HTMLElement>("[data-col]");
    t.querySelectorAll(".is-x").forEach((c) => c.classList.remove("is-x"));
    if (cell) t.querySelectorAll(`[data-col="${cell.dataset.col}"]`).forEach((c) => c.classList.add("is-x"));
  });
  t.addEventListener("pointerleave", () => t.querySelectorAll(".is-x").forEach((c) => c.classList.remove("is-x")));
}

function renderGates(): void {
  $("#gates").innerHTML = aia.gates
    .map(
      (g) => `<li class="gate${g.decisive ? " is-decisive" : ""}">
        <div class="gate-id">${g.id}<small>${g.decisive ? "decisive" : "gate"}</small></div>
        <div><h4>${esc(g.name)}</h4><p>${esc(g.question)}</p></div>
        <dl><dt>Evidence</dt><dd>${esc(g.evidence)}</dd><dt>Pass if</dt><dd>${esc(g.criterion)}</dd><dt>Legal hooks</dt><dd>${esc(g.hooks)}</dd></dl>
      </li>`,
    )
    .join("");
}

const VERDICT_LABEL: Record<string, [string, string]> = {
  failed: ["Failed", "x"],
  "not-performed": ["Not performed", "n"],
  partial: ["Partial", "p"],
};

function renderScorecard(): void {
  $("#scorecard").innerHTML = aia.gates
    .map((g) => {
      const [label, mark] = VERDICT_LABEL[g.retro.verdict];
      return `<div class="score-cell ${g.retro.verdict}">
        <div class="gid">${g.id}</div>
        <div class="verdict-tag"><i class="mark ${mark}"></i>${label}</div>
        <strong style="font-size:.8rem">${esc(g.name)}</strong>
        <p>${esc(g.retro.note)}</p></div>`;
    })
    .join("");
}

function renderRaci(): void {
  const t = $<HTMLTableElement>("#raci");
  const roles = raci.roles;
  t.innerHTML = `<thead><tr><th>Activity</th>${roles
    .map((r, i) => `<th data-col="${i}" tabindex="0" role="button">${esc(r.label)}</th>`)
    .join("")}</tr></thead><tbody>${raci.activities
    .map(
      (a) => `<tr><th>${esc(a.name)}</th>${roles
        .map((r, i) => {
          const v = (a.cells as Record<string, string>)[r.key];
          const cls = v.includes("A") ? "r-A" : v.includes("R") ? "r-R" : "";
          return `<td data-col="${i}" class="${cls}">${v}</td>`;
        })
        .join("")}</tr>`,
    )
    .join("")}</tbody>`;
  const note = $("#role-note");
  const select = (i: number) => {
    t.querySelectorAll(".is-col").forEach((c) => c.classList.remove("is-col"));
    t.querySelectorAll(`[data-col="${i}"]`).forEach((c) => c.classList.add("is-col"));
    note.innerHTML = `<strong>${esc(roles[i].label)}.</strong> ${esc(roles[i].duty)}`;
  };
  t.querySelectorAll<HTMLElement>("thead th[data-col]").forEach((th) => {
    const i = Number(th.dataset.col);
    th.addEventListener("click", () => select(i));
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select(i);
      }
    });
  });
  select(1);
}

function renderActors(): void {
  $("#actors").innerHTML = raci.actors
    .map((a) => `<div class="actor"><h4>${esc(a.who)}</h4><ol>${a.actions.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`)
    .join("");
}

function renderLabelTable(): void {
  const t = $<HTMLTableElement>("#label-table");
  const best = (k: "cost_share" | "avoidable_share" | "health_share") => Math.max(...labels.rows.map((r) => r[k]));
  const cell = (v: number, k: "cost_share" | "avoidable_share" | "health_share") =>
    `<td class="n"${v === best(k) ? ' style="font-weight:600"' : ""}>${fmt.pct1(v)}</td>`;
  t.innerHTML = `<caption>Table 8.1 · Who is in the top 3% under each label (hold-out, n = ${fmt.int(labels.n_holdout)})</caption>
    <thead><tr><th>Ranking</th><th class="n">Black share</th><th class="n">95% CI</th><th class="n">Published</th>
    <th class="n">Total cost captured</th><th class="n">Avoidable cost captured</th><th class="n">Chronic conditions captured</th><th class="n">Excess-conditions gap closed</th></tr></thead>
    <tbody>${labels.rows
      .map(
        (r) => `<tr class="${r.key === "health" ? "is-hl" : ""}"><th>${esc(r.label)}</th>
        <td class="n">${fmt.pct1(r.black_share)}</td>
        <td class="n">${fmt.pct1(r.black_ci[0])}–${fmt.pct1(r.black_ci[1])}</td>
        <td class="n">${r.paper_black_share == null ? "–" : fmt.pct1(r.paper_black_share)}</td>
        ${cell(r.cost_share, "cost_share")}${cell(r.avoidable_share, "avoidable_share")}${cell(r.health_share, "health_share")}
        <td class="n">${r.key === "cost" ? "ref." : fmt.pct0(r.excess_reduction)}</td></tr>`,
      )
      .join("")}</tbody>`;
}

type Mark = "y" | "p" | "n" | "x";
interface RegCell {
  m: string;
  t: string;
  d: string;
  src: string[];
}

function renderRegulatory(): void {
  const host = $("#reg");
  const detail = $("#reg-detail");
  const juris = regulatory.jurisdictions;
  let year = "2026";
  let selected: [number, string] = [0, "us"];

  const draw = () => {
    host.innerHTML =
      `<div class="reg-h">Obligation</div>` +
      juris.map((j) => `<div class="reg-h">${esc(j.label)}<small>${esc(j.sub)}</small></div>`).join("") +
      regulatory.obligations
        .map(
          (o, oi) =>
            `<div class="reg-row">${esc(o.label)}</div>` +
            juris
              .map((j) => {
                const c = (o.cells as Record<string, Record<string, RegCell>>)[j.key][year];
                const on = selected[0] === oi && selected[1] === j.key;
                return `<div><button class="cell" data-o="${oi}" data-j="${j.key}" aria-pressed="${on}"><i class="mark ${c.m as Mark}"></i><span>${esc(c.t)}</span></button></div>`;
              })
              .join(""),
        )
        .join("");
    showDetail();
  };

  const showDetail = () => {
    const [oi, jk] = selected;
    const o = regulatory.obligations[oi];
    const j = juris.find((x) => x.key === jk)!;
    const c = (o.cells as Record<string, Record<string, RegCell>>)[jk][year];
    const yearLabel = regulatory.years.find((y) => y.key === year)!.label;
    detail.innerHTML = `<h5>${esc(o.label)} · ${esc(j.label)} · ${esc(yearLabel)}</h5>
      <p><i class="mark ${c.m}" style="margin-right:.5rem"></i><strong>${esc(c.t)}.</strong> ${c.d}</p>
      <div class="src">Sources: ${c.src.map((id) => `${cite([id])} ${esc(references.refs.find((r) => r.id === id)?.short ?? id)}`).join(" · ")}</div>`;
  };

  host.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button.cell");
    if (!b) return;
    selected = [Number(b.dataset.o), b.dataset.j!];
    host.querySelectorAll("button.cell").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    showDetail();
  });

  segmented(
    $("#reg-year"),
    regulatory.years.map((y) => ({ value: y.key, label: y.label })),
    year,
    (v) => {
      year = v;
      draw();
    },
  );
  draw();

  $("#verdicts").innerHTML = regulatory.verdicts
    .map((v) => `<div class="verdict"><h4>${esc(v.label)}</h4><div class="answer">${esc(v.answer)}</div><p>${v.text}</p></div>`)
    .join("");
  $("#india-box").innerHTML = narrative.india.map((p) => `<p>${p}</p>`).join("");
}

function renderFidelity(): void {
  const rows: [string, string, string][] = [
    ["Patient-years", "100,009 (real)", `${fmt.int(48784)} (synthetic)`],
    ["Black share at or above 97th percentile", "17.7%", fmt.pct1(calibration.top3.black_share.est)],
    [
      "Chronic conditions at ≥ 97th, Black vs White",
      "4.8 vs 3.8 (+26%)",
      `${calibration.top3.conditions_black.toFixed(1)} vs ${calibration.top3.conditions_white.toFixed(1)} (+${Math.round(calibration.top3.rel_gap * 100)}%)`,
    ],
    ["Cost gap at equal health", "−$1,801", `−${fmt.usd(mechanism.gap_cost.est)}`],
    ["Swap at 97th, original code", "17.7% → 46.5%", `${fmt.pct1(swap.at97.before)} → ${fmt.pct1(swap.at97.buggy)}`],
    ["Swap at 97th, corrected code", "→ 59%", `→ ${fmt.pct1(swap.at97.fixed)}`],
    ...labels.rows
      .filter((r) => r.paper_black_share != null)
      .map((r): [string, string, string] => [`Black share, top 3%, ${r.label.toLowerCase()} label`, fmt.pct1(r.paper_black_share!), fmt.pct1(r.black_share)]),
    ["Excess-conditions reduction, combined label", "84% (vendor, 3.7M patients)", `${fmt.pct0(labels.rows.find((r) => r.key === "health")!.excess_reduction)} (health label)`],
  ];
  $("#fidelity").innerHTML = `<caption>Table 8.2 · Published values (real data) and our replication (synthetic data)</caption>
    <thead><tr><th>Quantity</th><th class="n">Obermeyer et al. 2019</th><th class="n">This project</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><th>${esc(r[0])}</th><td class="n">${esc(r[1])}</td><td class="n">${esc(r[2])}</td></tr>`).join("")}</tbody>`;
}

function renderNarrative(): void {
  $("#findings").innerHTML = narrative.findings.map((f) => `<li><div><strong>${f.title}</strong><p>${f.text}</p></div></li>`).join("");
  $("#qa").innerHTML = narrative.qa.map((q) => `<div class="qa-item"><h4>${esc(q.q)}</h4><p>${q.a}</p></div>`).join("");
}

type Ref = (typeof references.refs)[number] & Partial<Record<"volume" | "number" | "pages" | "month" | "edition" | "publisher" | "address" | "url" | "container", string>>;

/** IEEE-style reference text, from the same fields that generate the report's BibTeX. */
function formatRef(r: Ref): string {
  const authors = r.author
    .replace(/[{}]/g, "")
    .split(" and ")
    .map((a) => a.trim());
  const who = authors.length > 2 ? `${authors.slice(0, -1).join(", ")}, and ${authors[authors.length - 1]}` : authors.join(" and ");
  const date = [r.month, r.year].filter(Boolean).join(" ");
  const pages = r.pages ? `pp. ${r.pages.replace("--", "–")}` : "";
  const clean = (t: string) => t.replace(/\\S /g, "§");
  if (r.kind === "book") {
    return `${who}, <em>${esc(r.title)}</em>${r.edition ? `, ${r.edition} ed` : ""}. ${esc(r.address ?? "")}: ${esc(r.publisher ?? "")}, ${r.year}.`;
  }
  const parts = [r.volume ? `vol. ${r.volume}` : "", r.number ? `no. ${r.number}` : "", pages, date].filter(Boolean);
  const container = r.container ? (r.kind === "misc" ? esc(clean(r.container)) : `<em>${esc(r.container)}</em>`) : "";
  return `${who}, “${esc(r.title)},” ${[container, ...parts].filter(Boolean).join(", ")}.`;
}

function renderRefs(): void {
  $("#refs").innerHTML = (references.refs as Ref[])
    .map((r) => {
      const url = r.url ? ` <a href="${r.url}">${esc(r.url.replace(/^https?:\/\//, ""))}</a>` : "";
      return `<li id="ref-${r.id}">${formatRef(r)}${url}</li>`;
    })
    .join("");
  document.querySelectorAll<HTMLAnchorElement>("a.cite[data-ref]").forEach((a) => {
    const id = a.dataset.ref!;
    a.href = `#ref-${id}`;
    a.textContent = `[${REF_INDEX.get(id) ?? "?"}]`;
  });
}

export function renderContent(): void {
  renderTimeline();
  renderCharges();
  renderCrosswalk();
  renderGates();
  renderScorecard();
  renderRaci();
  renderActors();
  renderLabelTable();
  renderRegulatory();
  renderFidelity();
  renderNarrative();
  renderRefs();
}

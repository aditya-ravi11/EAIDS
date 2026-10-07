import issues from "../../content/issues.json";
import aia from "../../content/aia.json";
import raci from "../../content/raci.json";
import principles from "../../content/principles.json";
import regulatory from "../../content/regulatory.json";
import narrative from "../../content/narrative.json";
import references from "../../content/references.json";
import calibration from "./data/calibration.json";
import swap from "./data/swap.json";
import mechanism from "./data/mechanism.json";
import labels from "./data/labels.json";
import { fmt, segmented } from "./lib/chart";

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const REF_INDEX = new Map(references.refs.map((r, i) => [r.id, i + 1]));

export const cite = (ids: string[]) =>
  ids
    .filter((id) => REF_INDEX.has(id))
    .map((id) => `<a class="cite" href="#/conclusion/limits" data-ref="${id}">[${REF_INDEX.get(id)}]</a>`)
    .join("");

function renderIssues(): void {
  $("#charges").innerHTML = issues.issues
    .map(
      (e) => `<div class="issue">
        <div class="issue-top"><span class="issue-no">${e.id}</span><span class="sev" aria-label="Severity ${e.severity} of 3">${[1, 2, 3]
          .map((i) => `<i class="${i <= e.severity ? "on" : ""}"></i>`)
          .join("")}</span></div>
        <h4>${esc(e.title)}</h4>
        <p>${esc(e.text)}</p>
        <span class="stage-tag">${esc(e.stage)}</span>
      </div>`,
    )
    .join("");
}

function renderCrosswalk(): void {
  const t = $<HTMLTableElement>("#xwalk");
  const fw = principles.frameworks;
  t.innerHTML = `<thead><tr><th>Principle</th>${fw
    .map((f, i) => `<th data-col="${i}">${esc(f.label)}<span class="sub">${esc(f.sub)}</span></th>`)
    .join("")}</tr></thead><tbody>${principles.principles
    .map(
      (p) => `<tr><th>${esc(p.name)}<span class="sub">${esc(p.breach)}</span></th>${fw
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

const VERDICT: Record<string, [string, string]> = {
  failed: ["Failed", "x"],
  "not-performed": ["Not performed", "n"],
  partial: ["Partial", "p"],
};

function renderGates(): void {
  const host = $("#gates");
  host.innerHTML = `<div class="gates">${aia.gates
    .map((g, i) => {
      const [label, mark] = VERDICT[g.retro.verdict];
      return `<button class="gate-btn${g.decisive ? " decisive" : ""}" data-i="${i}" type="button">
        <span class="gid">${g.id}</span><span class="gname">${esc(g.name)}</span>
        <span class="gver"><i class="mark ${mark}"></i>${label}</span></button>`;
    })
    .join("")}</div><div class="gate-detail"></div>`;
  const detail = host.querySelector<HTMLElement>(".gate-detail")!;
  const select = (i: number) => {
    const g = aia.gates[i];
    const [label, mark] = VERDICT[g.retro.verdict];
    host.querySelectorAll(".gate-btn").forEach((b) => b.classList.toggle("is-on", (b as HTMLElement).dataset.i === String(i)));
    detail.innerHTML = `<div>
        <h4>${g.id} · ${esc(g.name)}</h4>
        <p class="q">${esc(g.question)}</p>
        <dl><dt>Evidence</dt><dd>${esc(g.evidence)}</dd><dt>Pass if</dt><dd>${esc(g.criterion)}</dd><dt>Legal hooks</dt><dd>${esc(g.hooks)}</dd></dl>
      </div>
      <div class="side-col">
        <div class="retro ${g.retro.verdict}"><b>The deployment we studied</b><div class="rv"><i class="mark ${mark}"></i>${label}</div><p>${esc(g.retro.note)}</p></div>
        <div class="levels"><b>Impact level for this tool (Canada's DADM scale)</b><div class="level-row">${aia.impact_levels
          .map((l) => `<div class="level${l.level === "III" || l.level === "IV" ? " on" : ""}"><strong>${l.level}</strong>${esc(l.requires)}</div>`)
          .join("")}</div></div>
      </div>`;
  };
  host.querySelectorAll<HTMLButtonElement>(".gate-btn").forEach((b) => b.addEventListener("click", () => select(Number(b.dataset.i))));
  select(1);
}

function renderScorecard(): void {
  $("#scorecard").innerHTML = aia.gates
    .map((g) => {
      const [label, mark] = VERDICT[g.retro.verdict];
      return `<div class="score-cell ${g.retro.verdict}">
        <div class="gid">${g.id}</div>
        <div class="verdict-tag"><i class="mark ${mark}"></i>${label}</div>
        <strong>${esc(g.name)}</strong>
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
  let selected: [number, string] = [7, "us"];
  const cell = (oi: number, jk: string) => (regulatory.obligations[oi].cells as Record<string, Record<string, RegCell>>)[jk][year];

  const showDetail = () => {
    const [oi, jk] = selected;
    const c = cell(oi, jk);
    const j = juris.find((x) => x.key === jk)!;
    const yearLabel = regulatory.years.find((y) => y.key === year)!.label;
    detail.innerHTML = `<h5>${esc(regulatory.obligations[oi].label)} · ${esc(j.label)} · ${esc(yearLabel)}</h5>
      <div class="rd-t"><i class="mark ${c.m}"></i>${esc(c.t)}</div>
      <p>${c.d}</p>
      ${c.src.length ? `<div class="src">Sources: ${c.src.map((id) => `${cite([id])} ${esc(references.refs.find((r) => r.id === id)?.short ?? id)}`).join(" · ")}</div>` : ""}`;
  };
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
                const c = cell(oi, j.key);
                const on = selected[0] === oi && selected[1] === j.key;
                return `<div><button class="cell" data-o="${oi}" data-j="${j.key}" aria-pressed="${on}"><i class="mark ${c.m as Mark}"></i><span>${esc(c.t)}</span></button></div>`;
              })
              .join(""),
        )
        .join("");
    showDetail();
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
    ["Black share at or above the 97th percentile", "17.7%", fmt.pct1(calibration.top3.black_share.est)],
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
      .map((r): [string, string, string] => [`Black share of top 3%, ${r.label.toLowerCase()} label`, fmt.pct1(r.paper_black_share!), fmt.pct1(r.black_share)]),
  ];
  $("#fidelity").innerHTML = `<thead><tr><th>Quantity</th><th class="n">Obermeyer et al. 2019</th><th class="n">This project</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><th>${esc(r[0])}</th><td class="n">${esc(r[1])}</td><td class="n">${esc(r[2])}</td></tr>`).join("")}</tbody>`;
}

function renderNarrative(): void {
  $("#findings").innerHTML = narrative.findings.map((f) => `<li><strong>${f.title}</strong><p>${f.text}</p></li>`).join("");
  $("#qa").innerHTML =
    `<div class="qa-item lead"><h4>In one line</h4><p>The bias could be detected with data every hospital already holds, and largely fixed by changing the label. What was missing was any obligation to look.</p></div>` +
    narrative.qa.map((q) => `<div class="qa-item"><h4>${esc(q.q)}</h4><p>${q.a}</p></div>`).join("");
}

type Ref = (typeof references.refs)[number] &
  Partial<Record<"volume" | "number" | "pages" | "month" | "edition" | "publisher" | "address" | "url" | "container", string>>;

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
      const url = r.url ? ` <a href="${r.url}" target="_blank" rel="noopener">${esc(r.url.replace(/^https?:\/\//, ""))}</a>` : "";
      return `<li id="ref-${r.id}">${formatRef(r)}${url}</li>`;
    })
    .join("");
}

export function renderContent(): void {
  renderIssues();
  renderCrosswalk();
  renderGates();
  renderScorecard();
  renderRaci();
  renderActors();
  renderRegulatory();
  renderFidelity();
  renderNarrative();
  renderRefs();
}

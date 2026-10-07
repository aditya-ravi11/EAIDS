import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import thr from "../data/thresholds.json";
import { C, fmt, frame, responsive, segmented, xAxis, yAxis } from "../lib/chart";

type Key = "commercial" | "cost" | "avoidable" | "health";
type Row = (typeof thr.rows)[number];

export const SCORERS: { key: Key; label: string; short: string }[] = [
  { key: "commercial", label: "Commercial risk score", short: "Commercial" },
  { key: "cost", label: "Model trained on total cost", short: "Total cost" },
  { key: "avoidable", label: "Model trained on avoidable cost", short: "Avoidable cost" },
  { key: "health", label: "Model trained on chronic conditions", short: "Chronic conditions" },
];

export function mountExplorer(fig: HTMLElement): void {
  const body = fig.querySelector<HTMLElement>(".chart")!;
  const readout = fig.querySelector<HTMLElement>(".readout")!;
  const range = fig.querySelector<HTMLInputElement>("input[type=range]")!;
  const out = fig.querySelector<HTMLOutputElement>("output")!;
  let focus: Key = "commercial";
  let p = Number(range.value);

  segmented(
    fig.querySelector<HTMLElement>("[data-control]")!,
    SCORERS.map((s) => ({ value: s.key, label: s.short })),
    focus,
    (v) => {
      focus = v as Key;
      draw();
    },
  );
  range.addEventListener("input", () => {
    p = Number(range.value);
    draw();
  });

  const draw = () => {
    out.textContent = `${p}th`;
    const compact = body.clientWidth < 560;
    const m = { top: 30, right: compact ? 14 : 132, bottom: 44, left: 48 };
    const f = frame(body, 0.5, m, 260, 420);
    const rows = thr.rows;
    const x = scaleLinear().domain([50, 99]).range([0, f.innerW]);
    const y = scaleLinear().domain([0.08, 0.34]).range([f.innerH, 0]);
    yAxis(f.g, y, f.innerW, [0.1, 0.15, 0.2, 0.25, 0.3], fmt.pct0, "Black share of patients selected");
    xAxis(f.g, x, f.innerH, [50, 60, 70, 80, 90, 99], (v) => `${v}th`, "Programme threshold (percentile of each score)");

    // Reference: Black share among the truly high-need at the same capacity.
    const need = line<Row>()
      .x((r) => x(r.p))
      .y((r) => y(r.commercial.need_black_share));
    f.g.append("path")
      .attr("d", need(rows))
      .attr("fill", "none")
      .attr("stroke", C.accent)
      .attr("stroke-width", 1.4)
      .attr("stroke-dasharray", "5 4");

    const labels: { y: number; text: string; strong: boolean; color: string }[] = [];
    const ordered = [...SCORERS].sort((a) => (a.key === focus ? 1 : -1));
    ordered.forEach((s) => {
      const strong = s.key === focus;
      const path = line<Row>()
        .x((r) => x(r.p))
        .y((r) => y(r[s.key].black_share));
      f.g.append("path")
        .attr("d", path(rows))
        .attr("fill", "none")
        .attr("stroke", strong ? C.ink : "#a8a192")
        .attr("stroke-width", strong ? 2.6 : 1.3);
      const last = rows[rows.length - 1][s.key].black_share;
      labels.push({ y: y(last), text: s.short, strong, color: strong ? C.ink : C.ink3 });
    });
    labels.push({ y: y(rows[rows.length - 1].commercial.need_black_share), text: "Truly high-need", strong: false, color: C.accent });

    if (!compact) {
      labels.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labels.length; i++) {
        if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
      }
      labels.forEach((l) => {
        f.g.append("text")
          .attr("x", f.innerW + 8)
          .attr("y", l.y)
          .attr("dy", "0.32em")
          .attr("font-size", 11.5)
          .attr("font-weight", l.strong ? 700 : 400)
          .attr("class", "halo")
          .attr("fill", l.color)
          .text(l.text);
      });
    }

    // Current threshold marker
    const r = rows.find((d) => d.p === p)!;
    f.g.append("line")
      .attr("class", "crosshair")
      .attr("x1", x(p))
      .attr("x2", x(p))
      .attr("y1", 0)
      .attr("y2", f.innerH);
    f.g.append("circle")
      .attr("cx", x(p))
      .attr("cy", y(r[focus].black_share))
      .attr("r", 5)
      .attr("fill", C.ink)
      .attr("stroke", C.paper)
      .attr("stroke-width", 2);
    f.g.append("circle")
      .attr("cx", x(p))
      .attr("cy", y(r.commercial.need_black_share))
      .attr("r", 4)
      .attr("fill", C.paper)
      .attr("stroke", C.accent)
      .attr("stroke-width", 1.6);

    renderReadout(readout, r, focus, p);
  };

  responsive(body, draw);
}

function renderReadout(el: HTMLElement, r: Row, focus: Key, p: number): void {
  const f = r[focus];
  const label = SCORERS.find((s) => s.key === focus)!.label;
  const top = 100 - p;
  el.innerHTML = `
    <h5>${label} · top ${top}%</h5>
    <div class="big">${fmt.pct1(f.black_share)}</div>
    <div>of selected patients are Black, against <span class="num">${fmt.pct1(f.need_black_share)}</span> of the truly high-need group of the same size.</div>
    <dl style="margin-top:.8rem">
      <dt>Representation ratio</dt><dd>${f.rep_ratio.toFixed(2)}</dd>
      <dt>Selected Black who are high-need</dt><dd>${fmt.pct0(f.ppv_b)}</dd>
      <dt>Selected White who are high-need</dt><dd>${fmt.pct0(f.ppv_w)}</dd>
      <dt>High-need Black selected</dt><dd>${fmt.pct0(f.tpr_b)}</dd>
      <dt>High-need White selected</dt><dd>${fmt.pct0(f.tpr_w)}</dd>
    </dl>
    <p class="note">A ratio below 1 means Black patients are under-selected relative to need. When selected Black patients are more often high-need than selected White patients, the bar for Black patients is higher.</p>`;
}

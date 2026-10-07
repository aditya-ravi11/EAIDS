import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import thr from "../data/thresholds.json";
import { C, fmt, frame, responsive, segmented, spread, xAxis, yAxis } from "../lib/chart";

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
    const compact = body.clientWidth < 520;
    const f = frame(body, 0.5, { top: 1.8, right: compact ? 1 : 8.6, bottom: 2.9, left: 3 });
    const rows = thr.rows;
    const x = scaleLinear().domain([50, 99]).range([0, f.innerW]);
    const y = scaleLinear().domain([0.08, 0.34]).range([f.innerH, 0]);
    yAxis(f, y, [0.1, 0.15, 0.2, 0.25, 0.3], fmt.pct0, "Black share of patients selected");
    xAxis(f, x, [50, 60, 70, 80, 90, 99], (v) => `${v}th`, "Programme threshold (percentile of each score)");

    const need = line<Row>()
      .x((r) => x(r.p))
      .y((r) => y(r.commercial.need_black_share));
    f.g.append("path").attr("d", need(rows)).attr("fill", "none").attr("stroke", C.accent).attr("stroke-width", 1.6).attr("stroke-dasharray", "5 4");

    const labels: { y: number; text: string; strong: boolean; color: string }[] = [];
    [...SCORERS]
      .sort((a) => (a.key === focus ? 1 : -1))
      .forEach((s) => {
        const strong = s.key === focus;
        const path = line<Row>()
          .x((r) => x(r.p))
          .y((r) => y(r[s.key].black_share));
        f.g.append("path").attr("d", path(rows)).attr("fill", "none").attr("stroke", strong ? C.ink : "#aaa394").attr("stroke-width", strong ? 3 : 1.4);
        labels.push({ y: y(rows[rows.length - 1][s.key].black_share), text: s.short, strong, color: strong ? C.ink : C.ink3 });
      });
    labels.push({ y: y(rows[rows.length - 1].commercial.need_black_share), text: "Truly high-need", strong: false, color: C.accent });
    if (!compact) {
      spread(labels, 1.05 * f.r).forEach((l) => {
        f.g.append("text")
          .attr("class", `lbl halo${l.strong ? " strong" : ""}`)
          .attr("x", f.innerW + 0.5 * f.r)
          .attr("y", l.y)
          .attr("dy", "0.32em")
          .attr("fill", l.color)
          .text(l.text);
      });
    }

    const r = rows.find((d) => d.p === p)!;
    f.g.append("line").attr("class", "crosshair").attr("x1", x(p)).attr("x2", x(p)).attr("y1", 0).attr("y2", f.innerH);
    f.g.append("circle").attr("cx", x(p)).attr("cy", y(r[focus].black_share)).attr("r", 0.38 * f.r).attr("fill", C.ink).attr("stroke", C.paper).attr("stroke-width", 2);
    f.g.append("circle").attr("cx", x(p)).attr("cy", y(r.commercial.need_black_share)).attr("r", 0.3 * f.r).attr("fill", C.paper).attr("stroke", C.accent).attr("stroke-width", 1.8);

    const s = r[focus];
    readout.innerHTML = `
      <h5>${SCORERS.find((d) => d.key === focus)!.label} · top ${100 - p}%</h5>
      <div class="big">${fmt.pct1(s.black_share)}</div>
      <div>of selected patients are Black, against <span class="num">${fmt.pct1(s.need_black_share)}</span> of the truly high-need.</div>
      <dl>
        <dt>Representation ratio</dt><dd>${s.rep_ratio.toFixed(2)}</dd>
        <dt>Selected Black who are high-need</dt><dd>${fmt.pct0(s.ppv_b)}</dd>
        <dt>Selected White who are high-need</dt><dd>${fmt.pct0(s.ppv_w)}</dd>
      </dl>
      <p class="note">Below 1 means under-selected relative to need. A higher share of selected Black patients being high-need means a higher bar for Black patients.</p>`;
  };

  responsive(body, draw);
}

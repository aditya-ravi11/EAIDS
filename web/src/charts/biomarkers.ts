import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { extent } from "d3-array";
import bio from "../data/biomarkers.json";
import { C, frame, responsive } from "../lib/chart";

type Marker = (typeof bio.markers)[number];
type Point = Marker["by_decile"][number];

export function mountBiomarkers(host: HTMLElement): void {
  host.classList.add("multiples");
  bio.markers.forEach((mk) => {
    const cell = document.createElement("div");
    const sign = mk.gap >= 0 ? "+" : "−";
    cell.innerHTML = `<h6>${mk.label}</h6><div class="unit-note">${mk.unit} · ${mk.direction}</div><div class="chart"></div>
      <div class="gap">Black − White at same score: ${sign}${Math.abs(mk.gap).toFixed(mk.gap > 10 ? 1 : 2)}</div>`;
    host.appendChild(cell);
    const el = cell.querySelector<HTMLElement>(".chart")!;
    responsive(el, () => draw(el, mk));
  });
}

function draw(el: HTMLElement, mk: Marker): void {
  const m = { top: 8, right: 6, bottom: 22, left: 34 };
  const f = frame(el, 0.85, m, 130, 200);
  const pts = mk.by_decile;
  const vals = pts.flatMap((p) => [p.b[1], p.b[2], p.w[1], p.w[2]]).filter((v): v is number => v != null);
  const [lo, hi] = extent(vals) as [number, number];
  const pad = (hi - lo) * 0.08;
  const x = scaleLinear().domain([0, 9]).range([0, f.innerW]);
  const y = scaleLinear()
    .domain([lo - pad, hi + pad])
    .range([f.innerH, 0])
    .nice(4);
  const ticks = y.ticks(4);
  const grid = f.g.append("g").attr("class", "grid");
  ticks.forEach((t) => {
    grid.append("line").attr("x1", 0).attr("x2", f.innerW).attr("y1", y(t)).attr("y2", y(t));
    grid.append("text")
      .attr("class", "tick-label")
      .attr("x", -5)
      .attr("y", y(t))
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text(t >= 100 ? t.toFixed(0) : t.toFixed(1));
  });
  const ax = f.g.append("g").attr("class", "axis").attr("transform", `translate(0,${f.innerH})`);
  ax.append("line").attr("x1", 0).attr("x2", f.innerW);
  [0, 9].forEach((d) => {
    ax.append("text")
      .attr("class", "tick-label")
      .attr("x", x(d))
      .attr("y", 15)
      .attr("text-anchor", d === 0 ? "start" : "end")
      .text(d === 0 ? "low score" : "high score");
  });

  (["w", "b"] as const).forEach((race) => {
    const color = race === "b" ? C.black : C.white;
    const band = area<Point>()
      .x((p) => x(p.d))
      .y0((p) => y(p[race][1]!))
      .y1((p) => y(p[race][2]!));
    const mid = line<Point>()
      .x((p) => x(p.d))
      .y((p) => y(p[race][0]!));
    f.g.append("path").attr("d", band(pts)).attr("fill", color).attr("opacity", 0.16);
    f.g.append("path").attr("d", mid(pts)).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.8);
  });
}

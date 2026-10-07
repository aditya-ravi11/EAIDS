import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { extent } from "d3-array";
import blend from "../data/blend.json";
import labels from "../data/labels.json";
import { C, fmt, frame, responsive, segmented, xAxis, yAxis } from "../lib/chart";

type KKey = "k1" | "k2" | "k3" | "k5" | "k10";
type Row = (typeof blend.rows)[number];

export function mountFrontier(fig: HTMLElement): void {
  const body = fig.querySelector<HTMLElement>(".chart")!;
  const readout = fig.querySelector<HTMLElement>(".readout")!;
  const range = fig.querySelector<HTMLInputElement>("input[type=range]")!;
  const out = fig.querySelector<HTMLOutputElement>("output")!;
  let kk: KKey = "k3";
  let idx = Number(range.value);

  segmented(
    fig.querySelector<HTMLElement>("[data-control]")!,
    [
      { value: "k1", label: "Top 1%" },
      { value: "k3", label: "Top 3%" },
      { value: "k5", label: "Top 5%" },
      { value: "k10", label: "Top 10%" },
    ],
    kk,
    (v) => {
      kk = v as KKey;
      draw();
    },
  );
  range.addEventListener("input", () => {
    idx = Number(range.value);
    draw();
  });

  const draw = () => {
    const rows = blend.rows;
    const cur = rows[idx];
    out.textContent = `α = ${cur.alpha.toFixed(2)}`;
    const f = frame(body, 0.6, { top: 1.8, right: 1.2, bottom: 2.9, left: 3.2 });
    const com = labels.rows.find((r) => r.key === "commercial")!;
    const [x0, x1] = extent(rows.map((r) => r[kk].cost)) as [number, number];
    const [y0, y1] = extent(rows.map((r) => r[kk].black)) as [number, number];
    const yLo = kk === "k3" ? Math.min(y0, com.black_share) : y0;
    const xHi = kk === "k3" ? Math.max(x1, com.cost_share) : x1;
    const x = scaleLinear().domain([x0 - (xHi - x0) * 0.12, xHi + (xHi - x0) * 0.12]).range([0, f.innerW]).nice(5);
    const y = scaleLinear().domain([yLo - (y1 - yLo) * 0.15, y1 + (y1 - yLo) * 0.15]).range([f.innerH, 0]).nice(5);
    yAxis(f, y, y.ticks(5), fmt.pct0, "Black share of selected patients");
    xAxis(f, x, x.ticks(f.innerW < 420 ? 4 : 6), (v) => fmt.pct1(v), "Share of all medical spending captured by the selected group");

    const path = line<Row>()
      .x((r) => x(r[kk].cost))
      .y((r) => y(r[kk].black));
    f.g.append("path").attr("d", path(rows)).attr("fill", "none").attr("stroke", C.rule).attr("stroke-width", 1.6);
    f.g.append("g")
      .selectAll("circle")
      .data(rows)
      .join("circle")
      .attr("cx", (r) => x(r[kk].cost))
      .attr("cy", (r) => y(r[kk].black))
      .attr("r", 0.26 * f.r)
      .attr("fill", (r) => (r.alpha === cur.alpha ? C.ink : C.paper))
      .attr("stroke", C.ink3)
      .attr("stroke-width", 1.3)
      .style("cursor", "pointer")
      .on("click", (_e, r) => {
        idx = rows.indexOf(r);
        range.value = String(idx);
        draw();
      });

    [
      { r: rows[0], t: "Health label only (α = 0)", left: true },
      { r: rows[rows.length - 1], t: "Cost label only (α = 1)", left: false },
    ].forEach(({ r, t, left }) => {
      f.g.append("text")
        .attr("class", "lbl halo")
        .attr("x", x(r[kk].cost) + (left ? 0.6 : -0.6) * f.r)
        .attr("y", y(r[kk].black) + (left ? -0.7 : 1.3) * f.r)
        .attr("text-anchor", left ? "start" : "end")
        .attr("fill", C.ink2)
        .text(t);
    });
    if (kk === "k3") {
      const s = 0.36 * f.r;
      f.g.append("rect").attr("x", x(com.cost_share) - s).attr("y", y(com.black_share) - s).attr("width", 2 * s).attr("height", 2 * s).attr("fill", C.accent);
      f.g.append("text").attr("class", "annot halo").attr("x", x(com.cost_share) + 0.7 * f.r).attr("y", y(com.black_share) + 0.3 * f.r).text("Commercial score");
    }
    f.g.append("circle").attr("cx", x(cur[kk].cost)).attr("cy", y(cur[kk].black)).attr("r", 0.6 * f.r).attr("fill", "none").attr("stroke", C.black).attr("stroke-width", 2.4);

    const c = cur[kk];
    const ref = rows[rows.length - 1][kk];
    readout.innerHTML = `
      <h5>Weight on cost ${cur.alpha.toFixed(2)} · ${kk.replace("k", "top ")}%</h5>
      <div class="big">${fmt.pct1(c.black)}</div>
      <div>of selected patients are Black <span class="num">(${fmt.pp(c.black - ref.black)} vs cost-only)</span></div>
      <dl>
        <dt>Total cost captured</dt><dd>${fmt.pct1(c.cost)}</dd>
        <dt>Cost-only model captures</dt><dd>${fmt.pct1(ref.cost)}</dd>
        <dt>Chronic conditions captured</dt><dd>${fmt.pct1(c.health)}</dd>
        <dt>Excess-illness gap closed</dt><dd>${fmt.pct0(cur.excess_reduction)}</dd>
      </dl>
      <p class="note">α weights predicted cost; 1 − α weights predicted chronic conditions. "Gap closed" is relative to the cost-only model.</p>`;
  };
  responsive(body, draw);
}

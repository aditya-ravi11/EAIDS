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
    const compact = body.clientWidth < 560;
    const m = { top: 30, right: compact ? 14 : 28, bottom: 46, left: 50 };
    const f = frame(body, 0.62, m, 260, 430);
    const xs = rows.map((r) => r[kk].cost);
    const ys = rows.map((r) => r[kk].black);
    const [x0, x1] = extent(xs) as [number, number];
    const [y0, y1] = extent(ys) as [number, number];
    const xpad = (x1 - x0) * 0.15 + 0.002;
    const ypad = (y1 - y0) * 0.15 + 0.005;
    const x = scaleLinear().domain([x0 - xpad, x1 + xpad]).range([0, f.innerW]).nice(5);
    const com = labels.rows.find((r) => r.key === "commercial")!;
    const yLo = kk === "k3" ? Math.min(y0, com.black_share) : y0;
    const y = scaleLinear().domain([yLo - ypad, y1 + ypad]).range([f.innerH, 0]).nice(5);
    yAxis(f.g, y, f.innerW, y.ticks(5), fmt.pct0, "Black share of selected patients");
    xAxis(f.g, x, f.innerH, x.ticks(compact ? 4 : 6), (v) => fmt.pct1(v), "Share of all medical spending captured by the selected group");

    const path = line<Row>()
      .x((r) => x(r[kk].cost))
      .y((r) => y(r[kk].black));
    f.g.append("path").attr("d", path(rows)).attr("fill", "none").attr("stroke", C.rule).attr("stroke-width", 1.5);
    f.g.append("g")
      .selectAll("circle")
      .data(rows)
      .join("circle")
      .attr("cx", (r) => x(r[kk].cost))
      .attr("cy", (r) => y(r[kk].black))
      .attr("r", 3.5)
      .attr("fill", (r) => (r.alpha === cur.alpha ? C.ink : C.paper))
      .attr("stroke", C.ink3)
      .attr("stroke-width", 1.2)
      .style("cursor", "pointer")
      .on("click", (_e, r) => {
        idx = rows.indexOf(r);
        range.value = String(idx);
        draw();
      });

    const ends = [
      { r: rows[0], t: "Health label only (α = 0)" },
      { r: rows[rows.length - 1], t: "Cost label only (α = 1)" },
    ];
    ends.forEach(({ r, t }) => {
      f.g.append("text")
        .attr("x", x(r[kk].cost) + (r.alpha === 0 ? 8 : -8))
        .attr("y", y(r[kk].black) + (r.alpha === 0 ? -8 : 16))
        .attr("text-anchor", r.alpha === 0 ? "start" : "end")
        .attr("class", "halo")
        .attr("font-size", 11)
        .attr("fill", C.ink2)
        .text(t);
    });

    if (kk === "k3") {
      f.g.append("rect")
        .attr("x", x(com.cost_share) - 5)
        .attr("y", y(com.black_share) - 5)
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", C.accent);
      f.g.append("text")
        .attr("class", "annot halo")
        .attr("x", x(com.cost_share) + 10)
        .attr("y", y(com.black_share) + 4)
        .text("Commercial score");
    }

    // Current point emphasis
    f.g.append("circle")
      .attr("cx", x(cur[kk].cost))
      .attr("cy", y(cur[kk].black))
      .attr("r", 8)
      .attr("fill", "none")
      .attr("stroke", C.black)
      .attr("stroke-width", 2);

    const c = cur[kk];
    const ref = rows[rows.length - 1][kk];
    readout.innerHTML = `
      <h5>Weight on cost ${cur.alpha.toFixed(2)} · ${kk.replace("k", "top ")}%</h5>
      <div class="big">${fmt.pct1(c.black)}</div>
      <div>of selected patients are Black <span class="num">(${fmt.pp(c.black - ref.black)} vs cost-only)</span>.</div>
      <dl style="margin-top:.8rem">
        <dt>Total cost captured</dt><dd>${fmt.pct1(c.cost)}</dd>
        <dt>Avoidable cost captured</dt><dd>${fmt.pct1(c.avoidable)}</dd>
        <dt>Chronic conditions captured</dt><dd>${fmt.pct1(c.health)}</dd>
        <dt>Excess-conditions gap closed</dt><dd>${fmt.pct0(cur.excess_reduction)}</dd>
      </dl>
      <p class="note">α is the weight on predicted cost; 1 − α goes to predicted chronic conditions. "Gap closed" compares the extra illness carried by Black patients at equal score against the cost-only model.</p>`;
  };
  responsive(body, draw);
}

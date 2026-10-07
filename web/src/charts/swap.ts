import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { pointer } from "d3-selection";
import swap from "../data/swap.json";
import { C, fmt, frame, responsive, xAxis, yAxis } from "../lib/chart";
import { Tip, row } from "../lib/tip";

type Row = (typeof swap.by_threshold)[number];

export function mountSwap(fig: HTMLElement): void {
  const body = fig.querySelector<HTMLElement>(".chart")!;
  const tip = new Tip(fig.querySelector<HTMLElement>(".fig-body")!);

  const draw = () => {
    const compact = body.clientWidth < 560;
    const m = { top: 30, right: compact ? 14 : 150, bottom: 44, left: 48 };
    const f = frame(body, 0.44, m, 250, 400);
    const rows = swap.by_threshold;
    const x = scaleLinear().domain([55, 99]).range([0, f.innerW]);
    const y = scaleLinear().domain([0, 0.8]).range([f.innerH, 0]);
    yAxis(f.g, y, f.innerW, [0, 0.2, 0.4, 0.6, 0.8], fmt.pct0, "Black share above the threshold");
    xAxis(f.g, x, f.innerH, [55, 65, 75, 85, 95, 99], (v) => `${v}th`, "Programme threshold");

    const series = [
      { k: "before", color: C.ink, width: 2.2, dash: "", label: "Actual, ranked by score" },
      { k: "buggy", color: "#a8a192", width: 1.6, dash: "5 4", label: "Swap · original code" },
      { k: "fixed", color: C.black, width: 2.6, dash: "", label: "Swap · corrected code" },
    ] as const;
    series.forEach((s) => {
      const path = line<Row>()
        .x((r) => x(r.p))
        .y((r) => y(r[s.k]));
      f.g.append("path")
        .attr("d", path(rows))
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", s.width)
        .attr("stroke-dasharray", s.dash);
      if (!compact) {
        const last = rows[rows.length - 1];
        f.g.append("text")
          .attr("x", f.innerW + 8)
          .attr("y", y(last[s.k]))
          .attr("dy", "0.32em")
          .attr("font-size", 11.5)
          .attr("font-weight", s.k === "fixed" ? 700 : 400)
          .attr("fill", s.color === "#a8a192" ? C.ink3 : s.color)
          .text(s.label);
      }
    });

    const a = swap.at97;
    const ax = x(97);
    f.g.append("line").attr("class", "crosshair").attr("x1", ax).attr("x2", ax).attr("y1", y(a.before)).attr("y2", y(a.fixed));
    [
      { v: a.before, t: fmt.pct1(a.before) },
      { v: a.buggy, t: fmt.pct1(a.buggy) },
      { v: a.fixed, t: fmt.pct1(a.fixed) },
    ].forEach((d) => {
      f.g.append("circle").attr("cx", ax).attr("cy", y(d.v)).attr("r", 4).attr("fill", C.paper).attr("stroke", C.ink).attr("stroke-width", 1.5);
      f.g.append("text")
        .attr("x", ax - 8)
        .attr("y", y(d.v))
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .attr("class", "halo")
        .attr("font-family", "IBM Plex Mono, monospace")
        .attr("font-size", 11)
        .attr("fill", C.ink)
        .text(d.t);
    });
    f.g.append("text")
      .attr("class", "annot halo")
      .attr("x", x(70))
      .attr("y", y(0.62))
      .text(compact ? "" : "Published 2019: 17.7% → 46.5%; corrected 2022: → 59%");

    f.g.append("rect")
      .attr("width", f.innerW)
      .attr("height", f.innerH)
      .attr("fill", "transparent")
      .on("pointermove", (ev: PointerEvent) => {
        const [px, py] = pointer(ev);
        const p = Math.max(55, Math.min(99, Math.round(x.invert(px))));
        const r = rows.find((d) => d.p === p)!;
        tip.show(
          `<b>Threshold ${p}th</b>` +
            row("Actual", fmt.pct1(r.before)) +
            row("Original code", fmt.pct1(r.buggy)) +
            row("Corrected code", fmt.pct1(r.fixed)),
          px + m.left,
          py + m.top,
        );
      })
      .on("pointerleave", () => tip.hide());
  };
  responsive(body, draw);
}

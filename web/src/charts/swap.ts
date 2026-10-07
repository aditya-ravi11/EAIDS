import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { pointer } from "d3-selection";
import swap from "../data/swap.json";
import { C, fmt, frame, responsive, spread, xAxis, yAxis } from "../lib/chart";
import { Tip, row } from "../lib/tip";

type Row = (typeof swap.by_threshold)[number];

export function mountSwap(fig: HTMLElement): void {
  const body = fig.querySelector<HTMLElement>(".chart")!;
  const tip = new Tip(fig.querySelector<HTMLElement>(".fig-body")!);

  const draw = () => {
    const compact = body.clientWidth < 520;
    const m = { top: 1.8, right: compact ? 1 : 9.4, bottom: 2.9, left: 3 };
    const f = frame(body, 0.5, m);
    const rows = swap.by_threshold;
    const x = scaleLinear().domain([55, 99]).range([0, f.innerW]);
    const y = scaleLinear().domain([0, 0.8]).range([f.innerH, 0]);
    yAxis(f, y, [0, 0.2, 0.4, 0.6, 0.8], fmt.pct0, "Black share above the threshold");
    xAxis(f, x, [55, 65, 75, 85, 95], (v) => `${v}th`, "Programme threshold");

    const series = [
      { k: "before", color: C.ink, width: 2.4, dash: "", label: "Actual, ranked by score" },
      { k: "buggy", color: "#aaa394", width: 1.8, dash: "6 4", label: "Swap · original code" },
      { k: "fixed", color: C.black, width: 3, dash: "", label: "Swap · corrected code" },
    ] as const;
    const labels: { y: number; text: string; color: string; strong: boolean }[] = [];
    series.forEach((s) => {
      const path = line<Row>()
        .x((r) => x(r.p))
        .y((r) => y(r[s.k]));
      f.g.append("path").attr("d", path(rows)).attr("fill", "none").attr("stroke", s.color).attr("stroke-width", s.width).attr("stroke-dasharray", s.dash);
      labels.push({ y: y(rows[rows.length - 1][s.k]), text: s.label, color: s.k === "buggy" ? C.ink3 : s.color, strong: s.k === "fixed" });
    });
    if (!compact) {
      spread(labels, 1.05 * f.r).forEach((l) =>
        f.g.append("text").attr("class", `lbl${l.strong ? " strong" : ""}`).attr("x", f.innerW + 0.5 * f.r).attr("y", l.y).attr("dy", "0.32em").attr("fill", l.color).text(l.text),
      );
    }

    const a = swap.at97;
    const ax = x(97);
    f.g.append("line").attr("class", "crosshair").attr("x1", ax).attr("x2", ax).attr("y1", y(a.before)).attr("y2", y(a.fixed));
    [a.before, a.buggy, a.fixed].forEach((v) => {
      f.g.append("circle").attr("cx", ax).attr("cy", y(v)).attr("r", 0.3 * f.r).attr("fill", C.paper).attr("stroke", C.ink).attr("stroke-width", 1.6);
      f.g.append("text").attr("class", "mono-lbl halo").attr("x", ax - 0.6 * f.r).attr("y", y(v)).attr("dy", "0.32em").attr("text-anchor", "end").attr("fill", C.ink).text(fmt.pct1(v));
    });
    f.g.append("text").attr("class", "lbl").attr("x", ax).attr("y", -0.5 * f.r).attr("text-anchor", "middle").attr("fill", C.ink2).text("97th");
    if (!compact) {
      f.g.append("text").attr("class", "annot halo").attr("x", x(64)).attr("y", y(0.66)).text("Published 2019: 17.7% → 46.5% · corrected 2022: → 59%");
    }

    f.g.append("rect")
      .attr("width", f.innerW)
      .attr("height", f.innerH)
      .attr("fill", "transparent")
      .on("pointermove", (ev: PointerEvent) => {
        const [px, py] = pointer(ev);
        const p = Math.max(55, Math.min(99, Math.round(x.invert(px))));
        const r = rows.find((d) => d.p === p)!;
        tip.show(`<b>Threshold ${p}th</b>` + row("Actual", fmt.pct1(r.before)) + row("Original code", fmt.pct1(r.buggy)) + row("Corrected code", fmt.pct1(r.fixed)), px + m.left * f.r, py + m.top * f.r);
      })
      .on("pointerleave", () => tip.hide());
  };
  responsive(body, draw);
}

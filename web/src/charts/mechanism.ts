import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { pointer } from "d3-selection";
import mech from "../data/mechanism.json";
import { C, fmt, frame, responsive, xAxis, yAxis } from "../lib/chart";
import { Tip, row } from "../lib/tip";

type Row = (typeof mech.by_conditions)[number];

export function mountMechanism(fig: HTMLElement): void {
  const body = fig.querySelector<HTMLElement>(".chart")!;
  const tip = new Tip(fig.querySelector<HTMLElement>(".fig-body")!);

  const draw = () => {
    const compact = body.clientWidth < 560;
    const m = { top: 30, right: compact ? 16 : 118, bottom: 44, left: 54 };
    const f = frame(body, 0.42, m, 240, 380);
    const rows = mech.by_conditions;
    const x = scaleLinear().domain([0, 10]).range([0, f.innerW]);
    const y = scaleLinear().domain([0, 60000]).range([f.innerH, 0]);
    yAxis(f.g, y, f.innerW, [0, 15000, 30000, 45000, 60000], fmt.usdk, "Mean total cost, year t");
    xAxis(f.g, x, f.innerH, [0, 2, 4, 6, 8, 10], (v) => (v === 10 ? "10+" : String(v)), "Active chronic conditions, year t");

    const gap = f.g.append("g");
    rows.forEach((r) => {
      gap.append("line")
        .attr("x1", x(r.k))
        .attr("x2", x(r.k))
        .attr("y1", y(r.cb))
        .attr("y2", y(r.cw))
        .attr("stroke", C.rule)
        .attr("stroke-width", 6);
    });

    (
      [
        { k: "cw", color: C.white, label: "White patients" },
        { k: "cb", color: C.black, label: "Black patients" },
      ] as const
    ).forEach((s) => {
      const path = line<Row>()
        .x((r) => x(r.k))
        .y((r) => y(r[s.k]));
      f.g.append("path").attr("class", "line").attr("stroke", s.color).attr("d", path(rows));
      f.g.append("g")
        .selectAll("circle")
        .data(rows)
        .join("circle")
        .attr("cx", (r) => x(r.k))
        .attr("cy", (r) => y(r[s.k]))
        .attr("r", 3.4)
        .attr("fill", C.paper)
        .attr("stroke", s.color)
        .attr("stroke-width", 2);
      if (!compact) {
        const last = rows[rows.length - 1];
        f.g.append("text")
          .attr("class", "series-label")
          .attr("x", x(10) + 10)
          .attr("y", y(last[s.k]) + 4)
          .attr("fill", s.color)
          .text(s.label);
      }
    });

    f.g.append("rect")
      .attr("width", f.innerW)
      .attr("height", f.innerH)
      .attr("fill", "transparent")
      .on("pointermove", (ev: PointerEvent) => {
        const [px, py] = pointer(ev);
        const k = Math.max(0, Math.min(10, Math.round(x.invert(px))));
        const r = rows[k];
        tip.show(
          `<b>${k === 10 ? "10+" : k} conditions</b>` +
            row("Black", fmt.usd(r.cb), "b") +
            row("White", fmt.usd(r.cw), "w") +
            row("Difference", `${r.cb < r.cw ? "−" : "+"}${fmt.usd(r.cb - r.cw)}`) +
            row("n (B / W)", `${r.nb} / ${r.nw}`),
          px + m.left,
          py + m.top,
        );
      })
      .on("pointerleave", () => tip.hide());
  };
  responsive(body, draw);
}

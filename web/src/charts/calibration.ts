import { scaleLinear, scaleLog } from "d3-scale";
import { line, curveMonotoneX } from "d3-shape";
import { pointer } from "d3-selection";
import cal from "../data/calibration.json";
import { C, fmt, frame, responsive, segmented, thresholds, xAxis, yAxis } from "../lib/chart";
import { Tip, row } from "../lib/tip";

type Mode = "health" | "cost";
type Row = (typeof cal.by_pct)[number];

const TITLES: Record<Mode, [string, string]> = {
  health: [
    "At every risk score, Black patients are sicker than White patients",
    "Mean number of active chronic conditions in the following year, by percentile of the commercial risk score. Dots are percentile means; lines are count-weighted kernel smooths.",
  ],
  cost: [
    "…yet the score predicts cost almost equally well for both groups",
    "Mean total medical expenditure in the following year (log scale), by the same risk-score percentile. The score is calibrated on the quantity it was trained to predict.",
  ],
};

export function mountCalibration(fig: HTMLElement): void {
  const body = fig.querySelector<HTMLElement>(".chart")!;
  const title = fig.querySelector<HTMLElement>(".fig-title")!;
  const sub = fig.querySelector<HTMLElement>(".fig-sub")!;
  const tip = new Tip(fig.querySelector<HTMLElement>(".fig-body")!);
  let mode: Mode = "health";

  segmented(
    fig.querySelector<HTMLElement>("[data-control]")!,
    [
      { value: "health", label: "Outcome: health" },
      { value: "cost", label: "Outcome: cost" },
    ],
    mode,
    (v) => {
      mode = v as Mode;
      draw();
    },
  );

  const draw = () => {
    title.textContent = TITLES[mode][0];
    sub.textContent = TITLES[mode][1];
    const compact = body.clientWidth < 560;
    const m = { top: 30, right: compact ? 16 : 118, bottom: 44, left: compact ? 44 : 54 };
    const f = frame(body, 0.46, m, 260, 440);
    const rows = cal.by_pct;
    const x = scaleLinear().domain([0, 100]).range([0, f.innerW]);
    const isHealth = mode === "health";
    const y = isHealth
      ? scaleLinear().domain([0, 7.6]).range([f.innerH, 0])
      : scaleLog().domain([900, 110000]).range([f.innerH, 0]).clamp(true);
    const yTicks = isHealth ? [0, 1, 2, 3, 4, 5, 6, 7] : [1000, 3000, 10000, 30000, 100000];
    yAxis(f.g, y, f.innerW, yTicks, isHealth ? String : fmt.usdk, isHealth ? "Active chronic conditions" : "Total cost (log scale)");
    xAxis(f.g, x, f.innerH, [0, 20, 40, 60, 80, 100], String, "Percentile of commercial risk score");
    thresholds(f.g, x, f.innerH, compact);

    const key = isHealth ? "h" : "c";
    const series: { race: "b" | "w"; color: string; label: string }[] = [
      { race: "w", color: C.white, label: "White patients" },
      { race: "b", color: C.black, label: "Black patients" },
    ];
    const val = (r: Row, k: string) => (r as unknown as Record<string, number | null>)[k];

    series.forEach((s) => {
      f.g.append("g")
        .selectAll("circle")
        .data(rows.filter((r) => val(r, key + s.race) != null))
        .join("circle")
        .attr("class", "dot")
        .attr("cx", (r) => x(r.p + 0.5))
        .attr("cy", (r) => y(val(r, key + s.race)!))
        .attr("r", compact ? 1.8 : 2.4)
        .attr("fill", s.color)
        .attr("opacity", s.race === "b" ? 0.38 : 0.45);
    });
    series.forEach((s) => {
      const k = `s_${key}${s.race}`;
      const path = line<Row>()
        .x((r) => x(r.p + 0.5))
        .y((r) => y(val(r, k)!))
        .curve(curveMonotoneX);
      f.g.append("path").attr("class", "line").attr("stroke", s.color).attr("d", path(rows));
      if (!compact) {
        const last = rows[rows.length - 1];
        f.g.append("text")
          .attr("class", "series-label")
          .attr("x", x(100) + 8)
          .attr("y", y(val(last, k)!) + (s.race === "b" ? -4 : 10))
          .attr("fill", s.color)
          .text(s.label);
      }
    });

    // Hover crosshair
    const cross = f.g.append("line").attr("class", "crosshair").attr("y1", 0).attr("y2", f.innerH).attr("opacity", 0);
    f.g.append("rect")
      .attr("width", f.innerW)
      .attr("height", f.innerH)
      .attr("fill", "transparent")
      .on("pointermove", (ev: PointerEvent) => {
        const [px, py] = pointer(ev);
        const p = Math.max(0, Math.min(99, Math.floor(x.invert(px))));
        const r = rows[p];
        cross.attr("x1", x(p + 0.5)).attr("x2", x(p + 0.5)).attr("opacity", 1);
        const v = (k: string) => {
          const n = val(r, k);
          if (n == null) return "–";
          return isHealth ? n.toFixed(2) : fmt.usd(n);
        };
        tip.show(
          `<b>Percentile ${p}</b>` +
            row("Black", v(key + "b"), "b") +
            row("White", v(key + "w"), "w") +
            row("n (B / W)", `${r.nb} / ${r.nw}`),
          px + m.left,
          py + m.top,
        );
      })
      .on("pointerleave", () => {
        cross.attr("opacity", 0);
        tip.hide();
      });
  };

  responsive(body, draw);
}

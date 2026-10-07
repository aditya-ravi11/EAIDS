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
    "Mean number of active chronic conditions next year, by percentile of the commercial risk score. Dots: percentile means. Lines: smoothed.",
  ],
  cost: [
    "…yet the score predicts cost almost equally well for both groups",
    "Mean total medical cost next year (log scale), by the same percentile. The score is accurate on what it was trained to predict.",
  ],
};

export function mountCalibration(fig: HTMLElement): { set: (m: Mode) => void } {
  const body = fig.querySelector<HTMLElement>(".chart")!;
  const title = fig.querySelector<HTMLElement>(".fig-title")!;
  const sub = fig.querySelector<HTMLElement>(".fig-sub")!;
  const tip = new Tip(fig.querySelector<HTMLElement>(".fig-body")!);
  const control = fig.querySelector<HTMLElement>("[data-control]")!;
  let mode: Mode = "health";

  segmented(
    control,
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
    const compact = body.clientWidth < 520;
    const f = frame(body, 0.5, { top: 1.8, right: compact ? 1 : 7.4, bottom: 2.9, left: 3.2 });
    const rows = cal.by_pct;
    const x = scaleLinear().domain([0, 100]).range([0, f.innerW]);
    const isHealth = mode === "health";
    const y = isHealth
      ? scaleLinear().domain([0, 7.6]).range([f.innerH, 0])
      : scaleLog().domain([900, 110000]).range([f.innerH, 0]).clamp(true);
    yAxis(f, y, isHealth ? [0, 1, 2, 3, 4, 5, 6, 7] : [1000, 3000, 10000, 30000, 100000], isHealth ? String : fmt.usdk, isHealth ? "Active chronic conditions" : "Total cost (log scale)");
    xAxis(f, x, [0, 20, 40, 60, 80, 100], String, "Percentile of commercial risk score");
    thresholds(f, x, compact);

    const key = isHealth ? "h" : "c";
    const val = (r: Row, k: string) => (r as unknown as Record<string, number | null>)[k];
    const series = [
      { race: "w", color: C.white, label: "White patients" },
      { race: "b", color: C.black, label: "Black patients" },
    ];
    series.forEach((s) => {
      f.g.append("g")
        .selectAll("circle")
        .data(rows.filter((r) => val(r, key + s.race) != null))
        .join("circle")
        .attr("cx", (r) => x(r.p + 0.5))
        .attr("cy", (r) => y(val(r, key + s.race)!))
        .attr("r", 0.17 * f.r)
        .attr("fill", s.color)
        .attr("opacity", 0.42);
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
          .attr("x", x(100) + 0.5 * f.r)
          .attr("y", y(val(last, k)!) + (s.race === "b" ? -0.3 : 0.7) * f.r)
          .attr("fill", s.color)
          .text(s.label);
      }
    });

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
          return n == null ? "–" : isHealth ? n.toFixed(2) : fmt.usd(n);
        };
        tip.show(`<b>Percentile ${p}</b>` + row("Black", v(key + "b"), "b") + row("White", v(key + "w"), "w") + row("n (B / W)", `${r.nb} / ${r.nw}`), px + 3.2 * f.r, py + 1.8 * f.r);
      })
      .on("pointerleave", () => {
        cross.attr("opacity", 0);
        tip.hide();
      });
  };

  responsive(body, draw);
  return {
    set: (m: Mode) => (control.querySelector<HTMLButtonElement>(`button[data-value="${m}"]`) ?? control).click(),
  };
}

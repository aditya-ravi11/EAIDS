import { select, type Selection } from "d3-selection";
import type { ScaleContinuousNumeric } from "d3-scale";
import { format } from "d3-format";

export type G = Selection<SVGGElement, unknown, null, undefined>;
export type Svg = Selection<SVGSVGElement, unknown, null, undefined>;

export const C = {
  ink: "#161616",
  ink2: "#47433b",
  ink3: "#777061",
  rule: "#cfc8b8",
  rule2: "#e2dccd",
  paper: "#f7f4ec",
  black: "#4b3f8c",
  white: "#d98e04",
  accent: "#b3261e",
};

export const fmt = {
  pct0: format(".0%"),
  pct1: format(".1%"),
  num1: format(".1f"),
  num2: format(".2f"),
  int: format(",d"),
  usd: (v: number) => `$${format(",.0f")(Math.abs(v))}`,
  usdk: (v: number) => (v >= 1000 ? `$${format(".0f")(v / 1000)}k` : `$${format(".0f")(v)}`),
  signed: (v: number, digits = 2) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`,
  pp: (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)} pp`,
};

export interface Frame {
  svg: Svg;
  g: G;
  width: number;
  height: number;
  innerW: number;
  innerH: number;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Create a fresh SVG sized to the container's current width. */
export function frame(el: HTMLElement, aspect: number, margin: Margin, minH = 220, maxH = 460): Frame {
  el.querySelector("svg")?.remove();
  const width = Math.max(280, el.clientWidth);
  const height = Math.round(Math.min(maxH, Math.max(minH, width * aspect)));
  const svg = select(el)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img") as Svg;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`) as G;
  return {
    svg,
    g,
    width,
    height,
    innerW: width - margin.left - margin.right,
    innerH: height - margin.top - margin.bottom,
  };
}

/** Minimal axes in the house style: hairline gridlines, mono tick labels. */
export function yAxis(
  g: G,
  y: ScaleContinuousNumeric<number, number>,
  innerW: number,
  ticks: number[],
  label: (v: number) => string,
  title?: string,
): void {
  const ax = g.append("g").attr("class", "grid");
  ticks.forEach((t) => {
    ax.append("line").attr("x1", 0).attr("x2", innerW).attr("y1", y(t)).attr("y2", y(t));
    ax.append("text")
      .attr("class", "tick-label")
      .attr("x", -8)
      .attr("y", y(t))
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text(label(t));
  });
  if (title) {
    g.append("text").attr("class", "axis-title").attr("x", 0).attr("y", -14).text(title);
  }
}

export function xAxis(
  g: G,
  x: ScaleContinuousNumeric<number, number>,
  innerH: number,
  ticks: number[],
  label: (v: number) => string,
  title?: string,
): void {
  const ax = g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`);
  ax.append("line").attr("x1", x.range()[0]).attr("x2", x.range()[1]);
  ticks.forEach((t) => {
    ax.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 0).attr("y2", 5);
    ax.append("text")
      .attr("class", "tick-label")
      .attr("x", x(t))
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .text(label(t));
  });
  if (title) {
    ax.append("text")
      .attr("class", "axis-title")
      .attr("x", x.range()[1])
      .attr("y", 36)
      .attr("text-anchor", "end")
      .text(title);
  }
}

/** Dashed programme thresholds (55th: referred, 97th: auto-identified). */
export function thresholds(g: G, x: ScaleContinuousNumeric<number, number>, innerH: number, compact = false): void {
  const t = g.append("g").attr("class", "thr");
  [
    { p: 55, label: compact ? "55th" : "55th · referred to PCP" },
    { p: 97, label: compact ? "97th" : "97th · auto-identified" },
  ].forEach(({ p, label }) => {
    t.append("line").attr("x1", x(p)).attr("x2", x(p)).attr("y1", 0).attr("y2", innerH);
    t.append("text")
      .attr("x", x(p) - 5)
      .attr("y", 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "hanging")
      .text(label);
  });
}

/** Re-run a draw function whenever the element changes width. */
export function responsive(el: HTMLElement, draw: () => void): void {
  // Draw once immediately; ResizeObserver callbacks can be delayed in background tabs.
  draw();
  let last = el.clientWidth;
  const ro = new ResizeObserver(() => {
    const w = el.clientWidth;
    if (Math.abs(w - last) > 2) {
      last = w;
      draw();
    }
  });
  ro.observe(el);
}

export function segmented(
  el: HTMLElement,
  options: { value: string; label: string }[],
  initial: string,
  onChange: (v: string) => void,
): void {
  el.classList.add("seg");
  el.setAttribute("role", "group");
  options.forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = o.label;
    b.dataset.value = o.value;
    b.setAttribute("aria-pressed", String(o.value === initial));
    b.addEventListener("click", () => {
      el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onChange(o.value);
    });
    el.appendChild(b);
  });
}

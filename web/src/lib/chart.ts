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

/** Current root font size in px: the deck scales everything from this. */
export const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

export interface Frame {
  svg: Svg;
  g: G;
  width: number;
  height: number;
  innerW: number;
  innerH: number;
  r: number;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Create a fresh SVG sized to the container. Margins are given in rem.
 * Containers marked `data-fill` take their height from CSS (they fill the
 * screen); others derive it from the width.
 */
export function frame(el: HTMLElement, aspect: number, m: Margin, minH = 200): Frame {
  el.querySelector("svg")?.remove();
  const r = rem();
  const width = Math.max(240, el.clientWidth);
  const height = el.hasAttribute("data-fill") ? Math.max(minH, el.clientHeight) : Math.max(minH, Math.round(width * aspect));
  const margin = { top: m.top * r, right: m.right * r, bottom: m.bottom * r, left: m.left * r };
  const svg = select(el).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height).attr("role", "img") as Svg;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`) as G;
  return { svg, g, width, height, innerW: width - margin.left - margin.right, innerH: height - margin.top - margin.bottom, r };
}

/** Hairline gridlines with mono tick labels. */
export function yAxis(
  f: Frame,
  y: ScaleContinuousNumeric<number, number>,
  ticks: number[],
  label: (v: number) => string,
  title?: string,
): void {
  const ax = f.g.append("g").attr("class", "grid");
  ticks.forEach((t) => {
    ax.append("line").attr("x1", 0).attr("x2", f.innerW).attr("y1", y(t)).attr("y2", y(t));
    ax.append("text").attr("class", "tick-label").attr("x", -0.5 * f.r).attr("y", y(t)).attr("dy", "0.32em").attr("text-anchor", "end").text(label(t));
  });
  if (title) f.g.append("text").attr("class", "axis-title").attr("x", 0).attr("y", -0.9 * f.r).text(title);
}

export function xAxis(
  f: Frame,
  x: ScaleContinuousNumeric<number, number>,
  ticks: number[],
  label: (v: number) => string,
  title?: string,
): void {
  const ax = f.g.append("g").attr("class", "axis").attr("transform", `translate(0,${f.innerH})`);
  ax.append("line").attr("x1", x.range()[0]).attr("x2", x.range()[1]);
  ticks.forEach((t) => {
    ax.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 0).attr("y2", 0.3 * f.r);
    ax.append("text").attr("class", "tick-label").attr("x", x(t)).attr("y", 1.2 * f.r).attr("text-anchor", "middle").text(label(t));
  });
  if (title) {
    ax.append("text").attr("class", "axis-title").attr("x", x.range()[1]).attr("y", 2.35 * f.r).attr("text-anchor", "end").text(title);
  }
}

/** Dashed programme thresholds (55th: referred, 97th: auto-identified). */
export function thresholds(f: Frame, x: ScaleContinuousNumeric<number, number>, compact = false): void {
  const t = f.g.append("g").attr("class", "thr");
  [
    { p: 55, label: compact ? "55th" : "55th · referred" },
    { p: 97, label: compact ? "97th" : "97th · auto-identified" },
  ].forEach(({ p, label }) => {
    t.append("line").attr("x1", x(p)).attr("x2", x(p)).attr("y1", 0).attr("y2", f.innerH);
    t.append("text").attr("x", x(p) - 0.35 * f.r).attr("y", 0.2 * f.r).attr("text-anchor", "end").attr("dominant-baseline", "hanging").text(label);
  });
}

/** Draw now (if visible) and again whenever the element's box changes. */
export function responsive(el: HTMLElement, draw: () => void): void {
  let lastW = 0;
  let lastH = 0;
  const run = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0) return;
    if (Math.abs(w - lastW) > 2 || Math.abs(h - lastH) > 2) {
      lastW = w;
      lastH = h;
      draw();
    }
  };
  run();
  new ResizeObserver(run).observe(el);
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

/** Push overlapping right-edge labels apart vertically. */
export function spread<T extends { y: number }>(labels: T[], gap: number): T[] {
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < gap) labels[i].y = labels[i - 1].y + gap;
  }
  return labels;
}

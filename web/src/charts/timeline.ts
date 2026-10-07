import { scaleTime } from "d3-scale";
import timeline from "../../../content/timeline.json";
import { frame, responsive } from "../lib/chart";

type Item = (typeof timeline.items)[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parse = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return new Date(y, m - 1, 15);
};
const label = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

/** Swimlane timeline: one lane per jurisdiction, labels stacked to avoid overlap. */
export function mountTimeline(host: HTMLElement, cite: (ids: string[]) => string): void {
  const chart = host.querySelector<HTMLElement>(".lanes-chart")!;
  chart.setAttribute("data-fill", "");
  const detail = host.querySelector<HTMLElement>(".lanes-detail")!;
  let selected: Item = timeline.items[0];

  const show = (it: Item) => {
    selected = it;
    const lane = timeline.lanes.find((l) => l.key === it.lane)!.label;
    detail.innerHTML = `<span class="d-date">${label(it.date)} · ${lane}</span><strong>${it.title}</strong>${it.text}${cite(it.refs)}`;
    chart.querySelectorAll(".tl-item").forEach((n) => n.classList.toggle("is-on", (n as SVGGElement).dataset.id === `${it.lane}-${it.date}-${it.short}`));
  };

  const draw = () => {
    const f = frame(chart, 0.45, { top: 1.6, right: 0.8, bottom: 0.4, left: 7.4 }, 200);
    const x = scaleTime()
      .domain([new Date(2019, 0, 1), new Date(2028, 2, 1)])
      .range([0, f.innerW]);
    const laneH = f.innerH / timeline.lanes.length;
    const charW = 0.36 * f.r;

    // Year grid
    for (let yr = 2019; yr <= 2028; yr++) {
      const xx = x(new Date(yr, 0, 1));
      f.g.append("line").attr("class", "year-line").attr("x1", xx).attr("x2", xx).attr("y1", -0.2 * f.r).attr("y2", f.innerH);
      f.g.append("text").attr("class", "year-tick").attr("x", xx + 0.2 * f.r).attr("y", -0.5 * f.r).text(yr);
    }
    const now = x(new Date(2026, 9, 7));
    f.g.append("line").attr("class", "now-line").attr("x1", now).attr("x2", now).attr("y1", -0.2 * f.r).attr("y2", f.innerH);
    f.g.append("text").attr("class", "now-label").attr("x", now + 0.25 * f.r).attr("y", f.innerH - 0.3 * f.r).text("today");

    timeline.lanes.forEach((lane, li) => {
      const top = li * laneH;
      f.g.append("line").attr("class", "lane-rule").attr("x1", -7.2 * f.r).attr("x2", f.innerW).attr("y1", top).attr("y2", top);
      f.g.append("text").attr("class", "lane-label").attr("x", -7.2 * f.r).attr("y", top + 0.9 * f.r).text(lane.label);

      // Greedy row assignment so labels in a lane never overlap.
      const items = timeline.items.filter((it) => it.lane === lane.key).sort((a, b) => a.date.localeCompare(b.date));
      const rowEnds: number[] = [];
      const rowH = 1.25 * f.r;
      const maxRows = Math.max(1, Math.floor((laneH - 0.9 * f.r) / rowH));
      items.forEach((it) => {
        const cx = x(parse(it.date));
        const w = it.short.length * charW + 1.2 * f.r;
        // Labels that would run off the right edge sit to the left of their marker.
        const flip = cx + w > f.innerW;
        const start = flip ? cx - w : cx;
        let row = rowEnds.findIndex((end) => start > end + 0.4 * f.r);
        if (row === -1) row = rowEnds.length < maxRows ? rowEnds.length : rowEnds.indexOf(Math.min(...rowEnds));
        rowEnds[row] = flip ? cx + 0.6 * f.r : cx + w;
        const cy = top + 0.75 * f.r + row * rowH;
        const g = f.g.append("g").attr("class", "tl-item").attr("data-id", `${it.lane}-${it.date}-${it.short}`);
        g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", top + 0.2 * f.r).attr("y2", cy);
        const s = 0.32 * f.r;
        g.append("rect").attr("class", `mk ${it.kind}`).attr("x", cx - s).attr("y", cy - s).attr("width", 2 * s).attr("height", 2 * s);
        g.append("text")
          .attr("x", flip ? cx - 0.55 * f.r : cx + 0.55 * f.r)
          .attr("y", cy)
          .attr("dy", "0.34em")
          .attr("text-anchor", flip ? "end" : "start")
          .text(it.short);
        g.on("click", () => show(it)).on("mouseenter", () => show(it));
      });
    });
    show(selected);
  };

  responsive(chart, draw);
}

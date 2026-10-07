import human from "../data/human.json";
import labels from "../data/labels.json";
import thresholds from "../data/thresholds.json";
import { fmt } from "../lib/chart";

/** Human review: are enrolled Black and White patients equally sick? */
export function mountHuman(el: HTMLElement): void {
  const b = human.conditions_enrolled.b;
  const w = human.conditions_enrolled.w;
  const max = Math.ceil(Math.max(b, w) + 1);
  const bar = (name: string, v: number, color: string) =>
    `<div class="hbar"><span>${name}</span><div class="track"><i class="fill" style="width:${(v / max) * 100}%;background:${color}"></i></div><span class="v">${v.toFixed(2)}</span></div>`;
  el.innerHTML = `
    <div class="hbars">
      <div class="hbar-cap">Mean active chronic conditions among <em>enrolled</em> patients</div>
      ${bar("Enrolled Black", b, "var(--black-pt)")}
      ${bar("Enrolled White", w, "var(--white-pt)")}
    </div>
    <div class="callouts">
      <div class="callout"><div class="co-v is-black">+${human.conditions_gap.est.toFixed(2)}</div><div class="co-l">more conditions for enrolled Black patients <span class="num">(CI ${human.conditions_gap.lo.toFixed(2)}–${human.conditions_gap.hi.toFixed(2)})</span>: a higher bar survived review</div></div>
      <div class="callout"><div class="co-v">${fmt.pp(human.enrol_gap_same_score.est)}</div><div class="co-l">difference in enrolment rate at the same score <span class="num">(CI ${fmt.pp(human.enrol_gap_same_score.lo)} to ${fmt.pp(human.enrol_gap_same_score.hi)})</span>: clinicians barely adjusted</div></div>
      <div class="callout"><div class="co-v">${fmt.pct0(human.share_enrolled_above_55)}</div><div class="co-l">of enrolled patients came from the score's flagged pool</div></div>
    </div>`;
}

/** Label choice: Black share of the top 3% under each ranking. */
export function mountLabelBars(el: HTMLElement): void {
  const need = thresholds.sensitivity.conditions_topk.commercial.need_black_share;
  const max = 0.36;
  const pos = (v: number) => `${(v / max) * 100}%`;
  const rows = labels.rows
    .map((r) => {
      const paper = r.paper_black_share == null ? "" : `<i class="lb-paper" style="left:${pos(r.paper_black_share)}" title="Published: ${fmt.pct1(r.paper_black_share)}"></i>`;
      return `<div class="lb-row${r.key === "health" ? " is-hl" : ""}">
        <span class="lb-name">${r.label}</span>
        <div class="lb-track">
          <i class="lb-fill" style="width:${pos(r.black_share)}"></i>
          <i class="lb-ci" style="left:${pos(r.black_ci[0])};width:calc(${pos(r.black_ci[1])} - ${pos(r.black_ci[0])})"></i>
          ${paper}
          <i class="lb-need" style="left:${pos(need)}"></i>
        </div>
        <span class="lb-val">${fmt.pct1(r.black_share)}</span>
      </div>`;
    })
    .join("");
  const ticks = [0, 0.1, 0.2, 0.3].map((t) => `<span style="left:${pos(t)}">${fmt.pct0(t)}</span>`).join("");
  const health = labels.rows.find((r) => r.key === "health")!;
  const avoid = labels.rows.find((r) => r.key === "avoidable")!;
  const cost = labels.rows.find((r) => r.key === "cost")!;
  el.innerHTML = `
    <div class="lb-rows">
      ${rows}
      <div class="lb-axis"><span></span><div>${ticks}</div><span></span></div>
      <div class="marks-key" style="margin-top:.4rem">
        <span>◇ Published value (real data)</span>
        <span>┆ Black share of the truly high-need (${fmt.pct1(need)})</span>
        <span>— 95% interval</span>
      </div>
    </div>
    <div class="callouts">
      <div class="callout"><div class="co-v is-black">${fmt.pct0(health.excess_reduction)}</div><div class="co-l">of the excess-illness gap closed by the health label, vs the cost label</div></div>
      <div class="callout"><div class="co-v">${fmt.pct0(avoid.excess_reduction)}</div><div class="co-l">closed by the avoidable-cost label</div></div>
      <div class="callout"><div class="co-v">${fmt.pct1(cost.cost_share)} → ${fmt.pct1(health.cost_share)}</div><div class="co-l">share of total cost captured (cost vs health label): each label wins on its own outcome</div></div>
    </div>`;
}

import labels from "../data/labels.json";
import { segmented } from "../lib/chart";

/** Hero: 100 programme places, coloured by who fills them under each ranking. */
export function mountUnits(el: HTMLElement): void {
  const rows = Object.fromEntries(labels.rows.map((r) => [r.key, r]));
  const modes = {
    commercial: {
      share: rows.commercial.black_share,
      label: "places go to Black patients when the commercial score fills the top 3%",
    },
    health: {
      share: rows.health.black_share,
      label: "places go to Black patients when the same model is trained to predict illness instead",
    },
  } as const;
  type Mode = keyof typeof modes;

  const grid = el.querySelector<HTMLElement>(".unit-grid")!;
  const count = el.querySelector<HTMLElement>(".units-count")!;
  const label = el.querySelector<HTMLElement>(".units-label")!;
  const cells: HTMLElement[] = [];
  for (let i = 0; i < 100; i++) {
    const c = document.createElement("i");
    c.className = "unit";
    grid.appendChild(c);
    cells.push(c);
  }
  // Fill Black places from a fixed scattered order so the switch reads as "more", not "moved".
  const order = Array.from({ length: 100 }, (_, i) => (i * 37) % 100);

  const set = (mode: Mode) => {
    const n = Math.round(modes[mode].share * 100);
    cells.forEach((c) => c.classList.remove("is-black"));
    order.slice(0, n).forEach((i) => cells[i].classList.add("is-black"));
    count.innerHTML = `${n}<small> / 100</small>`;
    label.textContent = modes[mode].label;
  };

  segmented(
    el.querySelector<HTMLElement>("[data-control]")!,
    [
      { value: "commercial", label: "Rank by cost score" },
      { value: "health", label: "Rank by health" },
    ],
    "commercial",
    (v) => set(v as Mode),
  );
  set("commercial");
}

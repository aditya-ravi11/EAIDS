import meta from "./data/meta.json";
import calibration from "./data/calibration.json";
import mechanism from "./data/mechanism.json";
import biomarkers from "./data/biomarkers.json";
import swap from "./data/swap.json";
import human from "./data/human.json";
import labels from "./data/labels.json";
import blend from "./data/blend.json";
import thresholds from "./data/thresholds.json";
import { fmt } from "./lib/chart";

const DATA: Record<string, unknown> = { meta, calibration, mechanism, biomarkers, swap, human, labels, blend, thresholds };

const FORMATS: Record<string, (v: number) => string> = {
  int: fmt.int,
  pct0: fmt.pct0,
  pct1: fmt.pct1,
  num1: fmt.num1,
  num2: fmt.num2,
  signed2: (v) => fmt.signed(v, 2),
  pp: fmt.pp,
  usd: fmt.usd,
  usdneg: (v) => `${v < 0 ? "−" : "+"}${fmt.usd(v)}`,
  usdsigned: (v) => `${v < 0 ? "−" : "+"}${fmt.usd(v)}`,
};

function lookup(path: string): number {
  const v = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], DATA);
  if (typeof v !== "number") throw new Error(`data-num path not found: ${path}`);
  return v;
}

/** Fill every inline number from the pipeline output so prose and data never drift. */
export function fillNumbers(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-num]").forEach((el) => {
    el.textContent = FORMATS[el.dataset.fmt ?? "num2"](lookup(el.dataset.num!));
  });
}

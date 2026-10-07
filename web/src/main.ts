import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles.css";

import meta from "./data/meta.json";
import calibration from "./data/calibration.json";
import mechanism from "./data/mechanism.json";
import biomarkers from "./data/biomarkers.json";
import swap from "./data/swap.json";
import human from "./data/human.json";
import labels from "./data/labels.json";
import blend from "./data/blend.json";
import thresholds from "./data/thresholds.json";

import { mountUnits } from "./charts/units";
import { mountCalibration } from "./charts/calibration";
import { mountMechanism } from "./charts/mechanism";
import { mountBiomarkers } from "./charts/biomarkers";
import { mountExplorer } from "./charts/explorer";
import { mountSwap } from "./charts/swap";
import { mountFrontier } from "./charts/frontier";
import { fmt } from "./lib/chart";
import { renderContent } from "./sections";

const DATA: Record<string, unknown> = { meta, calibration, mechanism, biomarkers, swap, human, labels, blend, thresholds };

if (new URLSearchParams(location.search).has("capture")) {
  document.documentElement.classList.add("capture");
}

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
function fillNumbers(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-num]").forEach((el) => {
    const f = FORMATS[el.dataset.fmt ?? "num2"];
    el.textContent = f(lookup(el.dataset.num!));
  });
}

/** Highlight the rail entry for the section currently in view. */
function trackSections(): void {
  const links = new Map<string, HTMLAnchorElement>();
  document.querySelectorAll<HTMLAnchorElement>(".rail a[href^='#']").forEach((a) => links.set(a.hash.slice(1), a));
  const visible = new Map<string, number>();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
      let best = "";
      let bestTop = Infinity;
      document.querySelectorAll<HTMLElement>("main .sec").forEach((s) => {
        const top = s.getBoundingClientRect().top;
        if ((visible.get(s.id) ?? 0) > 0 && Math.abs(top) < bestTop) {
          best = s.id;
          bestTop = Math.abs(top);
        }
      });
      links.forEach((a, id) => {
        const on = id === best;
        a.classList.toggle("is-active", on);
        if (on && window.innerWidth <= 940) a.scrollIntoView({ block: "nearest", inline: "center" });
      });
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.01, 0.2] },
  );
  document.querySelectorAll("main .sec").forEach((s) => io.observe(s));
}

renderContent();
fillNumbers();
mountUnits(document.getElementById("units")!);
mountCalibration(document.getElementById("fig-calibration")!);
mountMechanism(document.getElementById("fig-mechanism")!);
mountBiomarkers(document.getElementById("biomarkers")!);
mountExplorer(document.getElementById("fig-explorer")!);
mountSwap(document.getElementById("fig-swap")!);
mountFrontier(document.getElementById("fig-frontier")!);
trackSections();
document.documentElement.dataset.ready = "true";

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

import QRCode from "qrcode";

import { mountUnits } from "./charts/units";
import { mountCalibration } from "./charts/calibration";
import { mountMechanism } from "./charts/mechanism";
import { mountBiomarkers } from "./charts/biomarkers";
import { mountExplorer } from "./charts/explorer";
import { mountSwap } from "./charts/swap";
import { mountFrontier } from "./charts/frontier";
import { mountTimeline } from "./charts/timeline";
import { mountHuman, mountLabelBars } from "./charts/compare";
import { renderContent, cite } from "./sections";
import { fillNumbers } from "./numbers";
import { Deck } from "./deck";

const SITE = "https://aditya-ravi11.github.io/EAIDS/";

if (new URLSearchParams(location.search).has("capture")) {
  document.documentElement.classList.add("capture");
}

renderContent();
fillNumbers(document);
mountUnits(document.getElementById("units")!);
mountTimeline(document.getElementById("timeline")!, cite);
mountCalibration(document.getElementById("fig-calibration")!);
mountMechanism(document.getElementById("fig-mechanism")!);
mountBiomarkers(document.getElementById("biomarkers")!);
mountExplorer(document.getElementById("fig-explorer")!);
mountSwap(document.getElementById("fig-swap")!);
mountHuman(document.getElementById("human")!);
mountLabelBars(document.getElementById("labelbars")!);
mountFrontier(document.getElementById("fig-frontier")!);
fillNumbers(document);

QRCode.toString(SITE, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#161616", light: "#f7f4ec" } })
  .then((svg) => {
    document.getElementById("qr")!.innerHTML = svg;
  })
  .catch(() => undefined);

new Deck((root) => fillNumbers(root));
document.documentElement.dataset.ready = "true";

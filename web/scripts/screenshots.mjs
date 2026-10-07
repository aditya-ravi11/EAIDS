// Capture slide-style screenshots of the built dashboard for the README and the report.
// Usage (from web/): npm run build && npm run screenshots
import { preview } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, readdirSync, rmSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = resolve(root, "docs", "screenshots");
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith(".png")) rmSync(resolve(out, f));

const server = await preview({ root: resolve(root, "web"), preview: { port: 4317, strictPort: true } });
const base = "http://localhost:4317/EAIDS/?capture=1";
const browser = await chromium.launch({ channel: "chrome" });

async function open(viewport, scale, extra = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: "reduce", ...extra });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function shot(page, hash, file, prep) {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(350);
  if (prep) await prep(page);
  await page.screenshot({ path: `${out}/${file}` });
}

// 16:9 slides at 1600 × 900
const page = await open({ width: 1600, height: 900 }, 1.5);
const slides = [
  ["#/cover", "01-cover.png"],
  ["#/problem", "02-problem.png"],
  ["#/background", "03-background.png"],
  ["#/issues", "04-ethical-issues.png"],
  ["#/analysis/calibration", "05-calibration.png"],
  ["#/analysis/explorer", "06-threshold-explorer.png"],
  ["#/analysis/swap", "07-counterfactual.png"],
  ["#/principles", "08-principles.png"],
  ["#/recommendations/aia", "09-impact-assessment.png"],
  ["#/recommendations/raci", "10-accountability.png"],
  ["#/results/labels", "11-label-choice.png"],
  ["#/results/mixer", "12-label-mixer.png"],
  ["#/results/law", "13-regulatory-matrix.png"],
  ["#/conclusion/answers", "14-conclusion.png"],
];
for (const [hash, file] of slides) await shot(page, hash, file);

// Present mode with the details drawer closed, and the drawer open in normal mode
await shot(page, "#/results/verdicts", "15-present-mode.png", async (p) => {
  await p.evaluate(() => {
    document.documentElement.classList.add("presenting");
    document.getElementById("present-btn").innerHTML = "Exit <kbd>P</kbd>";
  });
  await p.waitForTimeout(250);
});
await page.evaluate(() => {
  document.documentElement.classList.remove("presenting");
  document.getElementById("present-btn").innerHTML = "Present <kbd>P</kbd>";
});
await shot(page, "#/analysis/explorer", "16-details-drawer.png", async (p) => {
  await p.keyboard.press("n");
  await p.waitForTimeout(350);
});

// Phone
const phone = await open({ width: 390, height: 844 }, 2, { isMobile: true, hasTouch: true });
await shot(phone, "#/analysis/explorer", "17-mobile.png");

await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log(`Saved screenshots to ${out}`);

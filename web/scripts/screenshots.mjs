// Capture section screenshots of the built site for the README and the report.
// Usage (from web/): npm run build && npm run screenshots
import { preview } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = resolve(root, "docs", "screenshots");
mkdirSync(out, { recursive: true });

const server = await preview({ root: resolve(root, "web"), preview: { port: 4317, strictPort: true } });
const base = "http://localhost:4317/EAIDS/?capture=1";

const browser = await chromium.launch({ channel: "chrome" });

async function page(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(base, { waitUntil: "networkidle" });
  await p.waitForFunction(() => document.documentElement.dataset.ready === "true");
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  return p;
}

// Hide the sticky navigation so it does not overlap element captures.
const hideChrome = (p) => p.addStyleTag({ content: ".rail{visibility:hidden}" });

const desktop = await page({ width: 1440, height: 1000 });
await desktop.screenshot({ path: `${out}/01-hero.png` });
await hideChrome(desktop);

const shots = [
  ["#fig-calibration", "02-calibration.png"],
  ["#fig-explorer", "03-threshold-explorer.png"],
  ["#fig-swap", "04-swap.png"],
  ["#fig-frontier", "05-label-mixer.png"],
  ["#gates", "06-aia-gates.png"],
  ["#raci", "07-raci.png"],
  ["#scorecard", "08-scorecard.png"],
];
for (const [sel, file] of shots) {
  const el = desktop.locator(sel);
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: `${out}/${file}` });
}

// Regulatory matrix with its legend, detail panel and verdicts in one frame.
const reg = await desktop.evaluate(() => {
  const top = document.querySelector("#reg-year").closest(".fig-head").getBoundingClientRect().top + scrollY;
  const bottom = document.querySelector("#verdicts").getBoundingClientRect().bottom + scrollY;
  const box = document.querySelector("main").getBoundingClientRect();
  return { x: box.left, y: top - 8, width: box.width, height: bottom - top + 16 };
});
await desktop.screenshot({ path: `${out}/09-regulatory-matrix.png`, clip: reg, fullPage: true });

// Tighter crops for the IEEE report, where figures are printed small.
const screens = resolve(root, "report", "figures", "screens");
mkdirSync(screens, { recursive: true });
await desktop.evaluate(() => scrollTo(0, 0));
await desktop.locator(".hero").screenshot({ path: `${screens}/hero.png` });
await desktop.locator("#fig-explorer .split").screenshot({ path: `${screens}/explorer.png` });
await desktop.locator("#fig-frontier .split").screenshot({ path: `${screens}/mixer.png` });
await desktop.locator("#reg").screenshot({ path: `${screens}/regulatory.png` });

// Mobile view of the hero and first section.
const mobile = await page({ width: 390, height: 844 });
await mobile.screenshot({ path: `${out}/10-mobile.png` });

await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log(`Saved screenshots to ${out}`);

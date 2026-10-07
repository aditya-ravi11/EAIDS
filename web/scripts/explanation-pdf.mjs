// Print the explanation page to an A4 PDF.
// Usage (from web/): npm run build && npm run explanation
import { preview } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = resolve(root, "docs", "MiniProject_EAIDS_Group2_Explanation.pdf");

const server = await preview({ root: resolve(root, "web"), preview: { port: 4318, strictPort: true } });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto("http://localhost:4318/EAIDS/explainer.html", { waitUntil: "networkidle" });
await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: "print" });
await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log(`Wrote ${out}`);

// One-off visual verification: all 11 new/updated hair styles actually
// render distinct, sane-looking geometry (not overlapping/invisible/
// exploded). Not part of the shipped build.
import { chromium } from "playwright";

const STYLES = ["buzz", "crop", "fade", "swept", "quiff", "curly", "afro", "mohawk", "ponytail", "bun", "long"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:5183/", { waitUntil: "networkidle" });
await page.click("#btnCustomize");
await page.waitForTimeout(300);

const labels = await page.$$eval("#czHairStyle button", (btns) => btns.map((b) => b.textContent));
console.log("hair style buttons:", labels);

for (const style of STYLES) {
  const label = style === "swept" ? "Swept back" : style[0].toUpperCase() + style.slice(1);
  await page.click(`#czHairStyle button:has-text("${label}")`);
  await page.waitForTimeout(600);
  await page.locator(".stage").screenshot({ path: `/tmp/av-hair-${style}.png` });
}

if (errors.length) {
  console.log("CONSOLE ERRORS:");
  for (const e of errors) console.log(" -", e);
} else {
  console.log("no console errors");
}
await browser.close();

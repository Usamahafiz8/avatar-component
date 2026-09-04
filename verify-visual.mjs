// One-off visual verification: content-based reaction sound assignment —
// only the 5 confirmed-big-gesture reactions get a sound, everything else
// (subtle talking loops, the dejected "Lose" pose) is silent, dances keep
// their cycle. Not part of the shipped build.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:5183/", { waitUntil: "networkidle" });
await page.click("#btnCustomize");
await page.click('#czTabs button[data-tab="reactions"]');
await page.waitForTimeout(500);

const rows = await page.$$eval(".cz-move-row", (els) =>
  els.map((el) => ({
    label: el.querySelector(".cz-move-label")?.textContent,
    sound: el.querySelector(".cz-move-sound")?.value,
  })),
);
const dances = rows.filter((r) => r.label?.startsWith("Dance"));
const reactions = rows.filter((r) => r.label?.startsWith("Reaction"));
console.log(`dances: ${dances.length} total, ${dances.filter((r) => r.sound).length} with a sound (expect all)`);
console.log(`reactions: ${reactions.length} total, ${reactions.filter((r) => r.sound).length} with a sound (expect 5)`);
console.log("reactions WITH a sound:", reactions.filter((r) => r.sound).map((r) => `${r.label}: ${r.sound}`));
console.log("Reaction 12 (the 'Lose' pose) sound:", reactions.find((r) => r.label === "Reaction 12")?.sound || "(none, correct)");

if (errors.length) {
  console.log("CONSOLE ERRORS:");
  for (const e of errors) console.log(" -", e);
} else {
  console.log("no console errors");
}
await browser.close();

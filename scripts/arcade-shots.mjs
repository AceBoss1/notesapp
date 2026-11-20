// Takes the Notes Arcade screenshots in public/images/arcade/<slug>.png (the cards on /arcade and each game's preview).
// Start the app first (npx next dev -p 3290), then: node scripts/arcade-shots.mjs [http://localhost:3290]
// Each shot is the game page at 1280×800, after pressing the game's start button if it has one, so the board is in play.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const base = process.argv[2] || "http://localhost:3290";
const src = readFileSync(new URL("../lib/arcade/catalogue.ts", import.meta.url), "utf8");
const games = [...src.matchAll(/slug: "([a-z]+)", path: "([^"]+)"/g)].map((m) => ({ slug: m[1], path: m[2] }));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
for (const g of games) {
  await page.goto(base + g.path, { waitUntil: "networkidle" });
  const start = page.locator(".arc-overlay button, .snake-overlay button").first();
  if (await start.count()) { await start.click().catch(() => {}); await page.waitForTimeout(2500); }
  await page.screenshot({ path: `public/images/arcade/${g.slug}.png` });
  console.log("shot", g.slug);
}
await browser.close();

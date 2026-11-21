// Takes the Notes Arcade screenshots (public/images/arcade/):
//   <slug>.png     the card on the Arcade home: the game page at 1280×800, in play.
//   <slug>-N.png   the gallery under each game (catalogue `shots`): the game's console at each level, or at the start,
//                  middle and later on of a game. Moves are made by tapping the game's own buttons, so every board is a real one.
// Start the app first (npx next dev -p 3290), then: node scripts/arcade-shots.mjs [http://localhost:3290] [slug…] [--cards]
// If the browser isn't found, set PW_CHROMIUM to a Chromium binary.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const cardsOnly = args.includes("--cards"); // only the Arcade home cards
const [base = "http://localhost:3290", ...only] = args.filter((a) => a !== "--cards");
import { readdirSync } from "node:fs";
const dir = new URL("../lib/arcade/", import.meta.url);
// The list itself, plus the newer games' entries kept beside their code (lib/arcade/<slug>.entry.ts).
const src = [readFileSync(new URL("catalogue.ts", dir), "utf8"), ...readdirSync(dir).filter((f) => f.endsWith(".entry.ts")).map((f) => readFileSync(new URL(f, dir), "utf8"))].join("\n");
const levelsOf = (block) => (/^LEVELS/.test(block) ? ["easy", "medium", "hard"] : /^STAGES/.test(block) ? [null, null, null] : [...block.matchAll(/level: "([a-z]+)"/g)].map((m) => m[1]));
const games = [...src.matchAll(/slug: "([a-z]+)",\s*path: "([^"]+)"[\s\S]*?shots: ([^\n]+)/g)]
  .map((m) => ({ slug: m[1], path: m[2], levels: levelsOf(m[3]) }))
  .filter((g) => !only.length || only.includes(g.slug));

const SKIP = /new game|sound|undo|play again|see board|cancel|deal again/i;
const HINT = /target|legal|move|can|hint|dot|playable|active|pulse|glow|select|roll|buy|deal|bid|play/i;

// Taps the game's own buttons: the hinted ones (legal moves, Roll, Buy…) most of the time, otherwise any enabled one.
async function play(page, taps) {
  for (let i = 0; i < taps; i++) {
    const overlay = page.locator(".arc-overlay button, .snake-overlay button").first();
    if (await overlay.isVisible().catch(() => false)) {
      const txt = (await overlay.textContent()) || "";
      if (/play again|new game/i.test(txt)) break; // the game is over: keep the board
      await overlay.click().catch(() => {});
    }
    const btns = await page.locator(".arc-console button:enabled, .arc-main button:enabled").evaluateAll((els, [skip, hint]) => {
      const s = new RegExp(skip, "i"), h = new RegExp(hint, "i");
      return els.map((e, i) => ({ i, ok: !s.test(e.textContent || "") && !s.test(e.getAttribute("aria-label") || ""), hint: h.test(e.className + " " + (e.getAttribute("aria-label") || "")) }));
    }, [SKIP.source, HINT.source]);
    const ok = btns.filter((b) => b.ok);
    if (!ok.length) { await page.waitForTimeout(400); continue; }
    const hinted = ok.filter((b) => b.hint);
    const pool = hinted.length && Math.random() < 0.8 ? hinted : ok;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    await page.locator(".arc-console button:enabled, .arc-main button:enabled").nth(pick.i).click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1800); // let the computer finish its turn
}

async function setLevel(page, level) {
  if (!level) return;
  const sel = page.locator(`select:has(option[value="${level}"])`).first();
  if (await sel.count()) await sel.selectOption(level).catch(() => {});
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
for (const g of games) {
  await page.goto(base + g.path, { waitUntil: "load" }); await page.waitForTimeout(2000);
  await play(page, 6);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); // tapping scrolls the page; the card shows its top
  await page.screenshot({ path: `public/images/arcade/${g.slug}.png` });
  if (cardsOnly) continue;
  const shotScale = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
  for (const [i, level] of g.levels.entries()) {
    await shotScale.goto(base + g.path, { waitUntil: "load" }); await shotScale.waitForTimeout(2000);
    await setLevel(shotScale, level);
    // Snake moves by itself: give it time. Levels: a few moves in. Stages: deeper each time.
    if (g.slug === "snake") { await shotScale.locator(".snake-overlay button").click().catch(() => {}); await shotScale.waitForTimeout(900); }
    else await play(shotScale, level ? 14 : [3, 30, 70][i]);
    await shotScale.locator(".arc-console, .snake-console").first().screenshot({ path: `public/images/arcade/${g.slug}-${i + 1}.png` });
    console.log("shot", g.slug, i + 1, level || "stage");
  }
  await shotScale.close();
}
await browser.close();

// Notes Arcade's game list (lib/arcade/catalogue.ts): every game has a page, a screenshot, rules, and a short path on arcade.<domain>.
// Run: npm run test:arcade.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ARCADE_GAMES, ARCADE_SLUGS, arcadeGame } from "../../lib/arcade/catalogue";

const slugs = ARCADE_GAMES.map((g) => g.slug);
assert.equal(new Set(slugs).size, slugs.length, "slugs are unique");
for (const g of ARCADE_GAMES) {
  assert.match(g.slug, /^[a-z]+$/);
  assert.ok(g.name && g.blurb && g.description.length > 60 && g.howTo.length >= 3 && g.players, `${g.slug} is described`);
  assert.equal(g.headline.length, 2);
  const page = g.slug === "snake" ? "app/(arcade)/snake/page.tsx" : `app/(arcade)/arcade/${g.slug}/page.tsx`;
  assert.ok(existsSync(page), `${g.slug} has a page`);
  assert.equal(g.path, g.slug === "snake" ? "/snake" : `/arcade/${g.slug}`);
  assert.ok(existsSync(`public/images/arcade/${g.slug}.png`), `${g.slug} has a screenshot`);
  // Our own games only: no other company's game names.
  assert.doesNotMatch(`${g.name} ${g.description} ${g.howTo.join(" ")}`, /monopoly|scrabble|uno\b/i);
}
for (const want of ["ludo", "whot", "spades", "landlord", "ncho", "chess", "draughts"]) assert.ok(ARCADE_SLUGS.includes(want), want);
assert.ok(!ARCADE_SLUGS.includes("snake"), "Snake keeps its own /snake");
assert.equal(arcadeGame("chess").name, "Chess");
assert.throws(() => arcadeGame("nope"));
console.log("arcade catalogue: ok");

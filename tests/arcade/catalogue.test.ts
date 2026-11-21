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
  assert.ok(g.shots.length >= 3, `${g.slug} has a gallery`);
  g.shots.forEach((_, i) => assert.ok(existsSync(`public/images/arcade/${g.slug}-${i + 1}.png`), `${g.slug} gallery shot ${i + 1}`));
  // Our own games only: no other company's game names.
  assert.doesNotMatch(`${g.name} ${g.description} ${g.howTo.join(" ")}`, /monopoly|scrabble|uno\b/i);
}
for (const want of ["ludo", "whot", "spades", "landlord", "ncho", "akahausa", "chess", "draughts", "achi", "run", "puffpuff"]) assert.ok(ARCADE_SLUGS.includes(want), want);
assert.ok(!ARCADE_SLUGS.includes("snake"), "Snake keeps its own /snake");
assert.equal(arcadeGame("chess").name, "Chess");
// Aka-Hausa is the second Ncho: straight after Ncho, every level shown.
assert.equal(slugs.indexOf("akahausa"), slugs.indexOf("ncho") + 1);
assert.deepEqual(arcadeGame("akahausa").shots.map((x) => x.level), ["easy", "medium", "hard"]);
assert.throws(() => arcadeGame("nope"));
// Advert spots (owner, 20 Nov 2026): every game has one, the partnership page shows them, arcade.<domain>/partners reaches it.
import("../../lib/ads").then(({ AD_PLACEMENTS }) => {
  assert.equal(AD_PLACEMENTS.arcade.scope, "site");
  for (const f of ["ad-ludo", "ad-landlord", "ad-banner"]) assert.ok(existsSync(`public/images/arcade/${f}.png`), `${f} picture`);
  assert.ok(existsSync("app/(arcade)/arcade/partners/page.tsx"), "partnership page");
  console.log("arcade catalogue: ok");
});

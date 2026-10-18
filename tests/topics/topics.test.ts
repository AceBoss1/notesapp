// Topics and hashtags (lib/topics.ts) and the topic backfill (lib/backfills.ts). Run: npm run test:topics → "ALL OK".
import assert from "node:assert/strict";
import { TOPICS, cleanTopics, hashtag, interestsFirst, matchTopic, normaliseTag, noteHeading, parseTags, topicsOf } from "../../lib/topics";
import { planTopics } from "../../lib/backfills";

// the list itself: unique slugs, and no alias that means two topics
const slugs = TOPICS.map((t) => t.slug);
assert.equal(new Set(slugs).size, slugs.length, "slugs are unique");
const seen = new Map<string, string>();
for (const t of TOPICS) for (const a of [t.slug, t.label, ...(t.aliases ?? [])]) {
  const k = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  assert.ok(!seen.has(k) || seen.get(k) === t.slug, `"${a}" means both ${seen.get(k)} and ${t.slug}`);
  seen.set(k, t.slug);
}

// matching what people type
assert.equal(matchTopic("#FinTech"), "fintech"); assert.equal(matchTopic("fin tech"), "fintech");
assert.equal(matchTopic("UI/UX"), "design"); assert.equal(matchTopic("Career Planning"), "careers");
assert.equal(matchTopic("Church"), "faith"); assert.equal(matchTopic("Mental Health"), "mental-health"); assert.equal(matchTopic("pottery"), null);
assert.equal(hashtag("mental-health"), "#MentalHealth"); assert.equal(hashtag("ai"), "#AI");
assert.equal(normaliseTag("#Side Hustle!"), "side-hustle"); assert.equal(normaliseTag("Café"), "cafe");
assert.deepEqual(parseTags("#SideHustle #AbujaTech, side hustle"), ["sidehustle", "abujatech", "side-hustle"]);
assert.deepEqual(cleanTopics(["ai", "nope", "ai", "faith"], 3), ["ai", "faith"]);

// a journal's topics: picked ones win, older ones are read from categories and tags
assert.deepEqual(topicsOf({ topics: ["ai"], categories: ["Faith"] }), ["ai"]);
assert.deepEqual(topicsOf({ categories: ["Career coaching", "Life Hacks"], tags: ["Fintech", "startup"] }), ["fintech", "startups"]);
assert.equal(noteHeading({ categories: ["Mental Health"] }), "Mental health"); assert.equal(noteHeading({ categories: ["Odd one"] }), "Odd one");
const { picked, rest } = interestsFirst([{ id: 1, topics: ["ai"] }, { id: 2, categories: ["Faith"] }, { id: 3 }], ["faith"]);
assert.deepEqual(picked.map((n) => n.id), [2]); assert.deepEqual(rest.map((n) => n.id), [1, 3]);

// the backfill
assert.deepEqual(planTopics({ categories: ["Fintech", "Life Hacks"], tags: ["startup", "money tips"] }).set, { topics: ["fintech", "startups"], categories: ["Fintech", "Startups"], tags: ["money-tips", "life-hacks"] });
assert.deepEqual(planTopics({ topics: ["ai"], categories: ["AI"], tags: ["ai"] }).set, { tags: [] }, "a hashtag that repeats a topic is dropped");
assert.equal(planTopics({ categories: ["Pottery"] }).unfiled, true);
console.log("ALL OK");

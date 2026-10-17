// The shelves (lib/discovery.ts). Run: npm run test:discovery → "ALL OK".
import assert from "node:assert/strict";
import { byForYou, byMostViewed, byRecent, shelves, type Shelfable } from "../../lib/discovery";
import { CATEGORY_TOPICS, STORE_CATEGORIES } from "../../lib/store-meta";
import { isTopic } from "../../lib/topics";

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const S = (id: string, topics: string[], age: number, views: number, owner = "x", viewsWeek?: number): Shelfable => ({ id, topics, publishedAt: day(age), views, viewsWeek, ownerUsername: owner });
const list = [
  S("fin-new", ["fintech"], 1, 5), S("fin-old-popular", ["fintech"], 20, 900), S("faith", ["faith"], 2, 50),
  S("ai-hot", ["ai"], 3, 10, "x", 400), S("mine", ["fintech"], 0, 1, "me"), S("followed", ["fintech"], 9, 2, "ada"), S("cold", [], 30, 0),
];
const reader = { interests: ["fintech"], follows: new Set(["ada"]), self: "me" };

assert.deepEqual(byRecent(list).map((s) => s.id).slice(0, 3), ["mine", "fin-new", "faith"]);
assert.equal(byMostViewed(list)[0].id, "fin-old-popular"); // lifetime 900 beats weekly 400 for the one with a weekly count
assert.deepEqual(byForYou(list, reader).map((s) => s.id).sort(), ["fin-new", "fin-old-popular", "followed"].sort(), "interests only, never your own");
assert.equal(byForYou(list, reader)[0].id, "followed", "people you follow first among your interests");
const sh = shelves(list, reader, 3);
const all = [...sh.forYou, ...sh.mostViewed, ...sh.recent].map((s) => s.id);
assert.equal(new Set(all).size, all.length, "nothing repeated across shelves");
assert.ok(!sh.mostViewed.some((s) => s.id === "cold"), "nothing with no visits on Most viewed");
assert.deepEqual(shelves(list, { interests: [] }, 3).forYou, [], "no interests, no For you shelf");
for (const c of STORE_CATEGORIES) for (const t of CATEGORY_TOPICS[c]) assert.ok(isTopic(t), `${c} → ${t} is a topic`);
console.log("ALL OK");

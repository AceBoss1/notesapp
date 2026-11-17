// The Nana on Claude copy (lib/nana-claude.ts): the fingerprints, what a fresh copy would change, and the file check the Claude page
// runs before it replaces its articles. Run: npm run test:nana-claude → "NANA CLAUDE OK".
import assert from "node:assert/strict";
import { buildCopy, copyGaps, copyHashes, fingerprint, readCopy, type CopyArticle } from "../../lib/nana-claude";

const SYSTEM = "You are Nana. ".repeat(60);
const arts = (n: number): CopyArticle[] => Array.from({ length: n }, (_, i) => ({ slug: `article-${i}`, title: `Article ${i}`, category: "Getting started", body: `Body of article ${i}. Free Basic: 20%.` }));

assert.equal(fingerprint("abc"), fingerprint("abc")); assert.notEqual(fingerprint("Pro: 15%"), fingerprint("Pro: 25%")); assert.match(fingerprint(""), /^[0-9a-f]{8}$/);

// never copied → say so; the same articles → up to date
const a = arts(12);
assert.equal(copyGaps(null, a, SYSTEM).never, true);
const last = copyHashes(a, SYSTEM);
assert.deepEqual(copyGaps(last, a, SYSTEM), { never: false, upToDate: true, added: [], changed: [], removed: [], instructions: false });
// a price changes in one, one is new, one is gone, and Nana's instructions change
const b = a.slice(1).map((x) => (x.slug === "article-3" ? { ...x, body: x.body.replace("20%", "18%") } : x)).concat({ slug: "new-moments", title: "Post a moment", category: "Getting started", body: "How to post a moment." });
assert.deepEqual(copyGaps(last, b, `${SYSTEM} New page.`), { never: false, upToDate: false, added: ["Post a moment"], changed: ["Article 3"], removed: ["article-0"], instructions: true });
// a renamed title or a moved category counts as a change too
assert.deepEqual(copyGaps(last, a.map((x, i) => (i === 5 ? { ...x, title: "Renamed" } : x)), SYSTEM).changed, ["Renamed"]);

// the file: what Admin downloads is what the page accepts, and nothing else gets in
const copy = buildCopy(a, SYSTEM, "https://www.naapp.tech", new Date("2026-11-17T09:00:00Z"));
assert.equal(copy.copied, "17 Nov 2026");
const back = readCopy(JSON.parse(JSON.stringify(copy)));
assert.deepEqual(back, copy);
const bad = (change: (c: Record<string, unknown>) => void, re: RegExp) => { const c = JSON.parse(JSON.stringify(copy)); change(c); assert.throws(() => readCopy(c), re); };
assert.throws(() => readCopy(null), /isn't a Nana on Claude copy file/); assert.throws(() => readCopy([1, 2]), /isn't a Nana on Claude copy file/);
bad((c) => { c.kind = "something-else"; }, /isn't a Nana on Claude copy file/);
bad((c) => { c.v = 2; }, /isn't a Nana on Claude copy file/);
bad((c) => { c.siteUrl = "javascript:alert(1)"; }, /site address/);
bad((c) => { c.siteUrl = "https://evil.example/path?x=1"; }, /site address/);
bad((c) => { c.system = "short"; }, /incomplete/);
bad((c) => { c.articles = arts(3); }, /doesn't hold the help articles/);
bad((c) => { (c.articles as CopyArticle[])[2].slug = "../etc"; }, /isn't valid/);
bad((c) => { (c.articles as CopyArticle[])[2].slug = (c.articles as CopyArticle[])[1].slug; }, /isn't valid/);
bad((c) => { (c.articles as CopyArticle[])[4].body = ""; }, /isn't valid/);
// extra fields in the file are dropped, never carried into the page
const extra = JSON.parse(JSON.stringify(copy)); extra.evil = "<script>"; extra.articles[0].html = "<img onerror=x>";
assert.deepEqual(readCopy(extra), copy);
console.log("NANA CLAUDE OK");

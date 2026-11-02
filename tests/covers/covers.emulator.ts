// Course covers made with Nana, on the Firestore emulator (lib/covers-server.ts): who may make them (the owner and co-tutors yes, a
// stranger no, admins yes), the daily count (Free Basic's 3: one cover and two edits; the fourth refused; a new Lagos day starts again),
// the Pearl call charged to the member's Nana allowance and refused when it's used up, the fallback design when the AI's answer can't be
// read, the short history, a limit changed in the pricing settings, and an admin's cover with no count or charge.
// Run: npm run test:covers-server → "COVERS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CourseError } from "../../lib/courses-server";
import { adminCover, coverStatus, generateCover, type CoverDeps } from "../../lib/covers-server";
import { ensurePricing } from "../../lib/pricing-server";
import { DEFAULT_PRICING } from "../../lib/pricing";
import { periodKey } from "../../lib/nana-gems";
import { COVER_HISTORY_MAX, type CoverSpec } from "../../lib/covers";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
let now = new Date("2026-11-01T09:00:00Z");
let reply = (): string => JSON.stringify({ template: "arch", palette: "moss", pattern: "mudcloth", icon: "wheat", headline: "AI for Farmers", subline: "Prices and weather", tag: "Beginner course", layout: "left" });
const calls: string[] = [];
const stored: string[] = [];
const deps: CoverDeps = {
  now: () => now,
  complete: async (a) => { calls.push(String(a.messages[0].content)); return { text: reply(), refused: false, usage: { input_tokens: 2000, output_tokens: 200 } }; },
  render: async () => ({ bytes: Buffer.from("RIFF0000WEBP"), type: "image/webp" }),
  store: async (_db, key) => { stored.push(key); return `https://media.example/${key}`; },
};
const refused = (p: Promise<unknown>, status: number, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof CourseError && e.status === status && re.test(e.message));
const user = (uid: string, extra: Record<string, unknown>) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid, role: "reader", accountTier: "basic", createdAt: "2026-01-01T00:00:00Z", ...extra });

(async () => {
  await Promise.all([
    user("owner", {}), user("tutor", {}), user("stranger", {}), user("admin", { role: "admin", accountTier: "standard" }), user("broke", {}), user("freeOnly", { accountTier: "standard" }),
    db.doc("courses/farm").set({ ownerUid: "owner", title: "AI for Farmers and Agribusiness", summary: "Weather, prices and pests.", topics: ["agriculture"], level: "beginner", status: "draft", tutorUids: ["tutor", "freeOnly"], cover: "" }),
    db.doc("courses/broke").set({ ownerUid: "broke", title: "Money Basics", summary: "", status: "draft", cover: "" }),
  ]);

  // who may
  await refused(generateCover(db, "stranger", { courseId: "farm" }, deps), 403, /tutors/);
  await refused(generateCover(db, "freeOnly", { courseId: "farm" }, deps), 403, /publishing accounts/);
  await refused(generateCover(db, "owner", { courseId: "nope" }, deps), 404, /doesn't exist/);
  await refused(generateCover(db, "owner", { courseId: "../x" }, deps), 400, /Which course/);
  await refused(coverStatus(db, "stranger", "farm", now), 403, /tutors/);

  // Free Basic: 3 a day — one cover and two edits
  let s = await coverStatus(db, "owner", "farm", now);
  assert.deepEqual([s.limit, s.used, s.left], [3, 0, 3]);
  assert.equal(s.allowance.source, "platform"); assert.ok(s.allowance.ok);
  const first = await generateCover(db, "owner", { courseId: "farm", prompt: "a farmer with a phone" }, deps);
  assert.equal(first.item.spec.icon, "wheat"); assert.equal(first.item.via, "platform"); assert.equal(first.fallback, false);
  assert.match(calls[0], /a farmer with a phone/); assert.match(calls[0], /AI for Farmers and Agribusiness/);
  assert.equal(first.status.left, 2);
  assert.match(stored[0], /^academy\/covers\/farm\/\w+\.webp$/);
  const acct = (await db.doc("nanaAccounts/owner").get()).data();
  assert.ok(acct && acct.usedKobo > 0 && acct.period === periodKey(now, DEFAULT_PRICING.nana.resetEvery), "the Pearl call came off the owner's allowance");

  await refused(generateCover(db, "owner", { courseId: "farm", baseId: "missing", prompt: "green" }, deps), 404, /recent covers/);
  await refused(generateCover(db, "owner", { courseId: "farm", baseId: first.item.id }, deps), 400, /Say what to change/);
  reply = () => JSON.stringify({ ...first.item.spec, palette: "gold" });
  const edit = await generateCover(db, "owner", { courseId: "farm", baseId: first.item.id, prompt: "make it gold" }, deps);
  assert.equal(edit.item.baseId, first.item.id); assert.equal(edit.item.spec.palette, "gold");
  assert.match(calls[calls.length - 1], /CURRENT DESIGN[\s\S]*"palette":"moss"[\s\S]*make it gold/);
  // the AI's answer can't be read: our own design, still counted (the tokens were spent)
  reply = () => "Sorry, here is a lovely cover!";
  const third = await generateCover(db, "owner", { courseId: "farm", baseId: edit.item.id, prompt: "make it green" }, deps);
  assert.equal(third.fallback, true); assert.equal(third.item.spec.palette, "moss", "the fallback still follows the instruction");
  assert.equal(third.status.left, 0);
  await refused(generateCover(db, "owner", { courseId: "farm" }, deps), 429, /today's 3 covers/);
  assert.equal((await db.doc(`coverCounts/owner_2026-11-01`).get()).data()?.count, 3, "the refused one wasn't counted");

  // a co-tutor has their own count; the history is the course's
  reply = () => JSON.stringify({ template: "frame", palette: "ivory", pattern: "kente", icon: "plant", headline: "AI for Farmers", subline: "", tag: "", layout: "center" });
  const t = await generateCover(db, "tutor", { courseId: "farm" }, deps);
  assert.equal(t.status.left, 2); assert.equal(t.status.items.length, 4); assert.equal(t.status.items[0].id, t.item.id, "newest first");

  // the next Lagos day starts again (Lagos midnight is 23:00 UTC)
  now = new Date("2026-11-01T23:05:00Z");
  s = await coverStatus(db, "owner", "farm", now);
  assert.deepEqual([s.used, s.left], [0, 3]);

  // the allowance used up: refused before anything is counted, with when it comes back
  await db.doc("nanaAccounts/broke").set({ period: periodKey(now, DEFAULT_PRICING.nana.resetEvery), usedKobo: 10_000_000, creditKobo: 0 });
  s = await coverStatus(db, "broke", "broke", now);
  assert.equal(s.allowance.ok, false); assert.match(s.allowance.note, /allowance is used up; covers come back when it refreshes on/);
  await refused(generateCover(db, "broke", { courseId: "broke" }, deps), 402, /allowance is used up; covers come back when it refreshes on \w+day/);
  assert.equal((await db.doc(`coverCounts/broke_2026-11-02`).get()).exists, false);
  // credit keeps it going
  await db.doc("nanaAccounts/broke").set({ creditKobo: 50_000 }, { merge: true });
  assert.equal((await generateCover(db, "broke", { courseId: "broke" }, deps)).item.via, "platform");

  // the AI is down: nothing counted
  const down: CoverDeps = { ...deps, complete: async () => { const { AiDown } = await import("../../lib/nana-server"); throw new AiDown("busy"); } };
  await refused(generateCover(db, "owner", { courseId: "farm" }, down), 503, /busy/);
  assert.equal((await coverStatus(db, "owner", "farm", now)).used, 0);

  // admins may, on any course, with at least Enterprise's number
  const a = await generateCover(db, "admin", { courseId: "broke" }, deps);
  assert.equal(a.status.limit, 50);

  // an admin's change in the pricing settings takes effect
  await db.doc("platformSettings/pricing").set({ config: { ...structuredClone(DEFAULT_PRICING), academyCovers: { ...DEFAULT_PRICING.academyCovers, basicDaily: 1 } } });
  await ensurePricing(db, Date.now() + 60_000);
  s = await coverStatus(db, "owner", "farm", now);
  assert.equal(s.limit, 1);
  await generateCover(db, "owner", { courseId: "farm" }, deps);
  await refused(generateCover(db, "owner", { courseId: "farm" }, deps), 429, /today's 1 cover\b/);

  // the history keeps the last few
  for (let i = 0; i < COVER_HISTORY_MAX; i++) await generateCover(db, "admin", { courseId: "farm" }, deps);
  assert.equal((await coverStatus(db, "admin", "farm", now)).items.length, COVER_HISTORY_MAX);

  // an admin's cover from a fixed design: no count, no allowance, set as the course's cover
  const before = (await db.doc("nanaAccounts/admin").get()).data()?.usedKobo ?? 0;
  const fixed: Partial<CoverSpec> = { template: "tiles", palette: "teal", icon: "coins" };
  const item = await adminCover(db, "broke", { spec: fixed, use: true, now }, deps);
  assert.equal(item.via, "admin"); assert.equal(item.spec.template, "tiles"); assert.equal(item.spec.headline, "Money Basics", "the rest comes from the course");
  assert.equal((await db.doc("courses/broke").get()).data()?.cover, item.url);
  assert.equal((await db.doc("nanaAccounts/admin").get()).data()?.usedKobo ?? 0, before);

  console.log("COVERS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

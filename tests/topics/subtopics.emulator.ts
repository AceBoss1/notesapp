// Subtopics against the Firestore emulator (lib/subtopics-server.ts): created once and counted, refused when unusable, and Nana's
// suggestions (a fake model, so no AI account is needed). Part of npm run test:nana-server → "SUBTOPICS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SubtopicError, adminList, adminRemove, adminRename, ensureMany, ensureSubtopic, listSubtopics, suggestFor } from "../../lib/subtopics-server";
if (!getApps().length) initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, re: RegExp) => { const e = await p.then(() => null, (x) => x); assert.ok(e instanceof SubtopicError, String(e)); assert.match((e as Error).message, re); };

(async () => {
  // created the first time with the label as first written; counted after; found again whatever the spelling
  const a = await ensureSubtopic(db, "u1", "topic", "tech", "IT Support");
  assert.deepEqual(a, { parent: "tech", slug: "it-support", label: "IT Support", created: true });
  const b = await ensureSubtopic(db, "u2", "topic", "tech", "it support");
  assert.equal(b.created, false); assert.equal(b.label, "IT Support");
  assert.equal((await db.doc("subtopics/tech__it-support").get()).data()!.uses, 2);
  await fails(ensureSubtopic(db, "u1", "topic", "nope", "IT Support"), /topics first/);
  await fails(ensureSubtopic(db, "u1", "topic", "tech", "!"), /2 to 30/);
  await fails(ensureSubtopic(db, "u1", "topic", "tech", "Tech"), /same as the one/);
  await fails(ensureMany(db, "u1", "topic", [1, 2, 3, 4]), /Up to 3/);
  assert.deepEqual(await ensureMany(db, "u1", "topic", [{ parent: "careers", label: "Certifications" }, { parent: "careers", label: "certifications" }]), [{ parent: "careers", slug: "certifications", label: "Certifications" }]);
  const bag = await ensureSubtopic(db, "u1", "category", "Shoes & bags", "Tote bags");
  assert.equal(bag.created, true); assert.ok((await db.doc("storeSubcategories/shoes-bags__tote-bags").get()).exists);
  await fails(ensureSubtopic(db, "u1", "category", "Cars", "Tyres"), /categories first/);
  assert.deepEqual((await listSubtopics(db, "topic", true)).map((x) => x.slug).sort(), ["certifications", "it-support"]);

  // suggestions: with #NotesApp's key, Nana's answer checked against the lists; without one (or on a bad answer), the title's words
  delete process.env.ANTHROPIC_API_KEY;
  const words = await suggestFor(db, { kind: "course", title: "IT Support Training" });
  assert.equal(words.via, "words");
  assert.deepEqual("subtopics" in words ? words.subtopics.map((x) => x.slug) : null, ["it-support"]);
  process.env.ANTHROPIC_API_KEY = "test-key";
  const seen: { model?: string; system: string }[] = [];
  const fake = (text: string) => ({ now: () => new Date(), complete: async (x: { model?: string; system: { text: string }[] }) => { seen.push({ model: x.model, system: x.system[0].text }); return { text, refused: false }; } });
  const ai = await suggestFor(db, { kind: "journal", title: "How I passed CompTIA A+ in six weeks" }, fake('{"topics":["tech","careers"],"subtopics":[{"parent":"tech","label":"IT support"},{"parent":"tech","label":"CompTIA"}]}') as never);
  assert.equal(ai.via, "ai");
  assert.deepEqual("subtopics" in ai ? ai.subtopics.map((x) => [x.label, x.isNew]) : null, [["IT Support", false], ["CompTIA", true]]);
  assert.match(seen[0].model ?? "", /haiku/, "on Pearl");
  assert.match(seen[0].system, /tech: Tech \(existing subtopics: IT Support\)/, "the existing ones are offered");
  const cached = await suggestFor(db, { kind: "journal", title: "How I passed CompTIA A+ in six weeks" }, fake("{}") as never);
  assert.equal(seen.length, 1, "the same title is answered from the cache"); assert.equal(cached.via, "ai");
  const bad = await suggestFor(db, { kind: "journal", title: "Saving money as a student" }, fake("I'm not sure.") as never);
  assert.equal(bad.via, "words", "a bad answer falls back to the title's words");
  const item = await suggestFor(db, { kind: "item", title: "Handmade Ankara tote bag" }, fake('{"options":[{"category":"Shoes & bags","subcategory":"Tote Bags"}]}') as never);
  assert.deepEqual("options" in item ? item.options : null, [{ category: "Shoes & bags", subcategory: { slug: "tote-bags", label: "Tote bags", isNew: false } }]);
  await fails(suggestFor(db, { kind: "journal", title: "Hi" }), /few more words/);
  await fails(suggestFor(db, { kind: "x", title: "Something long enough" }), /What is it for/);

  // Admin → Topics
  assert.equal((await adminList(db)).length, 3);
  await adminRename(db, "topic", "careers", "certifications", "Professional certifications");
  assert.equal((await db.doc("subtopics/careers__certifications").get()).data()!.label, "Professional certifications");
  await adminRemove(db, "category", "Shoes & bags", "tote-bags");
  assert.equal((await adminList(db)).length, 2);
  console.log("SUBTOPICS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

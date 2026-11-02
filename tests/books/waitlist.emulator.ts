// The Business books waitlist on the Firestore emulator: a sign-up becomes a lead of category "books-waitlist" with its answers, a
// thank-you email always and a bell for a member; the same email signing up again updates the first; bad answers are refused; and
// the route's rate limit lets 5 an hour through, then refuses. Run: npm run test:books-server → "BOOKS WAITLIST OK".
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LeadError, submitBooksWaitlist } from "../../lib/leads-server";
import { WAITLIST_LIMIT, checkWaitlist, keepsBooksLabel, waitlistMessage } from "../../lib/books-waitlist";
import { rateLimit } from "../../lib/rate-limit";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
type Mail = { to: string; subject: string; text: string };
const outbox: Mail[] = [];
const send = async (m: Mail) => { outbox.push(m); return true; };
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof LeadError && e.status === 400 && re.test(e.message));
const answers = { name: "Kemi  Adeyemi", email: "KEMI@x.ng", businessType: "shop", sells: "Rice, garri\nand Ankara", keepsBooks: "exercise-book", city: "Ojota, Lagos", notify: true };

(async () => {
  // ---------------------------------------------------------------- pure checks
  assert.equal(checkWaitlist({ ...answers, businessType: "bank" }).ok, false, "unknown kind of business");
  assert.equal(checkWaitlist({ ...answers, keepsBooks: "" }).ok, false, "how they keep books is required");
  assert.equal(checkWaitlist({ ...answers, city: " " }).ok, false, "city is required");
  const ok = checkWaitlist({ ...answers, keepsBooks: "other-app", otherApp: "Kippa" });
  assert.ok(ok.ok && ok.value.otherApp === "Kippa" && ok.value.name === "Kemi Adeyemi" && ok.value.email === "kemi@x.ng" && ok.value.sells === "Rice, garri and Ankara");
  assert.equal(keepsBooksLabel("other-app", "Kippa"), "Another app: Kippa");
  const noOther = checkWaitlist({ ...answers, otherApp: "ignored" });
  assert.ok(noOther.ok && noOther.value.otherApp === "", "otherApp only kept for another app");
  assert.match(waitlistMessage({ businessType: "salon", sells: "Braids", keepsBooks: "tralo", otherApp: "", city: "Ikeja", notify: false }), /Business: Salon[\s\S]*Keeps books today: Tralo[\s\S]*Notify when it opens: no/);

  // ---------------------------------------------------------------- a member's sign-up → a lead, an email and a bell
  await db.doc("users/kemi").set({ uid: "kemi", username: "kemi", displayName: "Kemi Adeyemi", role: "reader", accountTier: "basic" });
  const a = await submitBooksWaitlist(db, answers, { uid: "kemi" }, send);
  assert.equal(a.again, false);
  const lead = (await db.doc(`leads/${a.id}`).get()).data()!;
  assert.equal(lead.category, "books-waitlist"); assert.equal(lead.status, "new"); assert.equal(lead.uid, "kemi"); assert.equal(lead.email, "kemi@x.ng");
  assert.deepEqual(lead.booksWaitlist, { businessType: "shop", sells: "Rice, garri and Ankara", keepsBooks: "exercise-book", otherApp: "", city: "Ojota, Lagos", notify: true });
  assert.match(lead.message, /Business: Shop or supermarket/);
  assert.equal(outbox.length, 1); assert.equal(outbox[0].to, "kemi@x.ng"); assert.match(outbox[0].subject, /waitlist/); assert.match(outbox[0].text, /email you when it opens/);
  const bells = await db.collection("notifications").where("recipientUid", "==", "kemi").get();
  assert.equal(bells.size, 1); assert.equal(bells.docs[0].data().type, "books"); assert.equal(bells.docs[0].data().linkHref, "/books");

  // ---------------------------------------------------------------- the same email again updates, never duplicates
  const b = await submitBooksWaitlist(db, { ...answers, email: "kemi@x.ng", keepsBooks: "excel", notify: false }, { uid: null }, send);
  assert.equal(b.again, true); assert.equal(b.id, a.id);
  const again = await db.collection("leads").where("email", "==", "kemi@x.ng").where("category", "==", "books-waitlist").get();
  assert.equal(again.size, 1);
  const upd = again.docs[0].data();
  assert.equal(upd.booksWaitlist.keepsBooks, "excel"); assert.equal(upd.createdAt, lead.createdAt, "keeps their place"); assert.ok(upd.updatedAt);
  assert.equal(upd.uid, "kemi", "a later visitor sign-up doesn't unlink the member");
  assert.doesNotMatch(outbox[1].text, /email you when it opens/, "no promise to email when they said no");

  // ---------------------------------------------------------------- a visitor: no bell; bad answers refused, nothing saved
  const v = await submitBooksWaitlist(db, { ...answers, email: "visitor@x.ng" }, { uid: null }, send);
  assert.equal((await db.doc(`leads/${v.id}`).get()).data()!.uid, undefined);
  assert.equal((await db.collection("notifications").get()).size, 1, "visitors get no bell");
  const before = (await db.collection("leads").get()).size;
  await rejects(submitBooksWaitlist(db, { ...answers, email: "nope" }, { uid: null }, send), /email/);
  await rejects(submitBooksWaitlist(db, { ...answers, sells: "" }, { uid: null }, send), /what you sell/);
  assert.equal((await db.collection("leads").get()).size, before);

  // ---------------------------------------------------------------- the route's rate limit: 5 an hour, then 429
  const req = {} as NextRequest;
  for (let i = 0; i < WAITLIST_LIMIT.max; i++) assert.equal(await rateLimit(req, "books-waitlist", "ip:203.0.113.9", WAITLIST_LIMIT.max, WAITLIST_LIMIT.windowSec), null);
  const sixth = await rateLimit(req, "books-waitlist", "ip:203.0.113.9", WAITLIST_LIMIT.max, WAITLIST_LIMIT.windowSec);
  assert.equal(sixth?.status, 429);
  assert.equal(await rateLimit(req, "books-waitlist", "ip:203.0.113.10", WAITLIST_LIMIT.max, WAITLIST_LIMIT.windowSec), null, "another address isn't held back");

  console.log("BOOKS WAITLIST OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

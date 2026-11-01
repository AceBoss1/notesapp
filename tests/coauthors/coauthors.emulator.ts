// Co-author invites with access levels and agreements (lib/coauthors-server.ts, lib/invites-server.ts) against the Firestore
// emulator. Run: npm run test:coauthors-server → "COAUTHORS OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  CoAuthorError, changeCoAuthor, inviteCoAuthor, leaveCoAuthor, respondCoAuthor, revokeCoAuthor, saveSharedDraft, sharedDraft,
} from "../../lib/coauthors-server";
import { inviteView } from "../../lib/invites-server";
import { setInviteMailer } from "../../lib/invite-agreements-server";
import { INVITE_TERMS_VERSION, accessOf, termsLines } from "../../lib/invite-terms";
import { leadPercent, type CoAuthorInvite } from "../../lib/coauthors";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const mails: { uid: string; subject: string }[] = [];
setInviteMailer(async (uid, m) => { mails.push({ uid, subject: m.subject }); });

const fails = async (p: Promise<unknown>, status: number, why: string, code?: string) => {
  const e = await p.then(() => null, (x) => x);
  assert.ok(e instanceof CoAuthorError, `${why}: expected a CoAuthorError, got ${e}`);
  assert.equal((e as CoAuthorError).status, status, `${why}: ${(e as Error).message}`);
  if (code) assert.equal((e as CoAuthorError).code, code, `${why}: code`);
};
const agree = (access: string, percent: number) => ({ accept: true, agree: true, termsVersion: INVITE_TERMS_VERSION, seen: { access, percent }, userAgent: "TestBrowser/1" });
const inv = async (id: string) => (await db.doc(`coAuthorInvites/${id}`).get()).data() as CoAuthorInvite;
const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).get()).docs.map((d) => String(d.data().message));

(async () => {
  for (const [uid, username, tier] of [["lead", "lead", "pro"], ["vic", "vic", "basic"], ["eve", "eve", "basic"], ["sam", "sam", "standard"], ["old", "old", "basic"], ["basic", "basicpub", "basic"]] as const) {
    await db.doc(`users/${uid}`).set({ username, displayName: username.toUpperCase(), role: "reader", accountTier: tier });
    await db.doc(`usernames/${username}`).set({ uid });
  }
  await db.doc("notes/n1").set({ authorUid: "lead", authorUsername: "lead", author: "LEAD", title: "Rivers", content: "First words.", status: "draft", slug: "rivers" });

  // ---- inviting: the lead chooses the access; view may be 0%, edit at least 5% ----
  await fails(inviteCoAuthor(db, "basic", { noteId: "n1", username: "vic", percent: 10, access: "view" }), 403, "only Pro and up lead");
  await fails(inviteCoAuthor(db, "lead", { noteId: "n1", username: "eve", percent: 0, access: "edit" }), 400, "a contributor keeps the minimum share");
  const v = await inviteCoAuthor(db, "lead", { noteId: "n1", username: "@Vic", percent: 0, access: "view" });
  assert.equal(v.access, "view"); assert.equal(v.percent, 0);
  const e = await inviteCoAuthor(db, "lead", { noteId: "n1", username: "eve", percent: 30, access: "edit" });
  assert.equal(e.access, "edit");
  await fails(inviteCoAuthor(db, "lead", { noteId: "n1", username: "sam", percent: 65, access: "view" }), 400, "the lead keeps at least 10%");
  assert.ok((await bells("vic")).some((m) => m.includes("can view")), "the invitee's bell names the access");
  assert.ok(mails.some((m) => m.uid === "eve"), "and an email goes too");

  // ---- the accept screen and the agreement ----
  const view = await inviteView(db, "vic", "journal", "n1_vic");
  assert.equal(view.viewer, "invitee"); assert.equal(view.title, "Rivers"); assert.deepEqual(view.offer, { access: "view", percent: 0 });
  await fails(inviteView(db, "sam", "journal", "n1_vic"), 404, "a stranger can't see someone's invite");
  await fails(sharedDraft(db, "vic", "n1"), 403, "no draft before accepting");
  await fails(respondCoAuthor(db, "vic", "n1_vic", { accept: true }), 400, "accepting needs the agreement", "needs_agreement");
  await fails(respondCoAuthor(db, "vic", "n1_vic", { ...agree("view", 0), termsVersion: "old" }), 409, "an old terms version", "terms_changed");
  await fails(respondCoAuthor(db, "vic", "n1_vic", agree("edit", 0)), 409, "terms seen don't match", "terms_changed");
  await respondCoAuthor(db, "vic", "n1_vic", agree("view", 0));
  const vAcc = await inv("n1_vic");
  assert.equal(vAcc.status, "accepted"); assert.ok(vAcc.agreedAt);
  assert.deepEqual(vAcc.agreedTerms, { kind: "journal", title: "Rivers", leadName: "LEAD", access: "view", percent: 0, termsVersion: INVITE_TERMS_VERSION });
  const rec = (await db.collection("inviteAgreements").where("inviteId", "==", "n1_vic").get()).docs[0].data();
  assert.equal(rec.userAgent, "TestBrowser/1"); assert.deepEqual(rec.wording, termsLines("journal", { title: "Rivers", leadName: "LEAD", access: "view", percent: 0 }));
  assert.ok((await bells("lead")).some((m) => m.includes("VIC accepted and agreed")), "the lead is told");
  assert.deepEqual((await db.doc("notes/n1").get()).data()!.coAuthorUids, ["vic"], "listed once accepted");
  await respondCoAuthor(db, "eve", "n1_eve", agree("edit", 30));

  // ---- server-enforced access to the draft ----
  const vd = await sharedDraft(db, "vic", "n1");
  assert.equal(vd.access, "view"); assert.equal(vd.note.content, "First words.");
  await fails(saveSharedDraft(db, "vic", { noteId: "n1", title: "Rivers", content: "Vic's words", version: vd.version }), 403, "a viewer can't edit");
  await fails(sharedDraft(db, "sam", "n1"), 403, "a stranger can't read the draft");
  const ed = await sharedDraft(db, "eve", "n1");
  const saved = await saveSharedDraft(db, "eve", { noteId: "n1", title: "Rivers and seas", content: "Eve's words.", version: ed.version });
  const n1 = (await db.doc("notes/n1").get()).data()!;
  assert.equal(n1.content, "Eve's words."); assert.equal(n1.coEditedBy, "eve"); assert.equal(n1.authorUid, "lead", "the lead still owns it");
  assert.equal(n1.status, "draft", "a co-author's save never publishes");
  await fails(saveSharedDraft(db, "eve", { noteId: "n1", title: "x", content: "stale", version: ed.version }), 409, "a stale save is refused", "stale");
  await saveSharedDraft(db, "eve", { noteId: "n1", title: "Rivers and seas", content: "Eve again.", version: saved.version });
  assert.equal((await bells("lead")).filter((m) => m.includes("edited the draft")).length, 1, "one 'edited' bell an hour");

  // ---- changing access later ----
  // less access: at once, and the member is told
  const down = await changeCoAuthor(db, "lead", { inviteId: "n1_eve", access: "view", percent: 30 });
  assert.deepEqual(down, { applied: true, proposed: false });
  assert.equal((await inv("n1_eve")).access, "view");
  await fails(saveSharedDraft(db, "eve", { noteId: "n1", title: "x", content: "y", version: (await sharedDraft(db, "eve", "n1")).version }), 403, "edit access is gone at once");
  assert.ok((await bells("eve")).some((m) => m.includes("changed your access")));
  // more access: proposed; the agreed terms stay until they agree
  const up = await changeCoAuthor(db, "lead", { inviteId: "n1_vic", access: "edit", percent: 10 });
  assert.deepEqual(up, { applied: false, proposed: true });
  let vNow = await inv("n1_vic");
  assert.equal(vNow.access, "view"); assert.equal(vNow.percent, 0); assert.deepEqual({ a: vNow.change?.access, p: vNow.change?.percent }, { a: "edit", p: 10 });
  assert.equal(leadPercent([vNow, await inv("n1_eve")]), 60, "a proposal holds its share against the lead");
  await fails(changeCoAuthor(db, "lead", { inviteId: "n1_eve", access: "view", percent: 85 }), 400, "the lead's minimum counts proposals");
  await fails(saveSharedDraft(db, "vic", { noteId: "n1", title: "x", content: "y", version: (await sharedDraft(db, "vic", "n1")).version }), 403, "not yet: they haven't agreed");
  assert.deepEqual((await inviteView(db, "vic", "journal", "n1_vic")).offer, { access: "edit", percent: 10 });
  // declining a change keeps the old terms
  await respondCoAuthor(db, "vic", "n1_vic", { accept: false });
  vNow = await inv("n1_vic");
  assert.equal(vNow.status, "accepted"); assert.equal(vNow.access, "view"); assert.equal(vNow.change, undefined);
  // agreeing applies it, with a new agreement
  await changeCoAuthor(db, "lead", { inviteId: "n1_vic", access: "edit", percent: 10 });
  await respondCoAuthor(db, "vic", "n1_vic", agree("edit", 10));
  vNow = await inv("n1_vic");
  assert.equal(vNow.access, "edit"); assert.equal(vNow.percent, 10); assert.equal(vNow.agreedTerms?.access, "edit");
  assert.equal((await db.collection("inviteAgreements").where("inviteId", "==", "n1_vic").get()).size, 2, "every agreement is kept");
  // a share change alone also asks
  assert.deepEqual(await changeCoAuthor(db, "lead", { inviteId: "n1_vic", access: "edit", percent: 15 }), { applied: false, proposed: true });
  await fails(changeCoAuthor(db, "eve", { inviteId: "n1_vic", access: "edit", percent: 50 }), 404, "only the lead changes terms");

  // ---- leaving and removal ----
  await leaveCoAuthor(db, "eve", "n1_eve");
  assert.equal((await inv("n1_eve")).status, "revoked");
  assert.deepEqual((await db.doc("notes/n1").get()).data()!.coAuthorUids, ["vic"]);
  assert.ok((await bells("lead")).some((m) => m.includes("EVE left")));
  await fails(sharedDraft(db, "eve", "n1"), 403, "no draft after leaving");

  // ---- legacy invites (no access field): credit and share, no draft, as before ----
  await db.doc("coAuthorInvites/n1_old").set({ noteId: "n1", noteTitle: "Rivers", leadUid: "lead", leadName: "LEAD", leadUsername: "lead", inviteeUid: "old", inviteeUsername: "old", inviteeName: "OLD", percent: 5, status: "accepted", createdAt: "2026-10-01T00:00:00.000Z" });
  assert.equal(accessOf("journal", await inv("n1_old")), "credit");
  await fails(sharedDraft(db, "old", "n1"), 403, "a legacy co-author still doesn't see the draft", "no_access");
  assert.deepEqual(await changeCoAuthor(db, "lead", { inviteId: "n1_old", access: "view", percent: 5 }), { applied: false, proposed: true }, "giving them access asks first");
  await revokeCoAuthor(db, "lead", "n1_old");
  assert.ok((await bells("old")).some((m) => m.includes("removed you")), "removal is told");

  // ---- publishing locks it all ----
  await db.doc("notes/n1").update({ status: "published" });
  await fails(saveSharedDraft(db, "vic", { noteId: "n1", title: "x", content: "y", version: (await sharedDraft(db, "vic", "n1")).version }), 409, "no edits once published");
  await fails(changeCoAuthor(db, "lead", { inviteId: "n1_vic", access: "view", percent: 10 }), 409, "no changes once published");
  await fails(respondCoAuthor(db, "vic", "n1_vic", agree("edit", 15)), 409, "a proposed change lapses at publishing");
  assert.equal((await inv("n1_vic")).percent, 10, "the agreed split stands");
  await fails(leaveCoAuthor(db, "vic", "n1_vic"), 409, "the byline is locked once published");
  await fails(inviteCoAuthor(db, "lead", { noteId: "n1", username: "sam", percent: 5, access: "view" }), 409, "no invites once published");

  console.log("COAUTHORS OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

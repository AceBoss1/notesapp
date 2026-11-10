// The NotesApp Partner Network against the Firestore emulator: who may apply, the checks on an application, one open application a track,
// the team's review (approve at a tier, decline with feedback), the partner's slug, the directory, the tier shares replacing the referral
// share on plan payments (and back when paused), requests to experts, association verification, chapters, workplace codes (counted,
// never listed), profile badges, the portal's progress and Ask to be Certified, and the tier terms (Admin → Limits).
// Run: npm run test:partners → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  adminPartners, applyPartner, decideApplication, decideMember, directory, joinPartner, leavePartner, mine, partnerTermsFor, portal,
  profileBadges, publicPartner, requestTier, sendLead, setLeadStatus, setTierTerms, tierTerms, updateListing, updatePartner, withdrawApplication,
} from "../../lib/partner-network-server";
import { recordPlanEarning } from "../../lib/referrals-server";
import { TRAINING } from "../../lib/partner-network";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp, why?: string) => assert.rejects(p, (e: Error) => re.test(e.message), why);

const ok = (over: Record<string, unknown> = {}) => ({
  track: "solutions", orgName: "Kudi Studio", website: "", countries: "Lagos, Nigeria", reach: 40, services: ["setup", "payments"],
  about: "We set up booking, payments and shops for coaches and therapists across Lagos and online.",
  plan: "Move twenty of our clients to NotesApp in ninety days, and run two setup workshops for coaches.", agree: true, ...over,
});
const ADA = { uid: "u_ada", emailVerified: true };
const BOLA = { uid: "u_bola", emailVerified: true };
const CHI = { uid: "u_chi", emailVerified: true };

async function main() {
  await db.doc("users/u_ada").set({ username: "ada", displayName: "Ada" });
  await db.doc("users/u_bola").set({ username: "bola", displayName: "Bola" });
  await db.doc("users/u_chi").set({ username: "chi", displayName: "Chi" });
  await db.doc("users/u_teen").set({ username: "tobi", teen: true });
  await db.doc("usernames/chi").set({ uid: "u_chi" });

  // Who may apply, and the checks.
  await rejects(applyPartner(db, { uid: "u_ada", emailVerified: false }, ok()), /Verify your email/);
  await rejects(applyPartner(db, { uid: "u_teen", emailVerified: true }, ok()), /18 and over/);
  await rejects(applyPartner(db, { uid: "kid_1", emailVerified: true }, ok()), /18 and over/);
  await rejects(applyPartner(db, ADA, ok({ agree: false })), /Tick the box/);
  await rejects(applyPartner(db, ADA, ok({ track: "resellers" })), /track/);
  await rejects(applyPartner(db, ADA, ok({ services: [] })), /at least one service/);
  await rejects(applyPartner(db, ADA, ok({ about: "short" })), /at least 40/);
  await rejects(applyPartner(db, ADA, ok({ track: "associations", website: "" })), /website/);
  await rejects(applyPartner(db, ADA, ok({ website: "http://plain.example" })), /https/);

  const app = await applyPartner(db, ADA, ok());
  assert.equal(app.status, "received");
  await rejects(applyPartner(db, ADA, ok()), /already have/, "one open application a track");
  const assoc = await applyPartner(db, BOLA, ok({ track: "associations", orgName: "Coaches Guild of Nigeria", website: "https://guild.example", reach: 900 }));
  const work = await applyPartner(db, BOLA, ok({ track: "workplace", orgName: "Acme Bank", website: "https://acme.example", reach: 3000 }));
  const chap = await applyPartner(db, CHI, ok({ track: "chapters", orgName: "NotesApp UNILAG", reach: 250 }));
  const withdrawn = await applyPartner(db, CHI, ok({ track: "media", orgName: "Wave Records", website: "https://wave.example" }));
  await rejects(withdrawApplication(db, "u_ada", withdrawn.id), /not found/, "only your own");
  await withdrawApplication(db, "u_chi", withdrawn.id);
  await rejects(decideApplication(db, withdrawn.id, { status: "approved" }), /withdrew/);

  // Review: approve at a tier, decline with feedback.
  const { partnerId: kudi } = await decideApplication(db, app.id, { status: "approved" });
  assert.equal(kudi, "kudi-studio", "the slug comes from the name");
  await rejects(decideApplication(db, app.id, { status: "declined" }), /Already approved/);
  const { partnerId: guild } = await decideApplication(db, assoc.id, { status: "approved", tier: "certified" });
  const { partnerId: acme } = await decideApplication(db, work.id, { status: "approved" });
  const { partnerId: unilag } = await decideApplication(db, chap.id, { status: "approved" });
  const twin = await applyPartner(db, CHI, ok({ orgName: "Kudi Studio", reach: 1 }));
  assert.equal((await decideApplication(db, twin.id, { status: "approved" })).partnerId, "kudi-studio-2", "a free slug");
  const dir = await applyPartner(db, ADA, ok({ track: "technology", orgName: "Directory", website: "https://d.example" }));
  assert.equal((await decideApplication(db, dir.id, { status: "approved" })).partnerId, "directory-partner", "never a page's name");
  const declined = await applyPartner(db, ADA, ok({ track: "channel", orgName: "Hub One", website: "https://hub.example" }));
  await decideApplication(db, declined.id, { status: "declined", feedback: "Tell us more about your members first." });
  const my = await mine(db, "u_ada");
  assert.equal(my.applications.find((a) => a.id === declined.id)?.feedback, "Tell us more about your members first.", "the applicant reads the feedback");
  assert.equal(my.partners.length, 2);
  assert.ok(!("notes" in my.partners[0]), "team notes never reach the partner");

  // The directory and a partner's page.
  const listed = await directory(db);
  assert.ok(listed.some((p) => p.id === kudi) && listed.some((p) => p.id === guild));
  assert.equal(listed[0].tier, "certified", "higher tiers first");
  assert.ok(!listed.some((p) => "uid" in p), "no uids in public");
  assert.equal(await publicPartner(db, "no-such"), null);

  // Tier shares replace the referral share for members a partner brings; ordinary referrals keep theirs.
  const t0 = new Date("2026-11-09T10:00:00Z");
  await db.doc("referrals/payer1").set({ uid: "payer1", referredBy: "u_ada", referredByUsername: "ada", referredAt: t0.toISOString() });
  await db.doc("referrals/payer2").set({ uid: "payer2", referredBy: "u_bola", referredByUsername: "bola", referredAt: t0.toISOString() });
  await db.doc("referrals/payer3").set({ uid: "payer3", referredBy: "u_nobody", referredByUsername: "nobody", referredAt: t0.toISOString() });
  const terms = await tierTerms(db);
  assert.deepEqual(await partnerTermsFor(db, "u_bola"), { tier: "certified", ...terms.certified }, "the best tier of the partners you run");
  const e1 = await recordPlanEarning(db, "payer1", "P1", 500_000, "Pro plan", t0);
  assert.equal(e1?.percent, terms.registered.percent); assert.equal(e1?.kobo, 500_000 * terms.registered.percent / 100);
  const e2 = await recordPlanEarning(db, "payer2", "P2", 500_000, "Pro plan", t0);
  assert.equal(e2?.percent, terms.certified.percent);
  const e3 = await recordPlanEarning(db, "payer3", "P3", 500_000, "Pro plan", t0);
  assert.equal(e3?.percent, 20, "an ordinary referral");
  // Certified: 18 months by default, so month 15 still earns; an ordinary referral wouldn't.
  const m15 = new Date(t0.getTime() + 450 * 86_400_000);
  assert.ok(await recordPlanEarning(db, "payer2", "P2b", 500_000, "Pro plan", m15), "within the certified window");
  assert.equal(await recordPlanEarning(db, "payer3", "P3b", 500_000, "Pro plan", m15), null, "past the referral window");
  // Paused: back to the ordinary share.
  await updatePartner(db, kudi, { status: "suspended" });
  await updatePartner(db, "directory-partner", { status: "suspended" });
  assert.equal(await partnerTermsFor(db, "u_ada"), null);
  assert.equal((await recordPlanEarning(db, "payer1", "P1b", 500_000, "Pro plan", t0))?.percent, 20);
  assert.ok(!(await directory(db)).some((p) => p.id === kudi), "a paused partner leaves the directory");
  await updatePartner(db, kudi, { status: "active" });

  // Tier terms (Admin → Limits).
  await rejects(setTierTerms(db, { registered: { percent: 90, months: 12 }, certified: terms.certified, premier: terms.premier }, "admin"), /5 to 50%/);
  const saved = await setTierTerms(db, { registered: { percent: 22, months: 12 }, certified: terms.certified, premier: terms.premier }, "admin");
  assert.equal(saved.registered.percent, 22);
  assert.equal((await partnerTermsFor(db, "u_ada"))?.percent, 22, "applies at once");

  // Requests to experts (solutions only).
  await rejects(sendLead(db, ADA, kudi, { service: "setup", budget: "unsure", message: "Please set up my coaching site and calendar." }), /your own listing/);
  await rejects(sendLead(db, BOLA, guild, { service: "setup", budget: "unsure", message: "Please set up my coaching site and calendar." }), /isn't taking requests/);
  await rejects(sendLead(db, BOLA, kudi, { service: "setup", budget: "lots", message: "Please set up my coaching site and calendar." }), /budget/);
  await sendLead(db, BOLA, kudi, { service: "setup", budget: "unsure", message: "Please set up my coaching site and calendar." });
  await rejects(sendLead(db, BOLA, kudi, { service: "payments", budget: "unsure", message: "And payments too, while you're at it please." }), /already sent/);
  const lead = (await portal(db, "u_ada")).partners.find((p) => p.id === kudi)!.leads[0];
  assert.equal(lead.fromUsername, "bola");
  await rejects(setLeadStatus(db, "u_bola", lead.id, "won"), /not found/, "only the partner");
  await setLeadStatus(db, "u_ada", lead.id, "contacted");

  // Associations verify members; the badge follows.
  await rejects(joinPartner(db, CHI, guild, { ref: "" }), /membership number/);
  assert.equal(await joinPartner(db, CHI, guild, { ref: "CGN-0042" }), "pending");
  await rejects(joinPartner(db, CHI, guild, { ref: "CGN-0042" }), /waiting/);
  assert.deepEqual(await profileBadges(db, "u_chi").then((b) => b.filter((x) => x.kind === "member")), [], "no badge while pending");
  await rejects(decideMember(db, "u_ada", guild, "u_chi", "verify"), /not found/, "only the association");
  await decideMember(db, "u_bola", guild, "u_chi", "verify");
  const pp = await publicPartner(db, guild!);
  assert.deepEqual(pp?.members, [{ username: "chi", name: "Chi" }]);
  await rejects(decideMember(db, "u_bola", guild, "u_chi", "decline"), /waiting request/);

  // Chapters: join at once.
  assert.equal(await joinPartner(db, ADA, unilag, {}), "verified");
  await leavePartner(db, "u_ada", unilag);
  assert.equal(await joinPartner(db, ADA, unilag, {}), "verified", "can rejoin after leaving");

  // Workplaces: the code is the proof; staff are counted, never listed or badged.
  const acmeP = (await portal(db, "u_bola")).partners.find((p) => p.id === acme)!;
  assert.match(acmeP.code!, /^[0-9A-F]{8}$/);
  await rejects(joinPartner(db, CHI, acme, { ref: "WRONG" }), /code isn't right/);
  assert.equal(await joinPartner(db, CHI, acme, { ref: acmeP.code!.toLowerCase() }), "verified");
  const acmeNow = (await portal(db, "u_bola")).partners.find((p) => p.id === acme)!;
  assert.equal(acmeNow.members, 1); assert.deepEqual(acmeNow.requests, [], "a workplace never sees who");
  assert.deepEqual((await publicPartner(db, acme!))?.members, [], "nor does anyone else");
  await rejects(decideMember(db, "u_bola", acme, "u_chi", "remove"), /Workplaces/);
  await rejects(updateListing(db, "u_bola", acme, { recommended: "@nobody_here" }), /isn't on/);
  await updateListing(db, "u_bola", acme, { recommended: "@chi" });
  assert.deepEqual((await publicPartner(db, acme!))?.partner.recommended, ["chi"]);
  await updateListing(db, "u_bola", acme, { newCode: true });
  assert.notEqual((await portal(db, "u_bola")).partners.find((p) => p.id === acme)!.code, acmeP.code, "a new code");

  // Badges: the association, the chapter, being a partner; never the workplace.
  const chiBadges = (await profileBadges(db, "u_chi")).map((b) => b.label);
  assert.ok(chiBadges.includes("Verified member of Coaches Guild of Nigeria"));
  assert.ok(chiBadges.some((l) => /NotesApp partner · Agencies/.test(l)), "Chi runs Kudi Studio 2");
  assert.ok(!chiBadges.some((l) => /Acme/.test(l)), "no workplace badge");

  // Moving up: training and progress, then ask; the team decides.
  await rejects(requestTier(db, "u_ada", kudi), /Not yet/);
  await updateListing(db, "u_ada", kudi, { training: TRAINING.map((_, i) => i) });
  for (let i = 0; i < 5; i++) {
    await db.doc(`referralEarnings/plan_X${i}`).set({ uid: "u_ada", source: "plan", buyerUid: `buyer${i}`, status: "held", kobo: 1, createdAt: t0.toISOString(), releaseAfter: t0.toISOString() });
  }
  assert.equal((await portal(db, "u_ada")).partners.find((p) => p.id === kudi)!.canRequestTier, true);
  await requestTier(db, "u_ada", kudi);
  assert.ok((await adminPartners(db)).partners[0].tierRequestedAt, "requests first for the team");
  await updatePartner(db, kudi, { tier: "certified" });
  const k = (await portal(db, "u_ada")).partners.find((p) => p.id === kudi)!;
  assert.equal(k.tier, "certified"); assert.equal(k.tierRequestedAt ?? null, null);

  // Listing edits.
  await rejects(updateListing(db, "u_bola", kudi, { blurb: "Not mine to change at all, really." }), /not found/);
  await rejects(updateListing(db, "u_ada", kudi, { services: [] }), /at least one/);
  await updateListing(db, "u_ada", kudi, { blurb: "Setup, payments and shops for coaches. Lagos and online.", services: ["setup", "shop"] });
  assert.deepEqual((await publicPartner(db, kudi!))?.partner.services, ["setup", "shop"]);

  console.log("ALL OK");
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

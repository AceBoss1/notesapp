// The NotesApp Partner Network on the server (lib/partner-network.ts has the rules). Collections, all written by the server only
// (firestore.rules refuse browsers):
//   partnerApplications/{id}           applications to a track, reviewed in Admin → Partners
//   partners/{slug}                    approved partners: tier, listing, workplace code, recommended practitioners, training
//   partnerLeads/{id}                  members' requests to solutions partners (Find an expert)
//   partnerMembers/{partnerId_uid}     members of associations (verified), chapters, and workplace staff (counted only)
//   settings/partners                  tier terms (Admin → Limits → Partner Network)
import type { Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { isKidUid } from "./kids";
import { notifyBell } from "./email";
import { ttlCache, ttlCacheBy } from "./ttl-cache";
import {
  AGREE_TEXT, CERTIFY_MEMBERS, CERTIFY_PAYING, DEFAULT_TERMS, LEADS_PER_DAY, LIMITS, NETWORK_NAME, OPEN_APP, PORTAL_PATH,
  TIERS, TRACK, TRAINING, isAppStatus, isBudget, isLeadStatus, isService, isTier, isTierTerms, isTrack, partnerBadge, partnerPath, slugOf, toPublic,
  type Application, type Lead, type Membership, type MyApplication, type Partner, type ProfileBadge, type PublicPartner, type Tier, type TierTerms, type Track,
} from "./partner-network";

export class PartnerError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const APPS = "partnerApplications", PARTNERS = "partners", LEADS = "partnerLeads", MEMBERS = "partnerMembers";
const ID = /^[0-9a-f]{16}$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

const text = (v: unknown, max: number, label: string, min = 0): string => {
  const s = String(v ?? "").replace(/\r\n/g, "\n").trim();
  if (s.length < min) throw new PartnerError(400, min > 1 ? `${label}: write at least ${min} characters.` : `${label} is needed.`);
  if (s.length > max) throw new PartnerError(413, `${label} can be up to ${max} characters.`);
  return s;
};
const url = (v: unknown, required: boolean): string => {
  const s = String(v ?? "").trim();
  if (!s) { if (required) throw new PartnerError(400, "Add your website or a page about you (https://…)."); return ""; }
  if (!/^https:\/\/[^\s]+\.[^\s]+$/.test(s) || s.length > LIMITS.website) throw new PartnerError(400, "Your website must start with https://");
  return s;
};
const services = (v: unknown): Application["services"] => {
  const list = Array.isArray(v) ? Array.from(new Set(v.filter(isService))) : [];
  if (list.length > LIMITS.services) throw new PartnerError(400, `Choose up to ${LIMITS.services} services.`);
  return list;
};

// A member who may take part: verified email, 18 or over (not a child profile or in teen mode), not suspended, with a username.
async function adult(db: Firestore, me: { uid: string; emailVerified: boolean }, what: string) {
  if (!me.emailVerified) throw new PartnerError(403, "Verify your email first: open the link we sent to your inbox.");
  if (isKidUid(me.uid)) throw new PartnerError(403, `${what} is for members aged 18 and over.`);
  const u = (await db.doc(`users/${me.uid}`).get()).data();
  if (!u || u.suspended === true) throw new PartnerError(403, "Your account can't do that right now.");
  if (u.teen === true || u.kid === true) throw new PartnerError(403, `${what} is for members aged 18 and over.`);
  if (!u.username) throw new PartnerError(400, "Finish setting up your profile first.");
  return { username: String(u.username), name: String(u.displayName ?? u.username) };
}

// ── Tier terms (Admin → Limits) ───────────────────────────────────────────────────────────────────────────────────────────────────
// The caches read through the database the last caller passed (one Firestore per server).
let DB: Firestore;
const termsCache = ttlCache(60_000, () => readTerms(DB));
async function readTerms(db: Firestore): Promise<Record<Tier, TierTerms>> {
  const d = (await db.doc("settings/partners").get()).data();
  return Object.fromEntries(TIERS.map((t) => [t, isTierTerms(d?.terms?.[t]) ? { percent: d!.terms[t].percent, months: d!.terms[t].months } : DEFAULT_TERMS[t]])) as Record<Tier, TierTerms>;
}
export const tierTerms = (db: Firestore) => { DB = db; return termsCache(); };
export async function setTierTerms(db: Firestore, input: unknown, by: string): Promise<Record<Tier, TierTerms>> {
  const t = input as Record<string, unknown>;
  for (const tier of TIERS) if (!isTierTerms(t?.[tier])) throw new PartnerError(400, `${tier}: a share of 5 to 50% and 1 to 36 months.`);
  const terms = Object.fromEntries(TIERS.map((k) => [k, { percent: (t[k] as TierTerms).percent, months: (t[k] as TierTerms).months }]));
  await db.doc("settings/partners").set({ terms, updatedBy: by, updatedAt: new Date().toISOString() }, { merge: true });
  termsCache.invalidate();
  return readTerms(db);
}

// The plan share for members a referrer brought, if the referrer is an active partner (their best tier): used by
// lib/referrals-server.ts recordPlanEarning instead of the member referral's share. null: an ordinary referral.
export async function partnerTermsFor(db: Firestore, uid: string): Promise<(TierTerms & { tier: Tier }) | null> {
  const s = await db.collection(PARTNERS).where("uid", "==", uid).get();
  const active = s.docs.map((d) => d.data() as Partner).filter((p) => p.status === "active");
  if (!active.length) return null;
  const tier = active.map((p) => p.tier).sort((a, b) => TIERS.indexOf(b) - TIERS.indexOf(a))[0];
  return { tier, ...(await tierTerms(db))[tier] };
}

// ── Applying ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function applyPartner(db: Firestore, me: { uid: string; emailVerified: boolean }, b: Record<string, unknown>, now = new Date()): Promise<MyApplication> {
  const who = await adult(db, me, NETWORK_NAME);
  if (b.agree !== true) throw new PartnerError(400, `Tick the box: "${AGREE_TEXT}"`);
  if (!isTrack(b.track)) throw new PartnerError(400, "Choose the partner track you're applying for.");
  const reach = Math.floor(Number(b.reach));
  if (!Number.isFinite(reach) || reach < 0 || reach > 1e9) throw new PartnerError(400, `${TRACK[b.track].reachLabel}: a number, 0 or more.`);
  const svc = b.track === "solutions" ? services(b.services) : [];
  if (b.track === "solutions" && !svc.length) throw new PartnerError(400, "Choose at least one service you offer.");
  const app: Omit<Application, "id"> = {
    uid: me.uid, username: who.username, name: who.name, track: b.track,
    orgName: text(b.orgName, LIMITS.orgName, "Your organisation's name (or yours)", 2),
    website: url(b.website, b.track !== "solutions" && b.track !== "chapters"),
    countries: text(b.countries, LIMITS.country, "Where you work", 2),
    reach, services: svc,
    about: text(b.about, LIMITS.about, "About you", 40),
    plan: text(b.plan, LIMITS.plan, "Your plan with #NotesApp", 40),
    status: "received", createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  const mine = await db.collection(APPS).where("uid", "==", me.uid).get();
  if (mine.docs.some((d) => d.data().track === app.track && OPEN_APP.includes(d.data().status))) throw new PartnerError(409, `You already have a ${TRACK[app.track].label} application being reviewed.`);
  if (mine.docs.filter((d) => OPEN_APP.includes(d.data().status)).length >= 3) throw new PartnerError(429, "You have 3 applications being reviewed. Wait for an answer before sending another.");
  const id = randomBytes(8).toString("hex");
  await db.doc(`${APPS}/${id}`).set(app);
  await notifyBell({ uid: me.uid, type: "partners", linkHref: PORTAL_PATH, message: `${NETWORK_NAME}: we've received your ${TRACK[app.track].label} application for ${app.orgName}. A person on the partnerships team reviews every one.` }).catch(() => {});
  return toMine(id, { ...app, id });
}
const toMine = (id: string, a: Application): MyApplication => ({ id, track: a.track, orgName: a.orgName, status: a.status, createdAt: a.createdAt, ...(a.feedback ? { feedback: a.feedback } : {}), ...(a.partnerId ? { partnerId: a.partnerId } : {}) });

export async function withdrawApplication(db: Firestore, uid: string, id: unknown, now = new Date()) {
  if (typeof id !== "string" || !ID.test(id)) throw new PartnerError(404, "Application not found.");
  const ref = db.doc(`${APPS}/${id}`);
  const a = (await ref.get()).data() as Application | undefined;
  if (!a || a.uid !== uid) throw new PartnerError(404, "Application not found.");
  if (!OPEN_APP.includes(a.status)) throw new PartnerError(409, "That application can't be withdrawn now.");
  await ref.update({ status: "withdrawn", updatedAt: now.toISOString() });
}

// ── The partnerships team (Admin → Partners) ──────────────────────────────────────────────────────────────────────────────────────
export type AdminPartners = { applications: Application[]; partners: (Partner & { members: number; pending: number })[]; terms: Record<Tier, TierTerms> };
export async function adminPartners(db: Firestore): Promise<AdminPartners> {
  const [a, p, m] = await Promise.all([db.collection(APPS).get(), db.collection(PARTNERS).get(), db.collection(MEMBERS).get()]);
  const order = { received: 0, reviewing: 1, approved: 2, declined: 3, withdrawn: 4 };
  const count = (pid: string, st: string) => m.docs.filter((d) => d.data().partnerId === pid && d.data().status === st).length;
  return {
    applications: a.docs.map((d) => ({ ...(d.data() as Omit<Application, "id">), id: d.id })).sort((x, y) => order[x.status] - order[y.status] || y.createdAt.localeCompare(x.createdAt)),
    partners: p.docs.map((d) => ({ ...(d.data() as Partner), id: d.id, members: count(d.id, "verified"), pending: count(d.id, "pending") }))
      .sort((x, y) => Number(!!y.tierRequestedAt) - Number(!!x.tierRequestedAt) || y.createdAt.localeCompare(x.createdAt)),
    terms: await tierTerms(db),
  };
}

async function freeSlug(db: Firestore, name: string): Promise<string> {
  // /partners/directory and /partners/portal are pages, so those names are never a partner's.
  const base = ["directory", "portal", "apply"].includes(slugOf(name)) ? `${slugOf(name)}-partner` : slugOf(name);
  for (let i = 0; i < 50; i++) {
    const s = i ? `${base.slice(0, 44)}-${i + 1}` : base;
    if (!(await db.doc(`${PARTNERS}/${s}`).get()).exists) return s;
  }
  return `${base.slice(0, 30)}-${randomBytes(3).toString("hex")}`;
}
const newCode = () => randomBytes(4).toString("hex").toUpperCase();

// Review an application: reviewing, approved (a partner is made at the tier chosen, Registered by default) or declined, with feedback the
// applicant sees and notes they never see.
export async function decideApplication(db: Firestore, id: unknown, input: { status?: unknown; tier?: unknown; feedback?: unknown; notes?: unknown }, now = new Date()): Promise<{ partnerId?: string }> {
  if (typeof id !== "string" || !ID.test(id)) throw new PartnerError(404, "Application not found.");
  const ref = db.doc(`${APPS}/${id}`);
  const a = (await ref.get()).data() as Application | undefined;
  if (!a) throw new PartnerError(404, "Application not found.");
  const at = now.toISOString();
  const patch: Record<string, unknown> = { updatedAt: at };
  if (input.feedback !== undefined) patch.feedback = String(input.feedback ?? "").trim().slice(0, LIMITS.feedback);
  if (input.notes !== undefined) patch.notes = String(input.notes ?? "").slice(0, LIMITS.notes);
  let partnerId: string | undefined;
  if (input.status !== undefined && input.status !== a.status) {
    if (!isAppStatus(input.status) || input.status === "withdrawn" || input.status === "received") throw new PartnerError(400, "Choose reviewing, approved or declined.");
    if (a.status === "withdrawn") throw new PartnerError(409, "The applicant withdrew this application.");
    if (a.status === "approved") throw new PartnerError(409, "Already approved: manage the partner instead.");
    patch.status = input.status;
    if (input.status === "approved") {
      const tier: Tier = input.tier === undefined ? "registered" : isTier(input.tier) ? input.tier : (() => { throw new PartnerError(400, "Choose a tier."); })();
      partnerId = await freeSlug(db, a.orgName);
      const p: Partner = {
        id: partnerId, uid: a.uid, username: a.username, track: a.track, name: a.orgName, tier, status: "active", listed: true,
        blurb: a.about.slice(0, LIMITS.blurb), website: a.website, countries: a.countries, services: a.services,
        ...(a.track === "workplace" ? { code: newCode(), recommended: [] } : {}), training: [], createdAt: at, updatedAt: at,
      };
      await db.doc(`${PARTNERS}/${partnerId}`).set(p);
      patch.partnerId = partnerId;
      badgesFor.invalidate(a.uid);
    }
  }
  await ref.update(patch);
  const st = patch.status as Application["status"] | undefined;
  const msg = st === "approved" ? `${NETWORK_NAME}: ${a.orgName} is approved as one of our ${TRACK[a.track].label}. Welcome! Open your partner portal to finish your listing and get your link.`
    : st === "declined" ? `${NETWORK_NAME}: your ${TRACK[a.track].label} application for ${a.orgName} wasn't approved this time. Read the team's note in your partner portal; you're welcome to apply again.`
    : st === "reviewing" ? `${NETWORK_NAME}: the partnerships team is reviewing your application for ${a.orgName}.` : "";
  if (msg) await notifyBell({ uid: a.uid, type: "partners", linkHref: PORTAL_PATH, message: msg }).catch(() => {});
  return partnerId ? { partnerId } : {};
}

// Change a partner: tier, active or suspended, listed or not, team notes. A tier change clears a pending certification request.
export async function updatePartner(db: Firestore, id: unknown, input: { tier?: unknown; status?: unknown; listed?: unknown; notes?: unknown; declineTier?: unknown }, now = new Date()) {
  const ref = partnerRef(db, id);
  const p = (await ref.get()).data() as Partner | undefined;
  if (!p) throw new PartnerError(404, "Partner not found.");
  const patch: Record<string, unknown> = { updatedAt: now.toISOString() };
  let tell = "";
  if (input.tier !== undefined && input.tier !== p.tier) {
    if (!isTier(input.tier)) throw new PartnerError(400, "Choose a tier.");
    patch.tier = input.tier; patch.tierRequestedAt = null;
    tell = TIERS.indexOf(input.tier) > TIERS.indexOf(p.tier) ? `${NETWORK_NAME}: ${p.name} is now a ${input.tier[0].toUpperCase()}${input.tier.slice(1)} partner, with a bigger share on the members you bring. Congratulations!` : `${NETWORK_NAME}: ${p.name}'s tier changed to ${input.tier}. Your portal shows the terms.`;
  }
  if (input.declineTier === true && p.tierRequestedAt) { patch.tierRequestedAt = null; tell = `${NETWORK_NAME}: ${p.name} isn't moving up a tier yet. The partnerships team will be in touch with what's missing.`; }
  if (input.status !== undefined) {
    if (input.status !== "active" && input.status !== "suspended") throw new PartnerError(400, "Active or suspended.");
    if (input.status !== p.status) { patch.status = input.status; tell = input.status === "suspended" ? `${NETWORK_NAME}: ${p.name}'s partnership is paused. The partnerships team will contact you.` : `${NETWORK_NAME}: ${p.name}'s partnership is active again.`; }
  }
  if (typeof input.listed === "boolean") patch.listed = input.listed;
  if (input.notes !== undefined) patch.notes = String(input.notes ?? "").slice(0, LIMITS.notes);
  await ref.update(patch);
  directoryCache.invalidate(); badgesFor.invalidate(p.uid);
  if (tell) await notifyBell({ uid: p.uid, type: "partners", linkHref: PORTAL_PATH, message: tell }).catch(() => {});
}
const partnerRef = (db: Firestore, id: unknown) => {
  if (typeof id !== "string" || !SLUG.test(id)) throw new PartnerError(404, "Partner not found.");
  return db.doc(`${PARTNERS}/${id}`);
};

// ── The public side: the directory, a partner's page, profile badges ──────────────────────────────────────────────────────────────
const memberCounts = async (db: Firestore) => {
  const s = await db.collection(MEMBERS).where("status", "==", "verified").get();
  const n = new Map<string, number>();
  for (const d of s.docs) n.set(d.data().partnerId, (n.get(d.data().partnerId) ?? 0) + 1);
  return n;
};
const directoryCache = ttlCache(5 * 60_000, async (): Promise<PublicPartner[]> => {
  const db = DB;
  const [s, n] = await Promise.all([db.collection(PARTNERS).where("listed", "==", true).get(), memberCounts(db)]);
  return s.docs.map((d) => ({ ...(d.data() as Partner), id: d.id })).filter((p) => p.status === "active")
    .sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier) || a.name.localeCompare(b.name))
    .map((p) => toPublic(p, n.get(p.id) ?? 0));
});
export const directory = (db: Firestore) => { DB = db; return directoryCache(); };

export async function publicPartner(db: Firestore, id: string): Promise<{ partner: PublicPartner; members: { username: string; name: string }[] } | null> {
  if (!SLUG.test(id)) return null;
  const p = (await db.doc(`${PARTNERS}/${id}`).get()).data() as Partner | undefined;
  if (!p || p.status !== "active") return null;
  const showMembers = p.track === "associations" || p.track === "chapters";
  const s = showMembers ? await db.collection(MEMBERS).where("partnerId", "==", id).where("status", "==", "verified").limit(200).get() : null;
  const members = (s?.docs ?? []).map((d) => ({ username: String(d.data().username), name: String(d.data().name) }));
  return { partner: toPublic({ ...p, id }, members.length), members };
}

// A member's badges on their profile: verified association memberships, chapters, and being a partner. Workplace staff: never.
const badgesFor = ttlCacheBy(5 * 60_000, async (key: string): Promise<ProfileBadge[]> => {
  const db = DB;
  const [m, p] = await Promise.all([db.collection(MEMBERS).where("uid", "==", key).where("status", "==", "verified").get(), db.collection(PARTNERS).where("uid", "==", key).get()]);
  const out: ProfileBadge[] = [];
  for (const d of m.docs) {
    const x = d.data() as Membership;
    const badge = TRACK[x.track].members?.badge;
    if (badge) out.push({ label: badge(x.partnerName), href: partnerPath(x.partnerId), kind: "member" });
  }
  for (const d of p.docs) { const x = d.data() as Partner; if (x.status === "active") out.push(partnerBadge({ ...x, id: d.id })); }
  return out.slice(0, 6);
}, 1000);
export async function profileBadges(db: Firestore, uid: string): Promise<ProfileBadge[]> {
  if (!uid || uid.length > 128) return [];
  DB = db;
  return badgesFor(uid);
}

// ── Members of the public: asking a solutions partner for help, joining an association, chapter or workplace ─────────────────────
export async function sendLead(db: Firestore, me: { uid: string; emailVerified: boolean }, partnerId: unknown, b: Record<string, unknown>, now = new Date()): Promise<void> {
  const who = await adult(db, me, "Find an expert");
  const p = (await partnerRef(db, partnerId).get()).data() as Partner | undefined;
  if (!p || p.status !== "active" || p.track !== "solutions") throw new PartnerError(404, "That expert isn't taking requests.");
  if (p.uid === me.uid) throw new PartnerError(400, "That's your own listing.");
  if (!isService(b.service)) throw new PartnerError(400, "Choose what you need help with.");
  if (!isBudget(b.budget)) throw new PartnerError(400, "Choose a budget (or Not sure yet).");
  const message = text(b.message, LIMITS.message, "What you need", 20);
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const mine = await db.collection(LEADS).where("fromUid", "==", me.uid).get();
  if (mine.docs.filter((d) => d.data().createdAt >= since).length >= LEADS_PER_DAY) throw new PartnerError(429, `You can send up to ${LEADS_PER_DAY} requests a day.`);
  if (mine.docs.some((d) => d.data().partnerId === p.id && d.data().status === "new")) throw new PartnerError(409, "You've already sent this expert a request. They'll reply in your messages.");
  const id = randomBytes(8).toString("hex"), at = now.toISOString();
  const lead: Lead = { id, partnerId: p.id, partnerUid: p.uid, fromUid: me.uid, fromUsername: who.username, fromName: who.name, service: b.service, budget: b.budget, message, status: "new", createdAt: at, updatedAt: at };
  await db.doc(`${LEADS}/${id}`).set(lead);
  await notifyBell({ uid: p.uid, type: "partners", linkHref: PORTAL_PATH + "#leads", message: `${NETWORK_NAME}: @${who.username} asked ${p.name} for help. Reply within two working days.` }).catch(() => {});
}

export async function joinPartner(db: Firestore, me: { uid: string; emailVerified: boolean }, partnerId: unknown, b: Record<string, unknown>, now = new Date()): Promise<Membership["status"]> {
  const who = await adult(db, me, NETWORK_NAME);
  const p = (await partnerRef(db, partnerId).get()).data() as Partner | undefined;
  const m = p && TRACK[p.track].members;
  if (!p || p.status !== "active" || !m) throw new PartnerError(404, "You can't join that partner.");
  if (p.uid === me.uid) throw new PartnerError(400, "You run this partner.");
  const ref = db.doc(`${MEMBERS}/${p.id}_${me.uid}`);
  const had = (await ref.get()).data() as Membership | undefined;
  if (had && (had.status === "verified" || had.status === "pending")) throw new PartnerError(409, had.status === "verified" ? "You're already a member." : "Your request is waiting for them.");
  if (had?.status === "removed" || had?.status === "declined") throw new PartnerError(409, `${p.name} didn't confirm you. Contact them if that's a mistake.`);
  let ref_ = String(b.ref ?? "").trim().slice(0, LIMITS.ref);
  // Workplaces: the code is the proof, so staff join at once (and are only ever counted).
  let status: Membership["status"] = "pending";
  if (m.kind === "staff") {
    if (!p.code || ref_.toUpperCase() !== p.code) throw new PartnerError(400, "That workplace code isn't right. Ask your employer for it.");
    status = "verified"; ref_ = "";
  } else if (m.kind === "verified-member" && ref_.length < 2) throw new PartnerError(400, `${m.refLabel} is needed.`);
  // Chapters: members join at once; the lead can remove anyone.
  if (m.kind === "chapter-member") status = "verified";
  const at = now.toISOString();
  const row: Membership = { id: ref.id, partnerId: p.id, partnerUid: p.uid, partnerName: p.name, track: p.track, kind: m.kind, uid: me.uid, username: who.username, name: who.name, ref: ref_, status, createdAt: at, ...(status === "verified" ? { decidedAt: at } : {}) };
  await ref.set(row);
  badgesFor.invalidate(me.uid); directoryCache.invalidate();
  if (m.kind === "verified-member") await notifyBell({ uid: p.uid, type: "partners", linkHref: PORTAL_PATH + "#members", message: `${NETWORK_NAME}: @${who.username} asked to be verified as a member of ${p.name}.` }).catch(() => {});
  return status;
}

export async function leavePartner(db: Firestore, uid: string, partnerId: unknown) {
  const ref = db.doc(`${MEMBERS}/${String(partnerRef(db, partnerId).id)}_${uid}`);
  const had = (await ref.get()).data() as Membership | undefined;
  if (!had || (had.status !== "verified" && had.status !== "pending")) throw new PartnerError(404, "You're not a member.");
  await ref.update({ status: "left", decidedAt: new Date().toISOString() });
  badgesFor.invalidate(uid); directoryCache.invalidate();
}

// ── What a member sees: their applications, partners they run, and partners they belong to ───────────────────────────────────────
export async function mine(db: Firestore, uid: string) {
  const [a, p, m] = await Promise.all([
    db.collection(APPS).where("uid", "==", uid).get(),
    db.collection(PARTNERS).where("uid", "==", uid).get(),
    db.collection(MEMBERS).where("uid", "==", uid).get(),
  ]);
  return {
    applications: a.docs.map((d) => toMine(d.id, d.data() as Application)).sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
    partners: p.docs.map((d) => ({ ...(d.data() as Partner), id: d.id })).map(({ notes: _n, ...x }) => x),
    memberships: m.docs.map((d) => d.data() as Membership).filter((x) => x.status === "verified" || x.status === "pending")
      .map((x) => ({ partnerId: x.partnerId, partnerName: x.partnerName, track: x.track, status: x.status })),
  };
}

// ── The partner portal ────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function ownPartner(db: Firestore, uid: string, id: unknown): Promise<Partner> {
  const p = (await partnerRef(db, id).get()).data() as Partner | undefined;
  if (!p || p.uid !== uid) throw new PartnerError(404, "Partner not found.");
  return { ...p, id: String(id) };
}

export type PortalPartner = Omit<Partner, "notes"> & {
  terms: TierTerms; brought: number; paying: number; members: number;
  leads: Lead[]; requests: Pick<Membership, "uid" | "username" | "name" | "ref" | "createdAt" | "status">[];
  canRequestTier: boolean;
};
export async function portal(db: Firestore, uid: string): Promise<{ partners: PortalPartner[]; terms: Record<Tier, TierTerms> }> {
  const [p, terms, brought, plans] = await Promise.all([
    db.collection(PARTNERS).where("uid", "==", uid).get(), tierTerms(db),
    db.collection("referrals").where("referredBy", "==", uid).count().get(),
    db.collection("referralEarnings").where("uid", "==", uid).where("source", "==", "plan").get(),
  ]);
  const paying = new Set(plans.docs.filter((d) => d.data().status !== "reversed").map((d) => d.data().buyerUid)).size;
  const partners = await Promise.all(p.docs.map(async (d) => {
    const x = { ...(d.data() as Partner), id: d.id };
    const [leads, members] = await Promise.all([
      x.track === "solutions" ? db.collection(LEADS).where("partnerId", "==", x.id).get() : null,
      TRACK[x.track].members ? db.collection(MEMBERS).where("partnerId", "==", x.id).get() : null,
    ]);
    const rows = (members?.docs ?? []).map((m) => m.data() as Membership);
    const verified = rows.filter((m) => m.status === "verified").length;
    const { notes: _n, ...rest } = x;
    const trained = (x.training ?? []).length >= TRAINING.length;
    const counts = paying >= CERTIFY_PAYING || ((x.track === "associations" || x.track === "chapters") && verified >= CERTIFY_MEMBERS);
    return {
      ...rest, terms: terms[x.tier], brought: brought.data().count, paying, members: verified,
      leads: (leads?.docs ?? []).map((l) => l.data() as Lead).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100),
      // Workplaces see a count only. Associations see who asked to be verified, so they can check their register. Chapters see who joined.
      requests: x.track === "workplace" ? [] : rows.filter((m) => m.status === "pending" || m.status === "verified")
        .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.createdAt.localeCompare(a.createdAt)).slice(0, 300)
        .map((m) => ({ uid: m.uid, username: m.username, name: m.name, ref: m.ref, createdAt: m.createdAt, status: m.status })),
      canRequestTier: x.status === "active" && x.tier === "registered" && !x.tierRequestedAt && trained && counts,
    };
  }));
  return { partners, terms };
}

// The partner edits their listing.
export async function updateListing(db: Firestore, uid: string, id: unknown, b: Record<string, unknown>, now = new Date()) {
  const p = await ownPartner(db, uid, id);
  const patch: Record<string, unknown> = { updatedAt: now.toISOString() };
  if (b.blurb !== undefined) patch.blurb = text(b.blurb, LIMITS.blurb, "Your listing", 20);
  if (b.website !== undefined) patch.website = url(b.website, false);
  if (b.countries !== undefined) patch.countries = text(b.countries, LIMITS.country, "Where you work", 2);
  if (b.services !== undefined && p.track === "solutions") { const s = services(b.services); if (!s.length) throw new PartnerError(400, "Choose at least one service."); patch.services = s; }
  if (b.training !== undefined) patch.training = Array.from(new Set((Array.isArray(b.training) ? b.training : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < TRAINING.length))).sort();
  if (b.recommended !== undefined && p.track === "workplace") {
    const names = Array.from(new Set((Array.isArray(b.recommended) ? b.recommended : String(b.recommended).split(/[\s,]+/)).map((u) => String(u).trim().toLowerCase().replace(/^@/, "")).filter(Boolean)));
    if (names.length > LIMITS.recommended) throw new PartnerError(400, `Recommend up to ${LIMITS.recommended} practitioners.`);
    for (const n of names) if (!/^[a-z0-9_-]{2,30}$/.test(n) || !(await db.doc(`usernames/${n}`).get()).exists) throw new PartnerError(400, `@${n} isn't on #NotesApp.`);
    patch.recommended = names;
  }
  if (b.newCode === true && p.track === "workplace") patch.code = newCode();
  await db.doc(`${PARTNERS}/${p.id}`).update(patch);
  directoryCache.invalidate();
}

export async function requestTier(db: Firestore, uid: string, id: unknown, now = new Date()) {
  const p = (await portal(db, uid)).partners.find((x) => x.id === id);
  if (!p) throw new PartnerError(404, "Partner not found.");
  if (!p.canRequestTier) throw new PartnerError(409, "Not yet: finish the training and the progress shown in your portal first.");
  await db.doc(`${PARTNERS}/${p.id}`).update({ tierRequestedAt: now.toISOString(), updatedAt: now.toISOString() });
}

export async function setLeadStatus(db: Firestore, uid: string, leadId: unknown, status: unknown, now = new Date()) {
  if (typeof leadId !== "string" || !ID.test(leadId)) throw new PartnerError(404, "Request not found.");
  if (!isLeadStatus(status)) throw new PartnerError(400, "Choose a status.");
  const ref = db.doc(`${LEADS}/${leadId}`);
  const l = (await ref.get()).data() as Lead | undefined;
  if (!l || l.partnerUid !== uid) throw new PartnerError(404, "Request not found.");
  await ref.update({ status, updatedAt: now.toISOString() });
}

// An association or chapter decides on a member: verify, decline, or remove.
export async function decideMember(db: Firestore, uid: string, partnerId: unknown, memberUid: unknown, decision: unknown, now = new Date()) {
  const p = await ownPartner(db, uid, partnerId);
  const kind = TRACK[p.track].members?.kind;
  if (!kind || kind === "staff") throw new PartnerError(400, "Workplaces don't manage members one by one.");
  if (typeof memberUid !== "string" || memberUid.length > 128) throw new PartnerError(404, "Member not found.");
  const ref = db.doc(`${MEMBERS}/${p.id}_${memberUid}`);
  const m = (await ref.get()).data() as Membership | undefined;
  if (!m) throw new PartnerError(404, "Member not found.");
  const to = decision === "verify" ? "verified" : decision === "decline" ? "declined" : decision === "remove" ? "removed" : null;
  if (!to) throw new PartnerError(400, "Verify, decline or remove.");
  if (to === "verified" && m.status !== "pending") throw new PartnerError(409, "Only a waiting request can be verified.");
  if (to === "declined" && m.status !== "pending") throw new PartnerError(409, "Only a waiting request can be declined.");
  if (to === "removed" && m.status !== "verified") throw new PartnerError(409, "Only a member can be removed.");
  await ref.update({ status: to, decidedAt: now.toISOString() });
  badgesFor.invalidate(m.uid); directoryCache.invalidate();
  if (to === "verified") await notifyBell({ uid: m.uid, type: "partners", linkHref: partnerPath(p.id), message: `${p.name} verified you as a member. The badge is on your profile now.` }).catch(() => {});
  if (to === "declined") await notifyBell({ uid: m.uid, type: "partners", linkHref: partnerPath(p.id), message: `${p.name} couldn't confirm your membership. Contact them if that's a mistake.` }).catch(() => {});
}

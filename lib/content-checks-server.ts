import { createHash, randomBytes } from "crypto";
import { FieldValue, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import {
  CHECK_DEFAULTS, ContentCheckError, KIND_LABEL, activeStrikes, afterStrike, blockedMessage, blockedTitle, cleanCheckSettings, communityStep,
  dayWords, decide, excerpt, findingWords, heldMessage, markdownImages, pausedMessage, postingPausedUntil,
  type CheckSettings, type ContentKind, type Decision, type Finding, type Standing, type Strike,
} from "./content-checks";
import { CheckerRefused, realCheck, streamFrames, type CheckItem } from "./content-checks-ai";
import { moderationMessage } from "./moderation-messages";

// AI content checks on the server (the rules are lib/content-checks.ts; docs/CONTENT_CHECKS.md has the plan and the owner's decisions).
//
// Every create or update path that publishes something other people see calls `gateContent` before it writes: journals (through a
// check pass, below), comments on journals, communities and their posts and comments, Moments, Media posts, shop items, events and
// profiles. Private 1:1 and group messages never come here. The gate:
//   1. refuses while the member's posting is paused (or the account is closed for content), or the community is closed;
//   2. checks only new or changed items (each item's answer is kept in contentCheckCache by a hash of the text or picture link);
//   3. passes, holds for a person (borderline: under the block level, or news, medical and art in context), blocks with a strike, or, for
//      child sexual abuse material, closes the account, reports it to the Legal team's queue and tells the owner;
//   4. when the checker can't answer (no key, an error, a timeout) it does NOT block: the post is published, and a `queued` flag is kept so
//      the scheduled re-check (recheckQueued, in /api/cron/reminders) checks it later and takes it down if it breaks the rules.
// Collections (all server-only, firestore.rules): contentCheckSettings (Admin's figures), contentFlags (every hold, block, re-check and
// appeal), contentStanding/{uid} (strikes and pauses), contentCheckCache, contentCheckStats/{day}, contentPasses (proof a browser write
// was checked: firestore.rules ask for one when a journal is published or a shop item or profile changes), communityChecks/{cid} and
// legalQueue (child-safety reports for the Legal team).

export type VideoRef = { streamUid: string; durationSec?: number; signed?: boolean };
export type CheckerDeps = { check: (items: CheckItem[]) => Promise<Finding[]>; frames: (v: VideoRef) => Promise<string[]>; now: () => Date };
const realDeps: CheckerDeps = { check: realCheck, frames: streamFrames, now: () => new Date() };
let injected: CheckerDeps | null = null;
// Tests replace the checker (and the clock) here; null puts the real ones back.
export function setContentCheckDeps(d: Partial<CheckerDeps> | null) { injected = d ? { ...realDeps, ...d } : null; }
const deps = () => injected ?? realDeps;

export class ContentAdminError extends Error { constructor(public status: number, message: string) { super(message); } }

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const SETTINGS = "contentCheckSettings/current";
let cached: { at: number; s: CheckSettings } | null = null;
export async function getCheckSettings(db: Firestore): Promise<CheckSettings> {
  if (cached && Date.now() - cached.at < 60_000) return cached.s;
  const c = cleanCheckSettings((await db.doc(SETTINGS).get()).data() ?? {}, CHECK_DEFAULTS);
  const s = typeof c === "string" ? CHECK_DEFAULTS : c;
  cached = { at: Date.now(), s };
  return s;
}
export const forgetCheckSettings = () => { cached = null; };
export async function saveCheckSettings(db: Firestore, input: unknown, by: string): Promise<CheckSettings> {
  forgetCheckSettings();
  const c = cleanCheckSettings(input, await getCheckSettings(db));
  if (typeof c === "string") throw new ContentAdminError(400, c);
  await db.doc(SETTINGS).set({ ...c, updatedBy: by, updatedAt: new Date().toISOString() });
  forgetCheckSettings();
  return c;
}

// ── Small helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
type StatKey = "checked" | "passed" | "blocked" | "held" | "queued" | "strikes" | "suspended" | "banned" | "overturned" | "kept";
async function bump(db: Firestore, now: Date, f: Partial<Record<StatKey, number>>) {
  const inc = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, FieldValue.increment(v ?? 0)]));
  await db.doc(`contentCheckStats/${dayKey(now)}`).set({ day: dayKey(now), ...inc }, { merge: true }).catch(() => {});
}
type Item = CheckItem & { key?: string };
const hashOf = (it: Item) => createHash("sha256").update(it.key ?? (it.url !== undefined ? `i:${it.url}` : `t:${it.text}`)).digest("hex");
async function bell(db: Firestore, uid: string, type: string, message: string, linkHref = "/profile/account#content-checks", now = new Date()) {
  await db.collection("notifications").add({ recipientUid: uid, type, message: message.slice(0, 280), linkHref, read: false, createdAt: now.toISOString() }).catch(() => {});
}

// ── The gate ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type GateInput = {
  uid: string;
  kind: ContentKind;
  label: string; // what the queue shows: a title or the opening words
  text?: string;
  pictures?: string[]; // links
  videos?: VideoRef[];
  where?: { cid?: string; href?: string };
  path?: string; // the document this content is (or will be) in
  restore?: { set?: DocumentData; update?: DocumentData }; // what "Restore" writes to `path` (publishing it)
  takedown?: { update?: DocumentData; delete?: boolean }; // what a later re-check does to `path` when it breaks the rules
  passId?: string;
};
export type GateResult = { status: "pass" | "queued" | "off"; flagId?: string };

async function buildItems(input: Pick<GateInput, "text" | "pictures" | "videos">, d: CheckerDeps): Promise<Item[]> {
  const items: Item[] = [];
  const text = (input.text ?? "").trim();
  if (text) items.push({ name: "text", text });
  const pics = Array.from(new Set((input.pictures ?? []).map((p) => String(p ?? "").trim()).filter(Boolean))).slice(0, 12);
  pics.forEach((url, i) => items.push({ name: `picture ${i + 1}`, url }));
  for (const [i, v] of (input.videos ?? []).slice(0, 4).entries()) {
    const frames = await d.frames(v).catch(() => [] as string[]);
    frames.slice(0, 5).forEach((url, j) => items.push({ name: `video ${i + 1}`, url, key: `v:${v.streamUid}:${j}` }));
  }
  return items;
}

// Each item's own findings (`item` left off), so the same text or picture is never checked twice.
async function saveCache(db: Firestore, items: Item[], findings: Finding[], now: Date) {
  const batch = db.batch();
  for (const it of items) {
    const mine = findings.filter((f) => f.item === it.name).map(({ category, confidence, reason, context }) => ({ category, confidence, reason, context }));
    batch.set(db.doc(`contentCheckCache/${hashOf(it)}`), { findings: mine, at: now.toISOString(), expireAt: new Date(now.getTime() + 180 * 86_400_000) });
  }
  await batch.commit().catch(() => {});
}

async function findingsFor(db: Firestore, items: Item[], d: CheckerDeps, now: Date): Promise<{ findings: Finding[]; down: boolean }> {
  const hashes = items.map(hashOf);
  const snaps = await db.getAll(...Array.from(new Set(hashes)).map((h) => db.doc(`contentCheckCache/${h}`)));
  const known = new Map(snaps.filter((x) => x.exists).map((x) => [x.id, x.data()!]));
  const findings: Finding[] = [];
  const todo: Item[] = [];
  items.forEach((it, i) => {
    const c = known.get(hashes[i]);
    if (c) findings.push(...((c.findings ?? []) as Omit<Finding, "item">[]).map((f) => ({ ...f, item: it.name })));
    else todo.push(it);
  });
  if (!todo.length) return { findings, down: false };
  try {
    const got = await d.check(todo.map(({ key: _k, ...it }) => it as CheckItem));
    findings.push(...got);
    await saveCache(db, todo, got, now);
    return { findings, down: false };
  } catch (e) {
    if (e instanceof CheckerRefused || (e instanceof Error && e.name === "CheckerRefused")) {
      findings.push({ category: "unclear", confidence: 1, item: todo[0].name, reason: "The check declined to look at this.", context: "none" });
      return { findings, down: false };
    }
    return { findings, down: true };
  }
}

export async function gateContent(db: Firestore, input: GateInput): Promise<GateResult> {
  const d = deps();
  const now = d.now();
  if (input.where?.cid) {
    const c = (await db.doc(`communities/${input.where.cid}`).get()).data();
    if (c?.closedForRules === true) throw new ContentCheckError(403, { outcome: "paused", title: "This community is closed", message: "This community was closed because posts that break the rules kept being published in it. Its owner can ask for a review." });
  }
  const s = await getCheckSettings(db);
  if (!s.enabled) return { status: "off" };
  const st = (await db.doc(`contentStanding/${input.uid}`).get()).data() as Standing | undefined;
  if (st?.banned) throw new ContentCheckError(403, { outcome: "banned", title: "Posting is closed on this account", message: "Posting is closed on this account because posts broke the rules again after a suspension. You can appeal on your account page." });
  const until = postingPausedUntil(st, now);
  if (until) throw new ContentCheckError(403, { outcome: "paused", title: "Posting is paused", message: pausedMessage(until), until });
  const items = await buildItems(input, d);
  if (!items.length) return { status: "pass" };
  const user = (await db.doc(`users/${input.uid}`).get()).data() ?? {};
  const teen = user.teen === true;
  const { findings, down } = await findingsFor(db, items, d, now);
  const decision = decide(findings, { teen, settings: s });
  await bump(db, now, { checked: 1 });
  if (decision.outcome === "pass") {
    if (!down) { await bump(db, now, { passed: 1 }); return { status: "pass" }; }
    const flagId = await newFlag(db, input, user, items, findings, { status: "queued", outcome: "pass" }, now);
    await bump(db, now, { queued: 1 });
    return { status: "queued", flagId };
  }
  return act(db, input, user, items, findings, decision, s, now);
}

async function newFlag(db: Firestore, input: GateInput, user: DocumentData, items: Item[], findings: Finding[], o: { status: string; outcome: string; finding?: Finding; legal?: boolean }, now: Date): Promise<string> {
  const ref = db.collection("contentFlags").doc();
  await ref.set({
    uid: input.uid, username: String(user.username ?? ""), teen: user.teen === true, kind: input.kind, label: excerpt(input.label || input.text || "", 120),
    ...(input.where ? { where: input.where } : {}), ...(input.path ? { path: input.path } : {}), ...(input.restore ? { restore: input.restore } : {}),
    ...(input.takedown ? { takedown: input.takedown } : {}), ...(input.passId ? { passId: input.passId } : {}), ...(input.videos?.length ? { videos: input.videos } : {}),
    items: items.map((it) => (it.url !== undefined ? { name: it.name, url: it.url, ...(it.key ? { key: it.key } : {}) } : { name: it.name, text: it.text.slice(0, 4000) })),
    findings: findings.filter((f) => f.category !== "none"), ...(o.finding ? { finding: o.finding } : {}),
    outcome: o.outcome, status: o.status, strike: false, legal: o.legal === true, attempts: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  });
  return ref.id;
}

const urlOf = (items: Item[], name?: string) => items.find((i) => i.name === name && i.url !== undefined)?.url;

async function act(db: Firestore, input: GateInput, user: DocumentData, items: Item[], findings: Finding[], decision: Decision, s: CheckSettings, now: Date): Promise<never> {
  const f = decision.finding!;
  const url = urlOf(items, f.item);
  if (decision.outcome === "csam") {
    const flagId = await newFlag(db, input, user, items, findings, { status: "csam", outcome: "csam", finding: f, legal: true }, now);
    await childSafety(db, input.uid, flagId, now);
    throw new ContentCheckError(403, { outcome: "banned", title: "This can't be posted", message: "This can't be posted, and the account has been closed under our child safety rules. If you think this is a mistake, contact us." });
  }
  if (decision.outcome === "hold" || decision.outcome === "csam_review") {
    const legal = decision.outcome === "csam_review";
    const flagId = await newFlag(db, input, user, items, findings, { status: "held", outcome: "hold", finding: f, legal }, now);
    if (legal) await db.collection("legalQueue").doc(flagId).set({ flagId, uid: input.uid, kind: input.kind, status: "open", ban: false, createdAt: now.toISOString() });
    await bump(db, now, { held: 1 });
    throw new ContentCheckError(422, { outcome: "held", title: "A person will look at this first", message: heldMessage(legal ? { ...f, category: "unclear" } : f), flagId, category: legal ? "unclear" : f.category, item: f.item, ...(url ? { url } : {}) });
  }
  const flagId = await newFlag(db, input, user, items, findings, { status: "blocked", outcome: "block", finding: f }, now);
  await bump(db, now, { blocked: 1 });
  const r = await recordStrike(db, input.uid, flagId, f, input.kind, input.where?.cid, s, now);
  const strike = { n: r.n, of: s.strikesToSuspend, windowDays: s.windowDays };
  throw new ContentCheckError(422, {
    outcome: "blocked", title: blockedTitle(f.item), message: blockedMessage(f, strike, r.consequence, r.until), flagId, category: f.category, item: f.item,
    ...(url ? { url } : {}), strike, ...(r.until ? { until: r.until } : {}),
  });
}

// ── Strikes, pauses and bans ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function recordStrike(db: Firestore, uid: string, flagId: string, f: Finding, kind: ContentKind, cid: string | undefined, s: CheckSettings, now: Date): Promise<{ n: number; consequence: "none" | "suspend" | "ban"; until?: string }> {
  const ref = db.doc(`contentStanding/${uid}`);
  const at = now.toISOString();
  const r = await db.runTransaction(async (t) => {
    const st = ((await t.get(ref)).data() as Standing | undefined) ?? { strikes: [] };
    const strikes: Strike[] = [...(st.strikes ?? []).filter((x) => x.flagId !== flagId), { flagId, at, category: f.category, kind }];
    const next: Standing = { ...st, strikes };
    const consequence = afterStrike(next, now, s);
    let until: string | undefined;
    if (consequence === "suspend") {
      until = new Date(now.getTime() + s.suspendDays * 86_400_000).toISOString();
      Object.assign(next, { postingSuspendedUntil: until, suspensions: (st.suspensions ?? 0) + 1, lastSuspendedAt: at });
    }
    if (consequence === "ban") next.banned = true;
    t.set(ref, next);
    return { n: activeStrikes(strikes, now, s.windowDays).length, consequence, until };
  });
  await db.doc(`contentFlags/${flagId}`).update({ strike: true, updatedAt: at });
  await bump(db, now, { strikes: 1, ...(r.consequence === "suspend" ? { suspended: 1 } : r.consequence === "ban" ? { banned: 1 } : {}) });
  const what = `Your ${KIND_LABEL[kind]} wasn't published: our check found ${findingWords(f)}.`;
  if (r.consequence === "suspend") await bell(db, uid, "suspended", `${what} Posting is paused on your account until ${dayWords(r.until!)}. You can still read and message, and you can appeal.`, undefined, now);
  else if (r.consequence === "ban") await closeAccount(db, uid, "Content checks: a post broke the rules again after a suspension", now);
  else await bell(db, uid, "content_check", `${what} This is a strike. You can ask for a review.`, undefined, now);
  if (cid) await communityStrike(db, uid, cid, flagId, s, now).catch((e) => console.error("[content-checks] community step failed", e));
  return r;
}

// A ban uses the existing suspension records (lib/moderation.ts, lib/reports-server.ts): the private suspensions/{uid} with the reason,
// `suspended` on the profile, and the bell. The member can appeal it from their profile, as for any suspension.
async function closeAccount(db: Firestore, uid: string, reason: string, now: Date) {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u) return;
  await db.doc(`suspensions/${uid}`).set({ reason, suspendedAt: now.toISOString(), suspendedByUid: "content-checks", appealStatus: "none" });
  await db.doc(`users/${uid}`).update({ suspended: true });
  await bell(db, uid, "suspended", moderationMessage.suspended(reason), `/u/${String(u.username ?? "")}`, now);
}

// Child sexual abuse material: an instant permanent ban, the Legal team's queue (they report it to NCMEC and the authorities:
// docs/CONTENT_CHECKS.md, owner steps), and nothing published.
async function childSafety(db: Firestore, uid: string, flagId: string, now: Date) {
  await db.collection("legalQueue").doc(flagId).set({ flagId, uid, status: "open", ban: true, createdAt: now.toISOString() });
  await db.doc(`contentStanding/${uid}`).set({ banned: true, csam: true }, { merge: true });
  await closeAccount(db, uid, "Child safety: content that breaks our child safety rules", now);
  await bump(db, now, { banned: 1, blocked: 1 });
}

// A community is closed only when its owner or moderators keep posting (or approving) rule-breaking content: at the Admin figure, its
// owner and moderators are warned first; the next time it is closed, and its owner can ask for a review.
async function communityStrike(db: Firestore, uid: string, cid: string, flagId: string, s: CheckSettings, now: Date) {
  const role = String((await db.doc(`communityMembers/${cid}_${uid}`).get()).data()?.role ?? "");
  if (!["owner", "admin", "moderator"].includes(role)) return;
  const ref = db.doc(`communityChecks/${cid}`);
  const cur = (await ref.get()).data() ?? {};
  const strikes = [...((cur.strikes ?? []) as { at: string; flagId: string }[]), { at: now.toISOString(), flagId }]
    .filter((x) => now.getTime() - Date.parse(x.at) < s.windowDays * 86_400_000);
  const step = communityStep(strikes.length, !!cur.warnedAt, s.communityStrikes);
  await ref.set({ cid, strikes, ...(step === "warn" ? { warnedAt: now.toISOString() } : {}), ...(step === "close" ? { closedAt: now.toISOString() } : {}) }, { merge: true });
  if (step === "none") return;
  const c = (await db.doc(`communities/${cid}`).get()).data() ?? {};
  const staff = await db.collection("communityMembers").where("cid", "==", cid).where("role", "in", ["owner", "admin", "moderator"]).get();
  if (step === "warn") {
    await db.doc(`communities/${cid}`).update({ rulesWarning: now.toISOString() });
    for (const m of staff.docs) await bell(db, String(m.data().uid), "community", `${String(c.name ?? "Your community")}: posts by its owner or moderators broke the rules. If it keeps happening, the community will be closed.`, `/c/${cid}?tab=about`, now);
    return;
  }
  await db.doc(`communities/${cid}`).update({ closedForRules: true, closedAt: now.toISOString() });
  const owner = String(c.ownerUid ?? "");
  const f = db.collection("contentFlags").doc();
  await f.set({
    uid: owner, username: "", kind: "community", label: String(c.name ?? cid), where: { cid }, path: `communities/${cid}`, restore: { update: { closedForRules: false } },
    items: [], findings: [], outcome: "close", status: "blocked", strike: false, legal: false, attempts: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  });
  for (const m of staff.docs) await bell(db, String(m.data().uid), "community", `${String(c.name ?? "Your community")} was closed: rule-breaking posts kept being published there after a warning.${String(m.data().uid) === owner ? " You can ask for a review on your account page." : ""}`, "/profile/account#content-checks", now);
}

async function removeStrike(db: Firestore, uid: string, flagId: string, s: CheckSettings, now: Date): Promise<void> {
  const ref = db.doc(`contentStanding/${uid}`);
  const lift = await db.runTransaction(async (t) => {
    const st = (await t.get(ref)).data() as Standing | undefined;
    if (!st) return false;
    const strikes = (st.strikes ?? []).map((x) => (x.flagId === flagId ? { ...x, removed: true } : x));
    const next: Standing & Record<string, unknown> = { ...st, strikes };
    const latest = [...(st.strikes ?? [])].filter((x) => !x.removed).sort((a, b) => a.at.localeCompare(b.at)).pop();
    let liftBan = false;
    if (postingPausedUntil(st, now) && activeStrikes(strikes, now, s.windowDays).length < s.strikesToSuspend) {
      delete next.postingSuspendedUntil;
      next.suspensions = Math.max(0, (st.suspensions ?? 1) - 1);
    }
    if (st.banned && !(st as { csam?: boolean }).csam && latest?.flagId === flagId) { next.banned = false; liftBan = true; }
    t.set(ref, next);
    return liftBan;
  });
  if (lift) {
    const sus = (await db.doc(`suspensions/${uid}`).get()).data();
    if (sus?.suspendedByUid === "content-checks") {
      await db.doc(`suspensions/${uid}`).update({ appealStatus: "upheld", resolvedAt: now.toISOString(), resolvedByUid: "content-checks" });
      await db.doc(`users/${uid}`).update({ suspended: false });
    }
  }
}

// ── Reviews (Admin → Reports → Content checks) ─────────────────────────────────────────────────────────────────────────────────
// Restore: publishes it (the stored write, or for a shop item or profile, clears it so saving again goes straight through) and removes
// the strike. Keep: a held item becomes a block with a strike; an appeal is refused and the strike stays.
export async function reviewFlag(db: Firestore, adminUid: string, id: string, action: unknown, note: unknown, opts: { legal?: boolean } = {}): Promise<void> {
  const now = deps().now();
  const ref = db.doc(`contentFlags/${String(id)}`);
  const f = (await ref.get()).data();
  if (!f) throw new ContentAdminError(404, "That item wasn't found.");
  if ((f.legal || f.status === "csam") && !opts.legal) throw new ContentAdminError(403, "Only the Legal team decides child-safety items.");
  if (!["held", "blocked", "appealed", "queued", "csam"].includes(String(f.status))) throw new ContentAdminError(409, "That item has already been decided.");
  const s = await getCheckSettings(db);
  const resolved = { resolvedBy: adminUid, resolvedAt: now.toISOString(), updatedAt: now.toISOString(), ...(typeof note === "string" && note.trim() ? { note: note.trim().slice(0, 500) } : {}) };
  if (action === "restore") {
    let published = false;
    if (f.path && f.restore) {
      if (f.restore.set) await db.doc(String(f.path)).set(f.restore.set);
      else if (f.restore.update) await db.doc(String(f.path)).update(f.restore.update);
      published = true;
    }
    // The same text or picture goes straight through next time.
    const batch = db.batch();
    for (const it of (f.items ?? []) as Item[]) batch.set(db.doc(`contentCheckCache/${hashOf(it)}`), { findings: [], cleared: true, by: adminUid, at: now.toISOString() });
    await batch.commit();
    if (f.strike) await removeStrike(db, String(f.uid), ref.id, s, now);
    if (f.status === "csam") {
      await db.doc(`contentStanding/${f.uid}`).set({ banned: false, csam: false }, { merge: true });
      const sus = (await db.doc(`suspensions/${f.uid}`).get()).data();
      if (sus?.suspendedByUid === "content-checks") { await db.doc(`suspensions/${f.uid}`).update({ appealStatus: "upheld", resolvedAt: now.toISOString(), resolvedByUid: adminUid }); await db.doc(`users/${f.uid}`).update({ suspended: false }); }
      await db.doc(`legalQueue/${ref.id}`).set({ status: "cleared", resolvedBy: adminUid, resolvedAt: now.toISOString() }, { merge: true });
    }
    await ref.update({ status: "restored", ...resolved });
    await bump(db, now, { overturned: f.strike || f.status === "appealed" ? 1 : 0 });
    const what = f.kind === "community" ? `${String(f.label)} is open again` : `A person looked again at your ${KIND_LABEL[f.kind as ContentKind] ?? "post"} and it's fine`;
    await bell(db, String(f.uid), "content_check", `${what}${f.kind === "community" ? "." : published ? ": it's published now." : ": save it again and it will go straight through."}${f.strike ? " The strike is removed." : ""}`, undefined, now);
    return;
  }
  if (action !== "keep") throw new ContentAdminError(400, "Restore or keep?");
  if (f.status === "held" && !f.legal) {
    await ref.update({ status: "blocked", ...resolved });
    const finding = (f.finding as Finding | undefined) ?? { category: "unclear", confidence: 1, item: "text", reason: "", context: "none" };
    await recordStrike(db, String(f.uid), ref.id, finding, f.kind as ContentKind, f.where?.cid, s, now);
    await bump(db, now, { kept: 1, blocked: 1 });
    return;
  }
  await ref.update({ status: "kept", ...resolved, ...(f.appeal ? { "appeal.status": "rejected" } : {}) });
  await bump(db, now, { kept: 1 });
  if (f.status === "appealed") await bell(db, String(f.uid), "content_check", `A person looked again at your ${KIND_LABEL[f.kind as ContentKind] ?? "post"}: it stays unpublished, and the strike stays.`, undefined, now);
}

// The Legal team marks a child-safety item reported (with the report's reference), or not child sexual abuse material (restores).
export async function legalStep(db: Firestore, adminUid: string, id: string, step: unknown, reference: unknown): Promise<void> {
  const now = deps().now();
  const ref = db.doc(`legalQueue/${String(id)}`);
  if (!(await ref.get()).exists) throw new ContentAdminError(404, "That item wasn't found.");
  if (step === "reported") {
    const r = typeof reference === "string" ? reference.trim().slice(0, 120) : "";
    if (!r) throw new ContentAdminError(400, "Add the report's reference number.");
    await ref.update({ status: "reported", reference: r, reportedBy: adminUid, reportedAt: now.toISOString() });
    return;
  }
  if (step === "not_csam") return reviewFlag(db, adminUid, id, "restore", "Legal: not child sexual abuse material", { legal: true });
  if (step === "keep") return reviewFlag(db, adminUid, id, "keep", "Legal: kept", { legal: true });
  throw new ContentAdminError(400, "Reported, keep, or not child sexual abuse material?");
}

// ── Appeals (the member) ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const appealText = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  if (t.length > 1000) throw new ContentAdminError(413, "An appeal can be up to 1,000 characters.");
  return t;
};
export async function appealFlag(db: Firestore, uid: string, id: unknown, text: unknown): Promise<void> {
  const now = deps().now();
  const ref = db.doc(`contentFlags/${String(id ?? "")}`);
  const f = (await ref.get()).data();
  if (!f || f.uid !== uid) throw new ContentAdminError(404, "That wasn't found.");
  if (f.status === "held" || f.status === "appealed") throw new ContentAdminError(409, "A person is already looking at this.");
  if (f.status !== "blocked") throw new ContentAdminError(409, "This has already been decided.");
  await ref.update({ status: "appealed", appeal: { text: appealText(text), at: now.toISOString(), status: "pending" }, updatedAt: now.toISOString() });
}
export async function appealSuspension(db: Firestore, uid: string, text: unknown): Promise<void> {
  const now = deps().now();
  const s = await getCheckSettings(db);
  const st = (await db.doc(`contentStanding/${uid}`).get()).data() as Standing | undefined;
  if (!st || (!postingPausedUntil(st, now) && !st.banned)) throw new ContentAdminError(409, "Your posting isn't paused.");
  if (st.appeal?.status === "pending") throw new ContentAdminError(409, "You've already appealed. A person will look at it within 48 hours.");
  const t = appealText(text);
  await db.doc(`contentStanding/${uid}`).set({ appeal: { text: t, at: now.toISOString(), status: "pending" } }, { merge: true });
  for (const x of activeStrikes(st.strikes ?? [], now, s.windowDays)) {
    const ref = db.doc(`contentFlags/${x.flagId}`);
    const f = (await ref.get()).data();
    if (f?.status === "blocked") await ref.update({ status: "appealed", appeal: { text: t, at: now.toISOString(), status: "pending" }, updatedAt: now.toISOString() });
  }
}

// ── What the member sees (their account page) ─────────────────────────────────────────────────────────────────────────────────
export type MyItem = { id: string; kind: string; label: string; category: string; item: string; at: string; status: string; strike: boolean; active: boolean; appealed: boolean };
export async function myChecks(db: Firestore, uid: string) {
  const now = deps().now();
  const s = await getCheckSettings(db);
  const [st, flags] = await Promise.all([
    db.doc(`contentStanding/${uid}`).get().then((d) => d.data() as Standing | undefined),
    db.collection("contentFlags").where("uid", "==", uid).limit(100).get(),
  ]);
  const active = new Set(activeStrikes(st?.strikes ?? [], now, s.windowDays).map((x) => x.flagId));
  const items: MyItem[] = flags.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DocumentData & { id: string })
    .filter((f) => f.status !== "queued" && f.status !== "cleared" && f.status !== "csam" && now.getTime() - Date.parse(f.createdAt) < Math.max(s.windowDays, 30) * 86_400_000)
    .map((f) => ({ id: f.id, kind: String(f.kind), label: String(f.label ?? ""), category: String(f.finding?.category ?? (f.kind === "community" ? "community" : "")), item: String(f.finding?.item ?? ""), at: String(f.createdAt), status: String(f.status), strike: f.strike === true, active: active.has(f.id), appealed: !!f.appeal }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return {
    pausedUntil: postingPausedUntil(st, now), banned: st?.banned === true, appeal: st?.appeal ?? null,
    activeStrikes: active.size, strikesToSuspend: s.strikesToSuspend, windowDays: s.windowDays, items,
  };
}

// ── Admin overview ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function adminOverview(db: Firestore, opts: { legal: boolean }) {
  const now = deps().now();
  const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - i * 86_400_000)));
  const [stats, held, appealed, queued, legal] = await Promise.all([
    db.getAll(...days.map((d) => db.doc(`contentCheckStats/${d}`))),
    db.collection("contentFlags").where("status", "==", "held").limit(100).get(),
    db.collection("contentFlags").where("status", "==", "appealed").limit(100).get(),
    db.collection("contentFlags").where("status", "==", "queued").count().get(),
    opts.legal ? db.collection("legalQueue").where("status", "==", "open").limit(100).get() : Promise.resolve(null),
  ]);
  const sum = (k: StatKey) => stats.reduce((n, d) => n + Number(d.data()?.[k] ?? 0), 0);
  const today = stats[0].data() ?? {};
  const row = (d: FirebaseFirestore.QueryDocumentSnapshot) => {
    const f = d.data();
    return { id: d.id, uid: f.uid, username: f.username, kind: f.kind, label: f.label, status: f.status, strike: f.strike === true, teen: f.teen === true, finding: f.finding ?? null, where: f.where ?? null, createdAt: f.createdAt, appeal: f.appeal ?? null, items: f.items ?? [], legal: f.legal === true };
  };
  const queue = [...held.docs, ...appealed.docs].map(row).filter((r) => opts.legal || !r.legal).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return {
    today: { checked: Number(today.checked ?? 0), blocked: Number(today.blocked ?? 0), held: Number(today.held ?? 0), queued: Number(today.queued ?? 0) },
    week: { strikes: sum("strikes"), suspended: sum("suspended"), banned: sum("banned"), overturned: sum("overturned") },
    waitingRecheck: queued.data().count,
    queue,
    legal: legal ? legal.docs.map((d) => ({ id: d.id, ...d.data() })) : null,
    settings: await getCheckSettings(db),
  };
}

// ── The re-check (cron): items published while the checker couldn't answer ──────────────────────────────────────────────────────
export async function recheckQueued(db: Firestore, max = 20): Promise<number> {
  const d = deps();
  const now = d.now();
  const s = await getCheckSettings(db);
  if (!s.enabled) return 0;
  const snap = await db.collection("contentFlags").where("status", "==", "queued").limit(max).get();
  let done = 0;
  for (const doc of snap.docs) {
    const f = doc.data();
    const stored = ((f.items ?? []) as Item[]).filter((i) => !i.key);
    const items: Item[] = [...stored, ...(await buildItems({ videos: f.videos ?? [] }, d))];
    const { findings, down } = await findingsFor(db, items, d, now);
    if (down) {
      const attempts = Number(f.attempts ?? 0) + 1;
      // After about a day of failures a person looks instead.
      await doc.ref.update(attempts >= 100 ? { attempts, status: "held", updatedAt: now.toISOString() } : { attempts, updatedAt: now.toISOString() });
      continue;
    }
    done++;
    const decision = decide(findings, { teen: f.teen === true, settings: s });
    if (decision.outcome === "pass") { await doc.ref.update({ status: "cleared", findings, updatedAt: now.toISOString() }); continue; }
    await takeDown(db, doc.id, f, decision.finding!);
    const finding = decision.finding!;
    if (decision.outcome === "csam") {
      await doc.ref.update({ status: "csam", outcome: "csam", legal: true, finding, findings, updatedAt: now.toISOString() });
      await childSafety(db, String(f.uid), doc.id, now);
    } else if (decision.outcome === "hold" || decision.outcome === "csam_review") {
      const legal = decision.outcome === "csam_review";
      await doc.ref.update({ status: "held", outcome: "hold", legal, finding, findings, updatedAt: now.toISOString() });
      if (legal) await db.collection("legalQueue").doc(doc.id).set({ flagId: doc.id, uid: f.uid, kind: f.kind, status: "open", ban: false, createdAt: now.toISOString() });
      await bump(db, now, { held: 1 });
      await bell(db, String(f.uid), "content_check", `Your ${KIND_LABEL[f.kind as ContentKind] ?? "post"} was taken down while a person looks at it: our check wasn't sure about it. It isn't a strike.`, undefined, now);
    } else {
      await doc.ref.update({ status: "blocked", outcome: "block", finding, findings, updatedAt: now.toISOString() });
      await bump(db, now, { blocked: 1 });
      await recordStrike(db, String(f.uid), doc.id, finding, f.kind as ContentKind, f.where?.cid, s, now);
    }
  }
  return done;
}

const PASS_COLLECTION: Partial<Record<ContentKind, string>> = { journal: "notes", store_item: "storeItems" };
// Takes down something published before it could be checked: the stored instruction for server-written content, or for a journal or
// shop item saved from a browser, the document carrying that check pass (a journal goes back to drafts, a shop item is removed and kept
// so Restore can put it back), or for a profile, the name and bio or the picture.
async function takeDown(db: Firestore, id: string, f: DocumentData, finding: Finding) {
  let path = f.path ? String(f.path) : "";
  const col = PASS_COLLECTION[f.kind as ContentKind];
  if (!path && f.passId && col) {
    const q = await db.collection(col).where("checkPass", "==", f.passId).limit(1).get();
    if (!q.empty) path = q.docs[0].ref.path;
  }
  if (!path && f.kind === "profile") path = `users/${f.uid}`;
  if (!path) return;
  const ref = db.doc(path);
  const cur = (await ref.get()).data();
  if (!cur) return;
  if (f.kind === "journal") { await ref.update({ status: "draft" }); await db.doc(`contentFlags/${id}`).update({ path, restore: { update: { status: "published" } } }); return; }
  if (f.kind === "profile") {
    const patch = finding.item.startsWith("picture") ? { avatar: "" } : { bio: "" };
    await ref.update(patch);
    await db.doc(`contentFlags/${id}`).update({ path, restore: { update: finding.item.startsWith("picture") ? { avatar: cur.avatar ?? "" } : { bio: cur.bio ?? "" } } });
    return;
  }
  if (f.takedown?.update) { await ref.update(f.takedown.update); return; }
  // Removed, and kept on the item so Restore can put it back.
  await ref.delete();
  await db.doc(`contentFlags/${id}`).update({ path, restore: { set: cur } });
}

// ── Check passes (journals, shop items and profiles are saved from the browser) ─────────────────────────────────────────────────
// The browser asks for a pass with what it is about to save; firestore.rules then accept the write only with a pass for exactly that
// title, text and pictures (contentPasses/{id}, an hour). A journal is checked as saved: the editor saves a draft first, then publishes
// with the pass, so a blocked or held journal simply stays a draft.
// A journal's words without its picture links (the pictures are checked as pictures).
const withoutPictures = (md: string) => md.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
const str = (v: unknown, max: number) => (typeof v === "string" ? v : "").slice(0, max);
export async function issuePass(db: Firestore, uid: string, kind: unknown, body: Record<string, unknown>): Promise<{ passId: string | null; status: GateResult["status"] }> {
  const now = deps().now();
  let fields: Record<string, unknown>;
  let gate: GateInput;
  if (kind === "journal") {
    const noteId = typeof body.noteId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(body.noteId) ? body.noteId : "";
    if (!noteId) throw new ContentAdminError(400, "Save the journal first.");
    const n = (await db.doc(`notes/${noteId}`).get()).data();
    if (!n) throw new ContentAdminError(404, "That journal wasn't found.");
    const mine = n.authorUid === uid || n.writerUid === uid
      || (typeof n.authorUid === "string" && ["writer", "admin"].includes(String((await db.doc(`orgMembers/${n.authorUid}_${uid}`).get()).data()?.role ?? "")));
    if (!mine) throw new ContentAdminError(403, "That isn't your journal.");
    fields = { title: String(n.title ?? ""), content: String(n.content ?? ""), image: String(n.featured_image ?? ""), poster: String(n.videoPoster ?? "") };
    gate = {
      uid, kind, label: String(n.title ?? ""), text: `${fields.title}\n\n${withoutPictures(String(fields.content))}`,
      pictures: [String(fields.image), ...markdownImages(String(fields.content)), String(fields.poster)].filter(Boolean),
      path: `notes/${noteId}`, restore: { update: { status: "published" } }, takedown: { update: { status: "draft" } },
    };
  } else if (kind === "store_item") {
    const images = Array.isArray(body.images) ? body.images.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
    fields = { title: str(body.title, 120), subtitle: str(body.subtitle, 1200), image: str(body.image, 500), images };
    gate = { uid, kind, label: String(fields.title), text: `${fields.title}\n\n${fields.subtitle}`, pictures: [String(fields.image), ...images].filter(Boolean) };
  } else if (kind === "profile") {
    const u = (await db.doc(`users/${uid}`).get()).data() ?? {};
    const next = {
      displayName: body.displayName !== undefined ? str(body.displayName, 200) : String(u.displayName ?? ""),
      bio: body.bio !== undefined ? str(body.bio, 5000) : String(u.bio ?? ""),
      avatar: body.avatar !== undefined ? str(body.avatar, 1000) : String(u.avatar ?? ""),
    };
    fields = next;
    const textChanged = next.displayName !== String(u.displayName ?? "") || next.bio !== String(u.bio ?? "");
    gate = { uid, kind, label: next.displayName || String(u.username ?? ""), text: textChanged ? `${next.displayName}\n\n${next.bio}` : "", pictures: next.avatar && next.avatar !== String(u.avatar ?? "") ? [next.avatar] : [] };
  } else throw new ContentAdminError(400, "Which kind of post?");
  const r = await gateContent(db, gate);
  if (r.status === "off") return { passId: null, status: "off" };
  const passId = randomBytes(12).toString("hex");
  await db.doc(`contentPasses/${passId}`).set({ uid, kind, ...fields, expiresAt: Timestamp.fromMillis(now.getTime() + 3_600_000), expireAt: new Date(now.getTime() + 86_400_000), createdAt: now.toISOString(), ...(r.flagId ? { flagId: r.flagId } : {}) });
  if (r.flagId) await db.doc(`contentFlags/${r.flagId}`).update({ passId });
  return { passId, status: r.status };
}

// A journal published by the server (the partner API, an agent): the same check as the editor's pass. `path` is the note.
export function gateJournal(db: Firestore, uid: string, n: DocumentData, path: string): Promise<GateResult> {
  const content = String(n.content ?? "");
  return gateContent(db, {
    uid, kind: "journal", label: String(n.title ?? ""), text: `${String(n.title ?? "")}\n\n${withoutPictures(content)}`,
    pictures: [String(n.featured_image ?? ""), ...markdownImages(content), String(n.videoPoster ?? "")].filter(Boolean),
    path, restore: { update: { status: "published" } }, takedown: { update: { status: "draft" } },
  });
}

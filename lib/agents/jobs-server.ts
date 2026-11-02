import type { Firestore } from "firebase-admin/firestore";
import { getAgentSettings, planLimit } from "./config-server";
import { DEFAULT_OPS, jobOn, opsOf, type JobId, type NanaOps } from "./jobs";
import { createProposal, defaultAlert, expireDue, recordDone, seen, type Alert } from "./proposals-server";
import { draftWithNana } from "./drafts";
import { classifyMessage } from "./proposals";
import { dayKey, isSummaryTime, isoWeekKey } from "./time";
import { learnVoice, type Voice } from "./voice";
import { execute } from "./execute-server";
import type { Proposal } from "./proposals";
import { bookingContext } from "@/lib/nana-booking";
import { formatNaira, formatSlot, type PublisherSettings } from "@/lib/booking-time";
import { listConversations } from "@/lib/messages-server";
import { actionEntry, logAction } from "@/lib/mcp/log";
import type { NanaDeps } from "@/lib/nana-server";
import type { AccountTier } from "@/lib/users";
import { memberTier } from "@/lib/nana-meter";

// Nana's job runner, called by the scheduled route (app/api/cron/agents, every 15 minutes and once a day by Vercel Cron). Each run:
//   1. closes proposals left waiting past their expiry;
//   2. handles queued events (a customer's message → a booking reply or an answer drafted in the member's voice);
//   3. new paid bookings → a confirmation (sent at once by the member's rule, else waiting for them);
//   4. orders unshipped for N days → a short update for the buyer, waiting for the member;
//   5. on Monday from 07:00 Lagos → the weekly summary (bell and phone).
// Idempotent: every item has a key (proposal ids are hashes of it), so a run that repeats or overlaps never doubles anything. Rate
// limited per member by the plan's nanaJobsPerDay (Admin → Limits). Nothing runs for a member who hasn't switched Nana's jobs on, whose
// plan doesn't include the operator, or who paused all jobs.

export type JobDeps = { nana?: NanaDeps; alert?: Alert | null };
export type RunReport = { expired: number; events: number; drafted: number; confirmations: number; nudges: number; summaries: number; skipped: number };

export const opsRef = (db: Firestore, uid: string) => db.doc(`nanaOps/${uid}`);
export async function getOps(db: Firestore, uid: string): Promise<NanaOps> {
  return opsOf((await opsRef(db, uid).get()).data() as Partial<NanaOps> | undefined);
}
export async function saveOps(db: Firestore, uid: string, patch: Partial<NanaOps>, now = new Date()): Promise<NanaOps> {
  const prev = await getOps(db, uid);
  const next: NanaOps = { ...prev, ...patch, jobs: { ...prev.jobs, ...(patch.jobs ?? {}) }, updatedAt: now.toISOString() };
  await opsRef(db, uid).set(next);
  return next;
}

// Is Nana working for this member on this job, and may she take one more run today? (A transaction keeps the count exact.)
export async function mayRun(db: Firestore, uid: string, job: JobId, now: Date, tier?: AccountTier): Promise<{ ok: boolean; ops: NanaOps; tier: AccountTier }> {
  const t = tier ?? (await memberTier(db, uid));
  if ((await planLimit(db, uid, "nanaOperator", t)) <= 0) return { ok: false, ops: DEFAULT_OPS, tier: t };
  const perDay = await planLimit(db, uid, "nanaJobsPerDay", t);
  const ref = opsRef(db, uid);
  return db.runTransaction(async (tr) => {
    const ops = opsOf((await tr.get(ref)).data() as Partial<NanaOps> | undefined);
    if (!jobOn(ops, job)) return { ok: false, ops, tier: t };
    const day = dayKey(now);
    const used = ops.jobsDay?.day === day ? ops.jobsDay.count : 0;
    if (used >= perDay) return { ok: false, ops, tier: t };
    tr.set(ref, { jobsDay: { day, count: used + 1 } }, { merge: true });
    return { ok: true, ops, tier: t };
  });
}

const nameOf = async (db: Firestore, uid: string) => { const u = (await db.doc(`users/${uid}`).get()).data(); return { name: String(u?.displayName ?? u?.username ?? "Someone"), username: String(u?.username ?? "") }; };
const log = (db: Firestore, uid: string, tool: string, summary: string, result: "done" | "waiting", proposalId: string, logDays: number, now: Date) =>
  logAction(db, actionEntry(tool, {}, true, { via: "nana", uid, agent: "Nana", summary, result, proposalId, client: "Nana", logDays }, now));

// ---- 2. a customer's message
async function handleMessage(db: Firestore, ev: FirebaseFirestore.DocumentData, deps: JobDeps, now: Date, report: RunReport) {
  const uid = String(ev.uid);
  const idemKey = `msg:${ev.cid}:${ev.messageId}`;
  if (await seen(db, uid, idemKey)) return;
  const m = (await db.doc(`conversations/${ev.cid}/messages/${ev.messageId}`).get()).data();
  const conv = (await db.doc(`conversations/${ev.cid}`).get()).data();
  if (!m || m.deleted || !m.text || !conv || (conv.participants as string[]).length !== 2) return;
  const kind = classifyMessage(String(m.text));
  if (kind === "other") return;
  const job: JobId = kind === "booking" ? "bookingReplies" : "customerQuestions";
  const run = await mayRun(db, uid, job, now);
  if (!run.ok) { report.skipped++; return; }
  const s = await getAgentSettings(db);
  const [from, me] = await Promise.all([nameOf(db, String(ev.fromUid)), nameOf(db, uid)]);
  const booking = kind === "booking" ? await bookingContext(db, uid, now).catch(() => null) : null;
  const link = booking ? /: (\S+\/u\/\S+)/.exec(booking)?.[1] : undefined;
  const settings = kind === "booking" ? ((await db.doc(`publisherSettings/${uid}`).get()).data() as PublisherSettings | undefined)?.session : undefined;
  const draft = await draftWithNana(db, uid, { kind: kind === "booking" ? "booking" : "question", from: from.name, text: String(m.text), context: booking ?? undefined, voice: run.ops.voice, memberName: me.name }, { link, deps: deps.nana, now });
  const firstOpen = booking ? /Next open times:\n- (.+)/.exec(booking)?.[1] : undefined;
  const trail = kind === "booking"
    ? [`Read ${from.name}'s message and found it was a booking request.`, booking ? (firstOpen ? `Checked your open times: next is ${firstOpen}.` : "Checked your open times: none this week, so the reply points to your booking page.") : "You don't take paid sessions right now, so there's no booking link.", draft.via === "template" ? "Wrote a plain reply (the AI wasn't available) with your booking link." : "Wrote the reply in your voice and added your booking link.", "Waiting for you. Your rule: booking replies ask before sending."]
    : [`Read ${from.name}'s message and found it was a question.`, draft.via === "template" ? "Wrote a holding reply (the AI wasn't available)." : "Drafted an answer in your voice from what's on your account.", "Waiting for you. Your rule: customer questions ask before sending."];
  const { proposal, fresh } = await createProposal(db, {
    uid, kind: kind === "booking" ? "booking_reply" : "customer_reply", source: "nana", sourceName: "Nana", idemKey,
    title: kind === "booking" ? `${from.name} is asking about a session` : `${from.name} asked a question`,
    summary: kind === "booking" ? `${settings?.enabled ? `${settings.minutes} min, ${formatNaira(settings.priceKobo)}. ` : ""}Nana drafted a reply${link ? " with your booking link" : ""}.` : `"${String(m.text).slice(0, 90)}${String(m.text).length > 90 ? "…" : ""}" Nana drafted an answer.`,
    facts: kind === "booking" && settings?.enabled ? [{ label: "Session", value: `${settings.minutes} min` }, { label: "Price", value: formatNaira(settings.priceKobo) }, ...(firstOpen ? [{ label: "Next open", value: firstOpen, good: true }] : [])] : undefined,
    quote: { from: from.name, text: String(m.text) }, draft: draft.text, payload: { toUid: String(ev.fromUid), toName: from.name, cid: ev.cid }, trail,
  }, now, deps.alert === undefined ? defaultAlert : deps.alert);
  if (fresh) { report.drafted++; await log(db, uid, kind === "booking" ? "reply_booking" : "customer_reply", `Drafted a reply to ${from.name}`, "waiting", proposal.id, s.logDays, now); }
}

// ---- 3. a new paid booking → a thank-you confirmation
async function confirmBooking(db: Firestore, ref: string, b: FirebaseFirestore.DocumentData, deps: JobDeps, now: Date, report: RunReport) {
  const uid = String(b.publisherUid);
  const idemKey = `confirm:${ref}`;
  if (!uid || !b.clientUid || (await seen(db, uid, idemKey))) return;
  const run = await mayRun(db, uid, "bookingReplies", now);
  if (!run.ok) return;
  const s = await getAgentSettings(db);
  const [client, me] = await Promise.all([nameOf(db, String(b.clientUid)), nameOf(db, uid)]);
  const when = `${b.date} at ${formatSlot(String(b.slot))}`;
  const sign = run.ops.voice?.signOff || me.name.split(" ")[0];
  const text = `Hi ${client.name.split(" ")[0]}, thank you for booking. You're confirmed for ${when} (Lagos time), ${b.minutes} minutes. I look forward to it.\n\n${sign}`;
  const base = { uid, kind: "booking_confirm" as const, source: "nana", sourceName: "Nana", idemKey, facts: [{ label: "Session", value: when }, { label: "Paid", value: formatNaira(Number(b.amountKobo) || 0) }], draft: text, payload: { toUid: String(b.clientUid), toName: client.name, booking: ref } };
  if (run.ops.autoConfirm) {
    const p = { ...base, id: "", status: "pending", payload: base.payload, trail: [], createdAt: now.toISOString(), expiresAt: now.toISOString(), summary: "", title: "" } as unknown as Proposal;
    const result = await execute(db, uid, p, text, now);
    const { proposal } = await recordDone(db, { ...base, title: `Confirmed ${client.name}'s paid booking for ${when}`, summary: "You let confirmations go without asking.", trail: [`${client.name} booked and paid.`, "Sent your thank-you and confirmation. Your rule: confirmations go without asking."], result }, now);
    report.confirmations++;
    await log(db, uid, "reply_booking", `Confirmed ${client.name}'s paid booking, ${when}`, "done", proposal.id, s.logDays, now);
  } else {
    const { proposal, fresh } = await createProposal(db, { ...base, title: `Confirm ${client.name}'s booking for ${when}`, summary: "Nana drafted a thank-you and confirmation.", trail: [`${client.name} booked and paid.`, "Drafted your confirmation. Waiting for you."] }, now, deps.alert === undefined ? defaultAlert : deps.alert);
    if (fresh) { report.drafted++; await log(db, uid, "reply_booking", `Drafted a confirmation for ${client.name}`, "waiting", proposal.id, s.logDays, now); }
  }
}

// ---- 4. an order unshipped for days
async function nudgeShipping(db: Firestore, o: FirebaseFirestore.DocumentData, deps: JobDeps, now: Date, report: RunReport) {
  const uid = String(o.sellerUid);
  const idemKey = `ship:${o.reference}`;
  if (await seen(db, uid, idemKey)) return;
  const run = await mayRun(db, uid, "shippingNudges", now);
  if (!run.ok) return;
  const s = await getAgentSettings(db);
  const [buyer, me] = await Promise.all([nameOf(db, String(o.buyerUid)), nameOf(db, uid)]);
  const days = Math.floor((now.getTime() - new Date(o.paidAt).getTime()) / 86_400_000);
  const draft = await draftWithNana(db, uid, { kind: "shipping", from: buyer.name, text: `Order of ${o.itemTitle}, paid ${days} days ago, not sent yet.`, voice: run.ops.voice, memberName: me.name }, { deps: deps.nana, now });
  const { proposal, fresh } = await createProposal(db, {
    uid, kind: "shipping_nudge", source: "nana", sourceName: "Nana", idemKey,
    title: `Order ${String(o.parcelId ?? o.reference).slice(0, 14)} hasn't shipped in ${days} days`,
    summary: `${o.itemTitle}, ${formatNaira(Number(o.amountKobo) || 0)}, to ${o.address?.city ?? "the buyer"}. A short update for the buyer is ready.`,
    facts: [{ label: "Item", value: String(o.itemTitle).slice(0, 40) }, { label: "Paid", value: `${days} days ago` }],
    draft: draft.text, payload: { toUid: String(o.buyerUid), toName: buyer.name, reference: o.reference, orderHref: "/orders" },
    trail: [`Noticed ${o.itemTitle} was paid ${days} days ago and hasn't shipped.`, "Drafted a short update for the buyer. Mark it shipped in Orders when it goes."],
  }, now, deps.alert === undefined ? defaultAlert : deps.alert);
  if (fresh) { report.nudges++; await log(db, uid, "shipping_nudge", `Drafted an update for ${buyer.name}'s order`, "waiting", proposal.id, s.logDays, now); }
}

// ---- 5. the weekly summary
export async function weeklySummaryText(db: Firestore, uid: string, now: Date): Promise<{ text: string; facts: { label: string; value: string }[] }> {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  // By owner only (no composite index), the week picked out here; a member's own lists are small.
  const recent = (q: FirebaseFirestore.Query, field: string) => q.limit(1000).get().then((r) => r.docs.filter((d) => String(d.data()[field] ?? "") >= since));
  const [bookings, orders, downloads, waiting] = await Promise.all([
    recent(db.collection("bookings").where("publisherUid", "==", uid), "createdAt"),
    recent(db.collection("storeOrders").where("sellerUid", "==", uid), "paidAt"),
    recent(db.collection("digitalPurchases").where("sellerUid", "==", uid), "createdAt"),
    db.collection("agentProposals").where("uid", "==", uid).where("status", "==", "pending").get(),
  ]);
  const sum = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => docs.reduce((n, d) => n + (Number(d.data().amountKobo) || 0), 0);
  const paid = bookings.filter((d) => d.data().status !== "cancelled");
  const parts = [
    `${paid.length} session${paid.length === 1 ? "" : "s"} (${formatNaira(sum(paid))})`,
    `${downloads.length} download sale${downloads.length === 1 ? "" : "s"} (${formatNaira(sum(downloads))})`,
    `${orders.length} order${orders.length === 1 ? "" : "s"} (${formatNaira(sum(orders))})`,
  ];
  const text = `Last week: ${parts.join(", ")}.${waiting.size ? ` ${waiting.size} thing${waiting.size === 1 ? " is" : "s are"} waiting for you in Nana's inbox.` : ""}`;
  return { text, facts: [{ label: "Sessions", value: String(paid.length) }, { label: "Downloads", value: String(downloads.length) }, { label: "Orders", value: String(orders.length) }] };
}
async function weekly(db: Firestore, uid: string, deps: JobDeps, now: Date, report: RunReport) {
  const week = isoWeekKey(now);
  const ops = await getOps(db, uid);
  if (ops.lastWeekly === week || (await seen(db, uid, `weekly:${week}`))) return;
  const run = await mayRun(db, uid, "weeklySummary", now);
  if (!run.ok) return;
  const s = await getAgentSettings(db);
  const sum = await weeklySummaryText(db, uid, now);
  const { proposal, fresh } = await recordDone(db, { uid, kind: "weekly_summary", source: "nana", sourceName: "Nana", idemKey: `weekly:${week}`, title: "Sent your weekly summary", summary: sum.text, facts: sum.facts, trail: ["Counted last week's sessions, sales and orders.", "Sent you the summary."] }, now);
  await opsRef(db, uid).set({ lastWeekly: week }, { merge: true });
  if (!fresh) return;
  const alert = deps.alert === undefined ? defaultAlert : deps.alert;
  if (alert) await alert(uid, { title: "Your week, from Nana", body: sum.text, href: `/nana/inbox?view=done&p=${proposal.id}` }).catch(() => {});
  report.summaries++;
  await log(db, uid, "weekly_summary", "Sent your weekly summary", "done", proposal.id, s.logDays, now);
}

export async function runAgentJobs(db: Firestore, now = new Date(), deps: JobDeps = {}): Promise<RunReport> {
  const s = await getAgentSettings(db);
  const report: RunReport = { expired: await expireDue(db, now), events: 0, drafted: 0, confirmations: 0, nudges: 0, summaries: 0, skipped: 0 };
  // Events, oldest first, claimed one at a time so two overlapping runs don't both take one.
  const events = await db.collection("agentEvents").where("status", "==", "new").limit(s.eventsPerRun).get();
  for (const d of events.docs) {
    const claimed = await db.runTransaction(async (t) => { const e = await t.get(d.ref); if (e.data()?.status !== "new") return false; t.update(d.ref, { status: "working", at: now.toISOString() }); return true; });
    if (!claimed) continue;
    try { if (d.data().kind === "message") await handleMessage(db, d.data(), deps, now, report); await d.ref.update({ status: "done" }); }
    catch (e) { console.error("[nana] event failed", d.id, e instanceof Error ? e.message : e); await d.ref.update({ status: "failed", error: String(e instanceof Error ? e.message : e).slice(0, 200) }); }
    report.events++;
  }
  // Paid bookings made in the last two days (the proposal key keeps each to once).
  const recent = await db.collection("bookings").where("createdAt", ">=", new Date(now.getTime() - 2 * 86_400_000).toISOString()).limit(300).get();
  for (const d of recent.docs) if (d.data().status === "confirmed") await confirmBooking(db, d.id, d.data(), deps, now, report).catch((e) => console.error("[nana] confirm failed", d.id, e instanceof Error ? e.message : e));
  // Orders still unshipped after N days.
  const cutoff = new Date(now.getTime() - s.shipNudgeDays * 86_400_000).toISOString();
  const unshipped = await db.collection("storeOrders").where("status", "==", "paid").limit(300).get();
  for (const d of unshipped.docs) if (String(d.data().paidAt ?? "") <= cutoff) await nudgeShipping(db, { ...d.data(), reference: d.data().reference ?? d.id }, deps, now, report).catch((e) => console.error("[nana] nudge failed", d.id, e instanceof Error ? e.message : e));
  // Monday's summary for everyone who has it on.
  if (isSummaryTime(now, s)) {
    const members = await db.collection("nanaOps").where("enabled", "==", true).limit(500).get();
    for (const d of members.docs) await weekly(db, d.id, deps, now, report).catch((e) => console.error("[nana] summary failed", d.id, e instanceof Error ? e.message : e));
  }
  return report;
}

// ---- voice: learnt from what the member wrote (their own messages and journals), never anyone else's words
export async function relearnVoice(db: Firestore, uid: string, now = new Date()): Promise<Voice> {
  const samples: string[] = [];
  const convs = (await listConversations(db, uid)).filter((c) => c.kind === "direct").slice(0, 8);
  for (const c of convs) {
    const msgs = await db.collection(`conversations/${c.id}/messages`).orderBy("createdAt", "desc").limit(15).get();
    for (const m of msgs.docs) if (m.data().from === uid && m.data().text && !m.data().deleted) samples.push(String(m.data().text));
  }
  const notes = await db.collection("notes").where("authorUid", "==", uid).limit(12).get();
  for (const n of notes.docs) samples.push(String(n.data().content ?? "").slice(0, 1200));
  const voice = learnVoice(samples, now);
  await opsRef(db, uid).set({ voice }, { merge: true });
  return voice;
}

// A journal draft from the member's notes (Nana's inbox → Journal drafts): drafted, then waiting for them; never published.
export async function journalFromNotes(db: Firestore, uid: string, notes: string, now = new Date(), deps: JobDeps = {}): Promise<Proposal> {
  const text = String(notes ?? "").replace(/\u0000/g, "").trim().slice(0, 8000);
  if (text.length < 20) throw new Error("Give Nana a few lines to work from.");
  const run = await mayRun(db, uid, "journalDrafts", now);
  if (!run.ok) throw new Error(run.ops.enabled ? "Journal drafts are off, paused, or you've reached today's limit." : "Switch Nana's jobs on first.");
  const me = await nameOf(db, uid);
  const d = await draftWithNana(db, uid, { kind: "journal", text, voice: run.ops.voice, memberName: me.name }, { deps: deps.nana, now });
  const s = await getAgentSettings(db);
  const words = d.text.split(/\s+/).filter(Boolean).length;
  const { proposal } = await createProposal(db, {
    uid, kind: "journal_draft", source: "nana", sourceName: "Nana", idemKey: `journal:${dayKey(now)}:${text.length}:${text.slice(0, 40)}`,
    title: `Journal draft: "${(d.title ?? "Untitled").slice(0, 90)}"`, summary: `${words.toLocaleString("en-GB")} words from your notes. Approving saves it as a draft; it's never published by Nana.`,
    draft: d.text.replace(/^#\s+.+\n+/, ""), payload: { title: d.title ?? "Untitled draft" }, trail: ["Read your notes.", d.via === "template" ? "Laid them out as a draft (the AI wasn't available)." : "Wrote a first draft in your voice.", "Waiting for you. Journal drafts are never published by Nana."],
  }, now, null);
  await log(db, uid, "create_draft", `Drafted the journal "${(d.title ?? "").slice(0, 60)}"`, "waiting", proposal.id, s.logDays, now);
  return proposal;
}

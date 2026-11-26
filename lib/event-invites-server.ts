import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { gateContent } from "./content-checks-server";
import { notifyBell, sendEmail } from "./email";
import { getUserEmail } from "./firebase-admin";
import { SITE_URL } from "./host";
import { invitesConfig } from "./pricing";
import { whenText } from "./events";
import type { UserProfile } from "./users";
import { allowanceFor, cleanEmails, cleanMessage, pickRecipients, weekOf } from "./event-invites";

// Invitations on the server (lib/event-invites.ts has the rules). The week's count is inviteWeeks/{uid}_{week}; a send becomes inviteJobs/{id},
// sent INVITE_BATCH at a time: the first batch at once, the rest by the cron (app/api/cron/reminders). Packs are invitePacks/{uid}.
// All server-only (firestore.rules). Callers run ensurePricing() first.
export class InviteError extends Error { constructor(public status: number, message: string) { super(message); } }
export const INVITE_BATCH = 60;

type Target = { kind: "event" | "meeting"; id: string; title: string; href: string; hostUid: string; startsAt: string; endsAt: string };
async function targetOf(db: Firestore, kind: unknown, id: string): Promise<Target> {
  if (kind === "meeting") {
    const m = (await db.doc(`meetings/${id}`).get()).data();
    if (!m || m.cancelled) throw new InviteError(404, "That meeting wasn't found.");
    return { kind: "meeting", id, title: m.title, href: `/meetings/${id}`, hostUid: m.hostUid, startsAt: m.startsAt, endsAt: m.endsAt };
  }
  const e = (await db.doc(`events/${id}`).get()).data();
  if (!e || e.cancelled) throw new InviteError(404, "That event wasn't found.");
  if (e.visibility === "members") throw new InviteError(409, "Members-only events are for the community's members: announce it in the community.");
  const start = e.nextStartAt ?? e.startsAt, len = new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime();
  return { kind: "event", id, title: e.title, href: `/events/${id}`, hostUid: e.hostUid, startsAt: start, endsAt: new Date(new Date(start).getTime() + len).toISOString() };
}

// This week: the allowance, how many sent, how many left, and any pack.
export async function inviteWeek(db: Firestore, uid: string, now = new Date()) {
  const [u, pack, used] = await Promise.all([
    db.doc(`users/${uid}`).get(), db.doc(`invitePacks/${uid}`).get(), db.doc(`inviteWeeks/${uid}_${weekOf(now)}`).get(),
  ]);
  const p = pack.data() as { sends: number; until: string } | undefined;
  const allowance = allowanceFor(String(u.data()?.accountTier ?? "basic"), invitesConfig(), p ?? null, now);
  const sent = Number(used.data()?.sent ?? 0);
  const followers = await db.collection("follows").where("username", "==", String(u.data()?.username ?? "")).count().get().then((r) => r.data().count).catch(() => 0);
  return { week: weekOf(now), allowance, sent, left: Math.max(0, allowance - sent), followers, ...(p && Date.parse(p.until) > now.getTime() ? { pack: p } : {}) };
}

// Invite followers and/or email addresses to an event or meeting the host runs.
export async function sendInvites(db: Firestore, uid: string, raw: { kind?: unknown; id?: unknown; followers?: unknown; emails?: unknown; message?: unknown }, now = new Date()) {
  const t = await targetOf(db, raw.kind, String(raw.id ?? ""));
  if (t.hostUid !== uid) throw new InviteError(403, "Only the host sends invitations.");
  if (new Date(t.endsAt).getTime() < now.getTime()) throw new InviteError(409, "It has already happened.");
  const me = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  if (!me || me.suspended) throw new InviteError(403, "Your account can't do that right now.");
  const message = cleanMessage(raw.message);
  if (message) await gateContent(db, { uid, kind: "event", label: `Invitation: ${t.title}`, text: message, where: { href: t.href }, path: `${t.kind === "event" ? "events" : "meetings"}/${t.id}`, restore: {}, takedown: {} });
  const { emails, skipped } = cleanEmails(raw.emails);
  const followerUids = raw.followers === true ? (await db.collection("follows").where("username", "==", String(me.username ?? "")).limit(50_000).get()).docs.map((d) => String(d.data().followerUid)).filter((x) => x && x !== uid) : [];
  if (!followerUids.length && !emails.length) throw new InviteError(400, "Choose your followers or paste some email addresses.");
  // People already in aren't invited again.
  const already = new Set<string>();
  if (t.kind === "event") (await db.collection("eventRsvps").where("eventId", "==", t.id).limit(5000).get()).docs.forEach((d) => already.add(String(d.data().uid)));
  else (await db.collection("meetingSeats").where("meetingId", "==", t.id).limit(500).get()).docs.forEach((d) => { if (d.data().status === "booked") already.add(String(d.data().uid)); });
  const weekRef = db.doc(`inviteWeeks/${uid}_${weekOf(now)}`);
  const { allowance } = await inviteWeek(db, uid, now);
  const pick = await db.runTransaction(async (tx) => {
    const sent = Number((await tx.get(weekRef)).data()?.sent ?? 0);
    const r = pickRecipients({ uids: followerUids, emails }, already, allowance - sent);
    const n = r.uids.length + r.emails.length;
    if (n) tx.set(weekRef, { uid, week: weekOf(now), sent: FieldValue.increment(n), updatedAt: now.toISOString() }, { merge: true });
    return { ...r, n, leftAfter: Math.max(0, allowance - sent - n) };
  });
  if (!pick.n) throw new InviteError(409, already.size && !pick.cut ? "Everyone you chose is already in." : "You've used this week's invitations. Add a pack for more, or wait until Monday.");
  const job = db.collection("inviteJobs").doc();
  await job.set({ uid, hostName: me.displayName ?? "", kind: t.kind, targetId: t.id, title: t.title, href: t.href, startsAt: t.startsAt, endsAt: t.endsAt, message, uids: pick.uids, emails: pick.emails, at: 0, done: false, createdAt: now.toISOString() });
  await runInviteJob(db, job.id);
  return { invited: pick.n, notInvited: pick.cut, skipped, left: pick.leftAfter };
}

// Sends the next batch of a job. The cron calls sendInviteJobs for whatever is left.
async function runInviteJob(db: Firestore, jobId: string): Promise<number> {
  const ref = db.doc(`inviteJobs/${jobId}`);
  const j = (await ref.get()).data() as { uid: string; hostName: string; title: string; href: string; startsAt: string; endsAt: string; message: string; uids: string[]; emails: string[]; at: number; done: boolean } | undefined;
  if (!j || j.done) return 0;
  const all: ({ uid: string } | { email: string })[] = [...j.uids.map((uid) => ({ uid })), ...j.emails.map((email) => ({ email }))];
  const slice = all.slice(j.at, j.at + INVITE_BATCH);
  const when = whenText(new Date(j.startsAt), new Date(j.endsAt));
  const line = `${j.hostName} invited you to ${j.title}, ${when}.`;
  const link = `${SITE_URL}${j.href}?r=invite`;
  for (const r of slice) {
    const text = `${line}${j.message ? `\n\n"${j.message}"` : ""}\n\nSee it and say if you're coming: ${link}\n\nYou're getting this because ${j.hostName} invited you on #NotesApp.`;
    if ("uid" in r) {
      const to = await getUserEmail(r.uid).catch(() => null);
      if (to) await sendEmail({ to, subject: `${j.hostName} invited you: ${j.title}`, text, bell: { uid: r.uid, type: "event", linkHref: `${j.href}?r=invite`, message: line } }).catch(() => {});
      else await notifyBell({ uid: r.uid, type: "event", linkHref: `${j.href}?r=invite`, message: line }).catch(() => {});
    } else await sendEmail({ to: r.email, subject: `${j.hostName} invited you: ${j.title}`, text }).catch(() => {});
  }
  const at = j.at + slice.length;
  await ref.update({ at, done: at >= all.length });
  return slice.length;
}
export async function sendInviteJobs(db: Firestore): Promise<number> {
  const open = await db.collection("inviteJobs").where("done", "==", false).limit(10).get();
  let n = 0;
  for (const d of open.docs) for (let i = 0; i < 5; i++) { const k = await runInviteJob(db, d.id); n += k; if (!k) break; }
  return n;
}

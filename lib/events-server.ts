import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { UserProfile } from "./users";
import { notifyBell, sendEmail } from "./email";
import { getUserEmail } from "./firebase-admin";
import { SITE_URL } from "./host";
import { sendPush } from "./push-server";
import { can, type Role } from "./community";
import { CommunityError, memberOf, readCommunity } from "./community-server";
import { ticketsLeft, type TicketType } from "./tickets";
import { cleanEvent, nextOccurrence, reminderDue, whenText, type EventDoc, type EventInput, type Rsvp } from "./events";

// Events on the server (the rules are lib/events.ts). events/{id} carries `nextStartAt` (the next start, kept up to date by the cron) so
// upcoming lists and reminders are one query. Members-only events are a community's and only its members see them.
export class EventError extends Error { constructor(public status: number, message: string) { super(message); } }

const MAX_UPCOMING = 60;
type Ev = EventDoc & { id: string; nextStartAt: string | null };
const withNext = (e: EventDoc, now: Date) => ({ ...e, nextStartAt: nextOccurrence(e, now)?.start.toISOString() ?? null });

async function roleIn(db: Firestore, cid: string, uid: string | null): Promise<Role | null> {
  const m = await memberOf(db, cid, uid);
  return m && m.status === "active" ? m.role : null;
}
export async function mayManage(db: Firestore, e: EventDoc, uid: string) {
  if (e.hostUid === uid) return true;
  return !!e.cid && can(await roleIn(db, e.cid, uid), "events");
}
export async function mayView(db: Firestore, e: EventDoc, uid: string | null) {
  return e.visibility === "public" || (!!e.cid && !!(await roleIn(db, e.cid, uid)));
}

export async function createEvent(db: Firestore, uid: string, raw: EventInput & { cid?: unknown }, now = new Date()): Promise<Ev> {
  const p = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  if (!p || p.suspended) throw new EventError(403, "Your account can't do that right now.");
  const cid = typeof raw.cid === "string" && raw.cid ? raw.cid : "";
  let communityName = "";
  if (cid) {
    const c = await readCommunity(db, cid).catch(() => null);
    if (!c) throw new EventError(404, "That community wasn't found.");
    if (!can(await roleIn(db, cid, uid), "events")) throw new EventError(403, "Only the community's admins add its events.");
    communityName = c.name;
  }
  const r = cleanEvent(raw, now, { community: !!cid });
  if (!r.ok) throw new EventError(400, r.error);
  const mine = await db.collection("events").where("hostUid", "==", uid).where("nextStartAt", ">=", now.toISOString()).get().catch(() => null);
  if (mine && mine.size >= MAX_UPCOMING) throw new EventError(409, `You can have up to ${MAX_UPCOMING} upcoming events.`);
  const ref = db.collection("events").doc();
  const e: EventDoc = { ...r.event, hostUid: uid, hostName: p.displayName ?? "", hostUsername: p.username ?? "", ...(cid ? { cid, communityName } : {}), going: 0, interested: 0, createdAt: now.toISOString() };
  const doc = withNext(e, now);
  await ref.set(doc);
  return { ...doc, id: ref.id };
}
export async function eventOf(db: Firestore, id: string): Promise<Ev> {
  const e = (await db.doc(`events/${id}`).get()).data() as Ev | undefined;
  if (!e) throw new EventError(404, "That event wasn't found.");
  return { ...e, id };
}
export async function updateEvent(db: Firestore, uid: string, id: string, raw: EventInput, now = new Date()): Promise<Ev> {
  const e = await eventOf(db, id);
  if (!(await mayManage(db, e, uid))) throw new EventError(403, "Only the host can change this event.");
  const r = cleanEvent({ ...e, ...raw }, now, { community: !!e.cid });
  if (!r.ok) throw new EventError(400, r.error);
  const next = withNext({ ...e, ...r.event }, now);
  await db.doc(`events/${id}`).set(next);
  await tellAttendees(db, next, id, `${e.title} has changed: ${next.nextStartAt ? whenText(new Date(next.nextStartAt), new Date(new Date(next.nextStartAt).getTime() + (new Date(next.endsAt).getTime() - new Date(next.startsAt).getTime()))) : "see the event"}.`);
  return { ...next, id };
}
export async function cancelEvent(db: Firestore, uid: string, id: string) {
  const e = await eventOf(db, id);
  if (!(await mayManage(db, e, uid))) throw new EventError(403, "Only the host can cancel this event.");
  await db.doc(`events/${id}`).update({ cancelled: true, nextStartAt: null });
  await tellAttendees(db, e, id, `${e.title} has been cancelled.`);
}
async function tellAttendees(db: Firestore, e: EventDoc, id: string, message: string) {
  const rs = await db.collection("eventRsvps").where("eventId", "==", id).limit(2000).get();
  for (const d of rs.docs) await notifyBell({ uid: d.data().uid, type: "event", linkHref: `/events/${id}`, message }).catch(() => {});
}

export async function getEvent(db: Firestore, id: string, viewerUid: string | null, now = new Date()) {
  const e = await eventOf(db, id);
  if (!(await mayView(db, e, viewerUid))) throw new EventError(403, "This event is for the community's members.");
  const mine = viewerUid ? ((await db.doc(`eventRsvps/${id}_${viewerUid}`).get()).data()?.status as Rsvp | undefined) ?? null : null;
  // Paid tickets (lib/tickets.ts): each type's name, price and how many are left. None = free RSVP, as before.
  const types = (((await db.doc(`eventTickets/${id}`).get()).data()?.types ?? []) as TicketType[]);
  const canManage = viewerUid ? await mayManage(db, e, viewerUid) : false;
  return {
    event: e, next: nextOccurrence(e, now), rsvp: mine, canManage,
    tickets: types.map((t) => ({ id: t.id, name: t.name, priceKobo: t.priceKobo, left: ticketsLeft(t), ...(canManage ? { quantity: t.quantity, sold: t.sold } : {}) })),
  };
}

// Upcoming events: public ones (by state and city), a community's (members see its members-only ones), a host's, or what I'm going to.
export async function upcoming(db: Firestore, f: { state?: string; city?: string; cid?: string; host?: string; mine?: boolean }, viewerUid: string | null, now = new Date()): Promise<Ev[]> {
  const from = now.toISOString();
  let list: Ev[] = [];
  if (f.mine && viewerUid) {
    const rs = await db.collection("eventRsvps").where("uid", "==", viewerUid).limit(200).get();
    const docs = rs.size ? await db.getAll(...rs.docs.map((d) => db.doc(`events/${d.data().eventId}`))) : [];
    list = docs.filter((d) => d.exists).map((d) => ({ ...(d.data() as Ev), id: d.id }));
  } else {
    let q = db.collection("events").where("nextStartAt", ">=", from) as FirebaseFirestore.Query;
    if (f.cid) q = db.collection("events").where("cid", "==", f.cid);
    else if (f.host) q = db.collection("events").where("hostUsername", "==", f.host);
    const snap = await q.limit(500).get().catch(async (e) => {
      if ((e as { code?: number }).code !== 9) throw e;
      return db.collection("events").limit(500).get();
    });
    list = snap.docs.map((d) => ({ ...(d.data() as Ev), id: d.id }));
  }
  const memberOfCid = f.cid ? !!(await roleIn(db, f.cid, viewerUid)) : false;
  return list
    .filter((e) => !e.cancelled && e.nextStartAt && e.nextStartAt >= new Date(now.getTime() - 12 * 3_600_000).toISOString())
    .filter((e) => e.visibility === "public" || (f.cid ? memberOfCid && e.cid === f.cid : !!f.mine))
    .filter((e) => !f.state || e.state === f.state)
    .filter((e) => !f.city || e.city.toLowerCase() === f.city.toLowerCase())
    .sort((a, b) => String(a.nextStartAt).localeCompare(String(b.nextStartAt)))
    .slice(0, 100);
}

export async function rsvp(db: Firestore, uid: string, id: string, status: unknown, now = new Date()): Promise<{ going: number; interested: number; rsvp: Rsvp | null }> {
  const e = await eventOf(db, id);
  if (!(await mayView(db, e, uid))) throw new EventError(403, "This event is for the community's members.");
  if (e.cancelled) throw new EventError(409, "This event has been cancelled.");
  const next: Rsvp | null = status === "going" || status === "interested" ? status : null;
  const ref = db.doc(`eventRsvps/${id}_${uid}`), eref = db.doc(`events/${id}`);
  return db.runTransaction(async (t) => {
    const cur = ((await t.get(ref)).data()?.status as Rsvp | undefined) ?? null;
    const ev = (await t.get(eref)).data() as Ev;
    const counts = { going: Number(ev.going ?? 0), interested: Number(ev.interested ?? 0) };
    if (cur) counts[cur] = Math.max(0, counts[cur] - 1);
    if (next) counts[next] += 1;
    if (next) t.set(ref, { eventId: id, uid, status: next, at: now.toISOString() }); else t.delete(ref);
    t.update(eref, counts);
    return { ...counts, rsvp: next };
  });
}

// The cron (every ~15 minutes): reminders 24 hours and 1 hour before each start, to everyone going or interested (bell, email and push), once
// each; and repeating events move on to their next start once one ends.
export async function sendEventReminders(db: Firestore, now = new Date(), push = (uid: string, p: { title: string; body: string; url: string }) => sendPush(db, uid, p)): Promise<number> {
  let sent = 0;
  // Events whose start passed more than a day ago (the cron missed them): move them on to their next start, or none.
  const behind = await db.collection("events").where("nextStartAt", "<", new Date(now.getTime() - 24 * 3_600_000).toISOString()).limit(200).get();
  for (const d of behind.docs) await d.ref.update({ nextStartAt: nextOccurrence(d.data() as Ev, now)?.start.toISOString() ?? null });
  const soon = await db.collection("events").where("nextStartAt", ">=", new Date(now.getTime() - 24 * 3_600_000).toISOString()).where("nextStartAt", "<=", new Date(now.getTime() + 24 * 3_600_000).toISOString()).limit(500).get();
  for (const d of soon.docs) {
    const e = { ...(d.data() as Ev), id: d.id };
    if (e.cancelled || !e.nextStartAt) continue;
    const start = new Date(e.nextStartAt);
    const len = new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime();
    if (start.getTime() + len <= now.getTime()) { await d.ref.update({ nextStartAt: nextOccurrence(e, now)?.start.toISOString() ?? null }); continue; }
    const kind = reminderDue(start, now);
    if (!kind) continue;
    const key = db.doc(`eventReminders/${e.id}_${e.nextStartAt.replace(/[:.]/g, "")}_${kind}`);
    const first = await db.runTransaction(async (t) => { if ((await t.get(key)).exists) return false; t.set(key, { at: now.toISOString() }); return true; });
    if (!first) continue;
    const rs = await db.collection("eventRsvps").where("eventId", "==", e.id).limit(2000).get();
    const message = kind === "hour" ? `${e.title} starts in an hour${e.liveUrl ? " — the Join live link is on the event" : ""}.` : `${e.title} is tomorrow: ${whenText(start, new Date(start.getTime() + len))}.`;
    for (const r of rs.docs) {
      // Bell and email together (sendEmail adds the bell); just the bell when there's no address.
      const to = await getUserEmail(r.data().uid).catch(() => null);
      if (to) await sendEmail({ to, subject: kind === "hour" ? `Starting soon: ${e.title}` : `Tomorrow: ${e.title}`, text: `${message}\n\n${SITE_URL}/events/${e.id}\n\n#NotesApp`, bell: { uid: r.data().uid, type: "event", linkHref: `/events/${e.id}`, message } }).catch(() => {});
      else await notifyBell({ uid: r.data().uid, type: "event", linkHref: `/events/${e.id}`, message }).catch(() => {});
      await push(r.data().uid, { title: e.title, body: message, url: `/events/${e.id}` }).catch(() => 0);
      sent++;
    }
  }
  return sent;
}
export { CommunityError };

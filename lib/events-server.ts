import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { gateContent } from "./content-checks-server";
import type { UserProfile } from "./users";
import { notifyBell, sendEmail } from "./email";
import { getUserEmail } from "./firebase-admin";
import { SITE_URL } from "./host";
import { sendPush } from "./push-server";
import { can, isDiscoverable, type Community, type Role } from "./community";
import { CommunityError, memberOf, readCommunity } from "./community-server";
import { ticketsLeft, type TicketType } from "./tickets";
import { cleanEvent, eventTrendScore, isListedEvent, nextOccurrence, reminderDue, whenText, type EventDoc, type EventInput, type Rsvp } from "./events";
import { withReturn } from "./growth";

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
  // AI content checks: what the event page shows, before it is listed.
  await gateContent(db, { uid, kind: "event", label: e.title, text: [e.title, e.description, e.place].filter(Boolean).join("\n\n"), ...(e.cover ? { pictures: [e.cover] } : {}), where: { ...(cid ? { cid } : {}), href: `/events/${ref.id}` }, path: ref.path, restore: { set: doc }, takedown: { delete: true } });
  await ref.set(doc);
  // Followers of the host's calendar hear about a new public event (sent in batches by the cron: lib/events-server.ts sendAnnouncements).
  if (e.visibility === "public" && !cid) await db.doc(`eventAnnouncements/${ref.id}`).set({ eventId: ref.id, hostUsername: e.hostUsername, after: "", done: false, sent: 0, createdAt: now.toISOString() });
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
  if (r.event.approval && !e.approval && ((await db.doc(`eventTickets/${id}`).get()).data()?.types ?? []).length) throw new EventError(409, "Approval is for free events. Remove the tickets first.");
  const next = withNext({ ...e, ...r.event }, now);
  const { id: _id, ...prev } = e;
  void _id;
  await gateContent(db, { uid, kind: "event", label: next.title, text: [next.title, next.description, next.place].filter(Boolean).join("\n\n"), ...(next.cover ? { pictures: [next.cover] } : {}), where: { ...(e.cid ? { cid: e.cid } : {}), href: `/events/${id}` }, path: `events/${id}`, restore: { set: next }, takedown: { update: { title: prev.title, description: prev.description, place: prev.place, cover: prev.cover ?? FieldValue.delete() } } });
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
  // The online link of a ticketed event or one that needs approval is for the people who are in (lib/event-kit.ts); other events'
  // links stay public, as they always were (a public YouTube live, say).
  const gated = !!e.liveUrl && (e.approval === true || types.length > 0) && !canManage && mine !== "going"
    && !(viewerUid && (await db.collection("tickets").where("holderUid", "==", viewerUid).limit(500).get()).docs.some((d) => d.data().eventId === id && d.data().status === "valid"));
  return {
    event: gated ? { ...e, liveUrl: "", linkHidden: true } : e, next: nextOccurrence(e, now), rsvp: mine, canManage,
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
    .slice(0, 100)
    .map(publicView);
}
// Lists never carry the link of a ticketed event or one that needs approval (getEvent gives it to the people who are in).
export const publicView = <T extends EventDoc>(e: T): T => (e.liveUrl && (e.approval || (e.priceFromKobo ?? 0) > 0) ? { ...e, liveUrl: "" } : e);

// Explore and Trending: every listed event (lib/events.ts isListedEvent: public, not cancelled, not over, and not from an invite-only
// community), with its next start worked out now, soonest first. One query on nextStartAt (a single-field index); two days back so an
// event on now, or a repeating one the cron hasn't moved on yet, is still read.
export async function listedEvents(db: Firestore, now = new Date()): Promise<Ev[]> {
  const from = new Date(now.getTime() - 2 * 86_400_000).toISOString();
  const snap = await db.collection("events").where("nextStartAt", ">=", from).limit(1000).get();
  const all = snap.docs.map((d) => ({ ...(d.data() as Ev), id: d.id })).filter((e) => e.visibility === "public" && !e.cancelled);
  const cids = [...new Set(all.map((e) => e.cid).filter((c): c is string => !!c))];
  const comms = cids.length ? await db.getAll(...cids.slice(0, 300).map((c) => db.doc(`communities/${c}`))) : [];
  const findable = new Set(comms.filter((c) => c.exists && isDiscoverable(c.data() as Community)).map((c) => c.id));
  return all
    .filter((e) => isListedEvent(e, now, !!e.cid && findable.has(e.cid)))
    .map((e) => publicView({ ...e, nextStartAt: nextOccurrence(e, now)!.start.toISOString() }))
    .sort((a, b) => String(a.nextStartAt).localeCompare(String(b.nextStartAt)));
}

export type TrendingEvent = Ev & { views: number; rsvps: number; tickets: number; score: number };
// Trending → Events: listed events by interest in the last `days` days (lib/events.ts eventTrendScore): tickets sold, RSVPs and visits to
// the event's page (pageViews buckets of kind "event", passed in by /api/trending, which reads them already). Events nobody has shown
// interest in yet follow, soonest first, so the tab isn't empty while there are events. Each query is on one field: no new index.
export async function trendingEvents(db: Firestore, days: number, views: Map<string, number> = new Map(), now = new Date(), limit = 10): Promise<TrendingEvent[]> {
  const since = new Date(now.getTime() - Math.min(30, Math.max(1, days)) * 86_400_000).toISOString();
  const [list, rs, tk] = await Promise.all([
    listedEvents(db, now),
    db.collection("eventRsvps").where("at", ">=", since).limit(5000).get(),
    db.collection("tickets").where("createdAt", ">=", since).limit(5000).get(),
  ]);
  const count = (m: Map<string, number>, id: unknown) => { const k = String(id ?? ""); if (k) m.set(k, (m.get(k) ?? 0) + 1); };
  const rsvps = new Map<string, number>(), tickets = new Map<string, number>();
  rs.docs.forEach((d) => count(rsvps, d.data().eventId));
  tk.docs.forEach((d) => { if (d.data().status === "valid") count(tickets, d.data().eventId); });
  const rows = list.map((e) => {
    const a = { views: views.get(e.id) ?? 0, rsvps: rsvps.get(e.id) ?? 0, tickets: tickets.get(e.id) ?? 0 };
    return { ...e, ...a, score: eventTrendScore(a) };
  });
  return [
    ...rows.filter((r) => r.score > 0).sort((a, b) => b.score - a.score || String(a.nextStartAt).localeCompare(String(b.nextStartAt))),
    ...rows.filter((r) => r.score === 0),
  ].slice(0, limit);
}

export async function rsvp(db: Firestore, uid: string, id: string, status: unknown, now = new Date()): Promise<{ going: number; interested: number; requested: number; rsvp: Rsvp | null }> {
  const e = await eventOf(db, id);
  if (!(await mayView(db, e, uid))) throw new EventError(403, "This event is for the community's members.");
  if (e.cancelled) throw new EventError(409, "This event has been cancelled.");
  const asked: Rsvp | null = status === "going" || status === "interested" ? status : null;
  const host = await mayManage(db, e, uid);
  const ref = db.doc(`eventRsvps/${id}_${uid}`), eref = db.doc(`events/${id}`);
  const r = await db.runTransaction(async (t) => {
    const cur = ((await t.get(ref)).data()?.status as Rsvp | undefined) ?? null;
    const ev = (await t.get(eref)).data() as Ev;
    // An event that needs approval: Going becomes a request, unless they're already in (or they run it).
    const next: Rsvp | null = asked === "going" && ev.approval && !host && cur !== "going" ? "requested" : asked;
    const counts = { going: Number(ev.going ?? 0), interested: Number(ev.interested ?? 0), requested: Number(ev.requested ?? 0) };
    if (next === cur) return { ...counts, rsvp: cur, changed: false };
    if (next === "going" && ev.capacity && counts.going >= ev.capacity) throw new EventError(409, "This event is full.");
    if (cur) counts[cur] = Math.max(0, counts[cur] - 1);
    if (next) counts[next] += 1;
    if (next) t.set(ref, { eventId: id, uid, status: next, at: now.toISOString() }); else t.delete(ref);
    t.update(eref, counts);
    return { ...counts, rsvp: next, changed: true };
  });
  if (r.changed && r.rsvp === "requested") {
    const p = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
    await notifyBell({ uid: e.hostUid, type: "event", linkHref: `/events/${id}?requests=1`, message: `${p?.displayName || "Someone"} asked to join ${e.title}.` }).catch(() => {});
  }
  return { going: r.going, interested: r.interested, requested: r.requested, rsvp: r.rsvp };
}

// The host's list of people asking to join (events that need approval), and accepting or declining one.
export async function joinRequests(db: Firestore, uid: string, id: string): Promise<{ uid: string; name: string; username: string; avatar: string; at: string }[]> {
  const e = await eventOf(db, id);
  if (!(await mayManage(db, e, uid))) throw new EventError(403, "Only the host sees who asked to join.");
  const rs = await db.collection("eventRsvps").where("eventId", "==", id).where("status", "==", "requested").limit(500).get();
  const people = rs.size ? await db.getAll(...rs.docs.map((d) => db.doc(`users/${d.data().uid}`))) : [];
  return rs.docs.map((d, i) => {
    const p = (people[i]?.data() ?? {}) as UserProfile;
    return { uid: String(d.data().uid), name: p.displayName ?? "", username: p.username ?? "", avatar: p.avatar ?? "", at: String(d.data().at) };
  }).sort((a, b) => a.at.localeCompare(b.at));
}
export async function decideRequest(db: Firestore, uid: string, id: string, who: string, accept: boolean, now = new Date()): Promise<void> {
  const e = await eventOf(db, id);
  if (!(await mayManage(db, e, uid))) throw new EventError(403, "Only the host accepts people.");
  const ref = db.doc(`eventRsvps/${id}_${who}`), eref = db.doc(`events/${id}`);
  await db.runTransaction(async (t) => {
    if ((await t.get(ref)).data()?.status !== "requested") throw new EventError(409, "That request has already been answered.");
    const ev = (await t.get(eref)).data() as Ev;
    const counts = { going: Number(ev.going ?? 0), requested: Math.max(0, Number(ev.requested ?? 0) - 1) };
    if (accept) {
      if (ev.capacity && counts.going >= ev.capacity) throw new EventError(409, "The event is full. Raise the guest limit to accept more.");
      counts.going += 1;
      t.set(ref, { eventId: id, uid: who, status: "going", at: now.toISOString(), acceptedAt: now.toISOString() });
    } else t.delete(ref);
    t.update(eref, counts);
  });
  const message = accept ? `You're in: ${e.title}. We'll remind you before it starts.` : `The host couldn't take you for ${e.title} this time.`;
  const to = await getUserEmail(who).catch(() => null);
  if (to) await sendEmail({ to, subject: accept ? `You're in: ${e.title}` : `About ${e.title}`, text: `${message}\n\n${SITE_URL}/events/${id}\n\n#NotesApp`, bell: { uid: who, type: "event", linkHref: `/events/${id}`, message } }).catch(() => {});
  else await notifyBell({ uid: who, type: "event", linkHref: `/events/${id}`, message }).catch(() => {});
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
    const rs = { docs: (await db.collection("eventRsvps").where("eventId", "==", e.id).limit(2000).get()).docs.filter((x) => x.data().status !== "requested") };
    const message = kind === "hour" ? `${e.title} starts in an hour${e.liveUrl ? " — the Join live link is on the event" : ""}.` : `${e.title} is tomorrow: ${whenText(start, new Date(start.getTime() + len))}.`;
    for (const r of rs.docs) {
      // Bell and email together (sendEmail adds the bell); just the bell when there's no address.
      const to = await getUserEmail(r.data().uid).catch(() => null);
      // ?r=reminder: a return through a reminder counts for it (lib/growth.ts).
      const href = withReturn(`/events/${e.id}`, "reminder");
      if (to) await sendEmail({ to, subject: kind === "hour" ? `Starting soon: ${e.title}` : `Tomorrow: ${e.title}`, text: `${message}\n\n${SITE_URL}${href}\n\n#NotesApp`, bell: { uid: r.data().uid, type: "event", linkHref: href, message } }).catch(() => {});
      else await notifyBell({ uid: r.data().uid, type: "event", linkHref: href, message }).catch(() => {});
      await push(r.data().uid, { title: e.title, body: message, url: href }).catch(() => 0);
      sent++;
    }
  }
  return sent;
}
// A new public event, to the people who follow the host (follows/{uid}_{username}): a bell, a phone notification and an email, in batches
// of ANNOUNCE_BATCH a run so a big calendar never holds up the cron. Each follower hears once per event.
const ANNOUNCE_BATCH = 300;
export async function sendAnnouncements(db: Firestore, now = new Date(), push = (uid: string, p: { title: string; body: string; url: string }) => sendPush(db, uid, p)): Promise<number> {
  const open = await db.collection("eventAnnouncements").where("done", "==", false).limit(5).get();
  let sent = 0;
  for (const a of open.docs) {
    const { eventId, hostUsername, after } = a.data() as { eventId: string; hostUsername: string; after: string };
    const e = (await db.doc(`events/${eventId}`).get()).data() as Ev | undefined;
    if (!e || e.cancelled || !e.nextStartAt || e.nextStartAt < now.toISOString()) { await a.ref.update({ done: true }); continue; }
    let q = db.collection("follows").where("username", "==", hostUsername).orderBy("followedAt").limit(ANNOUNCE_BATCH);
    if (after) q = q.startAfter(after);
    const f = await q.get();
    const href = withReturn(`/events/${eventId}`, "reminder");
    const message = `${e.hostName} posted a new event: ${e.title}, ${whenText(new Date(e.nextStartAt), new Date(new Date(e.nextStartAt).getTime() + (new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime())))}.`;
    for (const d of f.docs) {
      const who = String(d.data().followerUid ?? "");
      if (!who || who === e.hostUid) continue;
      const to = await getUserEmail(who).catch(() => null);
      if (to) await sendEmail({ to, subject: `New from ${e.hostName}: ${e.title}`, text: `${message}\n\n${SITE_URL}${href}\n\nYou're getting this because you follow ${e.hostName} on #NotesApp. #NotesApp`, bell: { uid: who, type: "event", linkHref: href, message } }).catch(() => {});
      else await notifyBell({ uid: who, type: "event", linkHref: href, message }).catch(() => {});
      await push(who, { title: e.title, body: message, url: href }).catch(() => 0);
      sent++;
    }
    const last = f.docs[f.docs.length - 1];
    await a.ref.update({ after: last ? String(last.data().followedAt) : after, done: f.size < ANNOUNCE_BATCH, sent: FieldValue.increment(f.size) });
  }
  return sent;
}
export { CommunityError };

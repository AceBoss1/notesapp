import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { gateContent } from "./content-checks-server";
import { notifyBell, sendEmail } from "./email";
import { getUserEmail } from "./firebase-admin";
import { SITE_URL } from "./host";
import { commissionRateFor, type CustomRates } from "./tiers";
import type { AccountTier, UserProfile } from "./users";
import type { PaymentRecord } from "./payments";
import { refundFraction } from "./cancellation";
import { whenText } from "./events";
import { whereLine } from "./event-kit";
import { MEETINGS_UPCOMING_MAX, cleanMeeting, forViewer, seatNo, seatsLeft, type MeetingDoc, type MeetingInput, type SeatDoc } from "./meetings";
import { formatNaira } from "./booking-time";

// Meetings on the server (lib/meetings.ts has the rules). Payments go through /api/paystack/initialize (kind "meeting") and
// lib/payments.ts fulfillPayment, which calls readForMeeting / writeMeetingSeat inside its transaction.
export class MeetingError extends Error { constructor(public status: number, message: string) { super(message); } }
export type Mt = MeetingDoc & { id: string };
const seatRef = (db: Firestore, id: string, uid: string) => db.doc(`meetingSeats/${id}_${uid}`);

async function profile(db: Firestore, uid: string) {
  const p = (await db.doc(`users/${uid}`).get()).data() as (UserProfile & { customRates?: CustomRates }) | undefined;
  if (!p || p.suspended) throw new MeetingError(403, "Your account can't do that right now.");
  return p;
}
export async function meetingOf(db: Firestore, id: string): Promise<Mt> {
  const m = (await db.doc(`meetings/${id}`).get()).data() as MeetingDoc | undefined;
  if (!m) throw new MeetingError(404, "That meeting wasn't found.");
  return { ...m, id };
}

export async function createMeeting(db: Firestore, uid: string, raw: MeetingInput, now = new Date()): Promise<Mt> {
  const p = await profile(db, uid);
  if (!p.username) throw new MeetingError(409, "Choose a username first.");
  const r = cleanMeeting(raw, now, uid);
  if (!r.ok) throw new MeetingError(400, r.error);
  if (r.meeting.priceKobo > 0) {
    const payout = (await db.doc(`payoutAccounts/${uid}`).get()).data();
    if (!payout?.recipientCode) throw new MeetingError(409, "Paid seats are paid to your bank account. Add it first, under Rates & payouts.");
  }
  const mine = await db.collection("meetings").where("hostUid", "==", uid).where("startsAt", ">=", now.toISOString()).get().catch(() => null);
  if (mine && mine.size >= MEETINGS_UPCOMING_MAX) throw new MeetingError(409, `You can have up to ${MEETINGS_UPCOMING_MAX} upcoming meetings.`);
  const ref = db.collection("meetings").doc();
  const m: MeetingDoc = { ...r.meeting, hostUid: uid, hostName: p.displayName ?? "", hostUsername: p.username, booked: 0, createdAt: now.toISOString() };
  await gateContent(db, { uid, kind: "event", label: m.title, text: [m.title, m.description, m.where.place].filter(Boolean).join("\n\n"), where: { href: `/meetings/${ref.id}` }, path: ref.path, restore: { set: m }, takedown: { delete: true } });
  await ref.set(JSON.parse(JSON.stringify(m)));
  return { ...m, id: ref.id };
}

export async function updateMeeting(db: Firestore, uid: string, id: string, raw: MeetingInput, now = new Date()): Promise<Mt> {
  const cur = await meetingOf(db, id);
  if (cur.hostUid !== uid) throw new MeetingError(403, "Only the host can change this meeting.");
  if (cur.cancelled) throw new MeetingError(409, "This meeting has been cancelled.");
  const merged = { ...cur, format: cur.where.format, place: cur.where.place, state: cur.where.state, city: cur.where.city, link: cur.where.link, ...raw };
  const r = cleanMeeting(merged, now, uid, cur.booked);
  if (!r.ok) throw new MeetingError(400, r.error);
  // A price can't change once people have paid: they bought at that price.
  if (cur.booked > 0 && r.meeting.priceKobo !== cur.priceKobo) throw new MeetingError(409, "People have already booked: the seat price can't change now.");
  const next = { ...cur, ...r.meeting, updatedAt: now.toISOString() };
  const { id: _id, ...doc } = next;
  void _id;
  await gateContent(db, { uid, kind: "event", label: next.title, text: [next.title, next.description, next.where.place].filter(Boolean).join("\n\n"), where: { href: `/meetings/${id}` }, path: `meetings/${id}`, restore: { set: doc }, takedown: { update: { title: cur.title, description: cur.description } } });
  await db.doc(`meetings/${id}`).set(JSON.parse(JSON.stringify(doc)));
  if (cur.startsAt !== next.startsAt || JSON.stringify(cur.where) !== JSON.stringify(next.where)) await tellSeats(db, next, `${next.title} has changed: ${whenText(new Date(next.startsAt), new Date(next.endsAt))}, ${whereLine(next.where)}.`);
  return next;
}

async function seatsOf(db: Firestore, id: string): Promise<SeatDoc[]> {
  return (await db.collection("meetingSeats").where("meetingId", "==", id).limit(200).get()).docs.map((d) => d.data() as SeatDoc).filter((s) => s.status === "booked");
}
async function tellSeats(db: Firestore, m: Mt, message: string) {
  for (const s of await seatsOf(db, m.id)) {
    const to = await getUserEmail(s.uid).catch(() => null);
    if (to) await sendEmail({ to, subject: m.title, text: `${message}\n\n${SITE_URL}/meetings/${m.id}\n\n#NotesApp`, bell: { uid: s.uid, type: "booking", linkHref: `/meetings/${m.id}`, message } }).catch(() => {});
    else await notifyBell({ uid: s.uid, type: "booking", linkHref: `/meetings/${m.id}`, message }).catch(() => {});
  }
}

// One meeting for a viewer: the link only for the host and people with a seat; the host also sees who's booked.
export async function getMeeting(db: Firestore, id: string, viewerUid: string | null) {
  const m = await meetingOf(db, id);
  const seat = viewerUid ? ((await seatRef(db, id, viewerUid).get()).data() as SeatDoc | undefined) ?? null : null;
  const host = viewerUid === m.hostUid;
  const inIt = host || seat?.status === "booked";
  return {
    meeting: forViewer(m, inIt), left: seatsLeft(m), seat: seat ? { status: seat.status, amountKobo: seat.amountKobo, refundKobo: seat.refundKobo ?? 0 } : null, canManage: host,
    ...(host ? { people: (await seatsOf(db, id)).map((s) => ({ uid: s.uid, name: s.name, paid: s.amountKobo })) } : {}),
  };
}

// A host's upcoming public meetings (their calendar), soonest first.
export async function upcomingMeetings(db: Firestore, hostUsername: string, now = new Date()): Promise<Mt[]> {
  const snap = await db.collection("meetings").where("hostUsername", "==", hostUsername).limit(200).get();
  return snap.docs.map((d) => ({ ...(d.data() as MeetingDoc), id: d.id }))
    .filter((m) => !m.cancelled && m.visibility === "public" && m.endsAt > now.toISOString())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((m) => forViewer(m, false));
}
// The meetings I have a seat in, and the ones I host.
export async function myMeetings(db: Firestore, uid: string, now = new Date()) {
  const [seats, hosting] = await Promise.all([
    db.collection("meetingSeats").where("uid", "==", uid).limit(200).get(),
    db.collection("meetings").where("hostUid", "==", uid).limit(200).get(),
  ]);
  const ids = seats.docs.map((d) => d.data() as SeatDoc).filter((s) => s.status === "booked").map((s) => s.meetingId);
  const booked = ids.length ? (await db.getAll(...ids.map((i) => db.doc(`meetings/${i}`)))).filter((d) => d.exists).map((d) => ({ ...(d.data() as MeetingDoc), id: d.id })) : [];
  const soon = (m: Mt) => !m.cancelled && m.endsAt > now.toISOString();
  return {
    booked: booked.filter(soon).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    hosting: hosting.docs.map((d) => ({ ...(d.data() as MeetingDoc), id: d.id })).filter(soon).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  };
}

// A free seat: taken here. A paid one goes through checkout (meetingCheckout), then fulfillPayment.
export async function takeFreeSeat(db: Firestore, uid: string, id: string, now = new Date()): Promise<void> {
  const p = await profile(db, uid);
  const mref = db.doc(`meetings/${id}`), sref = seatRef(db, id, uid);
  const m = await db.runTransaction(async (t) => {
    const m = (await t.get(mref)).data() as MeetingDoc | undefined;
    if (!m) throw new MeetingError(404, "That meeting wasn't found.");
    if (m.priceKobo > 0) throw new MeetingError(409, "This meeting has paid seats.");
    const cur = (await t.get(sref)).data() as SeatDoc | undefined;
    const no = seatNo(m, uid, now, cur?.status === "booked");
    if (no) throw new MeetingError(409, no);
    t.set(sref, { meetingId: id, uid, name: p.displayName || p.username || "Guest", status: "booked", amountKobo: 0, createdAt: now.toISOString() } satisfies SeatDoc);
    t.update(mref, { booked: FieldValue.increment(1) });
    return m;
  });
  await confirmSeat(db, { ...m, id }, uid);
}
async function confirmSeat(db: Firestore, m: Mt, uid: string) {
  const message = `Your seat is booked: ${m.title}, ${whenText(new Date(m.startsAt), new Date(m.endsAt))}. ${m.where.format === "in_person" ? whereLine(m.where) : "The link is on the meeting page"}.`;
  const to = await getUserEmail(uid).catch(() => null);
  if (to) await sendEmail({ to, subject: `Booked: ${m.title}`, text: `${message}\n\n${SITE_URL}/meetings/${m.id}\n\n#NotesApp`, bell: { uid, type: "booking", linkHref: `/meetings/${m.id}`, message } }).catch(() => {});
  await notifyBell({ uid: m.hostUid, type: "booking", linkHref: `/meetings/${m.id}`, message: `A seat was booked for ${m.title}.` }).catch(() => {});
}

// Checks a paid seat before checkout and fixes the commission now (the host's plan rate, like a session).
export async function meetingCheckout(db: Firestore, uid: string, id: string, now = new Date()) {
  const m = await meetingOf(db, id);
  if (m.priceKobo <= 0) throw new MeetingError(409, "This meeting is free: take a seat on its page.");
  const cur = (await seatRef(db, id, uid).get()).data() as SeatDoc | undefined;
  const no = seatNo(m, uid, now, cur?.status === "booked");
  if (no) throw new MeetingError(409, no);
  const host = (await db.doc(`users/${m.hostUid}`).get()).data() as (UserProfile & { customRates?: CustomRates }) | undefined;
  const buyer = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  return {
    amountKobo: m.priceKobo, hostUid: m.hostUid, hostUsername: m.hostUsername,
    commissionRate: commissionRateFor((host?.accountTier as AccountTier) || "basic", host?.customRates),
    info: { meetingId: id, title: m.title, startsAt: m.startsAt, endsAt: m.endsAt, name: buyer?.displayName || buyer?.username || "Guest" },
  };
}
// Inside fulfillPayment's transaction: reads first, then the writes. false → full or cancelled (the payment is flagged for a refund).
export async function readForMeeting(t: Transaction, db: Firestore, p: PaymentRecord) {
  const id = p.meeting!.meetingId;
  return { m: (await t.get(db.doc(`meetings/${id}`))).data() as MeetingDoc | undefined, seat: (await t.get(seatRef(db, id, p.uid))).data() as SeatDoc | undefined };
}
export function writeMeetingSeat(t: Transaction, db: Firestore, p: PaymentRecord, read: Awaited<ReturnType<typeof readForMeeting>>, now: string): boolean {
  const { m, seat } = read;
  if (!m || m.cancelled || seatsLeft(m) <= 0 || seat?.status === "booked") return false;
  const id = p.meeting!.meetingId;
  t.set(seatRef(db, id, p.uid), { meetingId: id, uid: p.uid, name: p.meeting!.name, status: "booked", reference: p.reference, amountKobo: p.amountKobo, createdAt: now } satisfies SeatDoc);
  t.update(db.doc(`meetings/${id}`), { booked: FieldValue.increment(1) });
  return true;
}
export async function afterPaidSeat(db: Firestore, p: PaymentRecord) {
  const m = await meetingOf(db, p.meeting!.meetingId).catch(() => null);
  if (m) await confirmSeat(db, m, p.uid);
}

// Giving up a seat (the person) or cancelling the whole meeting (the host). Paid seats are refunded under the session policy: 48 hours
// or more before, all of it; 24–48 hours, half; less, none; the host cancelling always refunds in full.
export async function cancelSeat(db: Firestore, uid: string, id: string, refund: (reference: string, amountKobo?: number) => Promise<void>, now = new Date()): Promise<{ refundKobo: number }> {
  const m = await meetingOf(db, id);
  const sref = seatRef(db, id, uid);
  const seat = (await sref.get()).data() as SeatDoc | undefined;
  if (!seat || seat.status !== "booked") throw new MeetingError(404, "You don't have a seat in this meeting.");
  if (new Date(m.startsAt).getTime() <= now.getTime()) throw new MeetingError(409, "The meeting has already started.");
  const refundKobo = await giveBack(db, m, seat, "client", refund, now);
  await notifyBell({ uid: m.hostUid, type: "booking", linkHref: `/meetings/${id}`, message: `${seat.name} gave up their seat for ${m.title}.` }).catch(() => {});
  return { refundKobo };
}
export async function cancelMeeting(db: Firestore, uid: string, id: string, refund: (reference: string, amountKobo?: number) => Promise<void>, now = new Date()): Promise<void> {
  const m = await meetingOf(db, id);
  if (m.hostUid !== uid) throw new MeetingError(403, "Only the host can cancel this meeting.");
  if (m.cancelled) return;
  await db.doc(`meetings/${id}`).update({ cancelled: true, updatedAt: now.toISOString() });
  for (const s of await seatsOf(db, id)) {
    const back = await giveBack(db, m, s, "host", refund, now).catch((e) => { console.error("meeting refund", id, s.uid, e); return 0; });
    const message = `${m.title} has been cancelled by the host.${back ? ` ${formatNaira(back)} is on its way back to you.` : ""}`;
    const to = await getUserEmail(s.uid).catch(() => null);
    if (to) await sendEmail({ to, subject: `Cancelled: ${m.title}`, text: `${message}\n\n#NotesApp`, bell: { uid: s.uid, type: "booking", linkHref: `/meetings/${id}`, message } }).catch(() => {});
  }
}
async function giveBack(db: Firestore, m: Mt, seat: SeatDoc, by: "client" | "host", refund: (reference: string, amountKobo?: number) => Promise<void>, now: Date): Promise<number> {
  const sref = seatRef(db, m.id, seat.uid);
  // Claim the seat first so a double tap can't refund twice.
  const claimed = await db.runTransaction(async (t) => {
    const cur = (await t.get(sref)).data() as SeatDoc | undefined;
    if (cur?.status !== "booked") return false;
    t.update(sref, { status: "cancelled", cancelledAt: now.toISOString(), cancelledBy: by });
    t.update(db.doc(`meetings/${m.id}`), { booked: FieldValue.increment(-1) });
    return true;
  });
  if (!claimed || !seat.reference || seat.amountKobo <= 0) return 0;
  const hours = (new Date(m.startsAt).getTime() - now.getTime()) / 3_600_000;
  const refundKobo = Math.floor(seat.amountKobo * refundFraction(hours, by === "host" ? "publisher" : "client"));
  const lref = db.doc(`ledger/${seat.reference}`);
  const l = (await lref.get()).data();
  if (refundKobo > 0 && l && (l.status === "held" || l.status === "disputed")) {
    await refund(seat.reference, refundKobo === seat.amountKobo ? undefined : refundKobo);
    if (refundKobo === seat.amountKobo) await Promise.all([lref.update({ status: "refunded" }), db.doc(`payments/${seat.reference}`).update({ status: "refunded" })]);
    else {
      const kept = seat.amountKobo - refundKobo, rate = Number((await db.doc(`payments/${seat.reference}`).get()).data()?.commissionRate ?? 0);
      const commissionKobo = Math.round(kept * rate);
      await lref.update({ grossKobo: kept, commissionKobo, netKobo: kept - commissionKobo });
    }
    await sref.update({ status: "refunded", refundKobo });
  }
  return refundKobo;
}

// The cron: reminders 24 hours and 1 hour before, to everyone with a seat (with the link or the address), once each.
export async function sendMeetingReminders(db: Firestore, now = new Date()): Promise<number> {
  const soon = await db.collection("meetings").where("startsAt", ">=", now.toISOString()).where("startsAt", "<=", new Date(now.getTime() + 24 * 3_600_000).toISOString()).limit(300).get();
  let sent = 0;
  for (const d of soon.docs) {
    const m = { ...(d.data() as MeetingDoc), id: d.id };
    if (m.cancelled || !m.booked) continue;
    const left = new Date(m.startsAt).getTime() - now.getTime();
    const kind = left <= 3_600_000 ? "hour" : "day";
    const key = db.doc(`meetingReminders/${m.id}_${kind}`);
    const first = await db.runTransaction(async (t) => { if ((await t.get(key)).exists) return false; t.set(key, { at: now.toISOString() }); return true; });
    if (!first) continue;
    const where = m.where.format === "in_person" ? whereLine(m.where) : m.where.format === "online" ? `Online: ${m.where.link}` : `${whereLine(m.where)}, or online: ${m.where.link}`;
    const message = kind === "hour" ? `${m.title} starts in an hour. ${where}` : `${m.title} is tomorrow: ${whenText(new Date(m.startsAt), new Date(m.endsAt))}. ${where}`;
    for (const s of [...(await seatsOf(db, m.id)).map((x) => x.uid), m.hostUid]) {
      const to = await getUserEmail(s).catch(() => null);
      if (to) await sendEmail({ to, subject: kind === "hour" ? `Starting soon: ${m.title}` : `Tomorrow: ${m.title}`, text: `${message}\n\n${SITE_URL}/meetings/${m.id}\n\n#NotesApp`, bell: { uid: s, type: "booking", linkHref: `/meetings/${m.id}`, message: message.split(". ")[0] + "." } }).catch(() => {});
      sent++;
    }
  }
  return sent;
}

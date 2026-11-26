// Events, meetings, sessions' places and invitations on the server, against the Firestore emulator (docs/EVENTS_DISCOVER.md).
// Run: npm run test:events-discover-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as E from "../../lib/events-server";
import * as D from "../../lib/events-discover-server";
import * as M from "../../lib/meetings-server";
import * as I from "../../lib/event-invites-server";
import { setTicketTypes } from "../../lib/tickets-server";
import type { PaymentRecord } from "../../lib/payments";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => assert.rejects(p, (e: unknown) => (e as { status?: number }).status === status && (!re || re.test((e as Error).message)), `expected ${status} ${re ?? ""}`);
const user = (uid: string, extra: Record<string, unknown> = {}) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid.toUpperCase(), role: "publisher", accountTier: "basic", createdAt: "2026-01-01T00:00:00.000Z", ...extra });
const H = 3_600_000;

(async () => {
  const now = new Date();
  const at = (h: number) => new Date(now.getTime() + h * H).toISOString();
  await Promise.all(["host", "ada", "bo", "cy", "dee"].map((u) => user(u)));
  await db.doc("payoutAccounts/host").set({ recipientCode: "RCP_x" });

  // ── Events: category, theme, in person / online / both ──
  const hyb = await E.createEvent(db, "host", { title: "Lagos Product Night", startsAt: at(30), format: "hybrid", place: "The Workspace, Yaba", city: "lagos", state: "Lagos", online: "link", liveUrl: "https://meet.google.com/abc", category: "tech", theme: "forest", pattern: "africa", capacity: 2 });
  assert.equal(hyb.format, "hybrid");
  assert.equal(hyb.category, "tech");
  assert.deepEqual([hyb.theme, hyb.pattern], ["forest", "africa"]);
  assert.equal(hyb.liveUrl, "https://meet.google.com/abc");
  const onl = await E.createEvent(db, "host", { title: "Women in Data: Excel", startsAt: at(50), format: "online", online: "notesapp", category: "education" });
  assert.equal(onl.liveUrl, "", "online on #NotesApp needs no link");
  await fails(E.createEvent(db, "host", { title: "Nowhere", startsAt: at(5), format: "in_person" }), 400, /where it is/);
  // An older-style event (a place and a Join live link, no format) still reads as before: in person and online.
  const old = await E.createEvent(db, "host", { title: "Old style", startsAt: at(70), place: "Hall", liveUrl: "https://youtube.com/live/x" });
  assert.equal(old.format, "hybrid");

  // ── Guest limit and approval ──
  assert.equal((await E.rsvp(db, "ada", hyb.id, "going")).going, 1);
  assert.equal((await E.rsvp(db, "bo", hyb.id, "going")).going, 2);
  await fails(E.rsvp(db, "cy", hyb.id, "going"), 409, /full/);
  const appr = await E.createEvent(db, "host", { title: "Founders brunch", startsAt: at(40), place: "Lekki", city: "Lagos", approval: true, category: "networking" });
  const req = await E.rsvp(db, "ada", appr.id, "going");
  assert.equal(req.rsvp, "requested", "Going on an approval event is a request");
  assert.equal(req.going, 0);
  assert.equal(req.requested, 1);
  await E.rsvp(db, "bo", appr.id, "going");
  const people = await E.joinRequests(db, "host", appr.id);
  assert.deepEqual(people.map((p) => p.uid).sort(), ["ada", "bo"]);
  await fails(E.joinRequests(db, "ada", appr.id), 403);
  await E.decideRequest(db, "host", appr.id, "ada", true);
  await E.decideRequest(db, "host", appr.id, "bo", false);
  await fails(E.decideRequest(db, "host", appr.id, "bo", true), 409, /already been answered/);
  const ev = (await db.doc(`events/${appr.id}`).get()).data()!;
  assert.deepEqual([ev.going, ev.requested], [1, 0]);
  assert.equal((await db.doc(`eventRsvps/${appr.id}_ada`).get()).data()!.status, "going");
  assert.equal((await db.doc(`eventRsvps/${appr.id}_bo`).get()).exists, false);
  await fails(setTicketTypes(db, "host", appr.id, [{ name: "Regular", priceKobo: 100_000, quantity: 10 }]), 409, /approval/);

  // ── The online link of a ticketed event is for people who are in ──
  const paid = await E.createEvent(db, "host", { title: "Paid webinar", startsAt: at(60), format: "online", online: "link", liveUrl: "https://zoom.us/j/1", category: "business" });
  await setTicketTypes(db, "host", paid.id, [{ name: "Regular", priceKobo: 300_000, quantity: 50 }]);
  assert.equal((await db.doc(`events/${paid.id}`).get()).data()!.priceFromKobo, 300_000, "cards know the cheapest ticket");
  const outsider = await E.getEvent(db, paid.id, "cy");
  assert.equal(outsider.event.liveUrl, "");
  assert.equal((outsider.event as { linkHidden?: boolean }).linkHidden, true);
  assert.equal((await E.getEvent(db, paid.id, "host")).event.liveUrl, "https://zoom.us/j/1");
  await db.doc("tickets/T1").set({ code: "T1", eventId: paid.id, holderUid: "dee", status: "valid" });
  assert.equal((await E.getEvent(db, paid.id, "dee")).event.liveUrl, "https://zoom.us/j/1", "a ticket holder sees it");
  assert.ok(!(await E.upcoming(db, { host: "host" }, null)).some((e) => e.id === paid.id && e.liveUrl), "lists never carry it");

  // ── Followers hear about a new public event ──
  await db.doc("follows/cy_host").set({ followerUid: "cy", username: "host", followedAt: "2026-11-01T00:00:00.000Z" });
  await db.doc("follows/dee_host").set({ followerUid: "dee", username: "host", followedAt: "2026-11-02T00:00:00.000Z" });
  const pushes: string[] = [];
  const sent = await E.sendAnnouncements(db, now, async (u) => { pushes.push(u); return 1; });
  assert.ok(sent >= 2 && pushes.includes("cy") && pushes.includes("dee"));
  assert.equal(await E.sendAnnouncements(db, now, async () => 1), 0, "each event once");

  // ── Discover ──
  const disc = await D.discover(db, "Lagos");
  assert.ok(disc.cityHasEvents);
  assert.ok(disc.featured.every((c) => c.city === "Lagos"));
  assert.equal(disc.categories.tech, 1);
  assert.equal(disc.categories.education, 1);
  assert.ok(disc.regions.find((r) => r.id === "nigeria")!.cities.find((c) => c.city === "Lagos")!.count >= 2);
  assert.ok(disc.calendars.some((c) => c.username === "host" && c.followers === 2));
  assert.deepEqual((await D.discoverList(db, { category: "education" })).map((c) => c.id), [onl.id]);
  assert.deepEqual((await D.discoverList(db, { region: "online" })).map((c) => c.id).sort(), [onl.id, paid.id].sort());

  // ── Meetings ──
  await fails(M.createMeeting(db, "ada", { title: "Office hours", startsAt: at(48), format: "online", link: "https://meet.google.com/x", seats: 3, priceKobo: 200_000 }), 409, /bank account/);
  const free = await M.createMeeting(db, "host", { title: "CV clinic", startsAt: at(48), format: "in_person", place: "Ikeja Library", city: "Lagos", seats: 2, priceKobo: 0 });
  await M.takeFreeSeat(db, "ada", free.id);
  await fails(M.takeFreeSeat(db, "ada", free.id), 409, /already have a seat/);
  await M.takeFreeSeat(db, "bo", free.id);
  await fails(M.takeFreeSeat(db, "cy", free.id), 409, /full/);
  const refunds: [string, number | undefined][] = [];
  const refund = async (r: string, k?: number) => { refunds.push([r, k]); };
  await M.cancelSeat(db, "bo", free.id, refund);
  assert.equal((await db.doc(`meetings/${free.id}`).get()).data()!.booked, 1);
  await M.takeFreeSeat(db, "cy", free.id);
  assert.equal(refunds.length, 0, "free seats: nothing to refund");

  const pm = await M.createMeeting(db, "host", { title: "Founder office hours", startsAt: at(36), endsAt: at(37), format: "online", link: "https://meet.google.com/abc", seats: 5, priceKobo: 200_000 });
  const co = await M.meetingCheckout(db, "ada", pm.id);
  assert.equal(co.amountKobo, 200_000);
  assert.equal(co.commissionRate > 0, true, "the host's plan commission, like a session");
  // The payment lands: fulfillPayment's reads and writes.
  const pay = { reference: "ref_pm_ada", kind: "meeting", uid: "ada", email: "a@x.ng", amountKobo: 200_000, status: "pending", publisherUid: "host", publisherUsername: "host", commissionRate: co.commissionRate, meeting: co.info, createdAt: now.toISOString() } as PaymentRecord;
  await db.runTransaction(async (t) => { const r = await M.readForMeeting(t, db, pay); assert.ok(M.writeMeetingSeat(t, db, pay, r, now.toISOString())); });
  await db.doc("ledger/ref_pm_ada").set({ reference: "ref_pm_ada", status: "held", grossKobo: 200_000, commissionKobo: 50_000, netKobo: 150_000 });
  await db.doc("payments/ref_pm_ada").set({ ...pay, status: "paid" });
  const view = await M.getMeeting(db, pm.id, "ada");
  assert.equal(view.meeting.where.link, "https://meet.google.com/abc", "a seat holder sees the link");
  assert.equal((await M.getMeeting(db, pm.id, "cy")).meeting.where.link, "", "others don't");
  await db.runTransaction(async (t) => { const r = await M.readForMeeting(t, db, pay); assert.equal(M.writeMeetingSeat(t, db, pay, r, now.toISOString()), false, "a second seat for the same person is refused"); });
  // 36 hours before: half back (the session policy).
  const r1 = await M.cancelSeat(db, "ada", pm.id, refund);
  assert.equal(r1.refundKobo, 100_000);
  assert.deepEqual(refunds.at(-1), ["ref_pm_ada", 100_000]);
  assert.equal((await db.doc("ledger/ref_pm_ada").get()).data()!.grossKobo, 100_000, "the host keeps the rest, less commission");
  // The host cancels: everyone else refunded in full.
  await M.cancelMeeting(db, "host", free.id, refund);
  assert.equal((await db.doc(`meetings/${free.id}`).get()).data()!.cancelled, true);
  await fails(M.takeFreeSeat(db, "dee", free.id), 409, /cancelled/);

  // ── A #NotesApp meeting room: only the host and people with a seat get in ──
  const rm = await M.createMeeting(db, "host", { title: "Cohort call", startsAt: new Date(now.getTime() + 10 * 60_000).toISOString(), endsAt: at(1), format: "online", seats: 10, priceKobo: 0 });
  assert.equal(rm.where.online, "notesapp");
  await M.takeFreeSeat(db, "ada", rm.id);
  await fails(M.startMeetingRoom(db, "ada", rm.id), 403);
  const later = await M.createMeeting(db, "host", { title: "Later call", startsAt: at(30), format: "online", seats: 4, priceKobo: 0 });
  await fails(M.startMeetingRoom(db, "host", later.id), 409, /30 minutes/);
  const { roomId } = await M.startMeetingRoom(db, "host", rm.id);
  const room = (await db.doc(`communityRooms/${roomId}`).get()).data()!;
  assert.equal(room.profile.meetingId, rm.id);
  const { mayWatchProfileLive } = await import("../../lib/rooms-server");
  assert.equal(await mayWatchProfileLive(db, room.profile, "ada"), true, "a seat holder gets in");
  assert.equal(await mayWatchProfileLive(db, room.profile, "cy"), false, "others don't, even followers");
  assert.equal((await M.startMeetingRoom(db, "host", rm.id)).roomId, roomId, "opening it again goes back to the same room");
  assert.equal((await M.getMeeting(db, rm.id, "ada")).roomLive, true);
  assert.equal((await M.getMeeting(db, rm.id, "cy")).meeting.roomId, undefined);

  // ── Invitations: followers and emails, counted against the week ──
  const inv = await I.sendInvites(db, "host", { kind: "event", id: onl.id, followers: true, emails: "x@example.com, y@example.com, bad" });
  assert.deepEqual([inv.invited, inv.skipped], [4, 1]);
  const wk = await I.inviteWeek(db, "host");
  assert.deepEqual([wk.allowance, wk.sent, wk.left], [500, 4, 496]);
  await db.doc(`inviteWeeks/host_${wk.week}`).set({ sent: 499 }, { merge: true });
  const inv2 = await I.sendInvites(db, "host", { kind: "meeting", id: pm.id, emails: "p@x.ng q@x.ng r@x.ng" });
  assert.deepEqual([inv2.invited, inv2.notInvited, inv2.left], [1, 2, 0]);
  await fails(I.sendInvites(db, "host", { kind: "meeting", id: pm.id, emails: "s@x.ng" }), 409, /this week/);
  await db.doc("invitePacks/host").set({ sends: 10_000, until: new Date(now.getTime() + 20 * 24 * H).toISOString() });
  assert.equal((await I.inviteWeek(db, "host")).allowance, 10_500, "a pack adds to the week");
  await fails(I.sendInvites(db, "ada", { kind: "event", id: onl.id, emails: "z@x.ng" }), 403);
  const done = (await db.collection("inviteJobs").get()).docs.map((d) => d.data()).every((j) => j.done === true);
  assert.ok(done, "small sends finish at once");

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

// Community and events, the pure rules (lib/community.ts, lib/events.ts). Run: npm run test:community → "ALL OK".
import assert from "node:assert/strict";
import {
  DEFAULT_PUBLIC, can, canActOn, canGiveRole, canPostIn, cleanSettings, cleanSlug, cleanSpaces, effectiveRole, isPublicPost, readableChannels, slowWait, tabsFor,
  type Community,
} from "../../lib/community";
import { cleanEvent, liveHost, occurrences, reminderDue, toIcs, whenText, type EventDoc } from "../../lib/events";

// Roles: moderators keep order, admins run it, only the owner makes admins; nobody acts on the owner or on their equal.
assert.equal(can("member", "post_general"), false); assert.equal(can("admin", "post_general"), true);
assert.equal(can("moderator", "approve"), true); assert.equal(can("moderator", "settings"), false); assert.equal(can(null, "comment"), false);
assert.equal(canActOn("moderator", "member"), true); assert.equal(canActOn("moderator", "moderator"), false); assert.equal(canActOn("admin", "owner"), false); assert.equal(canActOn("owner", "admin"), true);
assert.equal(canGiveRole("admin", "moderator"), true); assert.equal(canGiveRole("admin", "admin"), false); assert.equal(canGiveRole("owner", "admin"), true); assert.equal(canGiveRole("owner", "owner"), false);
// View as: only admins, and never more than they are.
assert.equal(effectiveRole("admin", "nonmember"), null); assert.equal(effectiveRole("admin", "moderator"), "moderator");
assert.equal(effectiveRole("admin", "owner"), "admin", "can't preview above yourself"); assert.equal(effectiveRole("moderator", "nonmember"), "moderator", "moderators can't use View as");
assert.equal(effectiveRole("owner", "admin"), "admin"); assert.equal(effectiveRole(null, "admin"), null);

// What non-members see: the home page always, the rest as the admins choose.
const base: Community = { id: "grace", name: "Grace", ownerUid: "o", tagline: "", about: "We meet on Sundays.", contact: "12 Road", avatar: "", cover: "", joinMode: "open", questions: [], publicView: DEFAULT_PUBLIC, slowModeSec: 0, spaces: [{ id: "updates", name: "Updates", visibility: "public", whoPosts: "admins" }, { id: "corner", name: "Corner", visibility: "members", whoPosts: "members" }], inviteCode: "x", memberCount: 1, verified: false, createdAt: "" };
assert.deepEqual(tabsFor(base, null), ["home", "general", "spaces", "events", "about", "contact"]);
const closed = { ...base, publicView: { ...DEFAULT_PUBLIC, general: false, about: false, contact: false, events: false } };
assert.deepEqual(tabsFor(closed, null), ["home", "spaces"]);
assert.deepEqual(tabsFor(closed, "member"), ["home", "general", "spaces", "events", "members", "about", "contact", "circles"]);
assert.ok(tabsFor(base, "moderator").includes("admin")); assert.ok(!tabsFor(base, "member").includes("admin"));
assert.deepEqual(readableChannels(base, null), ["general", "updates"]); assert.deepEqual(readableChannels(closed, null), ["updates"]);
assert.deepEqual(readableChannels(base, "member"), ["general", "updates", "corner"]);
assert.equal(canPostIn(base, "member", "general"), false); assert.equal(canPostIn(base, "member", "corner"), true); assert.equal(canPostIn(base, "member", "updates"), false); assert.equal(canPostIn(base, "admin", "updates"), true);
assert.equal(isPublicPost(base, "corner"), false, "members-only never leaves"); assert.equal(isPublicPost(base, "general"), true); assert.equal(isPublicPost(closed, "general"), false);
// Slow mode: members wait; moderators never do.
const now = new Date("2026-10-21T12:00:00Z");
assert.equal(slowWait("member", "2026-10-21T11:59:30Z", 60, now), 30); assert.equal(slowWait("member", "2026-10-21T11:58:00Z", 60, now), 0);
assert.equal(slowWait("moderator", "2026-10-21T11:59:59Z", 3600, now), 0); assert.equal(slowWait("member", undefined, 60, now), 0);
// Cleaning what admins send.
assert.equal(cleanSlug("Grace Chapel, Lekki!"), "grace-chapel-lekki"); assert.equal(cleanSlug("ab"), ""); assert.equal(cleanSlug("admin"), "");
assert.deepEqual(cleanSpaces([{ name: "Youth" }, { name: "Youth" }, { name: "General" }, { name: "" }, { name: "Board", visibility: "members", whoPosts: "admins" }]).map((s) => [s.id, s.visibility, s.whoPosts]), [["youth", "public", "members"], ["board", "members", "admins"]]);
const st = cleanSettings({ joinMode: "nope", slowModeSec: 45, questions: ["Which branch?", "", "a", "b", "c", "d", "e"], publicView: { general: false }, avatar: "javascript:x" });
assert.equal(st.joinMode, "open"); assert.equal(st.slowModeSec, 0); assert.equal(st.questions!.length, 5); assert.equal(st.publicView!.general, false); assert.equal(st.publicView!.about, true); assert.equal(st.avatar, "");

// Events
const at = new Date("2026-10-21T08:00:00Z");
const ok = cleanEvent({ title: "Sunday service", startsAt: "2026-10-25T08:00:00+01:00", place: "Grace Chapel", repeat: "weekly", visibility: "members" }, at, { community: true });
assert.ok(ok.ok); if (ok.ok) { assert.equal(ok.event.endsAt, "2026-10-25T09:00:00.000Z", "two hours by default"); assert.equal(ok.event.visibility, "members"); }
const notCommunity = cleanEvent({ title: "Launch", startsAt: "2026-10-25T08:00:00Z", liveUrl: "https://youtube.com/live/x", visibility: "members" }, at, { community: false });
assert.ok(notCommunity.ok && notCommunity.event.visibility === "public", "only a community's events can be members only");
for (const [bad, re] of [[{ title: "x", startsAt: "2026-10-25T08:00:00Z", place: "p" }, /name/], [{ title: "Old", startsAt: "2026-10-01T08:00:00Z", place: "p" }, /passed/], [{ title: "No place", startsAt: "2026-10-25T08:00:00Z" }, /where/], [{ title: "Bad link", startsAt: "2026-10-25T08:00:00Z", liveUrl: "http://x" }, /https/], [{ title: "Backwards", startsAt: "2026-10-25T08:00:00Z", endsAt: "2026-10-25T07:00:00Z", place: "p" }, /after/]] as const) {
  const r = cleanEvent(bad, at, { community: false }); assert.ok(!r.ok && re.test(r.error), JSON.stringify(bad));
}
const weekly = { startsAt: "2026-10-04T07:00:00.000Z", endsAt: "2026-10-04T09:00:00.000Z", repeat: "weekly" as const };
assert.deepEqual(occurrences(weekly, at, 3).map((o) => o.start.toISOString()), ["2026-10-25T07:00:00.000Z", "2026-11-01T07:00:00.000Z", "2026-11-08T07:00:00.000Z"]);
assert.equal(occurrences({ ...weekly, repeatUntil: "2026-10-30T00:00:00Z" }, at, 5).length, 1, "stops at repeatUntil");
const monthly = { startsAt: "2026-01-31T09:00:00.000Z", endsAt: "2026-01-31T10:00:00.000Z", repeat: "monthly" as const };
assert.deepEqual(occurrences(monthly, new Date("2026-01-01T00:00:00Z"), 3).map((o) => o.start.toISOString().slice(0, 10)), ["2026-01-31", "2026-02-28", "2026-03-31"], "the month's last day when it's shorter");
assert.equal(occurrences({ ...weekly, repeat: "none" }, at, 3).length, 0, "a one-off in the past");
assert.equal(reminderDue(new Date(at.getTime() + 30 * 60_000), at), "hour"); assert.equal(reminderDue(new Date(at.getTime() + 20 * 3_600_000), at), "day");
assert.equal(reminderDue(new Date(at.getTime() + 30 * 3_600_000), at), null); assert.equal(reminderDue(new Date(at.getTime() - 60_000), at), null);
assert.equal(liveHost("https://www.youtube.com/live/abc"), "YouTube Live"); assert.equal(liveHost("https://us02web.zoom.us/j/1"), "Zoom"); assert.equal(liveHost("https://meet.google.com/x"), "Google Meet"); assert.equal(liveHost("https://example.com"), "Join live");
assert.match(whenText(new Date("2026-10-25T08:00:00Z"), new Date("2026-10-25T10:00:00Z")), /9:00.*11:00.*Lagos time/);
const ev: EventDoc & { id: string } = { id: "e1", hostUid: "h", hostName: "Grace", hostUsername: "grace", title: "Service, with; commas", description: "Bring a friend", startsAt: "2026-10-25T08:00:00.000Z", endsAt: "2026-10-25T10:00:00.000Z", place: "Grace Chapel", state: "Lagos", city: "Lekki", liveUrl: "https://youtube.com/live/x", repeat: "weekly", visibility: "public", going: 0, interested: 0, createdAt: "" };
const ics = toIcs(ev, "https://www.notesapp.name.ng/events/e1", at);
assert.match(ics, /BEGIN:VEVENT\r\nUID:e1@notesapp\.name\.ng/); assert.match(ics, /DTSTART:20261025T080000Z/); assert.ok(ics.includes("SUMMARY:Service\\, with\\; commas"), "commas and semicolons escaped"); assert.match(ics, /RRULE:FREQ=WEEKLY/);
assert.ok(ics.split("\r\n").every((l) => l.length <= 75), "lines folded");
console.log("ALL OK");

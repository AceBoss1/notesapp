// The campus programme's pure rules (lib/campus.ts). Run inside npm run test:campus.
import assert from "node:assert/strict";
import { badgesOf } from "../../lib/name-badges";
import { CAMPUS_COUNTRIES, badgeFor, cleanReward, eligibility, sameCampus, approvedTally, campusDay, campusPages, cleanTask, cleanUrl, isOverdue, lagosDay, levelFor, pointsOf, shortName, taskCounts, type CampusTask } from "../../lib/campus";

assert.equal(lagosDay(new Date("2026-11-14T23:30:00Z")), "2026-11-15", "Lagos is an hour ahead");
assert.throws(() => cleanTask({ title: "x", due: "2026-11-20" }, "2026-11-15"), /title/);
assert.throws(() => cleanTask({ title: "Stand", due: "soon" }, "2026-11-15"), /due date/);
assert.throws(() => cleanTask({ title: "Stand", due: "2026-11-14" }, "2026-11-15"), /passed/);
assert.throws(() => cleanTask({ title: "Sign-ups", kind: "signups", due: "2026-11-20" }, "2026-11-15"), /how many/);
assert.deepEqual(cleanTask({ title: "  Bring   sign-ups ", kind: "signups", target: "10", due: "2026-11-20" }, "2026-11-15"), { title: "Bring sign-ups", details: "", kind: "signups", target: 10, due: "2026-11-20" });
assert.equal(cleanTask({ title: "Stand", kind: "weird", due: "2026-11-15" }, "2026-11-15").kind, "other");
assert.equal(cleanUrl(""), undefined);
assert.equal(cleanUrl("https://x.test/a"), "https://x.test/a");
assert.throws(() => cleanUrl("ftp://x"), /https/);

const t = (due: string, progress: CampusTask["progress"]): CampusTask => ({ id: due, country: "NG", coordinatorUid: "c", title: "t", details: "", kind: "other", due, assignees: Object.keys(progress), progress, createdBy: "c", createdAt: "", updatedAt: "" });
assert.equal(isOverdue({ due: "2026-11-14" }, undefined, "2026-11-15"), true);
assert.equal(isOverdue({ due: "2026-11-14" }, { status: "done" }, "2026-11-15"), false);
assert.equal(isOverdue({ due: "2026-11-15" }, undefined, "2026-11-15"), false, "due today isn't late yet");
assert.deepEqual(taskCounts([t("2026-11-10", { a: { status: "done" } }), t("2026-11-10", { a: { status: "doing" } }), t("2026-11-20", { a: { status: "done", review: "redo" } }), t("2026-11-20", { b: { status: "todo" } })], "a", "2026-11-15"),
  { done: 1, open: 2, overdue: 1, redo: 1 });

assert.deepEqual(campusPages({ lead: false, role: null }), []);
assert.deepEqual(campusPages({ lead: false, role: "ambassador" }).map((p) => p.label), ["My campus", "Tasks", "Leaderboard", "Rewards"]);
assert.deepEqual(campusPages({ lead: false, role: "coordinator" }).map((p) => p.label), ["Overview", "Tasks", "Leaderboard", "Rewards", "Ambassadors"]);
assert.deepEqual(campusPages({ lead: true, role: null }).map((p) => p.label), ["Overview", "Tasks", "Leaderboard", "Rewards", "Ambassadors", "Coordinators"]);

// Countries: Nigeria, Kenya, Botswana and Ghana, each counting days in its own time.
assert.deepEqual(CAMPUS_COUNTRIES.map((c) => c.code), ["NG", "KE", "BW", "GH"]);
const late = new Date("2026-11-30T22:30:00Z");
assert.equal(campusDay("GH", late), "2026-11-30", "Accra is on UTC");
assert.equal(campusDay("NG", late), "2026-11-30", "23:30 in Lagos");
assert.equal(campusDay("BW", late), "2026-12-01", "00:30 in Gaborone");
assert.equal(campusDay("KE", late), "2026-12-01", "01:30 in Nairobi");
assert.equal(campusDay(undefined, late), lagosDay(late));

// Points and levels.
assert.equal(pointsOf({ signups: 3, approved: 2, onTime: 1 }), 30 + 40 + 10);
assert.equal(levelFor(0).level.name, "Rookie"); assert.equal(levelFor(0).toNext, 100);
assert.equal(levelFor(100).level.name, "Rising");
assert.equal(levelFor(749).level.name, "Star"); assert.equal(levelFor(749).toNext, 1);
assert.equal(levelFor(5000).level.name, "Legend"); assert.equal(levelFor(5000).next, null);
assert.equal(shortName("Chioma Ngozi Eze"), "Chioma E."); assert.equal(shortName("Ada"), "Ada"); assert.equal(shortName("  "), "");
// Approved tasks: counted in the month they were approved, on time when reported by the due day (in the country's time).
const done = (due: string, updatedAt: string, reviewedAt: string, review: "approved" | "redo" = "approved"): CampusTask => ({ ...t(due, { a: { status: "done", review, updatedAt, reviewedAt } }) });
assert.deepEqual(approvedTally([
  done("2026-11-10", "2026-11-10T21:30:00Z", "2026-11-12T10:00:00Z"), // 00:30 on the 11th in Nairobi: late there
  done("2026-11-20", "2026-11-19T10:00:00Z", "2026-10-31T10:00:00Z"), // approved last month
  done("2026-11-20", "2026-11-19T10:00:00Z", "2026-11-19T10:00:00Z", "redo"),
], "a", "2026-11-01", "KE"), { month: { approved: 1, onTime: 0 }, all: { approved: 2, onTime: 1 } });
// Badges: the coordinator wears the maroon team mark; ambassadors and Campus Leads the white one; staff keep theirs.
assert.equal(badgeFor({ role: "coordinator" }), "coordinator");
assert.equal(badgeFor({ role: "ambassador", campusLead: true }), "lead");
assert.equal(badgeFor({ role: "ambassador" }), "ambassador");
assert.equal(badgeFor(null), null);
const prof = (campusBadge?: "coordinator" | "lead" | "ambassador", role = "reader") => ({ uid: "u", username: "u", displayName: "U", bio: "", avatar: "", social: {}, role, createdAt: "", accountTier: "standard", suspended: false, ...(campusBadge ? { campusBadge } : {}) }) as never;
assert.deepEqual(badgesOf(prof("coordinator")), { level: null, team: true });
assert.deepEqual(badgesOf(prof("ambassador")), { level: null, team: false, campus: "ambassador" });
assert.deepEqual(badgesOf(prof("lead")), { level: null, team: false, campus: "lead" });
assert.equal(badgesOf(prof("ambassador", "staff")).campus, undefined, "staff already wear the team mark");
assert.equal(badgesOf({ ...(prof("ambassador") as object), suspended: true } as never).campus, undefined, "none while suspended");
assert.ok(sameCampus("University of Lagos", "university-of-lagos ") && !sameCampus("UNILAG", "University of Lagos"));

// Rewards: what a lead posts, and who can claim it.
assert.throws(() => cleanReward({ country: "ZA", kind: "perk", title: "Pass", closesOn: "2026-12-01" }, "2026-11-15", ["tshirt"]), /country/);
assert.throws(() => cleanReward({ country: "NG", kind: "merch", title: "Free tee", closesOn: "2026-12-01" }, "2026-11-15", ["tshirt"]), /merch item/);
assert.throws(() => cleanReward({ country: "NG", kind: "perk", title: "Pass", closesOn: "2026-11-01" }, "2026-11-15", []), /passed/);
assert.deepEqual(cleanReward({ country: "all", kind: "merch", merchItemId: "tshirt", title: "Welcome tee", minLevel: "Rookie", leadsOnly: false, closesOn: "2026-12-01" }, "2026-11-15", ["tshirt"]),
  { country: "all", kind: "merch", title: "Welcome tee", partner: "#NotesApp", details: "", merchItemId: "tshirt", closesOn: "2026-12-01" }, "Rookie means no minimum");
const base = { country: "NG" as const, active: true, closesOn: "2026-11-30" };
const amb = { country: "NG", pointsAll: 120, monthRank: 4 };
assert.deepEqual(eligibility(base, amb, "2026-11-15"), { ok: true });
assert.match(eligibility({ ...base, country: "KE" }, amb, "2026-11-15").why!, /Kenya/);
assert.match(eligibility(base, amb, "2026-12-01").why!, /closed/);
assert.match(eligibility({ ...base, leadsOnly: true }, amb, "2026-11-15").why!, /Campus Leads/);
assert.equal(eligibility({ ...base, leadsOnly: true }, { ...amb, campusLead: true }, "2026-11-15").ok, true);
assert.match(eligibility({ ...base, minLevel: "Star" }, amb, "2026-11-15").why!, /Star first \(180 more points\)/);
assert.match(eligibility({ ...base, topN: 3 }, amb, "2026-11-15").why!, /top 3 .*#4/);
assert.equal(eligibility({ ...base, topN: 5 }, amb, "2026-11-15").ok, true);
assert.match(eligibility({ ...base, active: false }, amb, "2026-11-15").why!, /closed/);

console.log("CAMPUS RULES OK");

// The campus programme's pure rules (lib/campus.ts). Run inside npm run test:campus.
import assert from "node:assert/strict";
import { campusPages, cleanTask, cleanUrl, isOverdue, lagosDay, taskCounts, type CampusTask } from "../../lib/campus";

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
assert.deepEqual(campusPages({ lead: false, role: "ambassador" }).map((p) => p.label), ["My campus", "Tasks"]);
assert.deepEqual(campusPages({ lead: false, role: "coordinator" }).map((p) => p.label), ["Overview", "Tasks", "Ambassadors"]);
assert.deepEqual(campusPages({ lead: true, role: null }).map((p) => p.label), ["Overview", "Tasks", "Ambassadors", "Coordinators"]);
console.log("CAMPUS RULES OK");

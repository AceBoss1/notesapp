// Admin → #Nana-HR inbox, the pure rules (lib/hr-inbox.ts): what a thread shows in the list, unread = the applicant's replies after the
// team last read it, needs reply = the applicant wrote last, the filters and newest-first order. Run: npm run test:hr-inbox
import assert from "node:assert/strict";
import { HR_INBOX_FILTERS, filterRows, isHrInboxFilter, sortRows, threadSummary, type HrInboxRow } from "../../lib/hr-inbox";

const l = (from: string, createdAt: string, text = from) => ({ from, createdAt, text, label: from === "applicant" ? "Bola" : "HR, #NotesApp" });

// never read: every applicant reply is unread; order is by time, not by how they came
const t1 = threadSummary([l("applicant", "2026-11-26T10:05:00Z", "second"), l("hr", "2026-11-26T09:00:00Z"), l("applicant", "2026-11-26T10:00:00Z", "first")]);
assert.deepEqual([t1.unread, t1.needsReply, t1.lastText, t1.lastFrom, t1.count, t1.lastAt], [2, true, "second", "applicant", 3, "2026-11-26T10:05:00Z"]);
// read at 10:01: only the later reply is unread; the team's own messages never count
assert.equal(threadSummary([l("applicant", "2026-11-26T10:00:00Z"), l("applicant", "2026-11-26T10:05:00Z"), l("me", "2026-11-26T10:06:00Z")], "2026-11-26T10:01:00Z").unread, 1);
// the team answered last: nothing needed, and the last line shows who from
const t3 = threadSummary([l("applicant", "2026-11-26T10:00:00Z"), l("nana", "2026-11-26T11:00:00Z", "Hello Bola")], "2026-11-26T11:00:00Z");
assert.deepEqual([t3.unread, t3.needsReply, t3.lastFrom, t3.lastLabel], [0, false, "nana", "HR, #NotesApp"]);
// needs reply stays on after it's read, until someone answers
const t4 = threadSummary([l("hr", "2026-11-26T09:00:00Z"), l("applicant", "2026-11-26T10:00:00Z")], "2026-11-26T12:00:00Z");
assert.deepEqual([t4.unread, t4.needsReply], [0, true]);
assert.equal(threadSummary([]).count, 0);

const row = (id: string, lastAt: string, unread: number, needsReply: boolean) => ({ id, lastAt, unread, needsReply }) as HrInboxRow;
const rows = sortRows([row("a", "2026-11-25T10:00:00Z", 0, false), row("b", "2026-11-26T10:00:00Z", 2, true), row("c", "2026-11-26T08:00:00Z", 0, true)]);
assert.deepEqual(rows.map((r) => r.id), ["b", "c", "a"], "newest activity first");
assert.deepEqual(filterRows(rows, "all").map((r) => r.id), ["b", "c", "a"]);
assert.deepEqual(filterRows(rows, "unread").map((r) => r.id), ["b"]);
assert.deepEqual(filterRows(rows, "needs-reply").map((r) => r.id), ["b", "c"]);
assert.deepEqual(HR_INBOX_FILTERS.map((f) => f.label), ["All", "Unread", "Needs reply"]);
assert.ok(isHrInboxFilter("needs-reply") && !isHrInboxFilter("job") && !isHrInboxFilter(undefined));

console.log("HR INBOX RULES OK");

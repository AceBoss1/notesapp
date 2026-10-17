// Finding things in Messages (lib/chat-tools.ts) and the reaction chips (lib/messages-rules.ts). Run: npm run test:chat → "ALL OK".
import assert from "node:assert/strict";
import { fileBadge, filterInbox, fold, searchThread, tabCounts } from "../../lib/chat-tools";
import { isReaction, reactionSummary } from "../../lib/messages-rules";

const row = (uid: string, name: string, username: string, lastText: string, unread = 0, group?: string) => ({ id: uid, lastText, unread, with: { uid, username, displayName: name }, ...(group ? { group: { title: group } } : {}) });
const rows = [
  row("u1", "Ada Okafor", "ada", "See you **tomorrow**", 2),
  row("u2", "Chídí Obi", "chidi", "Invoice sent"),
  row("", "", "", "Agenda attached", 5, "Growth team"),
  row("u3", "Tola Bello", "tola", "Thanks"),
];
const ctx = { bookings: ["u1"], orders: ["u2", "u9"] };
const ids = (r: { id: string; group?: { title: string } }[]) => r.map((x) => x.group?.title ?? x.id);
assert.deepEqual(ids(filterInbox(rows, "", "all", ctx)), ["u1", "u2", "Growth team", "u3"]);
assert.deepEqual(ids(filterInbox(rows, "", "unread", ctx)), ["u1", "Growth team"]);
assert.deepEqual(ids(filterInbox(rows, "", "groups", ctx)), ["Growth team"]);
assert.deepEqual(ids(filterInbox(rows, "", "bookings", ctx)), ["u1"]);
assert.deepEqual(ids(filterInbox(rows, "", "orders", ctx)), ["u2"]);
assert.deepEqual(ids(filterInbox(rows, "", "orders", null)), [], "before the lookup arrives, nothing");
// search: name without accents, @handle, last message without formatting marks, group title
assert.deepEqual(ids(filterInbox(rows, "chidi", "all", ctx)), ["u2"]);
assert.deepEqual(ids(filterInbox(rows, "@tola", "all", ctx)), ["u3"]);
assert.deepEqual(ids(filterInbox(rows, "tomorrow", "all", ctx)), ["u1"]);
assert.deepEqual(ids(filterInbox(rows, "**", "all", ctx)), [], "formatting marks aren't searched");
assert.deepEqual(ids(filterInbox(rows, "growth", "all", ctx)), ["Growth team"]);
assert.deepEqual(ids(filterInbox(rows, "agenda", "unread", ctx)), ["Growth team"]);
assert.deepEqual(tabCounts(rows, ctx), { all: 4, unread: 2, groups: 1, bookings: 1, orders: 1 });
assert.equal(fold("ÀDÁ"), "ada");

// search inside a chat: two letters at least; not deleted, removed or call lines; file names count
const msgs = [
  { id: "1", text: "The **invoice** is attached" },
  { id: "2", text: "", attachments: [{ name: "Invoice-Oct.pdf" }] },
  { id: "3", text: "invoice", deleted: { at: "x" } },
  { id: "4", text: "", call: { kind: "audio" } },
  { id: "5", text: "Lunch?" },
];
assert.deepEqual(searchThread(msgs, "INVOICE"), ["1", "2"]);
assert.deepEqual(searchThread(msgs, "i"), [], "one letter is too short");
assert.deepEqual(searchThread(msgs, "   "), []);
assert.deepEqual(searchThread(msgs, "dinner"), []);

assert.equal(fileBadge("Report.final.docx"), "DOCX");
assert.equal(fileBadge("archive.tar.gz"), "GZ");
assert.equal(fileBadge("README"), "FILE");

// reaction chips: in the list's order, counted, with who
assert.deepEqual(reactionSummary({ a: "😂", b: "👍", c: "😂" }), [{ emoji: "👍", count: 1, uids: ["b"] }, { emoji: "😂", count: 2, uids: ["a", "c"] }]);
assert.deepEqual(reactionSummary(undefined), []);
assert.deepEqual(reactionSummary({ a: "🔥" }), [], "anything not on the list is ignored");
assert.ok(isReaction("❤️")); assert.ok(!isReaction("🔥")); assert.ok(!isReaction(""));

console.log("ALL OK");

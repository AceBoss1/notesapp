// Finding things in Messages (lib/chat-tools.ts) and the reaction chips (lib/messages-rules.ts). Run: npm run test:chat → "ALL OK".
import assert from "node:assert/strict";
import { fileBadge, filterInbox, fold, searchThread, tabCounts } from "../../lib/chat-tools";
import { isReaction, reactionSummary } from "../../lib/messages-rules";
import { parseCardLink } from "../../lib/chat-cards";


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

// #NotesApp links that get a card: our domains only, the four kinds, not pages like /academy/teach
const roots = ["notesapp.name.ng", "notesapp.tech"];
assert.deepEqual(parseCardLink("https://www.notesapp.name.ng/journals/Minding-The-Pay-Gap", roots), { kind: "journal", id: "minding-the-pay-gap" });
assert.deepEqual(parseCardLink("https://notesapp.tech/shop/AbC_123", roots), { kind: "item", id: "AbC_123" });
assert.deepEqual(parseCardLink("https://app.notesapp.name.ng/academy/excel-everyday/", roots), { kind: "course", id: "excel-everyday" });
assert.deepEqual(parseCardLink("https://www.notesapp.name.ng/u/Emmanuel?ref=x", roots), { kind: "profile", id: "emmanuel" });
assert.equal(parseCardLink("https://www.notesapp.name.ng/academy/teach", roots), null);
assert.equal(parseCardLink("https://www.notesapp.name.ng/journals/a/comments", roots), null);
assert.equal(parseCardLink("https://notesapp.name.ng.evil.com/u/emmanuel", roots), null, "look-alike domains don't count");
assert.equal(parseCardLink("https://example.com/journals/x", roots), null);
assert.equal(parseCardLink("javascript:alert(1)", roots), null);
assert.equal(parseCardLink("not a url", roots), null);

console.log("ALL OK");

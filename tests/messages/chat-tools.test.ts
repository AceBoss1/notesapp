// Finding things in Messages (lib/chat-tools.ts) and the reaction chips (lib/messages-rules.ts). Run: npm run test:chat → "ALL OK".
import assert from "node:assert/strict";
import { fileBadge, filterInbox, fold, searchThread, tabCounts } from "../../lib/chat-tools";
import { REACTIONS, cleanQuickReactions, emojiAsText, isNotesAppEmoji, isReaction, reactionSummary } from "../../lib/messages-rules";
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

// reaction chips: the most used first, then in the default list's order; counted, with who; any emoji
assert.deepEqual(reactionSummary({ a: "😂", b: "👍", c: "😂" }), [{ emoji: "😂", count: 2, uids: ["a", "c"] }, { emoji: "👍", count: 1, uids: ["b"] }]);
assert.deepEqual(reactionSummary({ a: "🔥", b: "👍" }), [{ emoji: "👍", count: 1, uids: ["b"] }, { emoji: "🔥", count: 1, uids: ["a"] }]);
assert.deepEqual(reactionSummary({ a: ":na:", b: "" }), [{ emoji: ":na:", count: 1, uids: ["a"] }]);
assert.deepEqual(reactionSummary(undefined), []);
// a reaction: any one emoji (with a skin tone, a flag, a family, a keycap) or one of ours; never words, two emojis or our unknown codes
for (const ok of ["❤️", "🔥", "🎓", "👍🏾", "🇳🇬", "👨‍👩‍👧", "1️⃣", ":na:", ":academy:"]) assert.ok(isReaction(ok), ok);
for (const bad of ["", "a", "hi", "🔥🔥", "🔥 ", ":fire:", ":na", "<b>", "x".repeat(40), 5, null]) assert.ok(!isReaction(bad), String(bad));
// a member's quick set: exactly QUICK_COUNT different reactions
assert.deepEqual(cleanQuickReactions([...REACTIONS]), [...REACTIONS]);
assert.deepEqual(cleanQuickReactions(["🔥", "❤️", "😂", "😮", "😢", "🙏", ":academy:"]), ["🔥", "❤️", "😂", "😮", "😢", "🙏", ":academy:"]);
assert.equal(cleanQuickReactions(["🔥", "🔥", "😂", "😮", "😢", "🙏", ":na:"]), null, "no repeats");
assert.equal(cleanQuickReactions(["🔥"]), null, "the whole row");
assert.equal(cleanQuickReactions(["hi", "❤️", "😂", "😮", "😢", "🙏", ":na:"]), null);
assert.equal(cleanQuickReactions("🔥"), null);
// ours read as their names where only text shows
assert.equal(emojiAsText("Welcome to :na: and :academy:!"), "Welcome to #NotesApp and Notes Academy!");
assert.equal(emojiAsText("Match day :football:"), "Match day Football", "the football is one of ours");
assert.ok(isNotesAppEmoji(":football:"));
assert.equal(emojiAsText("ratio 1:na:2"), "ratio 1#NotesApp2");

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

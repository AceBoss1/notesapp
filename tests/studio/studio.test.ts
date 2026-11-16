// Notes Live Studio (lib/studio.ts): the pure rules. Run: npm run test:studio
import assert from "node:assert/strict";
import {
  DEFAULT_STUDIO, STUDIO_MAX, applyStudioPatch, cleanComment, cleanLine, clipKindOf, clipOffset, layoutFor, ownStudioFile, programTiles, queueWith, studioAllowed, studioOf, studioOn,
} from "../../lib/studio";
import { ALL_MOD_PERMS, MOD_PRESETS, permsOf, roomCan } from "../../lib/rooms";

const BASE = "https://media.test";
const file = (uid: string) => (u: unknown) => ownStudioFile(u, BASE, uid, ["posters", "studio"]);
const opts = { file: file("ed"), stage: ["h", "a", "b"] };

// who may: the host everything; an editor the graphics and comments; Basic moderators neither; ending stays out of Editor
const editor = MOD_PRESETS.find((p) => p.id === "editor")!;
assert.deepEqual(editor.perms, ["pin", "poster", "studio", "onair"]);
assert.ok(ALL_MOD_PERMS.includes("studio") && ALL_MOD_PERMS.includes("onair"));
const room = { hostUid: "h", mods: { ed: { name: "Ed", avatar: "", perms: editor.perms }, b: { name: "B", avatar: "", perms: MOD_PRESETS[0].perms } } };
assert.equal(roomCan(room, "h", "studio"), true); assert.equal(roomCan(room, "ed", "studio"), true); assert.equal(roomCan(room, "ed", "onair"), true);
assert.equal(roomCan(room, "b", "studio"), false); assert.equal(roomCan(room, "b", "onair"), false); assert.equal(roomCan(room, "ed", "ban"), false);
assert.deepEqual(permsOf(room, "viewer"), []);
assert.equal(MOD_PRESETS[0].id, "basic"); assert.equal(MOD_PRESETS[1].id, "full", "the first two presets keep their places");

// the gate: only a live on the staff pass while the team tests
assert.equal(studioAllowed({ staffPass: true }), true); assert.equal(studioAllowed({}), false);

// a room from before reads as the defaults, switched off
assert.equal(studioOn({}), false); assert.equal(studioOn({ studio: { on: true } }), true);
assert.deepEqual(studioOf(null), DEFAULT_STUDIO);
assert.deepEqual(studioOf({ studio: { on: true, ticker: { lines: "x" } as never } }).ticker.lines, []);

// text: one line, no control characters, cut to length
assert.equal(cleanLine("  a\n\tb\u0000c  ", 20), "a b c"); assert.equal(cleanLine("x".repeat(500), STUDIO_MAX.head).length, STUDIO_MAX.head); assert.equal(cleanLine({ a: 1 }, 10), "");

// files: only this person's own posters/ or studio/ folder in our storage
assert.equal(file("ed")(`${BASE}/studio/ed/1-intro.mp4`), `${BASE}/studio/ed/1-intro.mp4`);
assert.equal(file("ed")(`${BASE}/posters/ed/logo.webp`), `${BASE}/posters/ed/logo.webp`);
assert.equal(file("ed")(""), "", "empty clears");
assert.equal(file("ed")(`${BASE}/studio/other/1.mp4`), null, "someone else's folder");
assert.equal(file("ed")(`https://evil.test/studio/ed/1.mp4`), null);
assert.equal(file("ed")(`${BASE}/studio/ed/../../x.mp4`), null);
assert.equal(file("ed")(`${BASE}/studio/ed/a"onerror=.png`), null);
assert.equal(file("ed")(`${BASE}/avatars/ed/a.png`), null, "another kind of folder");
assert.equal(ownStudioFile(`${BASE}/studio/ed/1.mp4`, "", "ed", ["studio"]), null, "no storage set up");
assert.equal(clipKindOf("a/b.mp4"), "video"); assert.equal(clipKindOf("a/b.mp3"), "audio"); assert.equal(clipKindOf("a/b.webp"), "image");

// the graphics patch: known fields only, cleaned; nothing shown empty
let out = applyStudioPatch(DEFAULT_STUDIO, { layout: "grid", theme: "midnight", focus: "a", caption: " hello\nthere ", junk: 1, on: true }, opts);
assert.ok(out.ok);
if (out.ok) { assert.equal(out.studio.layout, "grid"); assert.equal(out.studio.theme, "midnight"); assert.equal(out.studio.focus, "a"); assert.equal(out.studio.caption, "hello there"); assert.equal(out.studio.on, false, "a patch never switches the studio on"); assert.equal("junk" in out.studio, false); }
out = applyStudioPatch(DEFAULT_STUDIO, { layout: "wall", focus: "stranger" }, opts);
assert.ok(out.ok && out.studio.layout === "auto" && out.studio.focus === "", "unknown layout kept as it was; focus only on someone on stage");
out = applyStudioPatch(DEFAULT_STUDIO, { lower: { on: true } }, opts);
assert.ok(!out.ok, "a lower third needs a headline or a name");
out = applyStudioPatch(DEFAULT_STUDIO, { lower: { on: true, head: "African Mental Freedom", name: "Dr. N", style: "breaking", role: "Historian" } }, opts);
assert.ok(out.ok && out.studio.lower.on && out.studio.lower.style === "breaking" && out.studio.lower.role === "Historian");
out = applyStudioPatch(DEFAULT_STUDIO, { ticker: { on: true, lines: [] } }, opts);
assert.ok(!out.ok, "a ticker needs a line");
out = applyStudioPatch(DEFAULT_STUDIO, { ticker: { on: true, lines: [" one ", "", 7, ...Array(20).fill("x")], speed: "warp", tag: "NOTES LIVE" } }, opts);
assert.ok(out.ok);
if (out.ok) { assert.equal(out.studio.ticker.lines.length, STUDIO_MAX.lines); assert.equal(out.studio.ticker.lines[0], "one"); assert.equal(out.studio.ticker.lines[1], "7"); assert.equal(out.studio.ticker.speed, "normal"); }
out = applyStudioPatch(DEFAULT_STUDIO, { bug: { logo: "https://evil.test/x.png" } }, opts);
assert.ok(!out.ok, "a logo from elsewhere is refused");
out = applyStudioPatch(DEFAULT_STUDIO, { bug: { logo: `${BASE}/posters/ed/logo.webp`, show: "THE EMERGING VOICES", live: false } }, opts);
assert.ok(out.ok && out.studio.bug.logo.endsWith("logo.webp") && out.studio.bug.live === false && out.studio.bug.clock === true);
out = applyStudioPatch(DEFAULT_STUDIO, { sponsor: { url: `${BASE}/studio/ed/ad.mp4`, slot: "banner", label: "Acme" } }, opts);
assert.ok(out.ok && out.studio.sponsor?.kind === "video" && out.studio.sponsor.slot === "banner");
out = applyStudioPatch(DEFAULT_STUDIO, { sponsor: { url: "", slot: "banner" } }, opts);
assert.ok(!out.ok, "a sponsor spot needs a file");
out = applyStudioPatch({ ...DEFAULT_STUDIO, sponsor: { url: "u", kind: "image", slot: "corner", label: "" } }, { sponsor: null }, opts);
assert.ok(out.ok && out.studio.sponsor === null);
assert.equal(DEFAULT_STUDIO.ticker.lines.length, 0, "the defaults aren't changed by a patch");

// comments on air and the queue
assert.equal(cleanComment({ id: "m1", from: "u1", text: "" }, "mod"), null);
assert.equal(cleanComment(null, "mod"), null);
const c = cleanComment({ id: "m1", from: "u1", name: "Efua", avatar: "javascript:alert(1)", text: "  We need to\nre-embrace our culture " + "x".repeat(400) }, "mod")!;
assert.equal(c.avatar, ""); assert.equal(c.by, "mod"); assert.equal(c.text.length, STUDIO_MAX.comment); assert.ok(c.text.startsWith("We need to re-embrace"));
assert.equal(cleanComment({ id: "m2", from: "u2", text: "hi" }, "mod")!.name, "A viewer");
let q = queueWith([], c); q = queueWith(q, c);
assert.equal(q.length, 1, "the same comment is queued once");
for (let i = 0; i < 15; i++) q = queueWith(q, { ...c, id: `n${i}` });
assert.equal(q.length, STUDIO_MAX.queue); assert.equal(q[q.length - 1].id, "n14");

// who is in the picture, and the layout drawn
const s = (layout: string, focus = "", screen = "") => ({ layout, focus, screen }) as never;
assert.deepEqual(programTiles(s("auto"), ["h", "a", "b"], "h"), ["h", "a", "b"]);
assert.deepEqual(programTiles(s("solo", "a"), ["h", "a", "b"], "h"), ["a"]);
assert.deepEqual(programTiles(s("solo", "gone"), ["h", "a"], "h"), ["h"], "focus on someone who left falls back to the host");
assert.deepEqual(programTiles(s("spotlight", "b"), ["h", "a", "b"], "h"), ["b", "h", "a"]);
assert.deepEqual(programTiles(s("grid", "a", "b"), ["h", "a", "b"], "h"), ["b", "h", "a"], "a shared screen leads");
assert.deepEqual(programTiles(s("auto"), [], "h"), []);
assert.equal(layoutFor("auto", 1, false), "solo"); assert.equal(layoutFor("auto", 3, false), "row"); assert.equal(layoutFor("auto", 5, false), "grid");
assert.equal(layoutFor("auto", 3, true), "spotlight"); assert.equal(layoutFor("pip", 1, false), "solo"); assert.equal(layoutFor("pip", 2, false), "pip");

// a clip joined late starts where it has reached
assert.equal(clipOffset({ at: new Date(10_000).toISOString() }, 25_000), 15); assert.equal(clipOffset({ at: new Date(10_000).toISOString() }, 5_000), 0);

console.log("studio: ok");

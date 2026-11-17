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

// ── Automatic subtitles (docs/STUDIO_SUBTITLES.md) ──
import { SUBS, maySay, sayLine, shownSubs, subKey, subsFor, subsQuiet, voiceAlone } from "../../lib/studio";
{
  const stage = ["h", "a", "b"], T = (ms: number) => new Date(1_800_000_000_000 + ms);
  // Off until the editor switches it on; old rooms read as the defaults; switching off clears the lines at once.
  assert.deepEqual(studioOf({}).subs, { on: false, look: "clean", names: true, lang: "en", off: [], quiet: [] });
  assert.deepEqual(studioOf({ studio: { subs: { on: true } as never } }).subs.off, []);
  let s = { ...DEFAULT_STUDIO, on: true };
  assert.equal(maySay(s, stage, {}, "a"), "Subtitles are switched off.");
  let out = applyStudioPatch(s, { subs: { on: true, look: "neon", lang: "pcm", names: "yes" } }, opts);
  assert.ok(out.ok); s = out.ok ? out.studio : s;
  assert.deepEqual([s.subs.on, s.subs.look, s.subs.lang, s.subs.names], [true, "clean", "pcm", true], "an unknown look or a non-boolean is ignored");
  out = applyStudioPatch(s, { subs: { look: "bold" } }, opts); s = out.ok ? out.studio : s;
  assert.deepEqual([s.subs.on, s.subs.look], [true, "bold"], "a look alone doesn't switch it off");
  // Who may be subtitled: on stage, not switched off, microphone not turned off by the host.
  assert.equal(maySay(s, stage, {}, "a"), null);
  assert.match(maySay(s, stage, {}, "viewer")!, /on stage/);
  assert.match(maySay(s, stage, { a: true }, "a")!, /microphone is off/);
  assert.match(maySay({ ...s, on: false }, stage, {}, "a")!, /switched off/);
  // A voice alone: nobody else on stage, or everyone else muted by the host or by themselves.
  assert.equal(voiceAlone(["h"], {}, [], "h"), true);
  assert.equal(voiceAlone(stage, {}, [], "h"), false);
  assert.equal(voiceAlone(stage, { a: true }, ["b"], "h"), true, "one muted by the host, one muted themselves");
  assert.equal(voiceAlone(stage, { a: true }, [], "h"), false);
  assert.equal(voiceAlone(stage, undefined, ["a", "b", "h"], "h"), true, "her own mute doesn't count against her");
  // A line: cleaned and cut, the name from the room, the time it took kept within bounds.
  const say = (st: typeof s, uid: string, text: unknown, at: number, extra: object = {}) => sayLine(st, { uid, name: uid === "h" ? "Tunde Bakare" : uid === "a" ? "Dr. Naledi Mokoena" : "", text, ms: 4000 }, { stage, now: T(at), ...extra });
  let r = say(s, "h", "  but who decides\nwhat is taught?  ", 0);
  assert.ok(r.ok); s = r.ok ? r.studio : s;
  assert.deepEqual(s.said, [{ uid: "h", name: "Tunde Bakare", text: "but who decides what is taught?", at: T(0).toISOString(), ms: 4000, solo: false }]);
  assert.equal((sayLine(s, { uid: "b", name: "", text: "x".repeat(400), ms: 99_999 }, { stage, now: T(0) }) as { studio: typeof s }).studio.said[1].text.length, SUBS.line);
  assert.equal((sayLine(s, { uid: "b", name: "", text: "hi", ms: 99_999 }, { stage, now: T(0) }) as { studio: typeof s }).studio.said[1].ms, SUBS.maxPieceSec * 1000);
  assert.equal((sayLine(s, { uid: "b", name: "", text: "hi", ms: "x" }, { stage, now: T(0) }) as { studio: typeof s }).studio.said[1].name, "Speaker");
  // Refused: nothing said, too soon after her last line, not allowed.
  assert.deepEqual(say(s, "a", "   ", 100), { ok: false, status: 400, error: "Nothing was said." });
  assert.equal((say(s, "h", "again", SUBS.gapMs - 1) as { status: number }).status, 429);
  assert.equal((say(s, "viewer", "hello", 100) as { status: number }).status, 403);
  // Two people at once: two lines, each with its name. Her next line replaces her last. A third voice pushes the oldest out.
  r = say(s, "a", "that is exactly the question", 1500); s = r.ok ? r.studio : s;
  assert.deepEqual(s.said.map((l) => l.uid), ["h", "a"]);
  r = say(s, "h", "and who pays for it", 4200); s = r.ok ? r.studio : s;
  assert.deepEqual(s.said.map((l) => [l.uid, l.text]), [["a", "that is exactly the question"], ["h", "and who pays for it"]]);
  r = say(s, "b", "may I come in", 4400); s = r.ok ? r.studio : s;
  assert.deepEqual(s.said.map((l) => l.uid), ["h", "b"], "two lines at most");
  // A stale line is dropped when the next one comes.
  r = say(s, "a", "much later", 60_000); s = r.ok ? r.studio : s;
  assert.deepEqual(s.said.map((l) => l.uid), ["a"]);
  // Solo: with the others muted, the line carries no name.
  let quiet = subsQuiet(subsQuiet(s, "a", true), "b", true);
  assert.deepEqual(quiet.subs.quiet, ["a", "b"]);
  r = say(quiet, "h", "good evening and welcome", 70_000);
  assert.equal(r.ok && r.studio.said[r.studio.said.length - 1].solo, true);
  quiet = subsQuiet(quiet, "a", false);
  r = say(quiet, "h", "good evening and welcome", 70_000);
  assert.equal(r.ok && r.studio.said[r.studio.said.length - 1].solo, false, "one other microphone back on");
  assert.equal((say(s, "h", "muted by the host", 70_000, { hostMuted: { a: true, b: true } }) as { studio: typeof s }).studio.said.slice(-1)[0].solo, true);
  // A speaker's subtitles off: their line goes, and they can't post until it's back on.
  const off = subsFor(s, "a", true);
  assert.deepEqual([off.subs.off, off.said.length], [["a"], 0]);
  assert.match(maySay(off, stage, {}, "a")!, /Your subtitles are switched off/);
  assert.equal(maySay(subsFor(off, "a", false), stage, {}, "a"), null);
  // What a screen shows: by its own clock from when it first saw the line; the highlight moves evenly, then rests on the last word.
  const line = { uid: "a", name: "Dr. Naledi Mokoena", text: "someone else will teach it for us", at: T(0).toISOString(), ms: 4000, solo: false };
  const st = { caption: "", subs: { ...DEFAULT_STUDIO.subs, on: true }, said: [line] };
  const seen = { [subKey(line)]: 1000 };
  assert.deepEqual(shownSubs(st, {}, 1000), [], "not yet seen by this screen");
  assert.deepEqual(shownSubs(st, seen, 1000).map((x) => [x.word, x.name]), [[0, "Dr. Naledi Mokoena"]]);
  assert.equal(shownSubs(st, seen, 3000)[0].word, 3); assert.equal(shownSubs(st, seen, 4999)[0].word, 6);
  assert.equal(shownSubs(st, seen, 6000)[0].word, 6, "it rests on the last word");
  assert.equal(shownSubs(st, seen, 1000 + 4000 + SUBS.holdMs).length, 0, "then it clears");
  assert.equal(shownSubs({ ...st, said: [{ ...line, solo: true }] }, seen, 1000)[0].name, "", "a lone voice has no name");
  assert.equal(shownSubs({ ...st, subs: { ...st.subs, names: false } }, seen, 1000)[0].name, "", "names switched off");
  assert.equal(shownSubs({ ...st, caption: "Typed by the editor" }, seen, 1000).length, 0, "a typed line takes over");
  assert.equal(shownSubs({ ...st, subs: { ...st.subs, on: false } }, seen, 1000).length, 0);
}

console.log("studio: ok");

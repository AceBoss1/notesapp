// Moments tidy up and captions, the pure rules (lib/moments-tidy.ts): finding pauses in a recording's loudness, the stretches that
// play, long recordings as several moments, what the server keeps, where the player should be, and captions (cleaning, lines, the
// word being said, corrections, pieces, the speech service's answer in either shape).
// Run: npm run test:moments-tidy → "ALL OK".
import assert from "node:assert/strict";
import {
  BREATH, LEVEL_STEP, MAX_SPANS, MAX_WORDS, captionAt, captionLines, captionText, cleanCaptions, cleanSpans, cleanWords, editLine, findPauses,
  partsForSpans, playSpans, playedAt, playhead, quietBelow, shiftWords, spanTotal, splitSpans, wordsFromSpeech, wordsIn, type Span, type Word,
} from "../../lib/moments-tidy";

// A recording's loudness: `sec` seconds at `level`, in 20 ms steps.
const run = (sec: number, level: number) => Array.from({ length: Math.round(sec / LEVEL_STEP) }, () => level);
const near = (a: number, b: number, by = 0.03) => assert.ok(Math.abs(a - b) <= by, `${a} is not near ${b}`);

// ── Finding the pauses ──
// Speech 2 s, quiet 1 s, speech 3 s, a short 0.3 s breath, speech 1 s, then 2 s of quiet at the end.
const levels = [...run(2, 0.3), ...run(1, 0.005), ...run(3, 0.28), ...run(0.3, 0.004), ...run(1, 0.31), ...run(2, 0.003)];
assert.ok(quietBelow(levels) > 0.005 && quietBelow(levels) < 0.1);
const half = findPauses(levels, 0.5);
assert.equal(half.length, 2, "the 0.3 s breath stays at half a second");
near(half[0][0], 2 + BREATH); near(half[0][1], 3 - BREATH); // a breath is kept each side
near(half[1][0], 7.3 + BREATH); near(half[1][1], 9.3); // the quiet at the very end goes whole
assert.equal(findPauses(levels, 0.25).length, 3, "a quarter second takes the breath too");
assert.equal(findPauses(levels, 1).length, 2);
assert.equal(findPauses(run(5, 0.3), 0.5).length, 0, "nothing to trim in steady speech");
assert.equal(findPauses([], 0.5).length, 0);
// A quiet speaker in a noisy room: quiet is judged against this recording, not a fixed level.
const noisy = [...run(2, 0.08), ...run(1, 0.02), ...run(2, 0.09)];
assert.equal(findPauses(noisy, 0.5).length, 1);
// Quiet at the very start is taken from 0.
near(findPauses([...run(1, 0.002), ...run(2, 0.3)], 0.5)[0][0], 0);

// ── What plays ──
const spans = playSpans(9.3, half);
assert.equal(spans.length, 2);
near(spans[0][0], 0); near(spans[0][1], 2.12); near(spans[1][0], 2.88); near(spans[1][1], 7.42);
near(spanTotal(spans), 6.66, 0.05);
assert.equal(playSpans(9.3, half, [0]).length, 1, "a pause she kept isn't cut");
near(playSpans(9.3, half, [0])[0][1], 7.42);
assert.deepEqual(playSpans(10, []), [[0, 10]]);
assert.deepEqual(playSpans(10, [[0, 10]]), [], "all quiet: nothing plays");
// Long recordings: stretches dealt out in order, each moment at most 90 seconds of playing time.
const long: Span[] = [[0, 60], [70, 130], [140, 200]];
assert.equal(partsForSpans(long), 2); assert.equal(partsForSpans([[0, 81]]), 1); assert.equal(partsForSpans([[0, 90.5]]), 1); assert.equal(partsForSpans([[0, 92]]), 2);
const two = splitSpans(long, 2);
assert.deepEqual(two, [[[0, 60], [70, 100]], [[100, 130], [140, 200]]]);
assert.ok(two.every((p) => spanTotal(p) <= 90));
assert.deepEqual(splitSpans(long, 1), [[[0, 60], [70, 100]]], "room for one moment: the rest is left out");
assert.deepEqual(splitSpans([[0, 30]], 3), [[[0, 30]]]);
assert.equal(splitSpans([[0, 400]], 7).length, 5);

// ── What the server keeps ──
assert.deepEqual(cleanSpans([[0, 2.123], [2.9, "6.4"]], 8), [[0, 2.12], [2.9, 6.4]]);
assert.equal(cleanSpans([], 8), null); assert.equal(cleanSpans("x", 8), null);
assert.throws(() => cleanSpans([[2, 3], [1, 4]], 8), /isn't valid/); // out of order
assert.throws(() => cleanSpans([[0, 0.05]], 8), /isn't valid/); // too short to hear
assert.throws(() => cleanSpans([[0, 12]], 8), /isn't valid/); // past the end
assert.throws(() => cleanSpans([[0, NaN]], 8), /isn't valid/);
assert.throws(() => cleanSpans(Array.from({ length: MAX_SPANS + 1 }, (_, i) => [i, i + 0.5]), 500), /too many cuts/);

// ── Where the player should be ──
const p: Span[] = [[1, 3], [5, 8]];
assert.deepEqual(playhead(p, 0), { seek: 1 }); assert.deepEqual(playhead(p, 2), {}); assert.deepEqual(playhead(p, 3.5), { seek: 5 });
assert.deepEqual(playhead(p, 7.9), {}); assert.deepEqual(playhead(p, 8), { done: true }); assert.deepEqual(playhead([], 0), { done: true });
assert.equal(playedAt(p, 0), 0); assert.equal(playedAt(p, 2), 1); assert.equal(playedAt(p, 4), 2); assert.equal(playedAt(p, 6), 3); assert.equal(playedAt(p, 99), 5);

// ── Captions ──
const W = (w: string, s: number, e: number): Word => ({ w, s, e });
const said = [W("So", 0, 0.2), W("you", 0.2, 0.58), W("have", 0.58, 0.74), W("six", 0.74, 0.98), W("days.", 0.98, 1.28), W("Every", 2.4, 2.7), W("order", 2.7, 3), W("pays", 3, 3.3), W("half", 3.3, 3.6), W("before", 3.6, 4), W("I", 4, 4.1), W("cut.", 4.1, 4.5)];
// Cleaning: either field names, tags and control characters out, times in order, unsure words marked, a cap on how many.
assert.deepEqual(cleanWords([{ word: " So ", start: 0, end: 0.2 }, { w: "<b>you</b>", s: 0.2, e: 0.5, u: true }, { w: "", s: 1, e: 2 }, { w: "x", s: "no", e: 2 }, { w: "back", s: 0.1, e: 0.15 }]),
  [{ w: "So", s: 0, e: 0.2 }, { w: "b>you/b", s: 0.2, e: 0.5, u: true }, { w: "back", s: 0.2, e: 0.25 }].map((w) => (w.w === "b>you/b" ? { ...w, w: "byou/b" } : w)));
assert.equal(cleanWords(Array.from({ length: 600 }, (_, i) => ({ w: "a", s: i, e: i + 0.5 }))).length, MAX_WORDS);
assert.equal(cleanWords([{ w: "late", s: 200, e: 201 }], 90).length, 0, "a word after the recording ends is dropped");
assert.equal(cleanWords("nope").length, 0);
const caps = cleanCaptions({ words: said, style: "neon", place: "middle" }, "video", 10)!;
assert.deepEqual([caps.style, caps.place, caps.of, caps.words.length], ["bold", "middle", "video", 12]);
assert.equal(cleanCaptions({ words: [] }, "video", 10), null);
assert.equal(captionText(caps), "So you have six days. Every order pays half before I cut.");
assert.equal(captionText(null), "");
// Lines: broken at the pause, and before a line gets too long to read.
const lines = captionLines(said);
assert.deepEqual(lines.map((l) => l.words.map((w) => w.w).join(" ")), ["So you have six days.", "Every order pays half before I", "cut."]);
assert.deepEqual(lines.map((l) => l.from), [0, 5, 11]);
assert.deepEqual([lines[0].s, lines[0].e], [0, 1.28]);
// The line on screen and the word being said.
assert.equal(captionAt(lines, 0.8)!.line, lines[0]); assert.equal(captionAt(lines, 0.8)!.word, 3);
assert.equal(captionAt(lines, 1.6)!.line, lines[0], "a line stays up a moment after its last word");
assert.equal(captionAt(lines, 2.1), null, "nothing in the pause");
assert.equal(captionAt(lines, 3.35)!.word, 3); assert.equal(captionAt(lines, 4.2)!.line, lines[2]);
assert.equal(captionAt(lines, 30), null); assert.equal(captionAt([], 1), null);
// A correction: the same number of words keeps every time; more or fewer share the line's time; an emptied line goes.
const fixed = editLine(said, lines[0], "So you have six weeks.");
assert.equal(fixed[4].w, "weeks."); assert.deepEqual([fixed[4].s, fixed[4].e], [0.98, 1.28]); assert.equal(fixed.length, 12);
const longer = editLine(said, lines[0], "So you only have six days.");
assert.equal(longer.length, 13); assert.equal(longer[0].s, 0); near(longer[5].e, 1.28); assert.equal(longer[6].w, "Every");
assert.ok(longer.slice(0, 6).every((w, i, a) => i === 0 || w.s >= a[i - 1].s));
assert.equal(editLine(said, lines[2], "  ").length, 11);
// One moment of a longer recording gets the words said inside its stretches.
assert.deepEqual(wordsIn(said, [[0, 1.5]]).map((w) => w.w), ["So", "you", "have", "six", "days."]);
assert.equal(wordsIn(said, [[2.3, 3.2], [4, 5]]).map((w) => w.w).join(" "), "Every order pays I cut.");
assert.deepEqual(shiftWords([W("a", 1, 1.5)], 45), [W("a", 46, 46.5)]);

// ── The speech service's answer, in either shape ──
assert.deepEqual(wordsFromSpeech({ text: "So you", words: [{ word: "So", start: 0, end: 0.2 }, { word: "you", start: 0.2, end: 0.5 }] }), [W("So", 0, 0.2), W("you", 0.2, 0.5)]);
assert.deepEqual(wordsFromSpeech({ segments: [{ start: 0, end: 1, text: "x", words: [{ word: "So", start: 0, end: 0.2 }] }, { start: 2, end: 3, words: [{ word: "you", start: 2, end: 2.5 }] }] }).map((w) => w.w), ["So", "you"]);
// Only segment times: the words share the segment's time, and are marked unsure.
const seg = wordsFromSpeech({ segments: [{ start: 2, end: 4, text: " pays half " }] });
assert.deepEqual(seg.map((w) => [w.w, w.s, w.e, w.u]), [["pays", 2, 3, true], ["half", 3, 4, true]]);
assert.equal(wordsFromSpeech({ text: "no times at all" }).length, 0); assert.equal(wordsFromSpeech(null).length, 0);

// ── Pieces of sound for captions: at most 45 seconds, broken at a pause where there is one ──
import { captionPieces, wavOf } from "../../lib/moments-tidy-client";
assert.deepEqual(captionPieces([[0, 20], [22, 40], [43, 60]]), [[0, 40], [43, 60]]);
assert.deepEqual(captionPieces([[0, 100]]), [[0, 45], [45, 90], [90, 100]], "one long stretch is cut at 45 seconds");
assert.deepEqual(captionPieces([[5, 30]]), [[5, 30]]); assert.deepEqual(captionPieces([]), []);
assert.ok(captionPieces([[0, 30], [31, 80], [81, 200]]).every(([a, b]) => b - a <= 45.01));
// A WAV file: the header, then 16-bit samples at 16 kHz.
const w = wavOf(new Float32Array(32_000).fill(0.5), 0.5, 1.5);
assert.equal(w.length, 44 + 16_000 * 2); assert.equal(String.fromCharCode(...w.slice(0, 4)), "RIFF"); assert.equal(String.fromCharCode(...w.slice(8, 12)), "WAVE");
assert.equal(new DataView(w.buffer).getUint32(24, true), 16_000); assert.equal(new DataView(w.buffer).getInt16(44, true), Math.floor(0.5 * 0x7fff));
console.log("ALL OK");

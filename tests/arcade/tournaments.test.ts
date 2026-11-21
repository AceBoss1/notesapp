// Notes Arcade tournaments, the pure rules (lib/arcade/tournaments.ts; owner, 21 Nov 2026: "start tournaments"): admin drafts, the phase,
// the rank order, who may enter, and the leaderboard sort. The server's side is tests/arcade/tournaments.emulator.ts.
// Run: npx -y tsx tests/arcade/tournaments.test.ts
import assert from "node:assert/strict";
import { compareRank, rankKey, type TournamentGame } from "../../lib/arcade/tournament-games";
import { canEnter, listed, openBlocker, phase, publicTournament, sortEntries, validateDraft, type Member, type Tournament } from "../../lib/arcade/tournaments";

const FAKE: TournamentGame = { slug: "fake", name: "Fake", levels: ["easy", "hard"], rankedBy: "Score", maxRecording: 100, replay: () => ({ ok: false, error: "x" }) };
const games = [FAKE];
const good = {
  game: "fake", name: "The Test Cup", level: "hard", tries: 3, playFrom: "2026-11-29T09:00:00Z", playUntil: "2026-11-30T21:00:00Z",
  prize: true, ageRule: "adults", prizes: [{ place: "1st", prize: "A phone" }], sponsor: { name: "Ariaria Ltd", link: "https://ariaria.example", logo: "https://ariaria.example/logo.png", words: "Shop local." },
};

// ---- validateDraft ----
{
  const v = validateDraft(good, games);
  assert.ok(v.ok);
  assert.equal(v.value.level, "hard"); assert.equal(v.value.legalChecked, false, "left out: not ticked");
  assert.equal(v.value.playFrom, "2026-11-29T09:00:00.000Z");
  const bad = (patch: Record<string, unknown>, re: RegExp) => { const r = validateDraft({ ...good, ...patch }, games); assert.ok(!r.ok, JSON.stringify(patch)); assert.match(r.error, re); };
  bad({ game: "ludo" }, /Pick a game/);
  bad({ level: "medium" }, /can be played at: easy, hard/);
  bad({ tries: 0 }, /1 to 10/); bad({ tries: 11 }, /1 to 10/); bad({ tries: 2.5 }, /1 to 10/);
  bad({ name: "x" }, /name/);
  bad({ playUntil: "2026-11-29T08:00:00Z" }, /end after it starts/);
  bad({ playUntil: "2026-11-29T09:05:00Z" }, /15 minutes/);
  bad({ playUntil: "2027-01-29T09:00:00Z" }, /31 days/);
  bad({ playFrom: "soon" }, /Set when play/);
  bad({ entryFrom: "2026-12-01T00:00:00Z" }, /before play starts/);
  // §8.2: prize tournaments are adults-only; practice tournaments have no prizes.
  bad({ ageRule: "practice" }, /adults \(18\+\) only/);
  bad({ prize: false }, /Only a prize tournament lists prizes/);
  bad({ prizes: [] }, /at least one/);
  bad({ prizes: [{ place: "1st", prize: "" }] }, /needs a place/);
  // The sponsor's link must be https.
  bad({ sponsor: { name: "S", link: "http://s.example", logo: "", words: "" } }, /https/);
  bad({ sponsor: { name: "S", link: "javascript:alert(1)", logo: "", words: "" } }, /https/);
  bad({ sponsor: { name: "", link: "https://s.example", logo: "", words: "" } }, /sponsor's name/);
  bad({ sponsor: { name: "S", link: "https://s.example", logo: "ftp://x/y.png", words: "" } }, /logo/);
  // An empty sponsor is no sponsor; a practice tournament with no prizes is fine; the level defaults to the game's first.
  const p = validateDraft({ ...good, prize: false, prizes: [], ageRule: "practice", sponsor: { name: "", link: "", logo: "", words: "" }, level: undefined }, games);
  assert.ok(p.ok); assert.equal(p.value.sponsor, undefined); assert.equal(p.value.ageRule, "practice"); assert.equal(p.value.level, "easy");
}

// ---- phase, listing and the public view ----
const T = (patch: Partial<Tournament> = {}): Tournament => ({
  id: "t", game: "fake", name: "The Test Cup", format: "same-deal", level: "hard", seed: 4242, tries: 3, playFrom: "2026-11-29T09:00:00Z", playUntil: "2026-11-30T21:00:00Z",
  status: "open", prizes: [], prize: false, ageRule: "adults", legalChecked: false, createdAt: "x", updatedAt: "x", ...patch,
});
const before = new Date("2026-11-29T08:00:00Z"), during = new Date("2026-11-29T12:00:00Z"), after = new Date("2026-12-01T00:00:00Z");
assert.equal(phase(T(), before), "upcoming");
assert.equal(phase(T(), during), "playing");
assert.equal(phase(T(), after), "ended");
assert.equal(phase(T({ status: "closed" }), during), "ended", "closed early by admin");
assert.equal(phase(T({ status: "draft" }), during), "upcoming", "a draft never plays");
assert.equal(listed(T({ status: "draft" }), during), false);
assert.equal(listed(T({ entryFrom: "2026-11-28T00:00:00Z" }), new Date("2026-11-27T00:00:00Z")), false);
assert.equal(listed(T({ entryFrom: "2026-11-28T00:00:00Z" }), before), true);
const pub = publicTournament(T({ createdBy: "admin1" }), during) as Record<string, unknown>;
assert.equal(pub.seed, undefined, "the seed is never public"); assert.equal(pub.createdBy, undefined); assert.equal(pub.phase, "playing");

// ---- canEnter ----
const adult: Member = { signedIn: true, emailVerified: true, kid: false, teen: false, suspended: false, username: "ada" };
const no = (t: Tournament, m: Partial<Member>, re: RegExp, now = during) => { const c = canEnter(t, { ...adult, ...m }, now); assert.ok(!c.ok); assert.match(c.message, re); return c; };
assert.ok(canEnter(T(), adult, during).ok);
assert.equal((no(T(), { signedIn: false }, /Sign in/) as { status: number }).status, 401, "guests are refused");
no(T(), { emailVerified: false }, /Verify your email/);
no(T(), { kid: true }, /kids' accounts/);
no(T({ ageRule: "practice" }), { kid: true }, /kids' accounts/, during); // kids never
no(T(), { suspended: true }, /can't do that/);
no(T(), { username: "" }, /profile/);
no(T({ prize: true, legalChecked: true }), { teen: true }, /18 and over/);
no(T({ prize: false, ageRule: "adults" }), { teen: true }, /18 and over/);
assert.ok(canEnter(T({ ageRule: "practice" }), { ...adult, teen: true }, during).ok, "teens play practice tournaments");
no(T(), {}, /starts/, before);
no(T(), {}, /has ended/, after);
no(T({ status: "draft" }), {}, /doesn't exist/);
no(T({ prize: true, legalChecked: false }), {}, /isn't open yet/);

// ---- opening (§8.5) ----
assert.match(openBlocker(T({ status: "draft", prize: true, legalChecked: false }), before)!, /legal check/);
assert.equal(openBlocker(T({ status: "draft", prize: true, legalChecked: true }), before), null);
assert.match(openBlocker(T({ status: "draft" }), after)!, /window is over/);
assert.match(openBlocker(T({ status: "results" }), before)!, /finished/);

// ---- rank order: compareRank and rankKey agree ----
// rankKey is for what games make: whole numbers in tuples of one length per game (it rounds, and a shorter tuple sorts as a prefix).
const ranks = [[1, -3], [1, -10], [0, 25], [0, -2], [1, 0], [0, 0], [2, -999], [-1, 7], [1, 123456789], [0, -123456789]];
const byCompare = [...ranks].sort((a, b) => compareRank(b, a));
const byKey = [...ranks].sort((a, b) => (rankKey(b) < rankKey(a) ? -1 : rankKey(b) > rankKey(a) ? 1 : 0));
assert.deepEqual(byKey.map((r) => r.join(",")), byCompare.map((r) => r.join(",")), "string order = tuple order");
assert.ok(compareRank([1, -3], [1, -10]) > 0, "a win in fewer moves beats a win in more");
assert.ok(compareRank([1, -10], [0, 50]) > 0, "a win beats any loss");

// ---- leaderboard sort ----
const e = (u: string, rank: number[] | null, at: string) => ({ u, best: rank ? { rank, rankKey: rankKey(rank), summary: "", score: 0, at } : null });
const sorted = sortEntries([e("a", [0, 5], "2026-11-29T10:00:00Z"), e("b", [1, -9], "2026-11-29T11:00:00Z"), e("c", null, "x"), e("d", [1, -9], "2026-11-29T10:30:00Z"), e("f", [1, -2], "2026-11-29T12:00:00Z")]);
assert.deepEqual(sorted.map((x) => x.u), ["f", "d", "b", "a"], "best rank first, an earlier best breaks a tie, no-finish left out");

console.log("TOURNAMENTS OK");

// Notes Arcade tournaments, the pure rules (lib/arcade/tournaments.ts; owner, 21 Nov 2026: "start tournaments"): admin drafts, the phase,
// the rank order, who may enter, and the leaderboard sort. The server's side is tests/arcade/tournaments.emulator.ts.
// Run: npx -y tsx tests/arcade/tournaments.test.ts
import assert from "node:assert/strict";
import { compareRank, rankKey, type TournamentGame } from "../../lib/arcade/tournament-games";
import { canEnter, listed, openBlocker, phase, publicTournament, sortEntries, validateDraft, type Member, type Tournament } from "../../lib/arcade/tournaments";
import { LIST_DESCRIPTION, LIST_TITLE, lagosDates, ordinal, prizesHeadline, tournamentShare, whoLine, winnerBell, winnerMessage } from "../../lib/arcade/tournament-text";
import { escapeMd, mdUrl, mention, resultsPostBody, resultsPostTitle, winnerName } from "../../lib/arcade/tournament-results";

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

// ---- share text and the winners' messages (lib/arcade/tournament-text.ts; owner, 24 Nov 2026) ----
{
  // Dates in Lagos time (UTC+1): a window ending at Lagos midnight belongs to the day before.
  assert.equal(lagosDates("2026-11-29T09:00:00Z", "2026-11-30T21:00:00Z"), "29–30 Nov 2026");
  assert.equal(lagosDates("2026-11-29T09:00:00Z", "2026-11-29T21:00:00Z"), "29 Nov 2026");
  assert.equal(lagosDates("2026-11-29T09:00:00Z", "2026-11-30T23:00:00Z"), "29–30 Nov 2026", "ends 00:00 Lagos on 1 Dec");
  assert.equal(lagosDates("2026-11-30T09:00:00Z", "2026-12-02T12:00:00Z"), "30 Nov – 2 Dec 2026");
  assert.equal(lagosDates("2026-12-31T09:00:00Z", "2027-01-01T12:00:00Z"), "31 Dec 2026 – 1 Jan 2027");
  assert.equal(lagosDates("2026-11-28T23:30:00Z", "2026-11-29T12:00:00Z"), "29 Nov 2026", "23:30 UTC is already the 29th in Lagos");

  assert.equal(prizesHeadline([]), "");
  assert.equal(prizesHeadline([{ place: "1st", prize: "A phone" }]), "1st: A phone");
  assert.equal(prizesHeadline([{ place: "1st", prize: "A phone" }, { place: "2nd", prize: "A voucher" }]), "1st: A phone, and 1 more prize");
  assert.equal(prizesHeadline([{ place: "1st", prize: "A" }, { place: "2nd", prize: "B" }, { place: "3rd", prize: "C" }]), "1st: A, and 2 more prizes");

  const t = { name: "The Ariaria Cup", playFrom: good.playFrom, playUntil: good.playUntil, prize: true, prizes: good.prizes, ageRule: "adults" as const, sponsor: { name: "Ariaria Ltd" } };
  const s = tournamentShare(t, "Whot");
  assert.equal(s.title, "The Ariaria Cup · Whot tournament · Notes Arcade");
  assert.equal(tournamentShare({ ...t, name: "The Ariaria Cup, Whot, 29–30 Nov" }, "Whot").title, "The Ariaria Cup, Whot, 29–30 Nov · Notes Arcade", "the game named once");
  assert.match(s.description, /^A free Whot tournament on Notes Arcade, sponsored by Ariaria Ltd, 29–30 Nov 2026 \(Lagos time\)\. Prizes: 1st: A phone\. 18\+\./);
  const practice = tournamentShare({ ...t, prize: false, prizes: [], ageRule: "practice", sponsor: undefined }, "Ludo");
  assert.match(practice.description, /^A free Ludo tournament on Notes Arcade, 29–30 Nov 2026 \(Lagos time\)\. A practice tournament: teens welcome, no prizes\./);
  assert.doesNotMatch(practice.description, /sponsored/);
  assert.equal(whoLine(t), "Free entry · prizes · 18+");
  assert.equal(whoLine({ prize: false, ageRule: "practice" }), "Free entry · practice, teens welcome · no prizes");
  assert.ok(LIST_TITLE.includes("Notes Arcade") && LIST_DESCRIPTION.length > 50);

  // The winner's message: congratulations, the place, the prize as written, the sponsor, and §5's "confirm your details" line.
  const m = winnerMessage(t, "Whot", { username: "ada", place: 1, prize: { place: "1st", prize: "A phone" } }, "https://x.test/arcade/tournaments/cup");
  assert.match(m, /^Congratulations, @ada! You placed 1st in The Ariaria Cup \(Whot, 29–30 Nov 2026\)\./);
  assert.match(m, /Your prize: A phone, from Ariaria Ltd, who sponsored the tournament\./);
  assert.match(m, /Reply here to confirm your details; nothing is handed over until the team has checked\./);
  assert.match(m, /https:\/\/x\.test\/arcade\/tournaments\/cup/);
  assert.doesNotMatch(m, /₦|naira|cash/i, "promises only what the prize says");
  const noSponsor = winnerMessage({ ...t, sponsor: undefined }, "Whot", { username: "ada", place: 2, prize: { place: "2nd", prize: "A voucher" } }, "u");
  assert.match(noSponsor, /placed 2nd/); assert.match(noSponsor, /Your prize: A voucher\./); assert.doesNotMatch(noSponsor, /sponsored/);
  const top = winnerMessage({ ...t, prize: false, prizes: [], ageRule: "practice" }, "Whot", { username: "kemi", place: 3 }, "u");
  assert.match(top, /^Well played, @kemi! You finished 3rd/); assert.match(top, /practice tournament, so there's nothing to claim/);
  assert.doesNotMatch(top, /confirm your details|Your prize/);
  assert.ok(winnerMessage(t, "Whot", { username: "a".repeat(30), place: 10, prize: { place: "10th", prize: "x".repeat(200) } }, "https://x.test/" + "y".repeat(80)).length < 2000, "fits a message");
  assert.equal(ordinal(1), "1st"); assert.equal(ordinal(2), "2nd"); assert.equal(ordinal(3), "3rd"); assert.equal(ordinal(11), "11th"); assert.equal(ordinal(22), "22nd");
  assert.equal(winnerBell(t, 1, true), "🏆 You placed 1st in The Ariaria Cup! Check Messages: #NotesApp wrote to you about your prize.");
  assert.equal(winnerBell({ name: "P", prize: false }, 2, false), "🏆 You placed 2nd in P! Well played!");
  assert.ok(winnerBell({ name: "n".repeat(80), prize: true }, 1, true).length <= 280);
}

// ---- the results post (lib/arcade/tournament-results.ts; owner, 24 Nov 2026: "the results post on #NotesApp's account naming the
// winners and the sponsor") ----
void (async () => {
  const links = { tournament: "https://x.test/arcade/tournaments/cup", list: "https://x.test/arcade/tournaments", partners: "https://x.test/arcade/partners" };
  const t = {
    name: "The Ariaria Ludo Weekend", playFrom: good.playFrom, playUntil: good.playUntil, prize: true, ageRule: "adults" as const, entrants: 42,
    prizes: [{ place: "1st", prize: "A phone" }, { place: "2nd", prize: "A ₦10,000 voucher" }],
    sponsor: { name: "Ariaria Ltd", link: "https://ariaria.example/shop", words: "Shop local, play fair." },
  };
  assert.equal(resultsPostTitle(t), "Winners of The Ariaria Ludo Weekend");
  // Given out of order: the post lists them by place.
  const body = resultsPostBody(t, "Ludo", [
    { place: 2, username: "kemi_o", summary: "Won, 3 seeds home", prize: "A ₦10,000 voucher" },
    { place: 1, username: "ada", summary: "Won, 4 seeds home", prize: "A phone" },
  ], links);
  assert.match(body, /^The results of \*\*The Ariaria Ludo Weekend\*\* \(Ludo, 29–30 Nov 2026\) are in, and checked\./);
  assert.match(body, /Thank you to \*\*\[Ariaria Ltd\]\(https:\/\/ariaria\.example\/shop\)\*\* for sponsoring The Ariaria Ludo Weekend and its prizes\. In their words:\n\n> Shop local, play fair\./);
  const first = body.indexOf("- **1st:** @ada, Won, 4 seeds home. Prize: A phone.");
  const second = body.indexOf("- **2nd:** @kemi_o, Won, 3 seeds home. Prize: A ₦10,000 voucher.");
  assert.ok(first > 0 && second > first, "winners in place order, @username and their checked result");
  assert.match(body, /## The prizes\n\nAs listed before entry opened, from Ariaria Ltd:\n\n- \*\*1st:\*\* A phone\n- \*\*2nd:\*\* A ₦10,000 voucher/);
  assert.match(body, /42 members entered\. Entry was free, everyone played the same Ludo deal/);
  assert.match(body, /every try was checked by replaying it/);
  assert.match(body, /\[See the final leaderboard\]\(https:\/\/x\.test\/arcade\/tournaments\/cup\)/);
  assert.match(body, /\[Notes Arcade tournaments\]\(https:\/\/x\.test\/arcade\/tournaments\)/);
  assert.match(body, /\[sponsored tournaments\]\(https:\/\/x\.test\/arcade\/partners\)/);

  // Teens (and members who keep their profile private) aren't named in a public post (docs/YOUNG_MEMBERS.md); a practice tournament
  // says it had no prizes; no sponsor, no thanks line.
  const practice = resultsPostBody({ ...t, prize: false, prizes: [], ageRule: "practice", sponsor: undefined, entrants: 1 }, "Ludo", [
    { place: 1, username: "teenstar", summary: "Won", unnamed: "teen" },
    { place: 2, username: "quiet1", summary: "Won", unnamed: "private" },
    { place: 3, username: "bola", summary: "Lost" },
  ], links);
  assert.doesNotMatch(practice, /teenstar|quiet1/, "never their username");
  assert.match(practice, /- \*\*1st:\*\* a player in teen mode, Won\./);
  assert.match(practice, /- \*\*2nd:\*\* a member who keeps their profile private, Won\./);
  assert.match(practice, /- \*\*3rd:\*\* @bola, Lost\./);
  assert.match(practice, /practice tournament: teens welcome, no prizes/); assert.doesNotMatch(practice, /## The prizes|Prize:|Thank you to/);
  assert.match(practice, /1 member entered\./);
  assert.match(resultsPostBody({ ...t, sponsor: undefined }, "Ludo", [], links), /Nobody finished a try this time\./);

  // Markdown safety: text from a sponsor or a game can't become emphasis, a link, HTML or a heading; a username that isn't one isn't
  // linked; a leading underscore can't open emphasis.
  assert.equal(escapeMd("*Best* [deals](javascript:alert(1)) <b>x</b> # _y_ `z`"), "\\*Best\\* \\[deals\\](javascript:alert(1)) \\<b\\>x\\</b\\> \\# \\_y\\_ \\`z\\`");
  assert.equal(escapeMd("- one\ntwo"), "\\- one two"); assert.equal(escapeMd("1. first"), "1\\. first");
  assert.equal(mention("ada_obi"), "@ada_obi"); assert.equal(mention("_ada"), "@\\_ada"); assert.equal(mention("bad name"), null); assert.equal(mention("x](y)"), null);
  assert.equal(mdUrl("javascript:alert(1)"), null); assert.equal(mdUrl("http://a.example"), null); assert.equal(mdUrl("https://a.example/x y(1)"), "https://a.example/x%20y%281%29");
  assert.equal(winnerName({ place: 1, username: "<script>", summary: "" }), "a player whose account is no longer active");
  const nasty = resultsPostBody({
    ...t, name: "Cup <img src=x onerror=alert(1)>", sponsor: { name: "*Evil* [click](javascript:alert(1))", link: "javascript:alert(1)", words: "# Heading\n<script>alert(1)</script>" },
    prizes: [{ place: "1st", prize: "[free](javascript:x)" }],
  }, "Ludo", [{ place: 1, username: "_ada_", summary: "Won *big*", prize: "[free](javascript:x)" }], links);
  const { remark } = await import("remark");
  const html = (await import("remark-html")).default;
  const rendered = String(await remark().use(html).process(nasty));
  assert.doesNotMatch(rendered, /<script|<img|javascript:"|href="javascript|<em>|<h1/i, rendered);
  assert.match(rendered, /\*Evil\* \[click\]\(javascript:alert\(1\)\)/, "the sponsor's name shows as typed");
  assert.match(rendered, /@_ada_, Won \*big\*/, "the username and summary show as typed");
  console.log("TOURNAMENTS OK");
})().catch((e) => { console.error(e); process.exit(1); });

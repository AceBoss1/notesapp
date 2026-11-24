// The results post (docs/ARCADE_TOURNAMENTS.md §2 "The winners": "a post on #NotesApp's own account naming the winners and the sponsor";
// owner, 24 Nov 2026: "build: the results post on #NotesApp's account naming the winners and the sponsor"). Pure: no Firestore, no
// React, no game registry, so Admin's draft and the tests build exactly the same words. lib/arcade/tournaments-server.ts picks the winners
// (the same list "Tell winners" tells) and publishes the post on @na-notesapp's journal.
//
// The body is Markdown, the format journals are written in (remark + lib/linkify.ts render it, and turn @username into a profile link).
// Everything that came from someone else (the tournament's name, the sponsor's name and words, the prizes, the result summaries) is
// escaped, so a sponsor called "*Best* [deals](javascript:…)" shows as typed instead of becoming emphasis or a link.
import type { Prize, Tournament } from "./tournaments";
import { lagosDates, ordinal } from "./tournament-text";

/** Why a winner isn't named in public. docs/YOUNG_MEMBERS.md: a teen's public name is a nickname only and they're kept off public lists
 *  (lib/young.ts keptOffLists), and so is an adult who chose `keepHidden`; a deleted or suspended account isn't linked. Prize tournaments are 18+,
 *  so a teen only ever places in a practice tournament. */
export type Unnamed = "teen" | "private" | "gone";
export type PostWinner = { place: number; username: string; summary: string; prize?: string; unnamed?: Unnamed };

export const UNNAMED_LABEL: Record<Unnamed, string> = {
  teen: "a player in teen mode",
  private: "a member who keeps their profile private",
  gone: "a player whose account is no longer active",
};

type PostTournament = Pick<Tournament, "name" | "playFrom" | "playUntil" | "prize" | "prizes" | "ageRule"> & {
  sponsor?: { name: string; link: string; words?: string };
  entrants?: number;
};
export type PostLinks = { tournament: string; list: string; partners: string };

/** Text from someone else, made safe to drop into Markdown on one line: the characters that start emphasis, links, code, HTML, headings,
 *  tables or strikethrough are backslash-escaped, line breaks become spaces (a winner's line stays one list item), and a leading "-",
 *  "+" or "1." can't start a list (the sponsor's words open a quote line). */
export function escapeMd(s: string): string {
  return String(s ?? "").replace(/[\r\n\u0000]+/g, " ").trim().replace(/[\\`*_[\]{}<>#|~&!]/g, (c) => `\\${c}`)
    .replace(/^([-+])/, "\\$1").replace(/^(\d+)([.)])/, "$1\\$2");
}

/** A username as an @mention. Usernames are [a-z0-9_] (app/api/account/username); anything else isn't a username and is left out
 *  (null). Underscores inside a word never start emphasis in Markdown, so `@ada_obi` is safe as it is and stays a mention; only a leading
 *  underscore could open emphasis, so that one is escaped. */
export function mention(username: string): string | null {
  if (!/^[a-z0-9_]{1,40}$/.test(username)) return null;
  return `@${username.replace(/^_/, "\\_")}`;
}

/** An https address safe inside a Markdown link's (…): spaces, brackets and angle brackets percent-encoded. Anything else gives null. */
export function mdUrl(url: string): string | null {
  try { if (new URL(url).protocol !== "https:") return null; } catch { return null; }
  return url.replace(/[\s()<>[\]]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

/** How one winner is named in public: their @username, or the plain words for someone who mustn't be named (see Unnamed). */
export function winnerName(w: PostWinner): string {
  const m = w.unnamed ? null : mention(w.username);
  return m ?? UNNAMED_LABEL[w.unnamed ?? "gone"];
}

export const resultsPostTitle = (t: Pick<Tournament, "name">) => `Winners of ${t.name}`.slice(0, 200);

/** The post's Markdown body: thanks to the sponsor (name, link and words), the winners in order with their checked results and prizes,
 *  the prizes as listed, how many entered, why it was fair, the final leaderboard, and what's next. */
export function resultsPostBody(t: PostTournament, gameName: string, winners: PostWinner[], links: PostLinks): string {
  const name = escapeMd(t.name);
  const game = escapeMd(gameName);
  const out: string[] = [];
  out.push(`The results of **${name}** (${game}, ${lagosDates(t.playFrom, t.playUntil)}) are in, and checked. 🏆`);
  if (t.sponsor) {
    const href = mdUrl(t.sponsor.link);
    const sponsor = href ? `[${escapeMd(t.sponsor.name)}](${href})` : escapeMd(t.sponsor.name);
    out.push(`Thank you to **${sponsor}** for sponsoring ${name}${t.prize ? " and its prizes" : ""}.${t.sponsor.words ? " In their words:" : ""}`);
    if (t.sponsor.words) out.push(`> ${escapeMd(t.sponsor.words)}`);
  }
  const sorted = [...winners].sort((a, b) => a.place - b.place);
  out.push(sorted.length > 1 ? "## The winners" : "## The winner");
  if (!sorted.length) out.push("Nobody finished a try this time.");
  else out.push(sorted.map((w) => {
    const prize = t.prize && w.prize ? ` Prize: ${escapeMd(w.prize)}.` : "";
    return `- **${ordinal(w.place)}:** ${winnerName(w)}, ${escapeMd(w.summary)}.${prize}`;
  }).join("\n"));
  out.push("Well played, all of you.");
  if (t.prize && t.prizes.length) {
    out.push("## The prizes");
    out.push(`As listed before entry opened${t.sponsor ? `, from ${escapeMd(t.sponsor.name)}` : ""}:`);
    out.push(t.prizes.map((p: Prize) => `- **${escapeMd(p.place)}:** ${escapeMd(p.prize)}`).join("\n"));
  } else if (t.ageRule === "practice") {
    out.push("It was a practice tournament: teens welcome, no prizes, just the bragging rights.");
  }
  const n = t.entrants ?? 0;
  out.push(`## Same deal for everyone`);
  out.push(`${n ? `${n} ${n === 1 ? "member" : "members"} entered. ` : ""}Entry was free, everyone played the same ${game} deal against the computer at the same level, and every try was checked by replaying it on our server, so the best player wins, not the luckiest.`);
  const board = mdUrl(links.tournament);
  if (board) out.push(`[See the final leaderboard](${board})`);
  const list = mdUrl(links.list), partners = mdUrl(links.partners);
  const next = list ? `Fancy your chances? Look out for the next one on [Notes Arcade tournaments](${list}).` : "Fancy your chances? Look out for the next Notes Arcade tournament.";
  out.push(`${next}${partners ? ` Want your brand's name on a tournament? See [sponsored tournaments](${partners}).` : ""}`);
  return out.join("\n\n");
}

// The words a tournament is shared and announced with (owner, 24 Nov 2026: "share cards and sitemap entries for each tournament; telling
// winners in Messages"). Pure: no Firestore, no React, no game registry, so the page's generateMetadata, its share card
// (opengraph-image.tsx), Admin's preview and the server's sender all say the same thing, and tests can check it.
// The game's display name is passed in (lib/arcade/catalogue.ts ARCADE_GAMES), so this file doesn't load any game's code.
import type { Prize, Tournament } from "./tournaments";

type Shareable = Pick<Tournament, "name" | "playFrom" | "playUntil" | "prize" | "prizes" | "ageRule"> & { sponsor?: { name: string } };

const parts = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { d: p.day, m: p.month, y: p.year };
};

/** The play window as dates in Lagos time, the way the plan names tournaments: "29–30 Nov 2026", "30 Nov – 2 Dec 2026", "29 Nov 2026". */
export function lagosDates(fromIso: string, untilIso: string): string {
  const a = parts(fromIso);
  // A window ending exactly at midnight belongs to the day before (a "29–30 Nov" weekend that runs to 00:00 on the 1st).
  const b = parts(new Date(Date.parse(untilIso) - 1).toISOString());
  if (a.y !== b.y) return `${a.d} ${a.m} ${a.y} – ${b.d} ${b.m} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${a.m} – ${b.d} ${b.m} ${b.y}`;
  if (a.d !== b.d) return `${a.d}–${b.d} ${a.m} ${a.y}`;
  return `${a.d} ${a.m} ${a.y}`;
}

/** "1st: A phone, and 2 more prizes" — the headline of a prize tournament's prizes; "" when there are none. */
export function prizesHeadline(prizes: Prize[]): string {
  if (!prizes.length) return "";
  const first = `${prizes[0].place}: ${prizes[0].prize}`;
  return prizes.length === 1 ? first : `${first}, and ${prizes.length - 1} more ${prizes.length === 2 ? "prize" : "prizes"}`;
}

/** Who may play, in a few words (the share card's small line). */
export const whoLine = (t: Pick<Tournament, "prize" | "ageRule">) =>
  t.prize ? "Free entry · prizes · 18+" : t.ageRule === "practice" ? "Free entry · practice, teens welcome · no prizes" : "Free entry · 18+";

/** The tournament page's title and description, for the tab, search results and link previews. */
export function tournamentShare(t: Shareable, gameName: string): { title: string; description: string; dates: string } {
  const dates = lagosDates(t.playFrom, t.playUntil);
  // "The Ariaria Cup, Whot, 29–30 Nov" already says the game; don't say it twice.
  const title = t.name.toLowerCase().includes(gameName.toLowerCase()) ? `${t.name} · Notes Arcade` : `${t.name} · ${gameName} tournament · Notes Arcade`;
  const what = t.prize
    ? `Prizes: ${prizesHeadline(t.prizes)}. 18+.`
    : t.ageRule === "practice" ? "A practice tournament: teens welcome, no prizes." : "No prizes; 18+.";
  const description = `A free ${gameName} tournament on Notes Arcade${t.sponsor ? `, sponsored by ${t.sponsor.name}` : ""}, ${dates} (Lagos time). ${what} Everyone plays the same deal and the server checks every try, so the best player wins.`;
  return { title, description, dates };
}

export const LIST_TITLE = "Tournaments · Notes Arcade";
export const LIST_DESCRIPTION = "Free Notes Arcade tournaments: everyone plays the same deal, every try is checked by the server, and the best player wins. Playing now, coming up and results. Signed-in members; prize tournaments 18+.";

// ---- Telling the winners (docs/ARCADE_TOURNAMENTS.md §5) ----

export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export type WinnerNote = { username: string; place: number; prize?: Prize };

/**
 * The direct message from #NotesApp to one winner. §5: winners are told in Messages and asked to confirm their details, and nothing is
 * handed over before the team's check, so the message says exactly that. It promises only what the prize says (games never pay out
 * cash, §1). A tournament without prizes (practice, or adults with no prizes) gets a plain congratulations instead.
 */
export function winnerMessage(t: Shareable, gameName: string, w: WinnerNote, url: string): string {
  const where = `${t.name} (${gameName}, ${lagosDates(t.playFrom, t.playUntil)})`;
  if (t.prize && w.prize) {
    return [
      `Congratulations, @${w.username}! You placed ${ordinal(w.place)} in ${where}. 🏆`,
      `Your prize: ${w.prize.prize}${t.sponsor ? `, from ${t.sponsor.name}, who sponsored the tournament` : ""}.`,
      "Reply here to confirm your details; nothing is handed over until the team has checked.",
      `The tournament and the final leaderboard: ${url}`,
      "Well played, from all of us at #NotesApp.",
    ].join("\n\n");
  }
  return [
    `Well played, @${w.username}! You finished ${ordinal(w.place)} in ${where}. 🏆`,
    `${t.ageRule === "practice" ? "It was a practice tournament" : "This tournament had no prizes"}, so there's nothing to claim, just the bragging rights${t.sponsor ? `, and thanks to ${t.sponsor.name} for sponsoring it` : ""}. Keep an eye out for the next one.`,
    `The final leaderboard: ${url}`,
    "From all of us at #NotesApp.",
  ].join("\n\n");
}

/** The bell beside it (the message carries the details; the bell links to the tournament page). Under 280 characters. */
export function winnerBell(t: Pick<Tournament, "name" | "prize">, place: number, dm: boolean): string {
  const tail = t.prize ? (dm ? " Check Messages: #NotesApp wrote to you about your prize." : "") : (dm ? " #NotesApp sent you a message." : " Well played!");
  return `🏆 You placed ${ordinal(place)} in ${t.name.slice(0, 120)}!${tail}`;
}

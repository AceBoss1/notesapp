// While a message is typed: a country's name (3 letters or more: "nig", "South Afr", "Naija") or its code in capitals ("NG", "GHA")
// just before the caret offers that country's flag, and its map when we have one (components/CountrySuggest.tsx). Codes count only in
// capitals, so everyday words like "in", "to" or "us" never set it off.
import { COUNTRIES, COUNTRY_MAPS, flagCode, type Country } from "./countries";

export type CountryMatch = { country: Country; start: number; end: number; byCode: boolean; whole: boolean };
export type CountryOffer = { country: Country; emoji: string; kind: "flag" | "map" };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// The countries matching the words just before the caret, best first (at most `max`).
export function countriesAt(text: string, caret: number, max = 3): CountryMatch[] {
  const before = text.slice(0, caret);
  if (caret < text.length && /[\p{L}\p{N}]/u.test(text[caret])) return []; // in the middle of a word
  const tail = /((?:[\p{L}'’.-]+ ){0,3}[\p{L}'’.-]+)$/u.exec(before);
  if (!tail) return [];
  const words = tail[1].split(" ");
  const out: CountryMatch[] = [];
  const seen = new Set<string>();
  // Longest phrase first, so "South Africa" wins over "Africa".
  for (let n = words.length; n >= 1; n--) {
    const phrase = words.slice(words.length - n).join(" ");
    const start = caret - phrase.length;
    if (start > 0 && /[\p{L}\p{N}:@#]/u.test(before[start - 1])) continue;
    const q = fold(phrase);
    for (const c of COUNTRIES) {
      if (seen.has(c.code)) continue;
      const byCode = n === 1 && (phrase === c.code || phrase === c.code3);
      const names = [c.name, ...c.aka].map(fold);
      const whole = byCode || names.includes(q);
      const prefix = q.length >= 3 && names.some((x) => x.startsWith(q));
      if (byCode || whole || prefix) { seen.add(c.code); out.push({ country: c, start, end: caret, byCode, whole }); }
    }
    if (out.length) break;
  }
  return out.sort((a, b) => Number(b.whole) - Number(a.whole)).slice(0, max);
}

export function offersFor(m: CountryMatch): CountryOffer[] {
  const map = COUNTRY_MAPS[m.country.code];
  return [{ country: m.country, emoji: flagCode(m.country.code), kind: "flag" as const }, ...(map ? [{ country: m.country, emoji: map, kind: "map" as const }] : [])];
}

// Picking an offer: a code is replaced by the emoji ("NG" → 🇳🇬); a name is finished if it was cut short and the emoji goes after it
// ("Nig" → "Nigeria 🇳🇬"). Returns the new text and where the caret goes.
export function applyOffer(text: string, m: CountryMatch, emoji: string): { text: string; caret: number } {
  const typed = text.slice(m.start, m.end);
  const insert = m.byCode ? emoji : `${m.whole ? typed : m.country.name} ${emoji}`;
  const after = text.slice(m.end);
  const join = after.startsWith(" ") ? "" : " ";
  return { text: text.slice(0, m.start) + insert + join + after, caret: m.start + insert.length + join.length };
}

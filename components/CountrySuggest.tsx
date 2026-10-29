"use client";

import { useEffect, useState, type RefObject } from "react";
import { applyOffer, countriesAt, offersFor, type CountryMatch } from "@/lib/country-suggest";
import { Emoji } from "@/components/NotesAppEmoji";

// Type a country ("Nigeria", "nig", "NG") and a row above the box offers its flag and, when we have one, its map. Tap one to put it in;
// a code is swapped for the emoji, a name keeps its word (finished if it was cut short). Esc or typing on hides it.
export default function CountrySuggest({ target, value, onChange }: {
  target: RefObject<HTMLTextAreaElement | HTMLInputElement>;
  value: string;
  onChange: (next: string) => void;
}) {
  const [matches, setMatches] = useState<CountryMatch[]>([]);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const look = () => setMatches(el.selectionStart === el.selectionEnd ? countriesAt(el.value, el.selectionStart ?? el.value.length) : []);
    const esc = (e: Event) => { if ((e as KeyboardEvent).key === "Escape") setMatches([]); };
    const blur = () => window.setTimeout(() => setMatches([]), 150);
    el.addEventListener("input", look); el.addEventListener("click", look); el.addEventListener("keyup", look);
    el.addEventListener("keydown", esc); el.addEventListener("blur", blur);
    return () => { el.removeEventListener("input", look); el.removeEventListener("click", look); el.removeEventListener("keyup", look); el.removeEventListener("keydown", esc); el.removeEventListener("blur", blur); };
  }, [target]);
  useEffect(() => { if (!value) setMatches([]); }, [value]);

  if (!matches.length) return null;
  const pick = (m: CountryMatch, emoji: string) => {
    const next = applyOffer(value, m, emoji);
    onChange(next.text);
    setMatches([]);
    const el = target.current;
    window.requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(next.caret, next.caret); });
  };
  return (
    <div role="listbox" aria-label="Add a flag or map" className="absolute bottom-full left-0 z-30 mb-1 flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-rule bg-card p-1.5 shadow-lg">
      {matches.flatMap((m) => offersFor(m).map((o) => (
        <button key={o.emoji} type="button" role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); pick(m, o.emoji); }}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 font-ui text-xs font-semibold text-ink hover:bg-crimson/10">
          <span className="text-lg leading-none"><Emoji e={o.emoji} /></span>{m.country.name}{o.kind === "map" ? " map" : ""}
        </button>
      )))}
    </div>
  );
}

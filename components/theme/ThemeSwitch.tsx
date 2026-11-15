"use client";

import { useEffect, useState } from "react";
import { THEME_CHOICES, THEME_EVENT, readThemeChoice, saveThemeChoice, type ThemeChoice } from "@/lib/theme";

// Day ☀ · Night ☽ · Auto ◐. `compact` is the row in the phone menu; the full one, with a line under each, is in Account settings; `pill` is
// the slim Day | Night | Auto at the foot of the My account menu (Moda user dashboard redesign).
export default function ThemeSwitch({ compact = false, pill = false }: { compact?: boolean; pill?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  useEffect(() => {
    setChoice(readThemeChoice());
    const on = () => setChoice(readThemeChoice());
    window.addEventListener(THEME_EVENT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(THEME_EVENT, on); window.removeEventListener("storage", on); };
  }, []);
  if (pill) return (
    <div role="radiogroup" aria-label="Day or night" className="grid grid-cols-3 rounded-full border border-rule bg-paper p-[3px] font-ui text-[13px]">
      {THEME_CHOICES.map((c) => {
        const on = choice === c.id;
        return (
          <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => saveThemeChoice(c.id)}
            className={`rounded-full py-1.5 ${on ? "bg-crimson-bright/10 font-semibold text-crimson" : "text-slate hover:text-ink"}`}>{c.label}</button>
        );
      })}
    </div>
  );
  return (
    <div role="radiogroup" aria-label="Day or night" className={`grid grid-cols-3 gap-2 ${compact ? "" : "max-w-lg"}`}>
      {THEME_CHOICES.map((c) => {
        const on = choice === c.id;
        return (
          <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => saveThemeChoice(c.id)}
            className={`rounded-xl border px-3 text-left transition-colors ${compact ? "py-2" : "py-3"} ${on ? "border-crimson bg-crimson/10" : "border-rule hover:border-crimson/50"}`}>
            <span className="flex items-center gap-2 font-ui text-sm font-bold text-ink"><span aria-hidden className="text-lg leading-none text-crimson">{c.icon}</span>{c.label}</span>
            {!compact && <span className="mt-1 block text-xs text-slate">{c.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

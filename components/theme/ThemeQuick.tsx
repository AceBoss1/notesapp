"use client";

import { useEffect, useState } from "react";
import { THEME_CHOICES, THEME_EVENT, readThemeChoice, saveThemeChoice, type ThemeChoice } from "@/lib/theme";

// The round button in the header: shows ☀, ☽ or ◐ and taps through Day → Night → Auto.
export default function ThemeQuick({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  useEffect(() => {
    const on = () => setChoice(readThemeChoice());
    on();
    window.addEventListener(THEME_EVENT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(THEME_EVENT, on); window.removeEventListener("storage", on); };
  }, []);
  const i = Math.max(0, THEME_CHOICES.findIndex((c) => c.id === choice));
  const now = THEME_CHOICES[i], next = THEME_CHOICES[(i + 1) % THEME_CHOICES.length];
  return (
    <button type="button" onClick={() => saveThemeChoice(next.id)} title={`${now.label}: tap for ${next.label}`} aria-label={`${now.label}. Switch to ${next.label}`}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg leading-none ${className}`}>
      <span aria-hidden suppressHydrationWarning>{choice ? now.icon : "☀"}</span>
    </button>
  );
}

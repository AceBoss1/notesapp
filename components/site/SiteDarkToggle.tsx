"use client";

import { useEffect, useState } from "react";
import { SITE_DARK_KEY } from "@/lib/site-themes";

// The Scholar look's light and dark switch. The first paint already follows the visitor's last choice, or their device's setting (an
// inline script in app/(site)/s/[username]/layout.tsx sets data-site-dark before the page shows); this button flips it and remembers it on
// this device.
export default function SiteDarkToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  const root = () => document.querySelector<HTMLElement>("[data-site-theme]");
  useEffect(() => { setDark(root()?.getAttribute("data-site-dark") === "true"); }, []);
  function flip() {
    const next = !dark;
    root()?.setAttribute("data-site-dark", String(next));
    try { localStorage.setItem(SITE_DARK_KEY, String(next)); } catch { /* private mode: it still switches for this visit */ }
    setDark(next);
  }
  return (
    <button type="button" onClick={flip} aria-pressed={!!dark} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-sm text-ink hover:border-crimson">
      <span aria-hidden>{dark ? "☀" : "☾"}</span>
    </button>
  );
}

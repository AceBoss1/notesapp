"use client";

import { useEffect } from "react";
import { THEME_EVENT, THEME_KEY, applyTheme, readThemeChoice } from "@/lib/theme";

// Keeps Auto in step with the clock (checked each minute and when the tab comes back), and follows a change made in another tab.
export default function ThemeWatcher() {
  useEffect(() => {
    const again = () => applyTheme(readThemeChoice());
    const tick = window.setInterval(() => { if (readThemeChoice() === "auto") again(); }, 60_000);
    const storage = (e: StorageEvent) => { if (e.key === THEME_KEY) again(); };
    const visible = () => { if (document.visibilityState === "visible") again(); };
    window.addEventListener("storage", storage);
    window.addEventListener(THEME_EVENT, again);
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(tick); window.removeEventListener("storage", storage); window.removeEventListener(THEME_EVENT, again); document.removeEventListener("visibilitychange", visible); };
  }, []);
  return null;
}

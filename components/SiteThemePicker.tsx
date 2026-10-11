"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { SITE_THEMES, siteThemeOf, type SiteThemeId } from "@/lib/site-themes";

// Business and Enterprise: pick the look of your own site. Legacy is the original; Aurora is the new one.
export default function SiteThemePicker({ current, username }: { current?: string; username: string }) {
  const [theme, setTheme] = useState<SiteThemeId>(siteThemeOf({ siteTheme: current }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function choose(t: SiteThemeId) {
    if (t === theme || busy) return;
    setBusy(true); setMsg("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/site/theme", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ theme: t }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save the theme.");
      setTheme(t);
      setMsg(`Saved. Your site now uses ${SITE_THEMES.find((x) => x.id === t)!.name}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save the theme.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card mt-10 p-6" aria-labelledby="theme-h">
      <h2 id="theme-h" className="font-display text-xl text-ink">Your site&apos;s theme</h2>
      <p className="mt-1 text-sm text-slate">The look of your own site: your profile, journal and shop on your domain. You can switch back at any time. <a href={`/s/${username}`} className="text-crimson underline" target="_blank" rel="noopener noreferrer">Preview your site</a></p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Site theme">
        {SITE_THEMES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} disabled={busy} onClick={() => choose(t.id)}
            className={`rounded-2xl border p-4 text-left ${theme === t.id ? "border-crimson ring-2 ring-crimson/30" : "border-rule hover:border-crimson"}`}>
            <span className={`mb-3 block h-16 rounded-lg ${t.id === "aurora" ? "" : "border border-rule bg-paper"}`} style={t.id === "aurora" ? { backgroundImage: "linear-gradient(135deg, #4E0119 0%, #7A0328 100%)" } : undefined} aria-hidden="true" />
            <span className="block font-ui text-sm font-bold text-ink">{t.name}{theme === t.id ? " · in use" : ""}</span>
            <span className="mt-1 block text-xs text-slate">{t.blurb}</span>
          </button>
        ))}
      </div>
      {msg && <p className="mt-3 text-sm text-ink" role="status">{msg}</p>}
    </section>
  );
}

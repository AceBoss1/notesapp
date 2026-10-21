"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { BAND_GRADIENT, SITE_THEMES, siteThemeOf, themeAllowed, tierName, type SiteThemeId } from "@/lib/site-themes";

// Pick the look of your own site (Free Basic and above). Legacy is the original; Clean is for every site; Aurora and Maroon come with Pro.
// `children` goes under the looks (the colour sets).
export default function SiteThemePicker({ current, username, tier, title = "Your site's theme", children, onChange }: { current?: string; username: string; tier: string; title?: string; children?: React.ReactNode; onChange?: (t: SiteThemeId) => void }) {
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
      setTheme(t); onChange?.(t);
      setMsg(`Saved. Your site now uses ${SITE_THEMES.find((x) => x.id === t)!.name}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save the theme.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card mt-10 p-6" aria-labelledby="theme-h">
      <h2 id="theme-h" className="font-display text-xl text-ink">{title}</h2>
      <p className="mt-1 text-sm text-slate">The look of your whole site. You can switch at any time. <a href={`/s/${username}`} className="text-crimson underline" target="_blank" rel="noopener noreferrer">Preview your site</a></p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Site theme">
        {SITE_THEMES.map((t) => { const open = themeAllowed(t.id, tier); return (
          <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} disabled={busy || !open} onClick={() => choose(t.id)}
            className={`rounded-2xl border p-4 text-left disabled:cursor-not-allowed ${theme === t.id ? "border-crimson ring-2 ring-crimson/30" : "border-rule hover:border-crimson"} ${open ? "" : "opacity-60"}`}>
            {t.id === "maroon" ? (
              // A crimson header over white posts on the paper background
              <span className="mb-3 block h-16 overflow-hidden rounded-lg border border-rule bg-paper" aria-hidden="true">
                <span className="block h-5" style={{ backgroundImage: BAND_GRADIENT }} />
                <span className="mx-3 mt-2 block h-3 rounded border border-rule bg-card" />
                <span className="mx-3 mt-1.5 block h-3 rounded border border-rule bg-card" />
              </span>
            ) : t.id === "clean" ? (
              // White, a coloured button at the top right, words beside a picture
              <span className="mb-3 block h-16 overflow-hidden rounded-lg border border-rule bg-card p-2" aria-hidden="true">
                <span className="flex justify-end"><span className="h-2 w-6 rounded-full bg-crimson" /></span>
                <span className="mt-1.5 flex gap-2"><span className="flex-1 space-y-1"><span className="block h-1.5 rounded bg-ink/70" /><span className="block h-1.5 w-2/3 rounded bg-crimson/70" /><span className="block h-1 w-1/2 rounded bg-rule" /></span><span className="h-7 w-10 rounded bg-crimson/20" /></span>
              </span>
            ) : (
              <span className={`mb-3 block h-16 rounded-lg ${t.id === "aurora" ? "" : "border border-rule bg-paper"}`} style={t.id === "aurora" ? { backgroundImage: BAND_GRADIENT } : undefined} aria-hidden="true" />
            )}
            <span className="block font-ui text-sm font-bold text-ink">{t.name}{theme === t.id ? " · in use" : ""}</span>
            <span className="mt-1 block text-xs text-slate">{t.blurb}</span>
            {!open && <span className="mt-2 block text-xs font-semibold text-slate">🔒 Comes with {tierName(t.minTier)}</span>}
          </button>
        ); })}
      </div>
      {SITE_THEMES.some((t) => !themeAllowed(t.id, tier)) && <p className="mt-2 text-xs text-slate"><Link href="/pricing" className="text-crimson underline">See plans</Link> for the looks with a 🔒.</p>}
      {children}
      {msg && <p className="mt-3 text-sm text-ink" role="status">{msg}</p>}
    </section>
  );
}

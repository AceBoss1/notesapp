"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { MOMENTS_LIVE } from "@/lib/moments-rules";

// Who can see your moments: your followers (the default) or anyone signed in. Blocked members never can either way.
export default function MomentSettings() {
  const [pub, setPub] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (MOMENTS_LIVE) api<{ momentsPublic: boolean }>("/api/moments/prefs").then((r) => setPub(r.momentsPublic)).catch(() => {});
  }, []);
  if (!MOMENTS_LIVE || pub === null) return null;
  async function change(next: boolean) {
    setError("");
    try { await api("/api/moments/prefs", { body: { momentsPublic: next } }); setPub(next); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); }
  }
  return (
    <div className="mt-10 border-t border-rule pt-6">
      <h2 className="font-display text-2xl text-ink">Moments privacy</h2>
      <fieldset className="mt-3 space-y-2 text-sm">
        <legend className="sr-only">Who can see my moments</legend>
        <label className="flex items-start gap-2"><input type="radio" name="moments-audience" checked={!pub} onChange={() => change(false)} className="mt-1" /><span><strong className="text-ink">Followers only</strong> <span className="text-slate">(recommended). Only people who follow your journal can see your moments.</span></span></label>
        <label className="flex items-start gap-2"><input type="radio" name="moments-audience" checked={pub} onChange={() => change(true)} className="mt-1" /><span><strong className="text-ink">Everyone</strong> <span className="text-slate">Any signed-in member who opens your profile can see, like and reply to your moments, even if they don&apos;t follow you.</span></span></label>
      </fieldset>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}

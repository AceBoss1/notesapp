"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";

// Email choices on Account settings (/profile/account#email; the weekly digest's and the referrals report's "Email settings" links
// land here): the #NotesApp Weekly Digest (lib/digest-server.ts) and the monthly referrals report (lib/referral-report-server.ts),
// each on unless switched off.
type Prefs = { weeklyDigest: boolean; referralReport: boolean };
const CHOICES: { key: keyof Prefs; label: string; about: string }[] = [
  { key: "weeklyDigest", label: "#NotesApp Weekly Digest", about: "Every Sunday evening: up to ten journals from the week, your interests first with people you follow mixed in, plus four Notes Market items and four Notes Academy courses." },
  { key: "referralReport", label: "Monthly referrals report", about: "On the 1st of each month: who joined with your link or code, your affiliate sales, what you earned and your balances. Only sent when something happened that month." },
];

export default function EmailSettings() {
  const [signedIn, setSignedIn] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, (u) => {
    setSignedIn(!!u);
    if (u) api<Prefs>("/api/account/email-prefs").then(setPrefs).catch(() => setPrefs(null));
  }), []);
  if (!signedIn || prefs === null) return null;

  async function save(key: keyof Prefs, next: boolean) {
    setError(""); setPrefs((p) => (p ? { ...p, [key]: next } : p));
    try { await api("/api/account/email-prefs", { body: { [key]: next } }); }
    catch (e) { setPrefs((p) => (p ? { ...p, [key]: !next } : p)); setError(e instanceof Error ? e.message : "Couldn't save that."); }
  }
  return (
    <div className="space-y-3 text-sm">
      {CHOICES.map((c) => (
        <label key={c.key} className="flex items-start gap-2 text-ink">
          <input type="checkbox" className="mt-1" checked={prefs[c.key]} onChange={(e) => save(c.key, e.target.checked)} />
          <span>{c.label}
            <span className="mt-0.5 block text-xs text-slate">{c.about}</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-slate">Emails about your bookings, orders and account always come.</p>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";

type Prefs = { weeklyDigest: boolean; announcements: boolean };

// Email choices on Account settings (/profile/account#email; the weekly digest's and announcements' "Email settings" links land here):
// the #NotesApp Weekly Digest (lib/digest-server.ts) and #NotesApp announcements (lib/announcements-server.ts), each on unless
// switched off.
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
    setError(""); const before = prefs!; setPrefs({ ...before, [key]: next });
    try { setPrefs(await api<Prefs>("/api/account/email-prefs", { body: { [key]: next } })); }
    catch (e) { setPrefs(before); setError(e instanceof Error ? e.message : "Couldn't save that."); }
  }
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-start gap-2 text-ink">
        <input type="checkbox" className="mt-1" checked={prefs.weeklyDigest} onChange={(e) => save("weeklyDigest", e.target.checked)} />
        <span>#NotesApp Weekly Digest
          <span className="mt-0.5 block text-xs text-slate">Every Sunday evening: up to ten journals from the week, your interests first with people you follow mixed in, plus four Notes Market items and four Notes Academy courses.</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-ink">
        <input type="checkbox" className="mt-1" checked={prefs.announcements} onChange={(e) => save("announcements", e.target.checked)} />
        <span>News and announcements from #NotesApp
          <span className="mt-0.5 block text-xs text-slate">Now and then: what&apos;s new, what&apos;s coming, and ways to take part. They still reach your bell if you switch the email off. Emails about your bookings, orders and account always come.</span>
        </span>
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

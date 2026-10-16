"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";

// Email choices on Account settings (/profile/account#email; the weekly digest's "Email settings" link lands here).
// For now, the #NotesApp Weekly Digest (lib/digest-server.ts), on unless switched off.
export default function EmailSettings() {
  const [signedIn, setSignedIn] = useState(false);
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, (u) => {
    setSignedIn(!!u);
    if (u) api<{ weeklyDigest: boolean }>("/api/account/email-prefs").then((r) => setOn(r.weeklyDigest)).catch(() => setOn(null));
  }), []);
  if (!signedIn || on === null) return null;

  async function save(next: boolean) {
    setError(""); setOn(next);
    try { await api("/api/account/email-prefs", { body: { weeklyDigest: next } }); }
    catch (e) { setOn(!next); setError(e instanceof Error ? e.message : "Couldn't save that."); }
  }
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-start gap-2 text-ink">
        <input type="checkbox" className="mt-1" checked={on} onChange={(e) => save(e.target.checked)} />
        <span>#NotesApp Weekly Digest
          <span className="mt-0.5 block text-xs text-slate">Every Sunday evening: up to five journals from the week, from people you follow first, then the topics you like. Emails about your bookings, orders and account always come.</span>
        </span>
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

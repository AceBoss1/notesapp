"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, updateProfile, type UserProfile } from "@/lib/users";
import { cleanWork, type Work } from "@/lib/profile-work";
import WorkFields from "./WorkFields";

// A gentle, one-time ask for members who signed up before "What do you do?" existed. Shown under the header to signed-in members who have not
// answered. "Not now" hides it for 30 days, "Don't ask again" for good (kept in this browser), and saving the answer ends it everywhere.
const KEY = "na-work-prompt";
const SNOOZE_MS = 30 * 86_400_000;
const QUIET = ["/signup", "/login", "/admin", "/profile/edit", "/forgot-password", "/welcome"];

const hidden = () => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "never") return true;
    return !!v && Date.now() - Number(v) < SNOOZE_MS;
  } catch { return false; }
};
const remember = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* the prompt just comes back next visit */ } };

export default function WorkPrompt() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(true);
  const [work, setWork] = useState<Work>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setProfile(null);
    if (!u || hidden()) return;
    try {
      const p = await getUserByUid(u.uid);
      if (p && !p.industry) { setProfile(p); setGone(false); }
    } catch { /* it is only a prompt */ }
  }), []);

  if (gone || !profile || QUIET.some((q) => pathname.startsWith(q))) return null;
  const org = profile.accountKind === "organisation";

  async function save() {
    if (!profile || !work.industry) return;
    setBusy(true); setError("");
    try {
      await updateProfile(profile.uid, cleanWork(org ? { industry: work.industry } : work));
      setGone(true);
    } catch {
      setError("Couldn't save that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-rule bg-card px-4 py-3 text-sm text-ink" role="region" aria-label="Tell us what you do">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span>{org ? "Tell us what your organisation does." : "Tell us what you do."} <span className="text-slate">It takes ten seconds and is optional.</span></span>
        {!open && (
          <span className="flex gap-3 font-ui text-xs font-semibold">
            <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-crimson px-4 py-1.5 text-paper">Add it</button>
            <button type="button" onClick={() => { remember(String(Date.now())); setGone(true); }} className="text-slate underline">Not now</button>
            <button type="button" onClick={() => { remember("never"); setGone(true); }} className="text-slate underline">Don&apos;t ask again</button>
          </span>
        )}
      </div>
      {open && (
        <div className="mx-auto mt-3 max-w-xl text-left">
          <WorkFields value={work} onChange={setWork} orgOnly={org} inputClass="mt-1 w-full border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-crimson" />
          {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
          <div className="mt-3 flex gap-3 font-ui text-xs font-semibold">
            <button type="button" disabled={busy || !work.industry} onClick={save} className="rounded-full bg-crimson px-4 py-1.5 text-paper disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => { remember(String(Date.now())); setGone(true); }} className="text-slate underline">Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}

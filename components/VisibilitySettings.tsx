"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { visibilityOf, type Visibility } from "@/lib/social-graph";
import { VISIBILITY_EVENT } from "./PresenceBeat";

// Two switches, both on by default. The rule is the same for each: if yours is off, you can't see other people's either.
export default function VisibilitySettings() {
  const [uid, setUid] = useState<string | null>(null);
  const [vis, setVis] = useState<Visibility | null>(null);
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUid(u?.uid ?? null);
    if (!u) return setVis(null);
    getDoc(doc(db, "users", u.uid)).then((s) => setVis(visibilityOf(s.data()))).catch(() => setVis(null));
  }), []);
  if (!uid || !vis) return null;

  async function save(patch: Partial<Visibility>) {
    setError("");
    const next = { ...vis!, ...patch };
    try {
      await updateDoc(doc(db, "users", uid!), patch);
      setVis(next);
      if ("showOnline" in patch) {
        window.dispatchEvent(new CustomEvent(VISIBILITY_EVENT, { detail: { showOnline: next.showOnline } }));
        if (!next.showOnline) await deleteDoc(doc(db, "presence", uid!)).catch(() => {});
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); }
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-start gap-2 text-ink">
        <input type="checkbox" className="mt-1" checked={vis.showOnline} onChange={(e) => save({ showOnline: e.target.checked })} />
        <span>Show when I&apos;m online and when I was last seen
          <span className="mt-0.5 block text-xs text-slate">Only people who follow you and whom you follow back can see it. If you switch this off, you can&apos;t see other people&apos;s online status either.</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-ink">
        <input type="checkbox" className="mt-1" checked={vis.showLists} onChange={(e) => save({ showLists: e.target.checked })} />
        <span>Let signed-in members see who follows me and who I follow
          <span className="mt-0.5 block text-xs text-slate">Follower counts stay public. If you switch this off, you can&apos;t see other people&apos;s lists either.</span>
        </span>
      </label>
      <LifeSwitches />
      {error && <p className="text-red-700" role="alert">{error}</p>}
    </div>
  );
}

// Notes Life on the rest of NotesApp (lib/life/social.ts). Saved through /api/life/social; in teen mode both stay off.
function LifeSwitches() {
  const [p, setP] = useState<{ lifeShow: boolean; lifeCard: boolean; teen: boolean } | null>(null);
  const call = async (body?: object) => {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(`/api/life/social${body ? "" : "?privacy=1"}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.ok) setP(await r.json());
  };
  useEffect(() => { call().catch(() => undefined); }, []);
  if (!p) return null;
  return (
    <>
      <label className={`flex items-start gap-2 text-ink ${p.teen ? "opacity-60" : ""}`}>
        <input type="checkbox" className="mt-1" disabled={p.teen} checked={p.lifeShow} onChange={(e) => call({ lifeShow: e.target.checked })} />
        <span>Show that I play Notes Life
          <span className="mt-0.5 block text-xs text-slate">People you follow who follow you back see “🎮 Plays Notes Life” on your profile, store and courses, and in their feed.{p.teen ? " Off in teen mode." : ""}</span>
        </span>
      </label>
      <label className={`flex items-start gap-2 text-ink ${p.teen ? "opacity-60" : ""}`}>
        <input type="checkbox" className="mt-1" disabled={p.teen} checked={p.lifeCard} onChange={(e) => call({ lifeCard: e.target.checked })} />
        <span>Notes Life card in my feed
          <span className="mt-0.5 block text-xs text-slate">At most twice a day. Off hides it for good.{p.teen ? " Off in teen mode." : ""}</span>
        </span>
      </label>
    </>
  );
}

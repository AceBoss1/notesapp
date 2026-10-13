"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { ADMIN_PROFILES } from "@/lib/admin";
import { NA_NOTESAPP_PROFILE, OFFICIAL_NOTESAPP_PROFILE } from "@/lib/journals-directory";

const founderEmails = Object.keys(ADMIN_PROFILES).map((e) => e.toLowerCase());

// For the account owner only: follow or unfollow this profile as @na-notesapp. The server checks the owner again; everyone else sees nothing here.
export default function OfficialFollowControl({ username }: { username: string }) {
  const [owner, setOwner] = useState(false);
  const [following, setFollowing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, (u) => {
    setOwner(false);
    // Only founders' accounts are worth asking the server about.
    if (!u?.email || !founderEmails.includes(u.email.toLowerCase())) return;
    api<{ owner: boolean; following?: string[] }>("/api/follows/official").then((r) => { setOwner(r.owner); setFollowing(r.following ?? []); }).catch(() => {});
  }), []);
  if (!owner || username === NA_NOTESAPP_PROFILE.username || username === OFFICIAL_NOTESAPP_PROFILE.username) return null;

  const on = following.includes(username);
  async function toggle() {
    setBusy(true); setError("");
    try {
      await api("/api/follows/official", { body: { username, follow: !on } });
      setFollowing((f) => (on ? f.filter((x) => x !== username) : [...f, username]));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't do that."); }
    finally { setBusy(false); }
  }
  return (
    <div className="w-full">
      <button type="button" onClick={toggle} disabled={busy} className="btn-ghost !px-4 !py-2 text-xs disabled:opacity-50" title="Only you, the account owner, can do this">
        {busy ? "…" : on ? "Unfollow as @na-notesapp" : "Follow as @na-notesapp"}
      </button>
      {error && <p className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}

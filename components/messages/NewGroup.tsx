"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { GROUP_MEMBERS_MAX, GROUP_TITLE_MAX } from "@/lib/messages-rules";

// Starting a group: a name and the usernames of the people to put in it. You can add people you follow or who follow you.
export default function NewGroup() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [names, setNames] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === null) return <p className="text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to start a group.</p>;
  const usernames = names.split(/[\s,]+/).map((n) => n.replace(/^@/, "")).filter(Boolean);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !title.trim() || !usernames.length) return;
        setBusy(true); setError(null);
        try { const r = await api<{ id: string }>("/api/messages/groups", { body: { title, usernames } }); router.push(`/messages/${r.id}`); }
        catch (err) { setError(err instanceof Error ? err.message : "Couldn't start the group."); setBusy(false); }
      }}
    >
      <p className="text-sm text-slate"><Link href="/messages" className="text-crimson underline">← Messages</Link></p>
      <h1 className="font-display text-3xl text-ink">New group</h1>
      <label className="block text-sm text-slate">Group name
        <input value={title} maxLength={GROUP_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lagos coaches" className="mt-1 block w-full rounded border border-rule bg-card px-3 py-2 text-ink" />
      </label>
      <label className="block text-sm text-slate">People to add (usernames)
        <textarea value={names} rows={3} onChange={(e) => setNames(e.target.value)} placeholder="@amaka, @tunde" className="mt-1 block w-full rounded border border-rule bg-card px-3 py-2 text-ink" />
        <span className="mt-1 block text-xs">You can add people you follow or who follow you, up to {GROUP_MEMBERS_MAX} in all. Everyone in a group can see everyone else in it, and anyone can leave at any time.</span>
      </label>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button disabled={busy || !title.trim() || !usernames.length} className="btn-primary disabled:opacity-50">{busy ? "Starting…" : `Start the group${usernames.length ? ` with ${usernames.length} ${usernames.length === 1 ? "person" : "people"}` : ""}`}</button>
    </form>
  );
}

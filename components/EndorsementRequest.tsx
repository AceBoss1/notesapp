"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, UserProfile } from "@/lib/users";
import { getBadgeRequest, BadgeRequest } from "@/lib/moderation";

// Apply for the gold endorsement badge (/badges). Text only — no ID uploads.
export default function EndorsementRequest() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [request, setRequest] = useState<BadgeRequest | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh(u: User) {
    setProfile(await getUserByUid(u.uid));
    setRequest(await getBadgeRequest(u.uid));
  }
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); if (u) refresh(u); }), []);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/badge-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't submit");
      setMessage("");
      await refresh(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit");
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (user === undefined) return null;
  if (!user) {
    body = <p className="mt-2 text-sm text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to apply.</p>;
  } else if (profile?.goldBadge) {
    body = <p className="mt-2 text-sm text-ink">You hold the gold badge.</p>;
  } else if (request?.status === "pending") {
    body = <p className="mt-2 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">Your application is waiting for review.</p>;
  } else {
    body = (
      <form onSubmit={apply} className="mt-3">
        {request?.status === "rejected" && <p className="mb-2 text-sm text-slate">Your last application wasn&apos;t approved. You can apply again with more detail.</p>}
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={800} required
          placeholder="Who you are, what you publish, and links that back it up (website, LinkedIn, published work)."
          className="w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-gold" />
        {error && <p className="mt-2 text-sm text-crimson">{error}</p>}
        <button disabled={busy} className="btn-primary mt-3 !px-4 !py-2 text-xs">{busy ? "Sending…" : "Apply for endorsement"}</button>
        <p className="mt-2 text-[11px] text-slate">Please don&apos;t send ID documents — we don&apos;t collect them.</p>
      </form>
    );
  }
  return (
    <div className="card mt-6 p-6">
      <p className="font-ui text-sm font-bold text-ink">Apply for the gold endorsement badge</p>
      {body}
    </div>
  );
}

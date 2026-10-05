"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canPublish, getUserByUid, UserProfile } from "@/lib/users";
import { useSelfPublisher } from "@/lib/useSelfPublisher";
import { useMemberships } from "@/lib/useMemberships";
import NoteForm from "@/components/NoteForm";
import BecomePublisher from "@/components/BecomePublisher";

export default function NewEntryPage() {
  const { user, profile, setProfile } = useSelfPublisher();
  const { orgs } = useMemberships(user);
  const teamOrgs = (orgs || []).filter((o) => o.canPublish);
  const [postAs, setPostAs] = useState("me");
  const [orgProfile, setOrgProfile] = useState<UserProfile | null>(null);

  // Members without a publishing plan of their own can only write for an organisation.
  const personal = !!profile && canPublish(profile);
  const activeOrgId = postAs !== "me" ? postAs : !personal && teamOrgs.length > 0 ? teamOrgs[0].uid : null;
  useEffect(() => {
    if (!activeOrgId) return setOrgProfile(null);
    getUserByUid(activeOrgId).then(setOrgProfile).catch(() => setOrgProfile(null));
  }, [activeOrgId]);

  if (profile === undefined || orgs === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!profile || (!canPublish(profile) && teamOrgs.length === 0)) {
    return <BecomePublisher user={user} profile={profile ?? null} onApplied={() => setProfile((p) => (p ? { ...p, tierRequest: { status: "pending", message: "", requestedAt: new Date().toISOString() } } : p))} />;
  }
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Link href="/write" className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← My journal</Link>
      <h1 className="mt-4 font-display text-4xl">New entry</h1>
      {teamOrgs.length > 0 && (
        <label className="mt-6 block text-xs text-slate">Post as
          <select
            value={activeOrgId ?? "me"}
            onChange={(e) => setPostAs(e.target.value)}
            className="mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson"
          >
            {personal && <option value="me">Me (@{profile.username})</option>}
            {teamOrgs.map((o) => (
              <option key={o.uid} value={o.uid}>{o.displayName} — organisation channel (as {o.role})</option>
            ))}
          </select>
          {activeOrgId && <span className="mt-1 block">Shown as &ldquo;by @{profile.username} for {orgProfile?.displayName ?? "…"}&rdquo;. Whatever the post earns goes to the organisation.</span>}
        </label>
      )}
      <div className="mt-8">
        {activeOrgId ? (
          orgProfile ? <NoteForm key={activeOrgId} self={profile} org={{ profile: orgProfile }} /> : <p className="text-sm text-slate">Loading…</p>
        ) : (
          <NoteForm key="me" self={profile} />
        )}
      </div>
    </section>
  );
}

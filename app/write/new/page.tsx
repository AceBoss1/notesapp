"use client";

import Link from "next/link";
import { canPublish } from "@/lib/users";
import { useSelfPublisher } from "@/lib/useSelfPublisher";
import NoteForm from "@/components/NoteForm";
import BecomePublisher from "@/components/BecomePublisher";

export default function NewEntryPage() {
  const { user, profile, setProfile } = useSelfPublisher();
  if (profile === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!profile || !canPublish(profile)) {
    return <BecomePublisher user={user} profile={profile ?? null} onApplied={() => setProfile((p) => (p ? { ...p, tierRequest: { status: "pending", message: "", requestedAt: new Date().toISOString() } } : p))} />;
  }
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Link href="/write" className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← My journal</Link>
      <h1 className="mt-4 font-display text-4xl">New entry</h1>
      <div className="mt-8">
        <NoteForm self={profile} />
      </div>
    </section>
  );
}

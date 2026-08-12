"use client";

import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import NoteForm from "@/components/NoteForm";

export default function NewJournalPage() {
  const { user, loading } = useAdminAuth();

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <Link
        href="/admin/journals"
        className="font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright"
      >
        ← All Journals
      </Link>
      <h1 className="font-display text-4xl mt-4">New Journal Entry</h1>
      <div className="mt-8">
        <NoteForm />
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { createNote, getAllNotes } from "@/lib/firestore-notes";
import seedNotes from "@/lib/seed-notes.json";

export default function SeedPage() {
  const { user, loading } = useAdminAuth();
  const [status, setStatus] = useState<string>("");
  const [running, setRunning] = useState(false);

  async function handleImport() {
    setRunning(true);
    setStatus("Checking existing notes…");
    const existing = await getAllNotes({ publishedOnly: false });
    const existingSlugs = new Set(existing.map((n) => n.slug));

    let created = 0;
    let skipped = 0;
    for (const n of seedNotes as any[]) {
      if (existingSlugs.has(n.slug)) {
        skipped++;
        continue;
      }
      setStatus(`Importing "${n.title}"…`);
      await createNote(n);
      created++;
    }
    setStatus(`Done — imported ${created}, skipped ${skipped} already present.`);
    setRunning(false);
  }

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-14">
      <Link
        href="/admin/notes"
        className="font-ui text-xs font-semibold uppercase tracking-wideish text-gold-deep"
      >
        ← All Notes
      </Link>
      <h1 className="font-display text-4xl mt-4">Import Existing Posts</h1>
      <p className="mt-4 text-slate font-body">
        One-time import of the {seedNotes.length} posts recovered from the
        old WordPress site into Firestore. Safe to run more than once —
        posts already present (matched by slug) are skipped.
      </p>
      <button
        onClick={handleImport}
        disabled={running}
        className="mt-8 bg-gold text-ink font-ui font-semibold px-6 py-3 hover:bg-gold-deep hover:text-paper transition-colors disabled:opacity-50"
      >
        {running ? "Importing…" : `Import ${seedNotes.length} Posts`}
      </button>
      {status && <p className="mt-4 text-sm text-slate">{status}</p>}
    </section>
  );
}

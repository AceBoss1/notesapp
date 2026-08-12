"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";

// Renders Precheks' own published notes — same Firestore collection,
// same documents. "Journal" is a #NotesApp UI label, not a different
// dataset.
export default function JournalsGrid() {
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllNotes({ publishedOnly: true })
      .then(setNotes)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="card p-8 text-sm text-slate">
        Couldn't load journals yet — connect Firebase in{" "}
        <code className="font-mono text-crimson-bright">.env.local</code>{" "}
        (same project as precheks-site) to see live data here. ({error})
      </div>
    );
  }

  if (!notes) {
    return <div className="py-16 text-center text-sm text-slate">Loading journals…</div>;
  }

  if (notes.length === 0) {
    return (
      <div className="card p-8 text-sm text-slate">
        No published entries yet. Sign in as an admin and publish the
        first one from{" "}
        <Link href="/admin/journals/new" className="text-crimson underline underline-offset-2">
          the composer
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((n) => (
        <Link
          key={n.id}
          href={`/journals/${n.slug}`}
          className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
        >
          {n.featured_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={n.featured_image}
              alt=""
              className="h-44 w-full object-cover"
            />
          )}
          <div className="flex flex-1 flex-col p-6">
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">
              {n.author} · {n.reading_time} min read
            </p>
            <h3 className="mt-2 font-display text-xl leading-snug text-ink group-hover:text-crimson">
              {n.title}
            </h3>
            <p className="mt-2 flex-1 text-sm text-slate">{n.excerpt}</p>
            {(!!n.likeCount || !!n.viewCount) && (
              <p className="mt-3 font-mono text-[11px] text-slate">
                {!!n.viewCount && <span>{n.viewCount} views</span>}
                {!!n.viewCount && !!n.likeCount && <span> · </span>}
                {!!n.likeCount && <span>{n.likeCount} likes</span>}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

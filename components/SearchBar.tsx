"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";
import { getAllUsers, UserProfile } from "@/lib/users";
import { OFFICIAL_NOTESAPP_PROFILE } from "@/lib/journals-directory";

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [people, setPeople] = useState<UserProfile[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Loaded once, lazily, the first time someone opens search — small
  // demo dataset, so a client-side filter is plenty; a real search
  // index (Algolia/Typesense) is the obvious upgrade once note/user
  // counts grow past what fits in one query.
  useEffect(() => {
    if (!open || notes !== null) return;
    getAllNotes({ publishedOnly: true }).then(setNotes).catch(() => setNotes([]));
    getAllUsers().then(setPeople).catch(() => setPeople([]));
  }, [open, notes]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const matchedNotes = useMemo(() => {
    if (!notes || q.trim().length < 2) return [];
    const query = q.toLowerCase();
    return notes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.categories.some((c) => c.toLowerCase().includes(query)) ||
          n.tags.some((t) => t.toLowerCase().includes(query))
      )
      .slice(0, 5);
  }, [notes, q]);

  const matchedPeople = useMemo(() => {
    if (q.trim().length < 2) return [];
    const query = q.toLowerCase();
    const pool = [
      { username: OFFICIAL_NOTESAPP_PROFILE.username, displayName: OFFICIAL_NOTESAPP_PROFILE.displayName },
      ...(people || []),
    ];
    return pool
      .filter(
        (p) =>
          p.displayName.toLowerCase().includes(query) ||
          p.username.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [people, q]);

  const hasResults = matchedNotes.length > 0 || matchedPeople.length > 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        placeholder="Search journals, people, topics…"
        className="w-full rounded-full border border-rule bg-card px-4 py-2 font-body text-sm focus:border-crimson outline-none"
      />

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl2 border border-rule bg-card shadow-lg">
          {notes === null ? (
            <p className="p-4 text-sm text-slate">Loading…</p>
          ) : !hasResults ? (
            <p className="p-4 text-sm text-slate">No matches for "{q}".</p>
          ) : (
            <>
              {matchedNotes.length > 0 && (
                <div className="p-3">
                  <p className="px-2 font-mono text-[10px] uppercase tracking-eyebrow text-crimson-bright">
                    Journals
                  </p>
                  {matchedNotes.map((n) => (
                    <Link
                      key={n.id}
                      href={`/journals/${n.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-paper"
                    >
                      {n.featured_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.featured_image}
                          alt=""
                          className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 flex-shrink-0 rounded-md bg-rule" />
                      )}
                      <span className="text-sm font-medium text-ink">{n.title}</span>
                    </Link>
                  ))}
                </div>
              )}
              {matchedPeople.length > 0 && (
                <div className="border-t border-rule p-3">
                  <p className="px-2 font-mono text-[10px] uppercase tracking-eyebrow text-crimson-bright">
                    People
                  </p>
                  {matchedPeople.map((p) => (
                    <Link
                      key={p.username}
                      href={`/u/${p.username}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-paper"
                    >
                      <span className="text-sm font-medium text-ink">{p.displayName}</span>
                      <span className="font-mono text-xs text-slate">@{p.username}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

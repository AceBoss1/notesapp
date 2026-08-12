"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getAllNotes, deleteNote, NoteWithComputed } from "@/lib/firestore-notes";

export default function AdminNotesPage() {
  const { user, loading } = useAdminAuth();
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const all = await getAllNotes({ publishedOnly: false });
      setNotes(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    }
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
    await deleteNote(id);
    load();
  }

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14">
      <div className="flex items-center justify-between border-b-2 border-ink pb-4">
        <div>
          <p className="eyebrow">Precheks Admin</p>
          <h1 className="font-display text-4xl mt-2">Notes</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="border border-rule px-5 py-2.5 font-ui text-sm font-semibold hover:border-gold"
          >
            ← Dashboard
          </Link>
          <Link
            href="/admin/notes/new"
            className="bg-gold text-ink font-ui font-semibold px-5 py-2.5 hover:bg-gold-deep hover:text-paper transition-colors"
          >
            + New Note
          </Link>
          <button
            onClick={() => signOut(auth)}
            className="border border-rule px-5 py-2.5 font-ui text-sm hover:border-gold"
          >
            Sign Out
          </button>
        </div>
      </div>

      {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

      {!notes ? (
        <p className="mt-8 text-slate">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="mt-8 text-slate">
          No notes yet.{" "}
          <Link href="/admin/seed" className="text-gold-deep underline">
            Import your existing 15 posts →
          </Link>
        </p>
      ) : (
        <div className="mt-8 divide-y divide-rule">
          {notes.map((n) => (
            <div
              key={n.id}
              className="flex items-center justify-between py-4"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 ${
                      n.status === "published"
                        ? "bg-gold/20 text-gold-deep"
                        : "bg-slate/10 text-slate"
                    }`}
                  >
                    {n.status}
                  </span>
                  <p className="font-ui font-semibold text-ink">{n.title}</p>
                </div>
                <p className="text-xs text-slate mt-1 font-mono">
                  /{n.slug} · {n.author}
                </p>
              </div>
              <div className="flex gap-4 flex-shrink-0">
                <Link
                  href={`/admin/notes/${n.id}/edit`}
                  className="font-ui text-sm font-semibold text-gold-deep hover:text-ink"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(n.id, n.title)}
                  className="font-ui text-sm font-semibold text-red-700 hover:text-red-900"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

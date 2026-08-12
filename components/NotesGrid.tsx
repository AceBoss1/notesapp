"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { NoteWithComputed } from "@/lib/firestore-notes";

export default function NotesGrid({ notes }: { notes: NoteWithComputed[] }) {
  const [selected, setSelected] = useState<string>("All");

  const categories = useMemo(() => {
    const all = Array.from(new Set(notes.flatMap((n) => n.categories)));
    return ["All", ...all];
  }, [notes]);

  const filtered =
    selected === "All"
      ? notes
      : notes.filter((n) => n.categories.includes(selected));

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2 border-y border-rule py-4">
        {categories.map((c) => {
          const active = c === selected;
          return (
            <button
              key={c}
              onClick={() => setSelected(c)}
              className={`font-ui text-xs font-semibold uppercase tracking-wideish px-3 py-1.5 transition-colors ${
                active
                  ? "bg-ink text-paper"
                  : "text-slate border border-rule hover:border-gold hover:text-gold-deep"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10 mt-10">
        {filtered.map((n) => (
          <Link key={n.slug} href={`/notes/${n.slug}`} className="group">
            {n.featured_image && (
              <Image
                src={n.featured_image}
                alt={n.title}
                width={400}
                height={260}
                className="w-full h-48 object-cover"
              />
            )}
            <p className="eyebrow mt-3">{n.categories[0] || "Notes"}</p>
            <h3 className="headline-link text-xl mt-1.5">{n.title}</h3>
            <p className="mt-2 text-sm text-slate">{n.excerpt}</p>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-10 text-slate">No notes in this category yet.</p>
      )}
    </>
  );
}

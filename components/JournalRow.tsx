import Link from "next/link";
import { NoteWithComputed } from "@/lib/firestore-notes";

export default function JournalRow({
  note,
  showAuthor = false,
}: {
  note: NoteWithComputed;
  showAuthor?: boolean;
}) {
  return (
    <Link
      href={`/journals/${note.slug}`}
      className="card flex items-center gap-4 p-3 transition-shadow hover:shadow-md"
    >
      {note.featured_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={note.featured_image}
          alt=""
          className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-crimson/10 font-display text-xl text-crimson-bright">
          {note.title[0]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-ui text-sm font-semibold text-ink">
          {note.title}
        </p>
        <p className="mt-1 truncate text-xs text-slate">{note.excerpt}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-crimson-bright">
          {showAuthor ? `${note.author} · ` : ""}
          {note.categories[0] || "Journal"}
          {note.premium && <span className="ml-1.5 text-crimson">🔒</span>}
        </p>
      </div>
      <span className="flex-shrink-0 font-mono text-[10px] text-slate">
        {note.reading_time}m
      </span>
    </Link>
  );
}

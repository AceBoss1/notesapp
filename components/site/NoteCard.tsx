import Link from "next/link";
import type { NoteWithComputed } from "@/lib/firestore-notes";

export default function NoteCard({ note, base }: { note: NoteWithComputed; base: string }) {
  return (
    <Link href={`${base}/notes/${note.slug}`} className="card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {note.featured_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={note.featured_image} alt="" className="aspect-[16/9] w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-crimson-bright">
          {note.categories[0] || "Journal"}
          {note.premium && <span className="ml-1.5">🔒</span>}
        </p>
        <h3 className="mt-2 font-display text-xl leading-snug text-ink">{note.title}</h3>
        {note.excerpt && <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate">{note.excerpt}</p>}
        <p className="mt-3 font-mono text-[11px] text-slate">{note.reading_time} min read</p>
      </div>
    </Link>
  );
}

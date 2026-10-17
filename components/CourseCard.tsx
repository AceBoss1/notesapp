import Link from "next/link";

// A course on a shelf (docs/COURSES.md). Free courses play from the teacher's YouTube; paid ones are on #NotesApp.
export type CourseCardData = { id: string; title: string; teacher: string; teacherAvatar: string; image: string; lessons: number; hours: number; priceLabel: string; free: boolean; certificate: boolean; learners?: number };
export default function CourseCard({ c, href }: { c: CourseCardData; href: string }) {
  return (
    <Link href={href} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image} alt="" className="aspect-video w-full object-cover" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs text-slate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.teacherAvatar} alt="" className="h-5 w-5 rounded-full object-cover" />
          <span className="truncate">{c.teacher}</span>
        </div>
        <p className="mt-2 font-ui text-base font-bold leading-snug text-ink group-hover:text-crimson">{c.title}</p>
        <p className="mt-1 text-xs text-slate">{c.lessons} lessons · {c.hours} h{c.learners ? ` · ${c.learners.toLocaleString("en-GB")} learners` : ""}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className={`font-ui text-sm font-bold ${c.free ? "text-emerald-700" : "text-ink"}`}>{c.priceLabel}</span>
          {c.certificate && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-amber-900">Certificate</span>}
        </div>
      </div>
    </Link>
  );
}

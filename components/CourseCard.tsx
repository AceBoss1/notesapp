import Link from "next/link";
import { NameBadgeIcons } from "@/components/PersonName";
import { durationLabel, type CourseListing } from "@/lib/courses";

// A course on a shelf (docs/COURSES.md). Free courses play from the teacher's YouTube; paid ones are on #NotesApp.
// `minutes` (when known) is shown instead of `hours`; `progress` (0–100) draws the learner's bar on the card.
export type CourseCardData = {
  id: string; title: string; teacher: string; teacherAvatar: string; teacherUsername?: string; image: string; lessons: number; hours: number; minutes?: number;
  priceLabel: string; free: boolean; certificate: boolean; learners?: number; progress?: number;
};
export const courseCardOf = (c: CourseListing, progress?: number): CourseCardData => ({
  id: c.id, title: c.title, teacher: c.ownerName, teacherAvatar: c.ownerAvatar, teacherUsername: c.ownerUsername, image: c.cover, lessons: c.lessonCount,
  hours: Math.round((c.minutes / 60) * 10) / 10, minutes: c.minutes, priceLabel: "Free", free: true, certificate: true, learners: c.enrolCount, progress,
});

export default function CourseCard({ c, href }: { c: CourseCardData; href: string }) {
  const length = c.minutes !== undefined ? durationLabel(c.minutes) : c.hours ? `${c.hours} h` : "";
  return (
    <Link href={href} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {c.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={c.image} alt="" loading="lazy" className="aspect-video w-full object-cover" />
        : <span aria-hidden className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright p-4 text-center font-display text-xl leading-snug text-paper">{c.title}</span>}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.teacherAvatar || "/images/headshots/default-avatar.png"} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
          <span className="truncate">{c.teacher}</span>
          {c.teacherUsername && <NameBadgeIcons username={c.teacherUsername} size={12} />}
        </div>
        <p className="mt-2 font-ui text-base font-bold leading-snug text-ink group-hover:text-crimson">{c.title}</p>
        <p className="mt-1 text-xs text-slate">{c.lessons} {c.lessons === 1 ? "lesson" : "lessons"}{length ? ` · ${length}` : ""}{c.learners ? ` · ${c.learners.toLocaleString("en-GB")} ${c.learners === 1 ? "learner" : "learners"}` : ""}</p>
        {c.progress !== undefined && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-rule"><div className="h-full rounded-full bg-crimson" style={{ width: `${c.progress}%` }} /></div>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-slate">{c.progress === 100 ? "Finished" : `${c.progress}% done`}</p>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className={`font-ui text-sm font-bold ${c.free ? "text-emerald-700" : "text-ink"}`}>{c.priceLabel}</span>
          {c.certificate && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-amber-900">Certificate</span>}
        </div>
      </div>
    </Link>
  );
}

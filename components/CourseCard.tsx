"use client";

import Link from "next/link";
import { NameBadgeIcons } from "@/components/PersonName";
import { durationLabel, showsRating, type CourseListing } from "@/lib/courses";
import { useSavedCourses } from "@/lib/course-social-client";

// A course on a shelf (docs/COURSES.md). Free courses play from the teacher's YouTube; paid ones are on #NotesApp.
// `minutes` (when known) is shown instead of `hours`; `progress` (0–100) draws the learner's bar on the card. Its stars show from two
// reviews (lib/courses.ts showsRating); the bookmark on the cover saves it to Saved → Courses without opening it.
export type CourseCardData = {
  id: string; title: string; teacher: string; teacherAvatar: string; teacherUsername?: string; image: string; lessons: number; hours: number; minutes?: number;
  priceLabel: string; free: boolean; certificate: boolean; learners?: number; progress?: number;
  likes?: number; rating?: { count: number; average: number };
};
export const courseCardOf = (c: CourseListing, progress?: number): CourseCardData => ({
  id: c.id, title: c.title, teacher: c.ownerName, teacherAvatar: c.ownerAvatar, teacherUsername: c.ownerUsername, image: c.cover, lessons: c.lessonCount,
  hours: Math.round((c.minutes / 60) * 10) / 10, minutes: c.minutes, priceLabel: "Free", free: true, certificate: true, learners: c.enrolCount, progress,
  likes: c.likeCount, rating: c.rating,
});

export default function CourseCard({ c, href }: { c: CourseCardData; href: string }) {
  const length = c.minutes !== undefined ? durationLabel(c.minutes) : c.hours ? `${c.hours} h` : "";
  const { saved, toggle, signedIn } = useSavedCourses();
  const on = saved.has(c.id);
  return (
    <Link href={href} className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {signedIn && (
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggle(c.id); }} aria-pressed={on} aria-label={on ? "Remove from Saved" : "Save this course"} title={on ? "Saved" : "Save"}
          className={`absolute right-2 top-2 z-[1] flex h-9 w-9 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur hover:bg-card ${on ? "text-crimson" : "text-ink"}`}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z" /></svg>
        </button>
      )}
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
          <span className="flex items-center gap-2 text-xs">
            {showsRating(c.rating) && <span className="text-amber-500" title={`${c.rating!.average.toFixed(1)} from ${c.rating!.count} reviews`}>★ <b className="text-ink">{c.rating!.average.toFixed(1)}</b></span>}
            {!!c.likes && <span className="text-crimson" title={`${c.likes} likes`}>♥ {c.likes.toLocaleString("en-GB")}</span>}
            {c.certificate && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-amber-900">Certificate</span>}
          </span>
        </div>
      </div>
    </Link>
  );
}

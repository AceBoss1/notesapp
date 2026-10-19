"use client";

import CourseCard, { courseCardOf } from "@/components/CourseCard";
import { isCrimsonTheme } from "@/lib/site-themes";
import { COURSES_LIVE } from "@/lib/site-settings";
import { courseHref } from "@/lib/courses";
import { useAcademy } from "@/lib/courses-client";
import { byRecent } from "@/lib/discovery";
import { useSite } from "./SiteContext";
import AuroraBand from "./AuroraBand";

// The courses the member teaches on Notes Academy (published ones), newest first. A course opens on #NotesApp itself, where
// learners enrol and keep their progress. While Notes Academy is switched off this page says courses are coming.
export default function SiteCourses() {
  const { displayName, theme, username } = useSite();
  const crimson = isCrimsonTheme(theme);
  const courses = useAcademy(username, COURSES_LIVE);
  return (
    <div>
      {crimson && <AuroraBand eyebrow="Courses"><h1 className="mt-3 font-display text-4xl sm:text-5xl">Courses</h1></AuroraBand>}
      <div className={`mx-auto max-w-5xl px-4 sm:px-6 ${crimson ? "pb-14 pt-8" : "py-14"}`}>
        {!crimson && <><p className="eyebrow">Courses</p><h1 className="mt-2 font-display text-4xl text-ink">Courses</h1></>}
        {!COURSES_LIVE ? (
          <div className="card mt-8 p-6">
            <p className="font-display text-xl text-ink">Courses are coming soon</p>
            <p className="mt-1 text-sm text-slate">{displayName}&apos;s courses will be listed here.</p>
          </div>
        ) : courses === undefined ? (
          <p className="mt-8 text-sm text-slate">Loading…</p>
        ) : courses.length === 0 ? (
          <div className="card mt-8 p-6">
            <p className="font-display text-xl text-ink">No courses yet</p>
            <p className="mt-1 text-sm text-slate">{displayName}&apos;s courses will be listed here.</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {byRecent(courses).map((c) => <CourseCard key={c.id} c={courseCardOf(c)} href={courseHref(c.slug)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

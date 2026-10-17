"use client";

import { isCrimsonTheme } from "@/lib/site-themes";
import { useSite } from "./SiteContext";
import AuroraBand from "./AuroraBand";

// Courses aren't on #NotesApp yet (docs/COURSES.md); until they are, this page says they're coming.
export default function SiteCourses() {
  const { displayName, theme } = useSite();
  const crimson = isCrimsonTheme(theme);
  return (
    <div>
      {crimson && <AuroraBand eyebrow="Courses"><h1 className="mt-3 font-display text-4xl sm:text-5xl">Courses</h1></AuroraBand>}
      <div className={`mx-auto max-w-5xl px-4 sm:px-6 ${crimson ? "pb-14 pt-8" : "py-14"}`}>
        {!crimson && <><p className="eyebrow">Courses</p><h1 className="mt-2 font-display text-4xl text-ink">Courses</h1></>}
        <div className="card mt-8 p-6">
          <p className="font-display text-xl text-ink">Courses are coming soon</p>
          <p className="mt-1 text-sm text-slate">{displayName}&apos;s courses will be listed here.</p>
        </div>
      </div>
    </div>
  );
}

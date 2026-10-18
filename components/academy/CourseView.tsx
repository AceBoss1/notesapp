"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AcademyIcon } from "@/components/shell/icons";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { hashtag } from "@/lib/topics";
import { subtopicHashtag } from "@/lib/subtopics";
import { countCourseView, useCourse } from "@/lib/courses-client";
import AcademyFaq from "./AcademyFaq";
import ReviewsPanel, { Stars } from "@/components/ReviewsPanel";
import { useCourseSocial, useSavedCourses } from "@/lib/course-social-client";
import { RATING_SHOWN_FROM, durationLabel, lessonHref, plural, progressOf, showsRating, type Course, type Enrolment, type Lesson } from "@/lib/courses";

// /academy/<slug>: a course's page. Cover, title, the teacher, summary and topics; the lessons with their length (✓ once done);
// then "Enrol — free" (signed out: sign in and come straight back), or the learner's progress and Continue. The teacher sees
// their own draft here as a preview.
export default function CourseView({ slug }: { slug: string }) {
  const c = useCourse(slug);
  const { course, lessons, enrolment, user, preview } = c;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const counted = useRef(false);
  const { social, like } = useCourseSocial(course && !preview ? course.id : undefined);
  const { saved, toggle: toggleSave } = useSavedCourses();
  const [note, setNote] = useState("");
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(""), 2200); };

  useEffect(() => {
    if (!course || preview || user === undefined || counted.current) return;
    counted.current = true;
    countCourseView(course.id, user);
  }, [course, preview, user]);

  async function enrol() {
    setBusy(true);
    setError("");
    try { await c.enrol(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't enrol you."); } finally { setBusy(false); }
  }
  // Back from signing in with ?enrol=1: finish what they started.
  const { enrol: doEnrol } = c;
  useEffect(() => {
    if (!user || enrolment === undefined || !course || new URLSearchParams(window.location.search).get("enrol") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname);
    if (enrolment) return; // already enrolled
    setBusy(true);
    doEnrol().catch((e) => setError(e instanceof Error ? e.message : "Couldn't enrol you.")).finally(() => setBusy(false));
  }, [user, enrolment, course, doEnrol]);

  if (c.status === "loading") return <p className="px-4 py-24 text-center text-sm text-slate">Loading the course…</p>;
  if (c.status === "missing" || !course) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-3xl text-ink">Course not found</p>
        <p className="mt-2 text-sm text-slate">It may have been unpublished or moved.</p>
        <Link href="/academy" className="btn-primary mt-6 inline-block !px-6 !py-2 text-sm">Browse Notes Academy</Link>
      </div>
    );
  }
  const mine = !!user && user.uid === course.ownerUid;

  return (
    <>
      {preview && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Preview: this course is a draft, so only you can see it. <Link href={`/academy/teach/${course.id}`} className="font-semibold underline">Back to the editor</Link>
        </div>
      )}
      <section className="bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright text-paper">
        <div className={`mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 sm:py-12 ${course.cover ? "lg:grid-cols-[1fr_400px] lg:items-center" : ""}`}>
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-eyebrow text-paper/80"><Link href="/academy" className="hover:text-paper">Notes Academy</Link> · Free course</p>
            <h1 className="mt-3 font-display text-[2.4rem] leading-[1.1] sm:text-5xl">{course.title}</h1>
            <Link href={`/u/${course.ownerUsername}`} className="mt-5 flex w-fit items-center gap-3">
              <Avatar src={course.ownerAvatar} alt={course.ownerName} size={44} className="ring-2 ring-white/40" />
              <span className="min-w-0">
                <span className="flex items-center font-ui text-base font-semibold"><span className="truncate">{course.ownerName}</span><NameBadgeIcons username={course.ownerUsername} size={15} onDark /></span>
                <span className="block font-mono text-xs text-paper/75">@{course.ownerUsername} · Teacher</span>
              </span>
            </Link>
            {social && showsRating(social.rating) && (
              <a href="#reviews" className="mt-4 flex w-fit items-center gap-2 text-sm">
                <Stars value={social.rating.average} size="text-base !text-amber-300" /><strong>{social.rating.average.toFixed(1)}</strong>
                <span className="text-paper/80">· {plural(social.rating.count, "review")}{course.enrolCount ? ` · ${plural(course.enrolCount, "learner")}` : ""}</span>
              </a>
            )}
          </div>
          {course.cover
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={course.cover} alt="" className="aspect-video w-full rounded-2xl object-cover shadow-lg" />
            : null}
        </div>
      </section>
      {!preview && (
        <div className="border-b border-rule bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-around gap-2 px-4 py-1.5 font-ui text-sm font-semibold text-ink sm:justify-start sm:gap-6 sm:px-8">
            <button type="button" onClick={async () => { const e = await like(); if (e) flash(e); }} aria-pressed={!!social?.liked} aria-label={social?.liked ? "Unlike this course" : "Like this course"}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-paper ${social?.liked ? "text-crimson" : ""}`}>
              <HeartIcon on={!!social?.liked} />{social ? social.likeCount.toLocaleString("en-GB") : "Like"}
            </button>
            <button type="button" onClick={async () => { const r = await toggleSave(course.id); if (r.error) flash(r.error); else flash(saved.has(course.id) ? "Removed from Saved" : "Saved: find it in Saved → Courses"); }} aria-pressed={saved.has(course.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-paper ${saved.has(course.id) ? "text-crimson" : ""}`}>
              <BookmarkIcon on={saved.has(course.id)} />{saved.has(course.id) ? "Saved" : "Save"}
            </button>
            <a href="#reviews" className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-paper"><span aria-hidden className="text-amber-500">★</span>Review</a>
            <button type="button" onClick={async () => { const url = window.location.href.split("#")[0]; try { if (navigator.share) await navigator.share({ title: course.title, url }); else { await navigator.clipboard.writeText(url); flash("Link copied"); } } catch {} }}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-paper"><span aria-hidden>↗</span>Share</button>
          </div>
          {note && <p role="status" className="pb-2 text-center text-xs font-semibold text-crimson">{note}</p>}
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_340px]">
        <aside className="lg:col-start-2 lg:row-start-1">
          <div className="lg:sticky lg:top-24">
            <EnrolCard course={course} lessons={lessons} enrolment={enrolment} signedIn={!!user} slug={slug} busy={busy} onEnrol={enrol} mine={mine} />
            {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {course.summary && <p className="whitespace-pre-line text-[17px] leading-relaxed text-ink sm:text-base">{course.summary}</p>}
          {course.topics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {course.topics.map((t) => <Link key={t} href={`/academy?topic=${t}`} className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-crimson ring-1 ring-rule hover:ring-crimson">{hashtag(t)}</Link>)}
              {(course.subtopics ?? []).map((x) => <Link key={`${x.parent}/${x.slug}`} href={`/academy?topic=${x.parent}`} className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-slate ring-1 ring-rule hover:ring-crimson">{hashtag(x.parent)} › {subtopicHashtag(x.label)}</Link>)}
            </div>
          )}
          <h2 className="mt-8 font-display text-2xl text-ink">Lessons</h2>
          <p className="mt-1 text-xs text-slate">{plural(lessons.length, "lesson")}{course.minutes ? ` · ${durationLabel(course.minutes)}` : ""}{enrolment ? "" : " · the first lesson is a free preview"}</p>
          <LessonList slug={slug} lessons={lessons} enrolment={enrolment} open={!!enrolment || mine} />
          {!preview && <ReviewsPanel courseId={course.id} user={user} title="What learners say" minShown={RATING_SHOWN_FROM} />}
          <AcademyFaq />
        </div>
      </div>
    </>
  );
}

function EnrolCard({ course, lessons, enrolment, signedIn, slug, busy, onEnrol, mine }: {
  course: Course; lessons: Lesson[]; enrolment: Enrolment | null | undefined; signedIn: boolean; slug: string; busy: boolean; onEnrol: () => void; mine: boolean;
}) {
  const ids = lessons.map((l) => l.id);
  const p = progressOf(ids, enrolment);
  const back = `/academy/${slug}?enrol=1`;
  return (
    <div className="card p-5">
      <p className="font-ui text-2xl font-bold text-emerald-700">Free</p>
      <p className="mt-1 text-sm text-slate">{plural(lessons.length, "lesson")}{course.minutes ? ` · ${durationLabel(course.minutes)}` : ""}{course.enrolCount ? ` · ${plural(course.enrolCount, "learner")}` : ""}</p>
      {enrolment ? (
        <>
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-rule"><div className="h-full rounded-full bg-crimson transition-all" style={{ width: `${p.pct}%` }} /></div>
            <p className="mt-1.5 text-xs text-slate">{p.complete ? "You've finished every lesson. Well done!" : `${p.done} of ${p.total} lessons done · ${p.pct}%`}</p>
          </div>
          {p.next && <Link href={lessonHref(slug, p.next)} className="btn-primary mt-4 w-full !py-3">{p.complete ? "Watch again" : p.done ? "Continue" : "Start"}</Link>}
        </>
      ) : enrolment === undefined && signedIn ? (
        <p className="mt-4 text-sm text-slate">Checking your progress…</p>
      ) : (
        <>
          {signedIn
            ? <button onClick={onEnrol} disabled={busy || lessons.length === 0} className="btn-primary mt-4 w-full !py-3 disabled:opacity-50">{busy ? "Enrolling…" : "Enrol — free"}</button>
            : <Link href={`/login?next=${encodeURIComponent(back)}`} className="btn-primary mt-4 w-full !py-3">Enrol — free</Link>}
          <p className="mt-2 text-xs text-slate">{signedIn ? "Your progress is saved as you go." : "Sign in (or join free) and you'll come straight back here."}</p>
          {ids[0] && <Link href={lessonHref(slug, ids[0])} className="btn-ghost mt-3 w-full !py-2.5">Watch the first lesson</Link>}
        </>
      )}
      {mine && <Link href={`/academy/teach/${course.id}`} className="mt-4 block text-center text-sm font-semibold text-crimson">You teach this course · Edit it</Link>}
      {mine ? (
        <Link href="/academy/teach/setup" className="mt-4 block border-t border-rule pt-3 text-center text-sm font-semibold text-crimson"><AcademyIcon className="mr-1.5 inline-block h-[1.2em] w-[1.2em] align-[-0.25em]" />Set up your certificates</Link>
      ) : enrolment?.certificateId ? (
        <Link href={`/certificates/${enrolment.certificateId}`} className="mt-4 block border-t border-rule pt-3 text-center text-sm font-semibold text-crimson"><AcademyIcon className="mr-1.5 inline-block h-[1.2em] w-[1.2em] align-[-0.25em]" />See your certificate</Link>
      ) : enrolment && p.complete ? (
        <Link href={`/academy/${slug}/certificate`} className="btn-primary mt-4 w-full !py-3"><AcademyIcon className="mr-1.5 inline-block h-[1.2em] w-[1.2em] align-[-0.25em]" />Get your certificate</Link>
      ) : (
        <p className="mt-4 border-t border-rule pt-3 text-xs text-slate">Finish every lesson and get a certificate anyone can check, with your name, the hours and a QR code.</p>
      )}
    </div>
  );
}

export function LessonList({ slug, lessons, enrolment, open, current }: { slug: string; lessons: Lesson[]; enrolment: Enrolment | null | undefined; open: boolean; current?: string }) {
  return (
    <ol className="mt-4 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
      {lessons.map((l, i) => {
        const done = !!enrolment?.done?.[l.id];
        const locked = !open && i > 0;
        return (
          <li key={l.id}>
            <Link href={lessonHref(slug, l.id)} aria-current={current === l.id ? "page" : undefined}
              className={`flex items-center gap-3 px-4 py-3.5 hover:bg-paper ${current === l.id ? "bg-crimson/[0.06]" : ""}`}>
              <span aria-label={done ? "Done" : undefined} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-ui text-xs font-bold ${done ? "bg-emerald-600 text-white" : "bg-crimson/[0.08] text-crimson"}`}>{done ? "✓" : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className={`block font-ui text-[15px] font-semibold leading-snug sm:text-sm ${current === l.id ? "text-crimson" : "text-ink"}`}>{l.title}</span>
                <span className="block text-xs text-slate">{l.kind === "youtube" ? "Video" : "Reading"}{l.minutes ? ` · ${durationLabel(l.minutes)}` : ""}{!open && i === 0 ? " · Free preview" : ""}</span>
              </span>
              {locked && <span className="shrink-0 font-mono text-[10px] uppercase tracking-eyebrow text-slate">Enrol</span>}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

const HeartIcon = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>
);
export const BookmarkIcon = ({ on, className = "h-5 w-5" }: { on: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z" /></svg>
);

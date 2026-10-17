"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { remark } from "remark";
import html from "remark-html";
import { remarkLinkify } from "@/lib/linkify";
import { useCourse } from "@/lib/courses-client";
import { courseHref, durationLabel, lessonHref, progressOf, youtubeEmbed } from "@/lib/courses";
import { LessonList } from "./CourseView";

// /academy/<slug>/<lessonId>: one lesson. A video plays in YouTube's privacy-enhanced player and is ticked off by itself once
// the learner has watched about 90% of it (the YouTube IFrame Player API, loaded only on this page); "Mark as done" is always
// there too. A text lesson ends with the button. The course's lessons sit beside the player on a computer and below it on a
// phone. Learners who haven't enrolled can watch the first lesson as a preview.
export default function LessonPlayer({ slug, lessonId }: { slug: string; lessonId: string }) {
  const c = useCourse(slug);
  const { course, lessons, enrolment, user, preview } = c;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (c.status === "loading") return <p className="px-4 py-24 text-center text-sm text-slate">Loading the lesson…</p>;
  const i = lessons.findIndex((l) => l.id === lessonId);
  if (c.status === "missing" || !course || i < 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-3xl text-ink">Lesson not found</p>
        <p className="mt-2 text-sm text-slate">It may have been moved or removed.</p>
        <Link href={course ? courseHref(course.slug) : "/academy"} className="btn-primary mt-6 inline-block !px-6 !py-2 text-sm">{course ? "Back to the course" : "Browse Notes Academy"}</Link>
      </div>
    );
  }
  const lesson = lessons[i];
  const mine = !!user && user.uid === course.ownerUid;
  const open = !!enrolment || mine || i === 0;
  const done = !!enrolment?.done?.[lesson.id];
  const p = progressOf(lessons.map((l) => l.id), enrolment);
  const prev = lessons[i - 1], next = lessons[i + 1];

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  const mark = (on: boolean) => act(() => c.mark(lesson.id, on));
  const back = `/academy/${slug}/${lesson.id}`;
  const enrolBox = (
    <div className="card p-5">
      <p className="font-display text-xl text-ink">{open ? "Enrol to save your progress" : "Enrol to watch this lesson"}</p>
      <p className="mt-1 text-sm text-slate">It&apos;s free. Lessons are ticked off as you finish them{open ? "" : ", and the whole course opens"}.</p>
      {user
        ? <button onClick={() => act(c.enrol)} disabled={busy} className="btn-primary mt-4 w-full !py-3 disabled:opacity-50 sm:w-auto sm:!px-8">{busy ? "Enrolling…" : "Enrol — free"}</button>
        : <Link href={`/login?next=${encodeURIComponent(back)}`} className="btn-primary mt-4 w-full !py-3 sm:w-auto sm:!px-8">Sign in to enrol — free</Link>}
    </div>
  );

  return (
    <>
      {preview && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Preview of a draft: only you can see it. <Link href={`/academy/teach/${course.id}`} className="font-semibold underline">Back to the editor</Link>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <Link href={courseHref(course.slug)} className="font-ui text-sm font-semibold text-crimson">← {course.title}</Link>
        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            {open ? (
              lesson.kind === "youtube" && lesson.youtubeId
                ? <YouTubeLesson key={lesson.id} videoId={lesson.youtubeId} onWatched={enrolment && !done ? () => { void c.mark(lesson.id, true).catch(() => {}); } : undefined} />
                : <TextLesson key={lesson.id} body={lesson.body ?? ""} />
            ) : enrolBox}

            <p className="mt-5 font-mono text-xs uppercase tracking-eyebrow text-slate">Lesson {i + 1} of {lessons.length}{lesson.minutes ? ` · ${durationLabel(lesson.minutes)}` : ""}</p>
            <h1 className="mt-1 font-display text-3xl leading-tight text-ink sm:text-4xl">{lesson.title}</h1>

            {open && (enrolment ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {done
                  ? <><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 font-ui text-sm font-semibold text-emerald-800">✓ Done</span><button onClick={() => mark(false)} disabled={busy} className="text-sm text-slate underline hover:text-ink">Mark as not done</button></>
                  : <button onClick={() => mark(true)} disabled={busy} className="btn-primary !py-2.5 disabled:opacity-50">{busy ? "Saving…" : "Mark as done"}</button>}
                {lesson.kind === "youtube" && !done && <span className="text-xs text-slate">Ticked off by itself once you&apos;ve watched most of the video.</span>}
              </div>
            ) : enrolment === null || !user ? <div className="mt-5">{enrolBox}</div> : null)}
            {error && <p className="mt-3 text-sm text-crimson">{error}</p>}

            <nav className="mt-8 grid grid-cols-2 gap-3 border-t border-rule pt-5">
              {prev ? <Link href={lessonHref(slug, prev.id)} className="rounded-xl border border-rule p-3 hover:border-crimson"><span className="block text-xs text-slate">← Previous</span><span className="mt-0.5 block truncate font-ui text-sm font-semibold text-ink">{prev.title}</span></Link> : <span />}
              {next ? <Link href={lessonHref(slug, next.id)} className="rounded-xl border border-rule p-3 text-right hover:border-crimson"><span className="block text-xs text-slate">Next →</span><span className="mt-0.5 block truncate font-ui text-sm font-semibold text-ink">{next.title}</span></Link>
                : <Link href={courseHref(course.slug)} className="rounded-xl border border-rule p-3 text-right hover:border-crimson"><span className="block text-xs text-slate">Finished?</span><span className="mt-0.5 block font-ui text-sm font-semibold text-ink">Back to the course</span></Link>}
            </nav>
          </div>

          <aside className="min-w-0">
            <div className="lg:sticky lg:top-24">
              {enrolment && (
                <div className="card mb-4 p-4">
                  <div className="h-2 overflow-hidden rounded-full bg-rule"><div className="h-full rounded-full bg-crimson transition-all" style={{ width: `${p.pct}%` }} /></div>
                  <p className="mt-1.5 text-xs text-slate">{p.complete ? "Every lesson done. Well done! Certificates are coming." : `${p.done} of ${p.total} lessons done · ${p.pct}%`}</p>
                </div>
              )}
              <p className="font-display text-xl text-ink">Lessons</p>
              <div className="lg:max-h-[70vh] lg:overflow-y-auto"><LessonList slug={slug} lessons={lessons} enrolment={enrolment} open={!!enrolment || mine} current={lesson.id} /></div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

// ---- text lessons: Markdown rendered as journals are (remark-html sanitises it; links and @mentions become links) ----
function TextLesson({ body }: { body: string }) {
  const [out, setOut] = useState("");
  useEffect(() => {
    let alive = true;
    remark().use(remarkLinkify).use(html).process(body).then((f) => alive && setOut(String(f))).catch(() => alive && setOut("<p>Couldn't show this lesson.</p>"));
    return () => { alive = false; };
  }, [body]);
  return <article className="prose prose-lg max-w-none rounded-2xl border border-rule bg-card p-5 font-body text-ink prose-headings:font-display prose-a:text-crimson-bright sm:p-8" dangerouslySetInnerHTML={{ __html: out }} />;
}

// ---- video lessons ----
type YTPlayer = { getCurrentTime(): number; getDuration(): number; getPlayerState(): number };
type YTNamespace = { Player: new (el: HTMLIFrameElement, opts: { events?: Record<string, (e: unknown) => void> }) => YTPlayer };
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }

let ytApi: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApi) {
    ytApi = new Promise<YTNamespace>((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); if (window.YT) resolve(window.YT); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => { ytApi = null; reject(new Error("YouTube's player didn't load")); };
      document.head.appendChild(s);
    });
  }
  return ytApi;
}

// The privacy-enhanced embed, responsive 16:9. Seconds actually played are added up (seeking ahead doesn't count), and
// onWatched fires once they reach 90% of the video.
function YouTubeLesson({ videoId, onWatched }: { videoId: string; onWatched?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const cb = useRef(onWatched);
  cb.current = onWatched;
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (!origin || !frame.current) return;
    let player: YTPlayer | null = null, timer: ReturnType<typeof setInterval> | undefined, alive = true;
    let watched = 0, last = -1, fired = false;
    loadYouTubeApi().then((YT) => {
      if (!alive || !frame.current) return;
      player = new YT.Player(frame.current, {});
      timer = setInterval(() => {
        try {
          if (!player || fired) return;
          const t = player.getCurrentTime(), d = player.getDuration();
          if (player.getPlayerState() === 1 && last >= 0) { const step = t - last; if (step > 0 && step <= 3) watched += step; }
          last = t;
          if (d > 0 && watched >= d * 0.9 && cb.current) { fired = true; cb.current(); }
        } catch { /* the player isn't ready yet */ }
      }, 1000);
    }).catch(() => { /* "Mark as done" still works */ });
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [origin, videoId]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink">
      {origin && (
        <iframe ref={frame} src={`${youtubeEmbed(videoId)}&enablejsapi=1&origin=${encodeURIComponent(origin)}`} title="Lesson video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0" />
      )}
    </div>
  );
}

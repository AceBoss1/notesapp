"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AcademyIcon } from "@/components/shell/icons";
import { remark } from "remark";
import html from "remark-html";
import { remarkLinkify } from "@/lib/linkify";
import { fetchLesson, useCourse, type LessonContent } from "@/lib/courses-client";
import { courseHref, durationLabel, isPaid, lessonHref, nairaLabel, progressOf, youtubeEmbed, type Lesson } from "@/lib/courses";
import { deviceLabel, getDeviceId } from "@/lib/device";
import dynamic from "next/dynamic";
import type { User } from "firebase/auth";
import { LessonList } from "./CourseView";

// The PDF viewer (pdf.js) loads in the browser only.
const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false, loading: () => <div className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-paper" /> });

// /academy/<slug>/<lessonId>: one lesson. A YouTube video plays in YouTube's privacy-enhanced player and an uploaded video (paid
// courses) in Cloudflare Stream's, with the viewer's @username and email drifting faintly across it; each is ticked off by itself
// once the learner has watched about 90% of it, and "Mark as done" is always there too. A text lesson ends with the button; a PDF
// opens in the page's own viewer. A free course's lessons come straight from Firestore; a paid course's (and any upload) from
// POST /api/academy/lesson, which opens free previews to anyone and the rest to buyers on up to two devices. The course's lessons
// sit beside the player on a computer and below it on a phone.
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
  const paid = isPaid(course);
  const mine = !!user && (user.uid === course.ownerUid || (course.tutorUids ?? []).includes(user.uid));
  const inCourse = !!enrolment && (!paid || !!enrolment.purchaseRef);
  const open = inCourse || mine || (paid ? !!lesson.preview : i === 0);
  const done = !!enrolment?.done?.[lesson.id];
  const p = progressOf(lessons.map((l) => l.id), enrolment);
  const prev = lessons[i - 1], next = lessons[i + 1];
  const remote = paid || lesson.kind === "video" || lesson.kind === "pdf";

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  const mark = (on: boolean) => act(() => c.mark(lesson.id, on));
  const watched = enrolment && !done ? () => { void c.mark(lesson.id, true).catch(() => {}); } : undefined;
  const back = `/academy/${slug}/${lesson.id}`;
  const joinBox = paid ? (
    <div className="card p-5">
      <p className="font-display text-xl text-ink">{open ? "Like it? Get the whole course" : "Buy the course to watch this lesson"}</p>
      <p className="mt-1 text-sm text-slate">{nairaLabel(course.priceKobo ?? 0)}, yours for good on up to 2 devices{course.certificateIncluded ? ", certificate included" : ""}. Refund within 7 days if you haven&apos;t started.</p>
      <Link href={courseHref(course.slug)} className="btn-primary mt-4 w-full !py-3 sm:w-auto sm:!px-8">Buy the course</Link>
    </div>
  ) : (
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
          Preview of a draft: only its tutors can see it. <Link href={`/academy/teach/${course.id}`} className="font-semibold underline">Back to the editor</Link>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <Link href={courseHref(course.slug)} className="font-ui text-sm font-semibold text-crimson">← {course.title}</Link>
        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            {!open ? joinBox
              : remote ? <RemoteLesson key={lesson.id} user={user} courseId={course.id} lesson={lesson} onWatched={watched} />
              : lesson.kind === "youtube" && lesson.youtubeId ? <YouTubeLesson key={lesson.id} videoId={lesson.youtubeId} onWatched={watched} />
              : <TextLesson key={lesson.id} body={lesson.body ?? ""} />}

            <p className="mt-5 font-mono text-xs uppercase tracking-eyebrow text-slate">Lesson {i + 1} of {lessons.length}{lesson.minutes ? ` · ${durationLabel(lesson.minutes)}` : ""}{!inCourse && open && !mine ? " · Free preview" : ""}</p>
            <h1 className="mt-1 font-display text-3xl leading-tight text-ink sm:text-4xl">{lesson.title}</h1>

            {open && (enrolment && inCourse ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {done
                  ? <><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 font-ui text-sm font-semibold text-emerald-800">✓ Done</span><button onClick={() => mark(false)} disabled={busy} className="text-sm text-slate underline hover:text-ink">Mark as not done</button></>
                  : <button onClick={() => mark(true)} disabled={busy} className="btn-primary !py-2.5 disabled:opacity-50">{busy ? "Saving…" : "Mark as done"}</button>}
                {(lesson.kind === "youtube" || lesson.kind === "video") && !done && <span className="text-xs text-slate">Ticked off by itself once you&apos;ve watched most of the video.</span>}
              </div>
            ) : !mine && (enrolment === null || !user || (paid && !inCourse)) ? <div className="mt-5">{joinBox}</div> : null)}
            {lesson.kind === "video" && open && <p className="mt-3 text-xs text-slate">Your @username and email drift faintly across the video, so a recording can always be traced. It plays on up to two of your devices.</p>}
            {error && <p className="mt-3 text-sm text-crimson">{error}</p>}

            <nav className="mt-8 grid grid-cols-2 gap-3 border-t border-rule pt-5">
              {prev ? <Link href={lessonHref(slug, prev.id)} className="rounded-xl border border-rule p-3 hover:border-crimson"><span className="block text-xs text-slate">← Previous</span><span className="mt-0.5 block truncate font-ui text-sm font-semibold text-ink">{prev.title}</span></Link> : <span />}
              {next ? <Link href={lessonHref(slug, next.id)} className="rounded-xl border border-rule p-3 text-right hover:border-crimson"><span className="block text-xs text-slate">Next →</span><span className="mt-0.5 block truncate font-ui text-sm font-semibold text-ink">{next.title}</span></Link>
                : <Link href={courseHref(course.slug)} className="rounded-xl border border-rule p-3 text-right hover:border-crimson"><span className="block text-xs text-slate">Finished?</span><span className="mt-0.5 block font-ui text-sm font-semibold text-ink">Back to the course</span></Link>}
            </nav>
          </div>

          <aside className="min-w-0">
            <div className="lg:sticky lg:top-24">
              {enrolment && inCourse && (
                <div className="card mb-4 p-4">
                  <div className="h-2 overflow-hidden rounded-full bg-rule"><div className="h-full rounded-full bg-crimson transition-all" style={{ width: `${p.pct}%` }} /></div>
                  <p className="mt-1.5 text-xs text-slate">{p.complete ? "Every lesson done. Well done!" : `${p.done} of ${p.total} lessons done · ${p.pct}%`}</p>
                  {p.complete && !mine && <Link href={enrolment.certificateId ? `/certificates/${enrolment.certificateId}` : `/academy/${slug}/certificate`} className="btn-primary mt-3 w-full !py-2 text-xs"><AcademyIcon className="mr-1.5 inline-block h-[1.2em] w-[1.2em] align-[-0.25em]" />{enrolment.certificateId ? "See your certificate" : "Get your certificate"}</Link>}
                </div>
              )}
              <p className="font-display text-xl text-ink">Lessons</p>
              <div className="lg:max-h-[70vh] lg:overflow-y-auto"><LessonList slug={slug} lessons={lessons} enrolment={enrolment} open={inCourse || mine} current={lesson.id} modules={course.modules} paid={paid} /></div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

// ---- lessons opened through the server: paid courses, and uploads ----
function RemoteLesson({ user, courseId, lesson, onWatched }: { user: User | null | undefined; courseId: string; lesson: Lesson; onWatched?: () => void }) {
  const [got, setGot] = useState<LessonContent | null>(null);
  const [fail, setFail] = useState<{ message: string; devices?: { id: string; label: string; lastAt: string }[]; ref?: string } | null>(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (user === undefined) return;
    let alive = true;
    setGot(null); setFail(null);
    fetchLesson(user, courseId, lesson.id, getDeviceId(), deviceLabel())
      .then((r) => { if (alive) setGot(r.lesson); })
      .catch((e) => { if (alive) setFail({ message: e.message, devices: e.code === "device_limit" ? e.devices : undefined }); });
    return () => { alive = false; };
  }, [user, courseId, lesson.id, tries]);

  if (fail) {
    return (
      <div className="card p-5">
        <p className="font-display text-xl text-ink">{fail.devices ? "Already open on two devices" : "This lesson didn't open"}</p>
        <p className="mt-1 text-sm text-slate">{fail.message}</p>
        {fail.devices && (
          <ul className="mt-3 space-y-2 text-sm">
            {fail.devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-rule px-3 py-2">
                <span>{d.label}<span className="block text-xs text-slate">Last used {new Date(d.lastAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></span>
                <button type="button" className="rounded-full border border-rule px-3 py-1 font-ui text-xs font-bold hover:border-crimson"
                  onClick={async () => {
                    const ref = await fetch(`/api/academy/purchase?courseId=${encodeURIComponent(courseId)}`, { headers: user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {} }).then((r) => r.json()).then((j) => j.purchase?.reference).catch(() => null);
                    if (!ref || !user) return;
                    const r = await fetch("/api/academy/lesson", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action: "removeDevice", courseId, reference: ref, deviceId: d.id }) });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) { setFail((f) => f && { ...f, message: j.error || "Couldn't remove it." }); return; }
                    setTries((n) => n + 1);
                  }}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        {!fail.devices && <button type="button" onClick={() => setTries((n) => n + 1)} className="btn-ghost mt-4 !py-2">Try again</button>}
      </div>
    );
  }
  if (!got) return <div className="aspect-video w-full animate-pulse rounded-2xl bg-paper" />;
  const mark = got.watermark ? [got.watermark.username, got.watermark.email].filter(Boolean).join(" · ") : "";
  if (got.kind === "video" && got.playerUrl) return <StreamLesson src={got.playerUrl} watermark={mark} onWatched={onWatched} />;
  if (got.kind === "youtube" && got.youtubeId) return <YouTubeLesson videoId={got.youtubeId} onWatched={onWatched} />;
  if (got.kind === "pdf") {
    const load = async () => {
      const r = await fetch("/api/academy/lesson", { method: "POST", headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}) }, body: JSON.stringify({ courseId, lessonId: lesson.id, deviceId: getDeviceId(), deviceLabel: deviceLabel(), bytes: true }) });
      if (!r.ok) throw new Error("Couldn't open the PDF.");
      return r.arrayBuffer();
    };
    return <PdfViewer load={load} watermark={mark || "Notes Academy"} />;
  }
  return <TextLesson body={got.body ?? ""} />;
}

// Cloudflare Stream's player (a signed, short-lived link; no download), with the viewer's @username and email drifting to a new
// spot every few seconds so it can't be cropped out. Full screen is our own button on the frame, so the watermark goes with it.
// Seconds actually played are added up from the player's timeupdate messages, as for YouTube.
function StreamLesson({ src, watermark, onWatched }: { src: string; watermark: string; onWatched?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const cb = useRef(onWatched);
  cb.current = onWatched;
  const [spot, setSpot] = useState({ x: 12, y: 18 });
  useEffect(() => {
    const t = setInterval(() => setSpot({ x: 6 + Math.random() * 52, y: 8 + Math.random() * 70 }), 4500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let watched = 0, last = -1, duration = 0, fired = false;
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = typeof e.data === "string" ? (() => { try { return JSON.parse(e.data); } catch { return null; } })() : e.data;
      const ev = d?.__privateUnstableMessageType ?? d?.event ?? d?.type;
      const v = d?.value ?? d?.data ?? {};
      if (typeof v.duration === "number") duration = v.duration;
      if ((ev === "timeupdate" || ev === "propertyChange") && typeof v.currentTime === "number") {
        const step = v.currentTime - last;
        if (last >= 0 && step > 0 && step <= 3) watched += step;
        last = v.currentTime;
        if (!fired && duration > 0 && watched >= duration * 0.9 && cb.current) { fired = true; cb.current(); }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [src]);
  return (
    <div ref={box} className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink" onContextMenu={(e) => e.preventDefault()}>
      <iframe ref={frame} src={src} title="Lesson video" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" className="absolute inset-0 h-full w-full border-0" />
      {watermark && (
        <span aria-hidden className="pointer-events-none absolute select-none whitespace-nowrap font-mono text-[11px] text-white/40 transition-all duration-[1500ms] ease-in-out sm:text-sm"
          style={{ left: `${spot.x}%`, top: `${spot.y}%`, transform: "rotate(-8deg)", textShadow: "0 1px 2px rgba(0,0,0,.35)" }}>{watermark}</span>
      )}
      <button type="button" aria-label="Full screen" onClick={() => { const el = box.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.(); }}
        className="absolute right-2 top-2 rounded-full bg-black/45 px-2.5 py-1 font-ui text-xs font-bold text-white hover:bg-black/70">⛶</button>
    </div>
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

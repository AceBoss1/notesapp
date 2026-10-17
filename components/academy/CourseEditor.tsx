"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import TopicPicker from "@/components/TopicPicker";
import { useMember } from "@/lib/member-client";
import { api } from "@/lib/moments-client";
import { uploadToR2 } from "@/lib/upload";
import {
  COURSE_SUMMARY_MAX, COURSE_TITLE_MAX, LESSON_MINUTES_MAX, LESSON_TITLE_MAX, MAX_COURSE_TOPICS, MAX_LESSONS,
  courseHref, durationLabel, plural, publishProblems, youtubeId, youtubeThumb, type Course, type Lesson, type LessonKind,
} from "@/lib/courses";

// /academy/teach/<id>: everything about one course on one page, phone first. Details (title, summary, topics, cover), the
// lessons (a YouTube link or a text lesson; edit, move, delete), then Publish / Unpublish and the preview. Every change is
// saved by the server (/api/academy/courses/<id>…), which checks it's the teacher's own course.
const input = "mt-1 w-full rounded-lg border border-rule bg-white px-3 py-2.5 text-base outline-none focus:border-crimson sm:text-sm";
const label = "font-ui text-sm font-semibold text-ink";

export default function CourseEditor({ courseId }: { courseId: string }) {
  const { user } = useMember();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [cover, setCover] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [form, setForm] = useState<{ kind: LessonKind; lesson?: Lesson } | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ course: Course; lessons: Lesson[] }>(`/api/academy/courses/${courseId}`)
      .then((r) => { setCourse(r.course); setLessons(r.lessons); setTitle(r.course.title); setSummary(r.course.summary); setTopics(r.course.topics); setCover(r.course.cover); })
      .catch((e) => setLoadError(e.message));
  }, [user, courseId]);

  const dirty = !!course && (title.trim() !== course.title || summary.trim() !== course.summary || cover !== course.cover || topics.join() !== course.topics.join());
  const missing = useMemo(() => publishProblems({ title, summary }, lessons.length), [title, summary, lessons.length]);
  const flash = (m: string) => { setNote(m); setError(""); setTimeout(() => setNote((x) => (x === m ? "" : x)), 3000); };

  async function run<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(what);
    setError("");
    try { return await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); return null; } finally { setBusy(null); }
  }
  const saveDetails = () => run("details", async () => {
    const r = await api<{ course: Course }>(`/api/academy/courses/${courseId}`, { method: "PATCH", body: { title, summary, topics, cover } });
    setCourse(r.course); setTitle(r.course.title); setSummary(r.course.summary);
    flash("Details saved.");
    return r.course;
  });
  async function publish(on: boolean) {
    if (on && dirty && !(await saveDetails())) return;
    const r = await run("publish", () => api<{ course: Course }>(`/api/academy/courses/${courseId}`, { body: { action: on ? "publish" : "unpublish" } }));
    if (r) { setCourse(r.course); flash(on ? "Published. Learners can find and enrol in it now." : "Unpublished. It's a draft again: only you can see it."); }
  }
  async function deleteCourse() {
    if (!course) return;
    const learners = course.enrolCount ? ` ${plural(course.enrolCount, "learner")} will lose their progress.` : "";
    if (!window.confirm(`Delete “${course.title}” and its ${plural(lessons.length, "lesson")}?${learners} This can't be undone.`)) return;
    const ok = await run("delete", () => api(`/api/academy/courses/${courseId}`, { method: "DELETE" }));
    if (ok) router.push("/academy/teach");
  }
  async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try { setCover(await uploadToR2(file)); } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); } finally { setUploading(false); }
  }
  async function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= lessons.length) return;
    const next = [...lessons];
    [next[i], next[j]] = [next[j], next[i]];
    const before = lessons;
    setLessons(next);
    const r = await run("move", () => api(`/api/academy/courses/${courseId}/lessons`, { method: "PUT", body: { ids: next.map((l) => l.id) } }));
    if (!r) setLessons(before);
  }
  async function remove(l: Lesson) {
    if (!window.confirm(`Delete the lesson “${l.title}”?`)) return;
    const r = await run("remove", () => api(`/api/academy/courses/${courseId}/lessons/${l.id}`, { method: "DELETE" }));
    if (r) { setLessons((x) => x.filter((y) => y.id !== l.id)); flash("Lesson deleted."); }
  }
  function saved(l: Lesson) {
    setLessons((x) => (x.some((y) => y.id === l.id) ? x.map((y) => (y.id === l.id ? l : y)) : [...x, l]));
    setForm(null);
    flash(form?.lesson ? "Lesson saved." : "Lesson added.");
  }

  if (user === null) return <Shell><p className="text-sm text-slate"><Link href={`/login?next=/academy/teach/${courseId}`} className="font-semibold text-crimson">Sign in</Link> to edit your course.</p></Shell>;
  if (loadError) return <Shell><p className="text-sm text-crimson">{loadError}</p><p className="mt-3"><Link href="/academy/teach" className="font-semibold text-crimson">← Your courses</Link></p></Shell>;
  if (!course) return <Shell><p className="text-sm text-slate">Loading the course…</p></Shell>;
  const minutes = lessons.reduce((n, l) => n + (l.minutes ?? 0), 0);
  const live = course.status === "published";

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/academy/teach" className="font-ui text-sm font-semibold text-crimson">← Your courses</Link>
        <span className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow ${live ? "bg-emerald-100 text-emerald-800" : "bg-rule text-slate"}`}>{live ? "Published" : "Draft"}</span>
      </div>
      <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{course.title || "Untitled course"}</h1>

      <ol className="mt-5 grid gap-3 rounded-2xl bg-crimson/[0.05] p-4 text-sm text-ink sm:grid-cols-3 sm:p-5">
        {[
          ["Describe it", "A clear title, a short summary of what learners will be able to do, up to 3 topics and a cover picture."],
          ["Add lessons", "Paste a link to a video on your YouTube (public or unlisted), or write a text lesson. Put them in order."],
          ["Publish", "Learners enrol free, watch here and tick lessons off. You can keep editing after publishing."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-crimson font-ui text-sm font-bold text-paper">{i + 1}</span>
            <span><span className="font-semibold">{t}.</span> <span className="text-slate">{d}</span></span>
          </li>
        ))}
      </ol>

      {(error || note) && <p role="status" className={`mt-5 rounded-lg px-4 py-3 text-sm ${error ? "bg-crimson/10 text-crimson" : "bg-emerald-50 text-emerald-800"}`}>{error || note}</p>}

      {/* 1. Details */}
      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-ink">1. Details</h2>
        <label className="mt-4 block"><span className={label}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={COURSE_TITLE_MAX} className={input} placeholder="e.g. Excel for small business owners" />
        </label>
        {!course.publishedAt && <p className="mt-1 text-xs text-slate">The course&apos;s address follows the title until you first publish: {courseHref(course.slug)}</p>}
        <label className="mt-4 block"><span className={label}>Summary</span>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={COURSE_SUMMARY_MAX} rows={4} className={input} placeholder="What will learners be able to do after this course? Who is it for?" />
          <span className="mt-1 block text-right text-xs text-slate">{summary.length.toLocaleString("en-GB")} / {COURSE_SUMMARY_MAX.toLocaleString("en-GB")}</span>
        </label>
        <div className="mt-2"><p className={label}>Topics</p><p className="mb-2 text-xs text-slate">Up to {MAX_COURSE_TOPICS}: they bring the course to learners interested in them.</p><TopicPicker value={topics} onChange={setTopics} max={MAX_COURSE_TOPICS} compact /></div>
        <div className="mt-5">
          <p className={label}>Cover picture</p>
          <p className="text-xs text-slate">Wide (16:9) works best. JPEG, PNG or WebP.</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            {cover
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cover} alt="Cover" className="aspect-video w-full rounded-lg object-cover sm:w-56" />
              : <span className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-rule text-xs text-slate sm:w-56">No cover yet</span>}
            <div className="flex flex-wrap gap-2">
              <label className="btn-ghost cursor-pointer !px-4 !py-2 text-sm">{uploading ? "Uploading…" : cover ? "Change picture" : "Upload a picture"}<input type="file" accept="image/*" onChange={uploadCover} className="sr-only" disabled={uploading} /></label>
              {cover && <button type="button" onClick={() => setCover("")} className="btn-ghost !px-4 !py-2 text-sm">Remove</button>}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={saveDetails} disabled={!dirty || busy !== null || uploading} className="btn-primary w-full !py-2.5 disabled:opacity-50 sm:w-auto">{busy === "details" ? "Saving…" : "Save details"}</button>
          {dirty && <span className="text-xs text-slate">Unsaved changes</span>}
        </div>
      </section>

      {/* 2. Lessons */}
      <section className="card mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl text-ink">2. Lessons</h2>
          <span className="text-xs text-slate">{plural(lessons.length, "lesson")}{minutes ? ` · ${durationLabel(minutes)}` : ""}</span>
        </div>
        {lessons.length === 0 && !form && <p className="mt-3 text-sm text-slate">No lessons yet. Add your first: a video from your YouTube, or a text lesson.</p>}
        {lessons.length > 0 && (
          <ol className="mt-4 divide-y divide-rule overflow-hidden rounded-xl border border-rule">
            {lessons.map((l, i) => (
              <li key={l.id} className="p-3 sm:flex sm:items-center sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-6 shrink-0 text-center font-display text-xl text-crimson-bright">{i + 1}</span>
                  {l.kind === "youtube" && l.youtubeId
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={youtubeThumb(l.youtubeId)} alt="" className="aspect-video w-20 shrink-0 rounded object-cover" />
                    : <span aria-hidden className="flex aspect-video w-20 shrink-0 items-center justify-center rounded bg-crimson/[0.07] font-mono text-[10px] uppercase tracking-eyebrow text-crimson">Text</span>}
                  <span className="min-w-0">
                    <span className="block truncate font-ui text-sm font-semibold text-ink">{l.title}</span>
                    <span className="block text-xs text-slate">{l.kind === "youtube" ? "Video" : "Text"}{l.minutes ? ` · ${durationLabel(l.minutes)}` : ""}</span>
                  </span>
                </div>
                <div className="mt-2 flex gap-1.5 pl-9 sm:mt-0 sm:pl-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0 || busy !== null} aria-label={`Move “${l.title}” up`} className="h-9 w-9 rounded-full border border-rule text-ink hover:border-crimson disabled:opacity-30">↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === lessons.length - 1 || busy !== null} aria-label={`Move “${l.title}” down`} className="h-9 w-9 rounded-full border border-rule text-ink hover:border-crimson disabled:opacity-30">↓</button>
                  <button onClick={() => setForm({ kind: l.kind, lesson: l })} disabled={busy !== null} className="h-9 rounded-full border border-rule px-3 text-sm text-ink hover:border-crimson">Edit</button>
                  <button onClick={() => remove(l)} disabled={busy !== null} className="h-9 rounded-full border border-rule px-3 text-sm text-crimson hover:border-crimson">Delete</button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {form ? (
          <LessonForm key={form.lesson?.id ?? form.kind} courseId={courseId} kind={form.kind} lesson={form.lesson} onSaved={saved} onCancel={() => setForm(null)} />
        ) : lessons.length < MAX_LESSONS ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button onClick={() => setForm({ kind: "youtube" })} className="btn-primary !py-2.5">+ Add a video lesson</button>
            <button onClick={() => setForm({ kind: "text" })} className="btn-ghost !py-2.5">+ Add a text lesson</button>
          </div>
        ) : <p className="mt-4 text-xs text-slate">A course can have up to {MAX_LESSONS} lessons.</p>}
      </section>

      {/* 3. Publish */}
      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-ink">3. Publish</h2>
        {live ? (
          <p className="mt-2 text-sm text-slate">Published{course.publishedAt ? ` on ${new Date(course.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}. {plural(course.enrolCount, "learner")} so far. Changes you save show straight away.</p>
        ) : missing.length ? (
          <p className="mt-2 text-sm text-slate">To publish, add {missing.join(", ").replace(/, ([^,]*)$/, " and $1")}.</p>
        ) : (
          <p className="mt-2 text-sm text-slate">Ready. Preview it first if you like: only you can see the draft.</p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {live
            ? <button onClick={() => publish(false)} disabled={busy !== null} className="btn-ghost !py-2.5">{busy === "publish" ? "Unpublishing…" : "Unpublish"}</button>
            : <button onClick={() => publish(true)} disabled={busy !== null || missing.length > 0} className="btn-primary !py-2.5 disabled:opacity-50">{busy === "publish" ? "Publishing…" : "Publish"}</button>}
          <Link href={courseHref(course.slug)} target="_blank" className="btn-ghost !py-2.5">{live ? "View the course page" : "Preview"}</Link>
        </div>
        <p className="mt-4 text-xs text-slate">Videos play with YouTube&apos;s privacy-enhanced player, so learners stay on #NotesApp. Keep them public or unlisted on YouTube (not private), or they won&apos;t play.</p>
        <button onClick={deleteCourse} disabled={busy !== null} className="mt-6 text-sm font-semibold text-crimson hover:underline">Delete this course</button>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">{children}</div>;
}

// Adding or editing one lesson. A video: paste the link, see its picture to confirm it's the right one. Text: the journal editor
// (Markdown, with a draft kept in this browser until it's saved).
function LessonForm({ courseId, kind, lesson, onSaved, onCancel }: { courseId: string; kind: LessonKind; lesson?: Lesson; onSaved: (l: Lesson) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [url, setUrl] = useState(lesson?.youtubeId ? `https://youtu.be/${lesson.youtubeId}` : "");
  const [minutes, setMinutes] = useState(lesson?.minutes ? String(lesson.minutes) : "");
  const [body, setBody] = useState(lesson?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const vid = kind === "youtube" ? youtubeId(url) : null;
  const draftKey = `course-${courseId}-${lesson?.id ?? "new"}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "youtube" && !vid) return setError("Paste a link to a YouTube video first.");
    setBusy(true);
    setError("");
    try {
      const payload = { kind, title, minutes: minutes.trim() || null, ...(kind === "youtube" ? { url } : { body }) };
      const r = lesson
        ? await api<{ lesson: Lesson }>(`/api/academy/courses/${courseId}/lessons/${lesson.id}`, { method: "PATCH", body: payload })
        : await api<{ lesson: Lesson }>(`/api/academy/courses/${courseId}/lessons`, { body: payload });
      if (kind === "text") try { localStorage.removeItem(`notesapp:draft:${draftKey}`); } catch {}
      onSaved(r.lesson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the lesson.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 rounded-xl border border-crimson/30 bg-paper p-4 sm:p-5">
      <p className="font-ui text-base font-bold text-ink">{lesson ? "Edit lesson" : kind === "youtube" ? "New video lesson" : "New text lesson"}</p>
      {kind === "youtube" && (
        <>
          <label className="mt-3 block"><span className={label}>YouTube link</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…" className={input} />
          </label>
          {url.trim() && !vid && <p className="mt-1 text-xs text-crimson">That doesn&apos;t look like a YouTube video link. Copy it from the Share button under the video.</p>}
          {vid && (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={youtubeThumb(vid)} alt="The video's picture" className="aspect-video w-40 rounded-lg object-cover" />
              <p className="text-xs text-slate">Is this the right video? If the picture is blank, the video may be private or removed.</p>
            </div>
          )}
        </>
      )}
      <label className="mt-3 block"><span className={label}>Lesson title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LESSON_TITLE_MAX} className={input} placeholder={kind === "youtube" ? "e.g. Formulas you'll use every day" : "e.g. Reading a balance sheet"} />
      </label>
      <label className="mt-3 block max-w-[12rem]"><span className={label}>Minutes <span className="font-normal text-slate">(optional)</span></span>
        <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" maxLength={3} placeholder={kind === "youtube" ? "e.g. 12" : "e.g. 5"} className={input} />
      </label>
      {kind === "text" && (
        <div className="mt-3">
          <p className={label}>Lesson</p>
          <div className="mt-1"><RichTextEditor value={body} onChange={setBody} draftKey={draftKey} /></div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={busy} className="btn-primary !py-2.5 disabled:opacity-50">{busy ? "Saving…" : lesson ? "Save lesson" : "Add lesson"}</button>
        <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost !py-2.5">Cancel</button>
      </div>
      <p className="mt-3 text-xs text-slate">Minutes are up to {LESSON_MINUTES_MAX}; they add up to the course&apos;s length.</p>
    </form>
  );
}

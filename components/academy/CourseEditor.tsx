"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import TopicPicker from "@/components/TopicPicker";
import { SubtopicChips, TopicSuggestions } from "@/components/NanaSuggest";
import Avatar from "@/components/Avatar";
import type { Subtopic } from "@/lib/subtopics";
import { useMember } from "@/lib/member-client";
import { api } from "@/lib/moments-client";
import { uploadToR2 } from "@/lib/upload";
import { digitalCommissionRateFor } from "@/lib/tiers";
import type { AccountTier } from "@/lib/users";
import {
  COURSE_LANGUAGES, COURSE_LEVELS, COURSE_PRICE_MIN_KOBO, COURSE_SUMMARY_MAX, COURSE_TITLE_MAX, LESSON_MINUTES_MAX, LESSON_TITLE_MAX, MAX_COURSE_TOPICS, MAX_CO_TUTORS,
  MAX_LESSONS, MAX_MODULES, MAX_OUTCOMES, MAX_REQUIREMENTS, MIN_LEAD_TUTOR_PERCENT, PDF_MAX_BYTES,
  courseHref, durationLabel, groupByModule, includesOf, isPaid, lessonKindLabel, nairaLabel, plural, publishProblems, youtubeId, youtubeThumb,
  type Course, type CourseFormat, type CourseModule, type Lesson, type LessonKind, type TutorInvite,
} from "@/lib/courses";

// /academy/teach/<id>: everything about one course on one page, phone first. Details (title, summary, topics, cover), About the
// course (level, language, format, what learners will learn, requirements, how it runs, the private class and community links),
// the price (paid courses: Pro and up), the tutors (co-tutors and their share of each sale), the curriculum (modules and lessons:
// YouTube, text, and on paid courses uploaded videos and PDFs), then Publish. Every change is saved by the server
// (/api/academy/courses/<id>…), which checks who may make it: co-tutors edit the content; the price, tutors and publishing are the lead's.
const input = "mt-1 w-full rounded-lg border border-rule bg-white px-3 py-2.5 text-base outline-none focus:border-crimson sm:text-sm";
const label = "font-ui text-sm font-semibold text-ink";
type Links = { classUrl: string; communityUrl: string };
type Plan = { tier: AccountTier; canSell: boolean; canUploadVideo: boolean; payoutsReady: boolean };
type View = { course: Course; lessons: Lesson[]; access: "lead" | "tutor"; links: Links; invites: TutorInvite[]; plan: Plan };
const lines = (a?: string[]) => (a ?? []).join("\n");

export default function CourseEditor({ courseId }: { courseId: string }) {
  const { user } = useMember();
  const router = useRouter();
  const [v, setV] = useState<View | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [cover, setCover] = useState("");
  const [about, setAbout] = useState({ level: "", language: "English", format: "self" as CourseFormat, outcomes: "", requirements: "", runsFor: "", schedule: "", classUrl: "", communityUrl: "" });
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [form, setForm] = useState<{ kind: LessonKind; lesson?: Lesson } | null>(null);

  const course = v?.course ?? null;
  function take(r: View) {
    setV(r); setLessons(r.lessons);
    const c = r.course;
    setTitle(c.title); setSummary(c.summary); setTopics(c.topics); setSubtopics(c.subtopics ?? []); setCover(c.cover);
    setAbout({ level: c.level ?? "", language: c.language || "English", format: c.format ?? "self", outcomes: lines(c.outcomes), requirements: lines(c.requirements), runsFor: c.runsFor ?? "", schedule: c.schedule ?? "", classUrl: r.links.classUrl, communityUrl: r.links.communityUrl });
  }
  const load = () => api<View>(`/api/academy/courses/${courseId}`).then(take).catch((e) => setLoadError(e.message));
  useEffect(() => { if (user) void load(); }, [user, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const aboutSaved = course && v ? { level: course.level ?? "", language: course.language || "English", format: course.format ?? "self", outcomes: lines(course.outcomes), requirements: lines(course.requirements), runsFor: course.runsFor ?? "", schedule: course.schedule ?? "", classUrl: v.links.classUrl, communityUrl: v.links.communityUrl } : null;
  const aboutDirty = !!aboutSaved && JSON.stringify(aboutSaved) !== JSON.stringify({ ...about, outcomes: about.outcomes.split("\n").map((x) => x.trim()).filter(Boolean).join("\n"), requirements: about.requirements.split("\n").map((x) => x.trim()).filter(Boolean).join("\n") });
  const dirty = !!course && (title.trim() !== course.title || summary.trim() !== course.summary || cover !== course.cover || topics.join() !== course.topics.join() || subtopics.map((x) => x.slug).join() !== (course.subtopics ?? []).map((x) => x.slug).join());
  const missing = useMemo(() => publishProblems({ title, summary }, lessons.length), [title, summary, lessons.length]);
  const flash = (m: string) => { setNote(m); setError(""); setTimeout(() => setNote((x) => (x === m ? "" : x)), 3000); };

  async function run<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(what);
    setError("");
    try { return await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); return null; } finally { setBusy(null); }
  }
  const patch = async (body: Record<string, unknown>) => {
    const r = await api<{ course: Course }>(`/api/academy/courses/${courseId}`, { method: "PATCH", body });
    setV((o) => (o ? { ...o, course: r.course, links: body.classUrl !== undefined ? { classUrl: String(body.classUrl), communityUrl: String(body.communityUrl) } : o.links } : o));
    return r.course;
  };
  const saveDetails = () => run("details", async () => {
    const c = await patch({ title, summary, topics, subtopics, cover });
    setTitle(c.title); setSummary(c.summary); setSubtopics(c.subtopics ?? []);
    flash("Details saved.");
    return c;
  });
  const saveAbout = () => run("about", async () => {
    const c = await patch({ ...about });
    setAbout((a) => ({ ...a, outcomes: lines(c.outcomes), requirements: lines(c.requirements), language: c.language || "English" }));
    flash("Saved.");
    return c;
  });
  async function publish(on: boolean) {
    if (on && dirty && !(await saveDetails())) return;
    if (on && aboutDirty && !(await saveAbout())) return;
    const r = await run("publish", () => api<{ course: Course }>(`/api/academy/courses/${courseId}`, { body: { action: on ? "publish" : "unpublish" } }));
    if (r) { setV((o) => (o ? { ...o, course: r.course } : o)); flash(on ? `Published. Learners can find and ${isPaid(r.course) ? "buy" : "enrol in"} it now.` : "Unpublished. It's a draft again: only its tutors can see it."); }
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
  // Up and down within a lesson's module; the server keeps the course order in step.
  async function move(l: Lesson, by: -1 | 1) {
    const group = lessons.filter((x) => (x.moduleId ?? "") === (l.moduleId ?? ""));
    const gi = group.findIndex((x) => x.id === l.id), other = group[gi + by];
    if (!other) return;
    const i = lessons.findIndex((x) => x.id === l.id), j = lessons.findIndex((x) => x.id === other.id);
    const next = [...lessons];
    [next[i], next[j]] = [next[j], next[i]];
    const before = lessons;
    setLessons(next);
    const r = await run("move", () => api<{ ids: string[] }>(`/api/academy/courses/${courseId}/lessons`, { method: "PUT", body: { ids: next.map((x) => x.id) } }));
    if (!r) setLessons(before); else setLessons((ls) => r.ids.map((id) => ls.find((x) => x.id === id)!).filter(Boolean));
  }
  async function remove(l: Lesson) {
    if (!window.confirm(`Delete the lesson “${l.title}”?`)) return;
    const r = await run("remove", () => api(`/api/academy/courses/${courseId}/lessons/${l.id}`, { method: "DELETE" }));
    if (r) { setLessons((x) => x.filter((y) => y.id !== l.id)); flash("Lesson deleted."); }
  }
  function saved(l: Lesson) {
    setForm(null);
    flash(form?.lesson ? "Lesson saved." : "Lesson added.");
    void load(); // the order (by module) and the outline come back from the server
    setLessons((x) => (x.some((y) => y.id === l.id) ? x.map((y) => (y.id === l.id ? l : y)) : [...x, l]));
  }

  if (user === null) return <Shell><p className="text-sm text-slate"><Link href={`/login?next=/academy/teach/${courseId}`} className="font-semibold text-crimson">Sign in</Link> to edit your course.</p></Shell>;
  if (loadError) return <Shell><p className="text-sm text-crimson">{loadError}</p><p className="mt-3"><Link href="/academy/teach" className="font-semibold text-crimson">← Your courses</Link></p></Shell>;
  if (!course || !v) return <Shell><p className="text-sm text-slate">Loading the course…</p></Shell>;
  const minutes = lessons.reduce((n, l) => n + (l.minutes ?? 0), 0);
  const live = course.status === "published";
  const lead = v.access === "lead";
  const paid = isPaid(course);
  const modules = course.modules ?? [];

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/academy/teach" className="font-ui text-sm font-semibold text-crimson">← Your courses</Link>
        <span className="flex items-center gap-2">
          {course.isOrg && <span className="rounded-full bg-paper px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-slate ring-1 ring-rule">{course.ownerName}</span>}
          {!lead && <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-amber-900">Co-tutor</span>}
          <span className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow ${live ? "bg-emerald-100 text-emerald-800" : "bg-rule text-slate"}`}>{live ? "Published" : "Draft"}</span>
        </span>
      </div>
      <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{course.title || "Untitled course"}</h1>

      <ol className="mt-5 grid gap-3 rounded-2xl bg-crimson/[0.05] p-4 text-sm text-ink sm:grid-cols-3 sm:p-5">
        {[
          ["Describe it", "A clear title, what learners will be able to do, up to 3 topics, a cover, and how the course runs."],
          ["Add lessons", "YouTube links (public or unlisted) and text lessons; on paid courses, upload videos and PDFs too. Group them in modules."],
          ["Publish", paid ? "Learners buy it with a card, a bank transfer or their wallet. You keep editing after publishing." : "Learners enrol free, watch here and tick lessons off. You keep editing after publishing."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-crimson font-ui text-sm font-bold text-paper">{i + 1}</span>
            <span><span className="font-semibold">{t}.</span> <span className="text-slate">{d}</span></span>
          </li>
        ))}
      </ol>

      {(error || note) && <p role="status" className={`sticky top-16 z-20 mt-5 rounded-lg px-4 py-3 text-sm shadow-sm ${error ? "bg-[#fbe9ee] text-crimson" : "bg-emerald-50 text-emerald-800"}`}>{error || note}</p>}

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
        <div className="mt-2"><TopicSuggestions kind="course" title={title} summary={summary} topics={topics} subtopics={subtopics} maxTopics={MAX_COURSE_TOPICS} onChange={(n) => { setTopics(n.topics); setSubtopics(n.subtopics); }} /></div>
        <div className="mt-2"><p className={label}>Topics</p><p className="mb-2 text-xs text-slate">Up to {MAX_COURSE_TOPICS}: they bring the course to learners interested in them.</p><TopicPicker value={topics} onChange={(t) => { setTopics(t); setSubtopics((s) => s.filter((x) => t.includes(x.parent))); }} max={MAX_COURSE_TOPICS} compact /><SubtopicChips subtopics={subtopics} onRemove={(x) => setSubtopics((s) => s.filter((y) => y !== x))} /></div>
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
        <SaveRow onSave={saveDetails} dirty={dirty} busy={busy === "details"} disabled={busy !== null || uploading} />
      </section>

      {/* 2. About the course */}
      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-ink">2. About the course</h2>
        <p className="mt-1 text-sm text-slate">What the course page tells learners before they start.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block"><span className={label}>Level</span>
            <select value={about.level} onChange={(e) => setAbout({ ...about, level: e.target.value })} className={input}><option value="">Any level</option>{COURSE_LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          </label>
          <label className="block"><span className={label}>Language</span>
            <select value={about.language} onChange={(e) => setAbout({ ...about, language: e.target.value })} className={input}>{Array.from(new Set([...COURSE_LANGUAGES, about.language])).map((l) => <option key={l}>{l}</option>)}</select>
          </label>
          <label className="block"><span className={label}>Format</span>
            <select value={about.format} onChange={(e) => setAbout({ ...about, format: e.target.value as CourseFormat })} className={input}><option value="self">Self-paced</option><option value="live">Live classes + recordings</option></select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={label}>What learners will learn</span> <span className="text-xs text-slate">one per line, up to {MAX_OUTCOMES}</span>
            <textarea value={about.outcomes} onChange={(e) => setAbout({ ...about, outcomes: e.target.value })} rows={6} className={input} placeholder={"Set up a help desk\nHandle angry customers calmly\nWrite proposals that win clients"} />
          </label>
          <label className="block"><span className={label}>Requirements</span> <span className="text-xs text-slate">one per line, up to {MAX_REQUIREMENTS}</span>
            <textarea value={about.requirements} onChange={(e) => setAbout({ ...about, requirements: e.target.value })} rows={6} className={input} placeholder={"A phone or laptop\nNo experience needed"} />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr]">
          <label className="block"><span className={label}>Runs for <span className="font-normal text-slate">(optional)</span></span>
            <input value={about.runsFor} onChange={(e) => setAbout({ ...about, runsFor: e.target.value })} maxLength={40} className={input} placeholder="e.g. 6 weeks" />
          </label>
          <label className="block"><span className={label}>{about.format === "live" ? "Live class times" : "Schedule"} <span className="font-normal text-slate">(optional)</span></span>
            <input value={about.schedule} onChange={(e) => setAbout({ ...about, schedule: e.target.value })} maxLength={90} className={input} placeholder="e.g. Tue, Thu, Sat · 9 am – 12 pm (Lagos)" />
          </label>
        </div>
        {about.format === "live" && (
          <label className="mt-4 block"><span className={label}>Class link</span> <span className="text-xs text-slate">Zoom, Google Meet or Teams; only learners who {paid ? "bought" : "enrolled"} see it</span>
            <input value={about.classUrl} onChange={(e) => setAbout({ ...about, classUrl: e.target.value })} inputMode="url" className={input} placeholder="https://zoom.us/j/…" />
          </label>
        )}
        <label className="mt-4 block"><span className={label}>Community link</span> <span className="text-xs text-slate">a WhatsApp or Telegram group; only learners who {paid ? "bought" : "enrolled"} see it</span>
          <input value={about.communityUrl} onChange={(e) => setAbout({ ...about, communityUrl: e.target.value })} inputMode="url" className={input} placeholder="https://chat.whatsapp.com/…" />
        </label>
        <SaveRow onSave={saveAbout} dirty={aboutDirty} busy={busy === "about"} disabled={busy !== null} />
      </section>

      {/* 3. Price */}
      <PriceSection course={course} plan={v.plan} lead={lead} busy={busy} onSave={(b) => run("price", async () => { const c = await patch(b); flash(isPaid(c) ? "Price saved." : "It's a free course now."); return c; })} />

      {/* 4. Tutors */}
      <TutorsSection course={course} invites={v.invites} lead={lead} me={user?.uid ?? ""} busy={busy} run={run} onChanged={() => void load()} onLeft={() => router.push("/academy/teach")} flash={flash} />

      {/* 5. Curriculum */}
      <section className="card mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl text-ink">5. Curriculum</h2>
          <span className="text-xs text-slate">{modules.length ? `${plural(modules.length, "module")} · ` : ""}{plural(lessons.length, "lesson")}{minutes ? ` · ${durationLabel(minutes)}` : ""}</span>
        </div>
        <Modules modules={modules} busy={busy} onSave={(m) => run("modules", async () => { const c = await patch({ modules: m }); flash("Modules saved."); void load(); return c; })} />
        {lessons.length === 0 && !form && <p className="mt-3 text-sm text-slate">No lessons yet. Add your first: a video from your YouTube, or a text lesson{paid ? ", or upload a video or PDF" : ""}.</p>}
        {groupByModule(lessons, modules).map((g) => (
          <div key={g.module?.id ?? "loose"} className="mt-4">
            {g.module && <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-slate">Module {modules.findIndex((m) => m.id === g.module!.id) + 1} · {g.module.title}</p>}
            <ol className="divide-y divide-rule overflow-hidden rounded-xl border border-rule">
              {g.items.map((l, gi) => (
                <li key={l.id} className="p-3 sm:flex sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="w-6 shrink-0 text-center font-display text-xl text-crimson-bright">{lessons.findIndex((x) => x.id === l.id) + 1}</span>
                    {l.kind === "youtube" && l.youtubeId
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={youtubeThumb(l.youtubeId)} alt="" className="aspect-video w-20 shrink-0 rounded object-cover" />
                      : <span aria-hidden className={`flex aspect-video w-20 shrink-0 items-center justify-center rounded font-mono text-[10px] uppercase tracking-eyebrow ${l.kind === "video" ? "bg-ink/90 text-white" : l.kind === "pdf" ? "bg-amber-50 text-amber-800" : "bg-crimson/[0.07] text-crimson"}`}>{l.kind === "video" ? "▶ Video" : l.kind === "pdf" ? "PDF" : "Text"}</span>}
                    <span className="min-w-0">
                      <span className="block truncate font-ui text-sm font-semibold text-ink">{l.title}</span>
                      <span className="block text-xs text-slate">{lessonKindLabel(l.kind)}{l.kind === "video" ? " · uploaded" : ""}{l.minutes ? ` · ${durationLabel(l.minutes)}` : ""}{paid && l.preview ? " · " : ""}{paid && l.preview && <b className="text-emerald-700">Free preview</b>}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1.5 pl-9 sm:mt-0 sm:pl-0">
                    <button onClick={() => move(l, -1)} disabled={gi === 0 || busy !== null} aria-label={`Move “${l.title}” up`} className="h-9 w-9 rounded-full border border-rule text-ink hover:border-crimson disabled:opacity-30">↑</button>
                    <button onClick={() => move(l, 1)} disabled={gi === g.items.length - 1 || busy !== null} aria-label={`Move “${l.title}” down`} className="h-9 w-9 rounded-full border border-rule text-ink hover:border-crimson disabled:opacity-30">↓</button>
                    <button onClick={() => setForm({ kind: l.kind, lesson: l })} disabled={busy !== null} className="h-9 rounded-full border border-rule px-3 text-sm text-ink hover:border-crimson">Edit</button>
                    <button onClick={() => remove(l)} disabled={busy !== null} className="h-9 rounded-full border border-rule px-3 text-sm text-crimson hover:border-crimson">Delete</button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {form ? (
          <LessonForm key={form.lesson?.id ?? form.kind} courseId={courseId} kind={form.kind} lesson={form.lesson} modules={modules} paid={paid} onSaved={saved} onCancel={() => setForm(null)} />
        ) : lessons.length < MAX_LESSONS ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button onClick={() => setForm({ kind: "youtube" })} className="btn-primary !py-2.5">+ Add a YouTube video</button>
            <button onClick={() => setForm({ kind: "text" })} className="btn-ghost !py-2.5">+ Add a text lesson</button>
            {paid && v.plan.canUploadVideo && <button onClick={() => setForm({ kind: "video" })} className="btn-ghost !py-2.5">+ Upload a video</button>}
            {paid && v.plan.canSell && <button onClick={() => setForm({ kind: "pdf" })} className="btn-ghost !py-2.5">+ Upload a PDF</button>}
          </div>
        ) : <p className="mt-4 text-xs text-slate">A course can have up to {MAX_LESSONS} lessons.</p>}
        {paid && !v.plan.canUploadVideo && <p className="mt-3 text-xs text-slate">Uploading videos is on Business and Enterprise plans. On {v.plan.tier === "pro" ? "Pro" : "your plan"}, add YouTube links, text lessons and PDFs.</p>}
        {lessons.length > 0 && (
          <div className="mt-5 rounded-xl bg-paper p-4 text-sm">
            <p className="font-ui font-bold text-ink">This course includes <span className="font-normal text-slate">(worked out for you)</span></p>
            <ul className="mt-1.5 grid gap-1 text-slate sm:grid-cols-2">{includesOf(course, lessons).map((x) => <li key={x}>✓ {x}</li>)}</ul>
          </div>
        )}
      </section>

      {/* 6. Publish */}
      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-ink">6. Publish</h2>
        {!lead ? (
          <p className="mt-2 text-sm text-slate">The lead tutor publishes and unpublishes the course. {live ? "It's published: changes you save show straight away." : "It's a draft for now."}</p>
        ) : live ? (
          <p className="mt-2 text-sm text-slate">Published{course.publishedAt ? ` on ${new Date(course.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}. {plural(course.enrolCount, "learner")} so far. Changes you save show straight away.</p>
        ) : missing.length ? (
          <p className="mt-2 text-sm text-slate">To publish, add {missing.join(", ").replace(/, ([^,]*)$/, " and $1")}.</p>
        ) : paid && !v.plan.payoutsReady ? (
          <p className="mt-2 text-sm text-slate">Add the bank account your earnings go to first, in <Link href="/profile/publishing" className="font-semibold text-crimson">Rates &amp; payouts</Link>, then publish.</p>
        ) : (
          <p className="mt-2 text-sm text-slate">Ready. Preview it first if you like: only the tutors can see the draft.</p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {lead && (live
            ? <button onClick={() => publish(false)} disabled={busy !== null} className="btn-ghost !py-2.5">{busy === "publish" ? "Unpublishing…" : "Unpublish"}</button>
            : <button onClick={() => publish(true)} disabled={busy !== null || missing.length > 0} className="btn-primary !py-2.5 disabled:opacity-50">{busy === "publish" ? "Publishing…" : "Publish"}</button>)}
          <Link href={courseHref(course.slug)} target="_blank" className="btn-ghost !py-2.5">{live ? "View the course page" : "Preview"}</Link>
        </div>
        <p className="mt-4 text-xs text-slate">YouTube videos play with YouTube&apos;s privacy-enhanced player, so learners stay on #NotesApp; keep them public or unlisted (not private). Uploaded videos play only to learners who bought the course, with no download button, on up to two devices, with each viewer&apos;s @username and email drifting faintly across the picture.</p>
        {lead && <button onClick={deleteCourse} disabled={busy !== null} className="mt-6 text-sm font-semibold text-crimson hover:underline">Delete this course</button>}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">{children}</div>;
}
function SaveRow({ onSave, dirty, busy, disabled }: { onSave: () => void; dirty: boolean; busy: boolean; disabled: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button onClick={onSave} disabled={!dirty || disabled} className="btn-primary w-full !py-2.5 disabled:opacity-50 sm:w-auto">{busy ? "Saving…" : "Save"}</button>
      {dirty && <span className="text-xs text-slate">Unsaved changes</span>}
    </div>
  );
}

// Free or paid, the price, and whether the certificate is included. Paid courses are for Pro and up (the owner's plan: the member's
// own, or the organisation's); the commission is the plan's digital-sales rate.
function PriceSection({ course, plan, lead, busy, onSave }: { course: Course; plan: Plan; lead: boolean; busy: string | null; onSave: (b: Record<string, unknown>) => void }) {
  const [paid, setPaid] = useState(isPaid(course));
  const [naira, setNaira] = useState(isPaid(course) ? String(Math.round(course.priceKobo! / 100)) : "");
  const [incl, setIncl] = useState(course.certificateIncluded !== false);
  useEffect(() => { setPaid(isPaid(course)); setNaira(isPaid(course) ? String(Math.round(course.priceKobo! / 100)) : ""); setIncl(isPaid(course) ? !!course.certificateIncluded : true); }, [course]);
  const kobo = Math.round(Number(naira.replace(/[^\d]/g, "")) * 100) || 0;
  const rate = digitalCommissionRateFor(plan.tier);
  const changed = paid !== isPaid(course) || (paid && (kobo !== course.priceKobo || incl !== !!course.certificateIncluded));
  const radio = (on: boolean) => `flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left ${on ? "border-2 border-crimson" : "border border-rule"}`;
  return (
    <section className="card mt-6 p-5 sm:p-6">
      <h2 className="font-display text-2xl text-ink">3. Price</h2>
      {!lead ? <p className="mt-2 text-sm text-slate">{isPaid(course) ? `${nairaLabel(course.priceKobo!)}${course.certificateIncluded ? ", certificate included" : ""}.` : "Free."} The lead tutor sets the price.</p> : (
        <>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => setPaid(false)} className={radio(!paid)}><span className={`h-4 w-4 shrink-0 rounded-full ${!paid ? "border-[5px] border-crimson" : "border border-slate"}`} /><span><b className="font-ui">Free</b><span className="block text-xs text-slate">Lessons from your YouTube; learners pay only for a certificate</span></span></button>
            <button type="button" onClick={() => plan.canSell && setPaid(true)} disabled={!plan.canSell} className={`${radio(paid)} disabled:opacity-60`}><span className={`h-4 w-4 shrink-0 rounded-full ${paid ? "border-[5px] border-crimson" : "border border-slate"}`} /><span><b className="font-ui">Paid</b><span className="block text-xs text-slate">{plan.canSell ? plan.canUploadVideo ? "Upload your videos and PDFs to #NotesApp" : "Text lessons, PDFs and YouTube (uploaded video: Business)" : "Pro, Business and Enterprise plans"}</span></span></button>
          </div>
          {!plan.canSell && <p className="mt-2 text-xs text-slate">Paid courses are on Pro (text, PDFs, YouTube) and Business or Enterprise (uploaded video too). <Link href="/pricing" className="font-semibold text-crimson">See the plans</Link></p>}
          {paid && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end">
              <label className="block"><span className={label}>Course price (₦)</span>
                <input value={naira} onChange={(e) => setNaira(e.target.value.replace(/[^\d,]/g, ""))} inputMode="numeric" className={`${input} !text-lg font-bold`} placeholder="e.g. 40,000" />
              </label>
              <p className="rounded-xl bg-paper p-3 text-xs text-slate">{kobo >= COURSE_PRICE_MIN_KOBO ? <>You get <b className="text-ink">{nairaLabel(kobo - Math.round(kobo * rate))}</b> per sale after our {Math.round(rate * 1000) / 10}% commission{course.tutors?.length ? " (shared with your co-tutors as agreed)" : ""}. Paid to your bank 7 days after each sale.</> : `At least ${nairaLabel(COURSE_PRICE_MIN_KOBO)}.`}</p>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={incl} onChange={(e) => setIncl(e.target.checked)} className="h-4 w-4 accent-crimson" /> Certificate included in the price</label>
              <p className="text-xs text-slate sm:col-span-2">Learners can get a refund within 7 days of buying, only if they haven&apos;t started the course.</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={() => onSave(paid ? { priceNaira: naira.replace(/[^\d]/g, ""), certificateIncluded: incl } : { priceKobo: 0 })} disabled={!changed || busy !== null} className="btn-primary w-full !py-2.5 disabled:opacity-50 sm:w-auto">{busy === "price" ? "Saving…" : "Save price"}</button>
            {changed && <span className="text-xs text-slate">Unsaved changes</span>}
          </div>
        </>
      )}
    </section>
  );
}

// The lead tutor (the course's owner) invites co-tutors with their share of each sale; each accepts first. A co-tutor sees who
// teaches it and can leave.
function TutorsSection({ course, invites, lead, me, busy, run, onChanged, onLeft, flash }: {
  course: Course; invites: TutorInvite[]; lead: boolean; me: string; busy: string | null;
  run: <T>(what: string, fn: () => Promise<T>) => Promise<T | null>; onChanged: () => void; onLeft: () => void; flash: (m: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [percent, setPercent] = useState("0");
  const share = 100 - invites.reduce((n, i) => n + i.percent, 0);
  const call = (body: Record<string, unknown>) => api(`/api/academy/courses/${course.id}/tutors`, { body });
  return (
    <section className="card mt-6 p-5 sm:p-6">
      <h2 className="font-display text-2xl text-ink">4. Tutors</h2>
      <p className="mt-1 text-sm text-slate">A single tutor, or up to {MAX_CO_TUTORS} co-tutors. Each co-tutor accepts first; their share of each sale is paid to them at their own plan&apos;s commission.</p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex items-center gap-3"><Avatar src={course.ownerAvatar} alt={course.ownerName} size={36} /><span className="min-w-0 flex-1"><b>{course.ownerName}</b> <span className="text-slate">@{course.ownerUsername} · {course.isOrg ? "publisher" : "lead tutor"}</span></span><span className="text-xs text-slate">{isPaid(course) ? `${share}%` : ""}</span></li>
        {invites.map((i) => (
          <li key={i.uid} className="flex items-center gap-3">
            <Avatar src={i.avatar} alt={i.name} size={36} />
            <span className="min-w-0 flex-1"><b>{i.name}</b> <span className="text-slate">@{i.username} · {i.status === "pending" ? "invited" : "co-tutor"}</span></span>
            <span className="text-xs text-slate">{isPaid(course) ? `${i.percent}%` : ""}</span>
            {(lead || i.uid === me) && (
              <button type="button" disabled={busy !== null} onClick={() => run("tutor", async () => {
                if (i.uid === me && !window.confirm("Leave this course? You won't be able to edit it any more.")) return null;
                await call({ action: "remove", uid: i.uid });
                if (i.uid === me) onLeft(); else { flash(i.status === "pending" ? "Invitation withdrawn." : "Co-tutor removed."); onChanged(); }
                return true;
              })} className="rounded-full border border-rule px-3 py-1 text-xs text-crimson hover:border-crimson">{i.uid === me ? "Leave" : i.status === "pending" ? "Withdraw" : "Remove"}</button>
            )}
          </li>
        ))}
      </ul>
      {lead && invites.length < MAX_CO_TUTORS && (
        <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); void run("tutor", async () => { await call({ action: "invite", username, percent: Number(percent) || 0 }); setUsername(""); setPercent("0"); flash("Invitation sent."); onChanged(); return true; }); }}>
          <label className="block"><span className={label}>Invite a co-tutor</span><input value={username} onChange={(e) => setUsername(e.target.value)} className={input} placeholder="@username" autoComplete="off" /></label>
          <label className="block"><span className={label}>Their share</span><span className="relative block"><input value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} inputMode="numeric" className={`${input} pr-7`} /><span className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-slate">%</span></span></label>
          <button disabled={busy !== null || username.trim().length < 2} className="btn-ghost !py-2.5 disabled:opacity-50">{busy === "tutor" ? "Sending…" : "Invite"}</button>
          <p className="text-xs text-slate sm:col-span-3">The lead keeps at least {MIN_LEAD_TUTOR_PERCENT}%. A share of 0% credits them as a tutor without a part of the sales.</p>
        </form>
      )}
    </section>
  );
}

// Modules group lessons on the Curriculum tab. Added, renamed, moved and removed here, saved together.
function Modules({ modules, busy, onSave }: { modules: CourseModule[]; busy: string | null; onSave: (m: CourseModule[]) => void }) {
  const [list, setList] = useState(modules);
  const [adding, setAdding] = useState("");
  useEffect(() => setList(modules), [modules]);
  const changed = JSON.stringify(list) !== JSON.stringify(modules);
  return (
    <details className="mt-4 rounded-xl border border-rule bg-paper p-3" open={modules.length > 0}>
      <summary className="cursor-pointer font-ui text-sm font-semibold text-ink">Modules {modules.length ? `· ${modules.length}` : <span className="font-normal text-slate">(optional: group lessons, e.g. “1 · Getting started”)</span>}</summary>
      <ol className="mt-3 space-y-2">
        {list.map((m, i) => (
          <li key={m.id} className="flex items-center gap-2">
            <span className="w-5 text-center font-ui text-sm font-bold text-crimson">{i + 1}</span>
            <input value={m.title} onChange={(e) => setList(list.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} className={`${input} !mt-0`} maxLength={80} />
            <button type="button" onClick={() => { const n = [...list]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setList(n); }} disabled={i === 0} className="h-9 w-9 shrink-0 rounded-full border border-rule disabled:opacity-30" aria-label="Move up">↑</button>
            <button type="button" onClick={() => setList(list.filter((x) => x.id !== m.id))} className="h-9 shrink-0 rounded-full border border-rule px-3 text-xs text-crimson" aria-label={`Remove ${m.title}`}>Remove</button>
          </li>
        ))}
      </ol>
      {list.length < MAX_MODULES && (
        <div className="mt-2 flex gap-2">
          <input value={adding} onChange={(e) => setAdding(e.target.value)} className={`${input} !mt-0`} placeholder="New module, e.g. Getting started" maxLength={80}
            onKeyDown={(e) => { if (e.key === "Enter" && adding.trim()) { e.preventDefault(); setList([...list, { id: "", title: adding.trim() }]); setAdding(""); } }} />
          <button type="button" onClick={() => { if (adding.trim()) { setList([...list, { id: "", title: adding.trim() }]); setAdding(""); } }} className="btn-ghost shrink-0 !px-4 !py-2 text-sm">+ Module</button>
        </div>
      )}
      {changed && <button type="button" onClick={() => onSave(list)} disabled={busy !== null} className="btn-primary mt-3 !py-2 text-sm">{busy === "modules" ? "Saving…" : "Save modules"}</button>}
      <p className="mt-2 text-xs text-slate">Removing a module keeps its lessons; they move to the top. Choose each lesson&apos;s module when you edit it.</p>
    </details>
  );
}

// Adding or editing one lesson. YouTube: paste the link and see its picture. Text: the journal editor (Markdown, with a draft kept in
// this browser until it's saved). Upload (paid courses): a video goes straight to Cloudflare Stream, a PDF to the private bucket, with
// progress; the lesson is saved once it has arrived.
function LessonForm({ courseId, kind, lesson, modules, paid, onSaved, onCancel }: {
  courseId: string; kind: LessonKind; lesson?: Lesson; modules: CourseModule[]; paid: boolean; onSaved: (l: Lesson) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [url, setUrl] = useState(lesson?.youtubeId ? `https://youtu.be/${lesson.youtubeId}` : "");
  const [minutes, setMinutes] = useState(lesson?.minutes ? String(lesson.minutes) : "");
  const [body, setBody] = useState(lesson?.body ?? "");
  const [moduleId, setModuleId] = useState(lesson?.moduleId ?? "");
  const [preview, setPreview] = useState(!!lesson?.preview);
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const vid = kind === "youtube" ? youtubeId(url) : null;
  const upload = kind === "video" || kind === "pdf";
  const draftKey = `course-${courseId}-${lesson?.id ?? "new"}`;

  // POST (video, to Stream's one-time URL) or PUT (PDF, to a signed bucket URL), with progress.
  function send(to: string, f: File, method: "POST" | "PUT"): Promise<void> {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open(method, to);
      x.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100)); };
      x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error("The upload didn't finish. Try again.")));
      x.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
      if (method === "PUT") { x.setRequestHeader("Content-Type", "application/pdf"); x.send(f); }
      else { const fd = new FormData(); fd.append("file", f); x.send(fd); }
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "youtube" && !vid) return setError("Paste a link to a YouTube video first.");
    if (upload && !file && !lesson) return setError(kind === "video" ? "Choose the video to upload." : "Choose the PDF to upload.");
    if (kind === "pdf" && file && file.size > PDF_MAX_BYTES) return setError(`A PDF can be up to ${PDF_MAX_BYTES / 1024 / 1024} MB.`);
    setBusy(true);
    setError("");
    try {
      let up: Record<string, unknown> = {};
      if (upload && file) {
        const s = await api<{ uploadUrl: string; streamUid?: string; fileKey?: string }>(`/api/academy/courses/${courseId}/upload`, { body: { kind, name: file.name, size: file.size } });
        setPct(0);
        await send(s.uploadUrl, file, kind === "video" ? "POST" : "PUT");
        up = kind === "video" ? { streamUid: s.streamUid } : { fileKey: s.fileKey, fileName: file.name };
      } else if (upload && lesson) up = kind === "video" ? { streamUid: lesson.streamUid } : { fileKey: lesson.fileKey, fileName: lesson.fileName };
      const payload = { kind, title, minutes: minutes.trim() || null, preview, moduleId: moduleId || undefined, ...(kind === "youtube" ? { url } : kind === "text" ? { body } : up) };
      const r = lesson
        ? await api<{ lesson: Lesson }>(`/api/academy/courses/${courseId}/lessons/${lesson.id}`, { method: "PATCH", body: payload })
        : await api<{ lesson: Lesson }>(`/api/academy/courses/${courseId}/lessons`, { body: payload });
      if (kind === "text") try { localStorage.removeItem(`notesapp:draft:${draftKey}`); } catch {}
      onSaved(r.lesson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the lesson.");
      setBusy(false);
      setPct(null);
    }
  }

  const heading = lesson ? "Edit lesson" : kind === "youtube" ? "New YouTube video lesson" : kind === "video" ? "Upload a video" : kind === "pdf" ? "Upload a PDF" : "New text lesson";
  return (
    <form onSubmit={save} className="mt-4 rounded-xl border border-crimson/30 bg-paper p-4 sm:p-5">
      <p className="font-ui text-base font-bold text-ink">{heading}</p>
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
      {upload && (
        <label className="mt-3 block"><span className={label}>{kind === "video" ? "Video file" : "PDF file"}</span>
          <input type="file" accept={kind === "video" ? "video/*" : "application/pdf,.pdf"} onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")); }} className="mt-1 block w-full text-sm" />
          <span className="mt-1 block text-xs text-slate">{lesson && !file ? `Keeping the current ${kind === "video" ? "video" : `file${lesson.fileName ? ` (${lesson.fileName})` : ""}`}. Choose a new one to replace it.` : kind === "video" ? "Up to 200 MB. It plays only to buyers, never downloads, with each viewer's details drifting across it." : `Up to ${PDF_MAX_BYTES / 1024 / 1024} MB. It opens in our viewer, never as a download.`}</span>
          {pct !== null && <span className="mt-2 block"><span className="block h-1.5 overflow-hidden rounded-full bg-rule"><span className="block h-full rounded-full bg-crimson transition-all" style={{ width: `${pct}%` }} /></span><span className="mt-1 block text-xs text-slate">Uploading · {pct}%{file ? ` of ${Math.round(file.size / 1024 / 1024)} MB` : ""} · keep this page open</span></span>}
        </label>
      )}
      <label className="mt-3 block"><span className={label}>Lesson title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LESSON_TITLE_MAX} className={input} placeholder={kind === "text" ? "e.g. Reading a balance sheet" : "e.g. Formulas you'll use every day"} />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={label}>Minutes <span className="font-normal text-slate">(optional{kind === "video" ? ": we read it from the video" : ""})</span></span>
          <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" maxLength={3} placeholder={kind === "text" ? "e.g. 5" : "e.g. 12"} className={input} />
        </label>
        {modules.length > 0 && (
          <label className="block"><span className={label}>Module</span>
            <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={input}><option value="">No module (at the top)</option>{modules.map((m, i) => <option key={m.id} value={m.id}>{i + 1} · {m.title}</option>)}</select>
          </label>
        )}
      </div>
      {paid && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} className="h-4 w-4 accent-crimson" /> Free preview: anyone can open this lesson before buying</label>}
      {kind === "text" && (
        <div className="mt-3">
          <p className={label}>Lesson</p>
          <div className="mt-1"><RichTextEditor value={body} onChange={setBody} draftKey={draftKey} /></div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={busy} className="btn-primary !py-2.5 disabled:opacity-50">{busy ? (pct !== null && pct < 100 ? "Uploading…" : "Saving…") : lesson ? "Save lesson" : upload ? "Upload and add" : "Add lesson"}</button>
        <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost !py-2.5">Cancel</button>
      </div>
      <p className="mt-3 text-xs text-slate">Minutes are up to {LESSON_MINUTES_MAX}; they add up to the course&apos;s length.</p>
    </form>
  );
}

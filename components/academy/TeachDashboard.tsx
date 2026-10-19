"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AcademyIcon } from "@/components/shell/icons";
import { useRouter } from "next/navigation";
import { useMember } from "@/lib/member-client";
import { api } from "@/lib/moments-client";
import { useMemberships } from "@/lib/useMemberships";
import Avatar from "@/components/Avatar";
import { COURSE_TITLE_MAX, MAX_COURSES_PER_MEMBER, courseHref, durationLabel, isPaid, plural, priceLabel, type Course, type TutorInvite } from "@/lib/courses";

type MyCourse = Course & { access: "lead" | "tutor" };
type Data = { courses: MyCourse[]; invites: TutorInvite[]; canTeach: boolean; reason?: string };

// /academy/teach: the member's courses (their own, their organisations', and ones they co-teach), drafts and published, newest
// change first; co-tutor invitations to accept or decline; and "New course" (a title is all it takes), as themselves or as an
// organisation they write for. Members who can't publish yet are shown how to start.
export default function TeachDashboard() {
  const { user, profile } = useMember();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const { orgs } = useMemberships(user ?? null);
  const teamOrgs = (orgs ?? []).filter((o) => o.canPublish && (o.accountTier === "business" || o.accountTier === "enterprise"));
  const [as, setAs] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api<Data>("/api/academy/courses").then(setData).catch((e) => setError(e.message));
  useEffect(() => { if (user) void load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  async function answer(i: TutorInvite, accept: boolean) {
    setError("");
    try { await api(`/api/academy/courses/${i.courseId}/tutors`, { body: { action: accept ? "accept" : "decline" } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't answer the invitation."); }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the course a title.");
    setBusy(true);
    setError("");
    try {
      const r = await api<{ course: Course }>("/api/academy/courses", { body: { title, ...(as ? { orgUid: as } : {}) } });
      router.push(`/academy/teach/${r.course.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the course.");
      setBusy(false);
    }
  }

  const hero = (
    <section className="bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright text-paper">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8 sm:py-12">
        <p className="font-mono text-xs uppercase tracking-eyebrow text-paper/70">Notes Academy</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Teach a course</h1>
        <p className="mt-2 max-w-2xl text-paper/85">Free courses with lessons from your own YouTube or written right here, and paid courses (Pro and up) with your own uploaded videos and PDFs. Teach alone, with co-tutors, or for your organisation.</p>
      </div>
    </section>
  );
  const wrap = (body: React.ReactNode) => <>{hero}<div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">{body}</div></>;

  if (user === undefined) return wrap(<p className="text-sm text-slate">Loading…</p>);
  if (user === null) {
    return wrap(
      <div className="card p-6">
        <p className="font-display text-xl text-ink">Sign in to teach</p>
        <p className="mt-1 text-sm text-slate">Courses belong to your #NotesApp account.</p>
        <Link href="/login?next=/academy/teach" className="btn-primary mt-4 inline-block !px-5 !py-2 text-sm">Sign in</Link>
      </div>
    );
  }
  if (error && !data) return wrap(<p className="text-sm text-crimson">{error}</p>);
  if (!data) return wrap(<p className="text-sm text-slate">Loading your courses…</p>);
  if (!data.canTeach && !teamOrgs.length && !data.courses.length && !data.invites.length) {
    return wrap(
      <div className="card p-6">
        <p className="font-display text-xl text-ink">Start publishing to teach</p>
        <p className="mt-1 text-sm text-slate">{data.reason || "Teaching is for publishing accounts."} Publishing is free on the Basic plan: set it up once and you can write journals, open a store and teach courses.</p>
        <Link href="/profile/publishing" className="btn-primary mt-4 inline-block !px-5 !py-2 text-sm">Start publishing</Link>
      </div>
    );
  }

  const full = !as && data.courses.filter((c) => c.ownerUid === user.uid).length >= MAX_COURSES_PER_MEMBER;
  return wrap(
    <>
      {data.invites.length > 0 && (
        <section className="card mb-6 border-crimson/30 p-5">
          <p className="font-display text-xl text-ink">Invitations to co-teach</p>
          <ul className="mt-3 space-y-3">
            {data.invites.map((i) => (
              <li key={i.courseId} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 text-sm"><b>{i.ownerName}</b> invited you to co-teach <Link href={courseHref(i.courseSlug)} className="font-semibold text-crimson">{i.courseTitle}</Link>{i.percent ? <>, for <b>{i.percent}%</b> of each sale</> : <>, credited as a tutor</>}.</p>
                <span className="flex gap-2">
                  <button onClick={() => answer(i, true)} className="btn-primary !px-4 !py-1.5 text-sm">Accept</button>
                  <button onClick={() => answer(i, false)} className="btn-ghost !px-4 !py-1.5 text-sm">Decline</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <form onSubmit={create} className="card p-5 sm:p-6">
        <label htmlFor="new-course" className="font-display text-xl text-ink">New course</label>
        <p className="mt-1 text-sm text-slate">Start with a working title; you can change it until you publish.</p>
        {teamOrgs.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Teach as">
            <span className="text-xs font-semibold text-slate">Teach as</span>
            {[{ uid: "", name: "You", avatar: profile?.avatar ?? "" }, ...teamOrgs.map((o) => ({ uid: o.uid, name: o.displayName, avatar: o.avatar }))].map((o) => (
              <button key={o.uid || "me"} type="button" role="radio" aria-checked={as === o.uid} onClick={() => setAs(o.uid)}
                className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold ${as === o.uid ? "bg-crimson text-paper" : "border border-rule bg-card text-ink"}`}>
                <Avatar src={o.avatar} alt={o.name} size={24} />{o.name}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input id="new-course" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={COURSE_TITLE_MAX} disabled={full} placeholder="e.g. Excel for small business owners"
            className="min-w-0 flex-1 rounded-lg border border-rule bg-white px-3 py-2.5 text-base outline-none focus:border-crimson sm:text-sm" />
          <button type="submit" disabled={busy || full} className="btn-primary !px-6 !py-2.5 text-sm disabled:opacity-50">{busy ? "Creating…" : "Create course"}</button>
        </div>
        {full && <p className="mt-2 text-xs text-slate">You have {MAX_COURSES_PER_MEMBER} courses, the most for now. Delete one to start another.</p>}
        {error && <p className="mt-2 text-sm text-crimson">{error}</p>}
      </form>

      {!data.canTeach && !as && <p className="mt-3 text-sm text-slate">{data.reason} You can still teach for {teamOrgs.map((o) => o.displayName).join(", ") || "an organisation you write for"}, and co-teach courses you're invited to.</p>}

      <h2 className="mt-10 font-display text-2xl text-ink">Your courses</h2>
      {data.courses.length === 0 ? (
        <p className="mt-3 text-sm text-slate">No courses yet. Create one above: a title first, then lessons, then publish.</p>
      ) : (
        <ul className="mt-4 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
          {data.courses.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              {c.cover
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.cover} alt="" className="aspect-video w-full rounded-lg object-cover sm:w-32" />
                : <span aria-hidden className="hidden aspect-video w-32 items-center justify-center rounded-lg bg-crimson/[0.07] font-display text-2xl text-crimson sm:flex">{c.title.trim()[0] ?? "·"}</span>}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-ui font-bold text-ink">{c.title}</span>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${c.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-rule text-slate"}`}>{c.status === "published" ? "Published" : "Draft"}</span>
                  {c.isOrg && <span className="rounded-full bg-paper px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-slate ring-1 ring-rule">{c.ownerName}</span>}
                  {c.access === "tutor" && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-amber-900">Co-tutor</span>}
                </p>
                <p className="mt-1 text-xs text-slate"><span className={isPaid(c) ? "font-semibold text-ink" : "text-emerald-700"}>{priceLabel(c)}</span> · {plural(c.lessonCount, "lesson")}{c.minutes ? ` · ${durationLabel(c.minutes)}` : ""} · {plural(c.enrolCount, "learner")} · {plural(c.viewCount, "view")}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/academy/teach/${c.id}`} className="btn-primary flex-1 !px-4 !py-1.5 text-center text-sm sm:flex-none">Edit</Link>
                <Link href={courseHref(c.slug)} className="btn-ghost flex-1 !px-4 !py-1.5 text-center text-sm sm:flex-none">{c.status === "published" ? "View" : "Preview"}</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-slate">Up to {MAX_COURSES_PER_MEMBER} courses, each with up to 100 lessons. Learners who finish get a certificate: <Link href="/academy/teach/setup" className="font-semibold text-crimson"><AcademyIcon className="mr-1 inline-block h-[1.2em] w-[1.2em] align-[-0.25em]" />set up your academy</Link> (your name, logo, signature and margin). Paid courses: Pro (text, PDFs, YouTube) and Business or Enterprise (uploaded video too).</p>
    </>
  );
}

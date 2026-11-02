"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { useAdminCall } from "@/lib/useAdminCall";
import { durationLabel, plural } from "@/lib/courses";
import type { SeedPlan } from "@/lib/course-seeds-server";

const ACTION: Record<SeedPlan["action"], string> = {
  create: "Creates a new draft",
  update: "Updates the course an earlier seed made",
  rewrite: "Rewrites the existing course in place",
  blocked: "Can't be seeded",
};
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

// Admin → Academy: "Seed courses" (lib/course-seeds.ts, POST /api/admin/course-seeds). The prepared courses, grouped by who they
// belong to: Emmanuel's own two (@emmanuel) and LWB Academy's seven on AI (the @lwb organisation, made by @emmanuel). A dry run first
// (what each will create or rewrite, its lessons and videos, or why it can't be seeded), then one tap to confirm each, or "Seed all"
// for a group. Super admins and the owner only; the card hides itself for anyone else.
export default function CourseSeedsCard({ user }: { user: User }) {
  const call = useAdminCall(user, "/api/admin/course-seeds");
  const [data, setData] = useState<{ plans: SeedPlan[]; note: string } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [confirming, setConfirming] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setData(await call()); } catch (e) { const m = e instanceof Error ? e.message : ""; if (/staff|super/i.test(m)) setHidden(true); else setError(m || "Couldn't load the seeds."); }
  }, [call]);
  useEffect(() => { void load(); }, [load]);

  async function seed(label: string, body: Record<string, unknown>) {
    setBusy(label); setError(""); setMsg("");
    try {
      const { results } = (await call({ ...body, confirm: true })) as { results: SeedPlan[] };
      setMsg(results.length === 1
        ? `${results[0].title}: ${results[0].done === "create" ? "created as a draft" : "rewritten"}, ${plural(results[0].after.lessons, "lesson")}. ${results[0].status === "draft" ? "It's a draft: preview it, then publish it from the editor." : "It stays published."}`
        : `${plural(results.length, "course")} seeded: ${results.filter((r) => r.done === "create").length} created as drafts, ${results.filter((r) => r.done !== "create").length} updated.`);
      setConfirming("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't seed it."); } finally { setBusy(""); }
  }

  if (hidden) return null;
  const groups = Array.from(new Map((data?.plans ?? []).map((p) => [p.group, (data?.plans ?? []).filter((x) => x.group === p.group)])));
  return (
    <div className="card mt-8 p-4 sm:p-5" data-testid="course-seeds">
      <h2 className="font-display text-2xl">Seed courses</h2>
      <p className="mt-1 text-sm text-slate">Courses prepared by Emmanuel Adams. Check what each will change, then confirm. Seeding again rewrites the same lessons; it never makes a copy.</p>
      {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
      {msg && <p className="mt-3 text-sm text-emerald-800" role="status">{msg}</p>}
      {!data && !error && <p className="mt-3 text-sm text-slate">Checking…</p>}
      {groups.map(([group, plans]) => {
        const owner = plans[0].ownerUsername, teacher = plans[0].teacherUsername, org = teacher !== owner;
        const blocked = plans.find((p) => p.action === "blocked" && !p.courseId)?.reason;
        const all = `all:${owner}`;
        return (
          <section key={group} className="mt-6" data-testid={`seed-group-${owner}`}>
            <h3 className="font-display text-xl text-ink">{group}</h3>
            <p className="mt-0.5 text-xs text-slate">
              {org
                ? <>Owned by the <Link href={`/u/${owner}`} className="text-crimson">@{owner}</Link> organisation, made by <Link href={`/u/${teacher}`} className="text-crimson">@{teacher}</Link> (credited as the teacher). New courses are drafts the organisation previews and publishes.</>
                : <>Delivered as <Link href={`/u/${owner}`} className="text-crimson">@{owner}</Link>&apos;s own courses.</>}
            </p>
            {blocked && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{blocked}</p>}
            {plans.length > 2 && !blocked && (confirming === all ? (
              <div className="mt-3 rounded-lg border border-crimson/30 bg-card p-3 text-sm">
                <p>Seed all {WORDS[plans.length] ?? plans.length} {group} courses ({plural(plans.reduce((n, p) => n + p.after.lessons, 0), "lesson")})? New ones are created as drafts; ones seeded before are updated.</p>
                <div className="mt-2 flex gap-2">
                  <button disabled={!!busy} onClick={() => void seed(all, { owner })} className="btn-primary !px-4 !py-1.5 text-xs">{busy === all ? "Seeding…" : "Confirm"}</button>
                  <button disabled={!!busy} onClick={() => setConfirming("")} className="btn-ghost !px-4 !py-1.5 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <button disabled={!!busy} onClick={() => { setConfirming(all); setMsg(""); }} className="btn-primary mt-3 !px-4 !py-1.5 text-xs">Seed all {WORDS[plans.length] ?? plans.length}</button>
            ))}
            <ul className="mt-3 space-y-4">
              {plans.map((p) => (
                <li key={p.key} className="rounded-xl border border-rule bg-paper p-3 sm:p-4">
                  <div className={plans.length > 2 ? "flex flex-col gap-3 sm:flex-row" : ""}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.after.cover} alt="" className={`aspect-video rounded-lg object-cover ${plans.length > 2 ? "w-full sm:w-44 sm:shrink-0" : "mb-3 w-full max-w-xs"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{p.title}</p>
                          <p className="text-xs text-slate [overflow-wrap:anywhere]">/academy/{p.slug}{p.courseId ? ` · ${p.status === "published" ? "published" : "draft"}` : ""} · by {p.byline}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-ui text-xs font-bold ${p.action === "blocked" ? "bg-red-50 text-red-700" : p.action === "create" ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{ACTION[p.action]}</span>
                      </div>
                      <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                        {p.before && <div><dt className="inline text-slate">Now: </dt><dd className="inline">{plural(p.before.lessons, "lesson")}{p.before.minutes ? ` · ${durationLabel(p.before.minutes)}` : ""} · {plural(p.before.enrolCount, "learner")} · {plural(p.before.reviews, "review")}</dd></div>}
                        <div><dt className="inline text-slate">After: </dt><dd className="inline">{plural(p.after.lessons, "lesson")} ({p.after.texts} text, {plural(p.after.videos.length, "video")}, {plural(p.after.quizzes, "quiz", "quizzes")}) · {durationLabel(p.after.minutes)}</dd></div>
                      </dl>
                    </div>
                  </div>
                  {p.after.videos.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-slate">
                      {p.after.videos.map((v) => <li key={v.youtubeId} className="[overflow-wrap:anywhere]">▶ <span className="text-ink">{v.lesson}</span>: “{v.title}” by {v.creator}</li>)}
                    </ul>
                  )}
                  {(p.action === "rewrite" || p.progressNote) && <p className="mt-2 rounded-lg bg-card px-3 py-2 text-xs text-ink"><b>Learners:</b> {p.progressNote ?? data!.note}</p>}
                  {p.action === "create" && <p className="mt-2 text-xs text-slate">Created as a draft owned by @{owner}{org ? `, made by @${teacher}` : ""}, to preview and publish.</p>}
                  {p.reason && p.reason !== blocked && <p className="mt-2 text-xs text-red-700">{p.reason}</p>}
                  {p.action !== "blocked" && (confirming === p.key ? (
                    <div className="mt-3 rounded-lg border border-crimson/30 bg-card p-3 text-sm">
                      <p>{p.action === "create" ? `Create "${p.title}" as a draft with ${plural(p.after.lessons, "lesson")}?` : `Replace the ${plural(p.before?.lessons ?? 0, "lesson")} of "${p.title}" with ${plural(p.after.lessons, "new lesson")} and update its details? ${p.status === "published" ? "It stays published, at the same address." : ""}`}</p>
                      <div className="mt-2 flex gap-2">
                        <button disabled={!!busy} onClick={() => void seed(p.key, { key: p.key })} className="btn-primary !px-4 !py-1.5 text-xs">{busy === p.key ? "Seeding…" : "Confirm"}</button>
                        <button disabled={!!busy} onClick={() => setConfirming("")} className="btn-ghost !px-4 !py-1.5 text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button disabled={!!busy} onClick={() => { setConfirming(p.key); setMsg(""); }} className={`${plans.length > 2 ? "btn-ghost" : "btn-primary"} !px-4 !py-1.5 text-xs`}>{p.action === "create" ? "Seed this course" : p.action === "rewrite" ? "Rewrite this course" : "Seed again"}</button>
                      {p.courseId && <Link href={`/academy/teach/${p.courseId}`} className="text-xs font-semibold text-crimson">Open in the editor</Link>}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

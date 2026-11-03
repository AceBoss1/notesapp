"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { DEPARTMENTS, type Dept } from "@/lib/admin-access";
import { APP_STATUS_LABEL, ARRANGEMENT_LABEL, type AppStatus, type Application, type Arrangement, type CareerRole } from "@/lib/careers";
import NanaPanel from "@/components/NanaPanel";

type Draft = { kind: string; title: string; markdown: string };
type Data = {
  manage: boolean; roles?: CareerRole[]; applications?: Application[]; canOpen?: boolean;
  drafts?: { id: string; applicationId: string | null; drafts: Draft[]; createdAt: string }[];
  unanswered?: { name: string; question: string; at: string }[];
};
const field = "mt-1 block w-full rounded-lg border border-rule bg-card px-2 py-1.5 text-sm";
const btn = "rounded-full bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const blankRole = { title: "", dept: "growth" as Dept, reportsTo: "", summary: "", about: "", responsibilities: "", requirements: "", hours: "20 hours a week, Monday to Friday", location: "Remote, anywhere in Nigeria", arrangement: "salary_options" as Arrangement };
const blankTerms = { applicationId: "", name: "", title: "", reportsTo: "", worksWith: "", offerDate: "", startDate: "", hoursPerWeek: "20", days: "", arrangement: "salary_options" as Arrangement, monthlySalary: "", bonusPerMonth: "", salaryAfterMilestone: "", milestoneName: "", probationMonths: "three", noticeAfterProbation: "one month's", restrictionMonths: "six", duties: "", whatTheyDo: "", howToWork: "", optionShares: "", optionPercent: "", exercisePrice: "", grantDate: "" };
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "");

// Nana-HR and hiring (the Nana-HR spec): every staff member asks Nana-HR about the handbook, their SOPs and briefs and their own hours,
// leave and pay; super admins and the Chief of Staff also run hiring here: roles (a super admin opens them on /careers), applications
// with Nana-HR's screening summaries, onboarding drafts (offer, option grant, announcement) and the questions Nana-HR couldn't answer.
export default function NanaHrPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/hr");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [roleForm, setRoleForm] = useState<(typeof blankRole & { id?: string }) | null>(null);
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [terms, setTerms] = useState<typeof blankTerms | null>(null);
  const [shownDrafts, setShownDrafts] = useState<Draft[] | null>(null);

  const load = useCallback(() => call().then(setData).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) load(); }, [user, load]);
  async function run(body: Record<string, unknown>, done: string) {
    setBusy(true); setError(""); setNote("");
    try { const j = await call(body); setNote(done); await load(); return j; }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); return null; }
    finally { setBusy(false); }
  }
  const download = (d: Draft) => {
    const url = URL.createObjectURL(new Blob([d.markdown], { type: "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = `${d.title.replace(/[^A-Za-z0-9 -]/g, "").replace(/\s+/g, "-")}.md`; a.click(); URL.revokeObjectURL(url);
  };

  if (loading || !user) return <p className="p-8 text-slate">Loading…</p>;
  const roles = data?.roles ?? [], apps = data?.applications ?? [];
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <p className="eyebrow"><Link href="/admin/team" className="underline">Team hub</Link></p>
      <h1 className="mt-2 font-display text-4xl text-ink">Nana-HR</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">Ask about the Employee Handbook, your SOP manual and brief, and your own hours, leave and pay. Nana-HR answers only from those, says where the answer came from, and tells you who to ask when she can&apos;t: your team lead, then the C-suite, then the founder. She can&apos;t change anything and never sees anyone else&apos;s records.</p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}

      <div className="mt-6 overflow-hidden rounded-xl border border-rule">
        <NanaPanel context="hr" className="h-[520px]" autoFocus={false} />
      </div>

      {data?.manage && (
        <>
          <h2 className="mt-12 font-display text-2xl text-ink">Hiring</h2>
          <p className="mt-1 text-sm text-slate">Roles are drafted here and opened by a super admin, then listed on <Link href="/careers" className="text-crimson underline">/careers</Link>. A person reads every application; Nana-HR&apos;s summary only checks it against the role&apos;s stated requirements. Applicants hear from us when they&apos;re invited to interview, offered the role or not taken forward.</p>
          <div className="mt-4 flex gap-2">
            {!roleForm && <button className={ghost} onClick={() => setRoleForm({ ...blankRole })}>Add a role</button>}
            {!terms && <button className={ghost} onClick={() => setTerms({ ...blankTerms })}>Draft onboarding documents</button>}
          </div>

          {roleForm && (
            <form className="card mt-4 grid gap-3 p-5 sm:grid-cols-2" onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run({ action: "saveRole", id: roleForm.id, role: { ...roleForm, responsibilities: roleForm.responsibilities.split("\n"), requirements: roleForm.requirements.split("\n") } }, roleForm.id ? "Role saved." : "Role drafted. A super admin opens it on /careers.");
              if (ok) setRoleForm(null);
            }}>
              <label className="text-xs sm:col-span-2">Title<input className={field} value={roleForm.title} onChange={(e) => setRoleForm({ ...roleForm, title: e.target.value })} required /></label>
              <label className="text-xs">Department<select className={field} value={roleForm.dept} onChange={(e) => setRoleForm({ ...roleForm, dept: e.target.value as Dept })}>{DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select></label>
              <label className="text-xs">Reports to<input className={field} value={roleForm.reportsTo} onChange={(e) => setRoleForm({ ...roleForm, reportsTo: e.target.value })} /></label>
              <label className="text-xs">Hours<input className={field} value={roleForm.hours} onChange={(e) => setRoleForm({ ...roleForm, hours: e.target.value })} /></label>
              <label className="text-xs">Where<input className={field} value={roleForm.location} onChange={(e) => setRoleForm({ ...roleForm, location: e.target.value })} /></label>
              <label className="text-xs">Pay arrangement<select className={field} value={roleForm.arrangement} onChange={(e) => setRoleForm({ ...roleForm, arrangement: e.target.value as Arrangement })}>{(Object.keys(ARRANGEMENT_LABEL) as Arrangement[]).map((k) => <option key={k} value={k}>{ARRANGEMENT_LABEL[k]}</option>)}</select></label>
              <label className="text-xs sm:col-span-2">Summary (one or two lines)<input className={field} value={roleForm.summary} onChange={(e) => setRoleForm({ ...roleForm, summary: e.target.value })} /></label>
              <label className="text-xs sm:col-span-2">About the role<textarea rows={3} className={field} value={roleForm.about} onChange={(e) => setRoleForm({ ...roleForm, about: e.target.value })} /></label>
              <label className="text-xs">Responsibilities (one per line)<textarea rows={5} className={field} value={roleForm.responsibilities} onChange={(e) => setRoleForm({ ...roleForm, responsibilities: e.target.value })} /></label>
              <label className="text-xs">Requirements (one per line; Nana-HR checks applications against these)<textarea rows={5} className={field} value={roleForm.requirements} onChange={(e) => setRoleForm({ ...roleForm, requirements: e.target.value })} required /></label>
              <div className="flex gap-2 sm:col-span-2"><button className={btn} disabled={busy}>{roleForm.id ? "Save" : "Draft the role"}</button><button type="button" className={ghost} onClick={() => setRoleForm(null)}>Cancel</button></div>
            </form>
          )}

          {terms && (
            <form className="card mt-4 grid gap-3 p-5 sm:grid-cols-3" onSubmit={async (e) => {
              e.preventDefault();
              const j = await run({ action: "drafts", terms: { ...terms, duties: terms.duties.split("\n"), whatTheyDo: terms.whatTheyDo.split("\n"), howToWork: terms.howToWork.split("\n") } }, "Drafts ready. Legal reviews them; the CEO (and, for options, the Board) approves and signs. Nana-HR never sends them.");
              if (j) { setShownDrafts(j.drafts); setTerms(null); }
            }}>
              <p className="text-xs text-slate sm:col-span-3">From the templates in the library (the offer letter, the NotesApp Inc. option grant and the internal announcement). Anything you leave blank stays as an [open point] for the reviewer.</p>
              <label className="text-xs">Name<input className={field} value={terms.name} onChange={(e) => setTerms({ ...terms, name: e.target.value })} required /></label>
              <label className="text-xs">Role title<input className={field} value={terms.title} onChange={(e) => setTerms({ ...terms, title: e.target.value })} required /></label>
              <label className="text-xs">Pay arrangement<select className={field} value={terms.arrangement} onChange={(e) => setTerms({ ...terms, arrangement: e.target.value as Arrangement })}>{(Object.keys(ARRANGEMENT_LABEL) as Arrangement[]).map((k) => <option key={k} value={k}>{ARRANGEMENT_LABEL[k]}</option>)}</select></label>
              <label className="text-xs">Reports to<input className={field} value={terms.reportsTo} onChange={(e) => setTerms({ ...terms, reportsTo: e.target.value })} placeholder="the Chief Executive Officer" /></label>
              <label className="text-xs">Works with<input className={field} value={terms.worksWith} onChange={(e) => setTerms({ ...terms, worksWith: e.target.value })} /></label>
              <label className="text-xs">Hours a week<input className={field} value={terms.hoursPerWeek} onChange={(e) => setTerms({ ...terms, hoursPerWeek: e.target.value })} /></label>
              <label className="text-xs">Offer date<input className={field} value={terms.offerDate} onChange={(e) => setTerms({ ...terms, offerDate: e.target.value })} placeholder="13th October 2026" /></label>
              <label className="text-xs">Start date<input className={field} value={terms.startDate} onChange={(e) => setTerms({ ...terms, startDate: e.target.value })} /></label>
              <label className="text-xs">Monthly salary (₦)<input className={field} value={terms.monthlySalary} onChange={(e) => setTerms({ ...terms, monthlySalary: e.target.value })} /></label>
              <label className="text-xs">Deferred bonus a month (₦, optional)<input className={field} value={terms.bonusPerMonth} onChange={(e) => setTerms({ ...terms, bonusPerMonth: e.target.value })} /></label>
              <label className="text-xs">Salary after the milestone (₦, optional)<input className={field} value={terms.salaryAfterMilestone} onChange={(e) => setTerms({ ...terms, salaryAfterMilestone: e.target.value })} /></label>
              <label className="text-xs">Milestone name (optional)<input className={field} value={terms.milestoneName} onChange={(e) => setTerms({ ...terms, milestoneName: e.target.value })} placeholder="Pre-Seed Milestone" /></label>
              <label className="text-xs">Option shares<input className={field} value={terms.optionShares} onChange={(e) => setTerms({ ...terms, optionShares: e.target.value })} /></label>
              <label className="text-xs">Option % of fully diluted<input className={field} value={terms.optionPercent} onChange={(e) => setTerms({ ...terms, optionPercent: e.target.value })} /></label>
              <label className="text-xs">Exercise price (US$)<input className={field} value={terms.exercisePrice} onChange={(e) => setTerms({ ...terms, exercisePrice: e.target.value })} /></label>
              <label className="text-xs sm:col-span-3">Duties for the first 90 days (one per line)<textarea rows={4} className={field} value={terms.duties} onChange={(e) => setTerms({ ...terms, duties: e.target.value })} /></label>
              <label className="text-xs sm:col-span-3">For the announcement: what they do (one per line)<textarea rows={3} className={field} value={terms.whatTheyDo} onChange={(e) => setTerms({ ...terms, whatTheyDo: e.target.value })} /></label>
              <label className="text-xs sm:col-span-3">For the announcement: how to work with them (one per line)<textarea rows={3} className={field} value={terms.howToWork} onChange={(e) => setTerms({ ...terms, howToWork: e.target.value })} /></label>
              <div className="flex gap-2 sm:col-span-3"><button className={btn} disabled={busy}>Draft them</button><button type="button" className={ghost} onClick={() => setTerms(null)}>Cancel</button></div>
            </form>
          )}

          {shownDrafts && (
            <div className="card mt-4 p-5">
              <div className="flex items-center justify-between"><p className="font-display text-xl text-ink">Drafts</p><button className={ghost} onClick={() => setShownDrafts(null)}>Close</button></div>
              {shownDrafts.map((d) => (
                <details key={d.title} className="mt-3 rounded-lg border border-rule p-3" open>
                  <summary className="cursor-pointer font-ui text-sm font-semibold">{d.title}</summary>
                  <div className="mt-2 flex gap-2"><button className={ghost} onClick={() => navigator.clipboard?.writeText(d.markdown)}>Copy</button><button className={ghost} onClick={() => download(d)}>Download (.md)</button></div>
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-paper p-3 text-xs">{d.markdown}</pre>
                </details>
              ))}
            </div>
          )}

          <ul className="mt-6 space-y-4">
            {roles.map((r) => {
              const mine = apps.filter((a) => a.roleId === r.id);
              return (
                <li key={r.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-xl text-ink">{r.title}</p>
                      <p className="text-xs text-slate">{DEPARTMENTS.find((d) => d.key === r.dept)?.label} · {r.status === "open" ? `open since ${day(r.openedAt || "")}` : r.status} · {mine.length} application{mine.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.status === "open" && <Link href={`/careers/${r.id}`} className={ghost}>View on /careers</Link>}
                      <button className={ghost} onClick={() => setRoleForm({ id: r.id, title: r.title, dept: r.dept, reportsTo: r.reportsTo, summary: r.summary, about: r.about, responsibilities: r.responsibilities.join("\n"), requirements: r.requirements.join("\n"), hours: r.hours, location: r.location, arrangement: r.arrangement })}>Edit</button>
                      {data.canOpen && r.status !== "open" && <button className={btn} disabled={busy} onClick={() => run({ action: "roleStatus", id: r.id, status: "open" }, "Role opened on /careers.")}>Open on /careers</button>}
                      {data.canOpen && r.status === "open" && <button className={ghost} disabled={busy} onClick={() => { if (confirm(`Close ${r.title}? Its applications are deleted 6 months from now, unless an applicant asked to be kept.`)) run({ action: "roleStatus", id: r.id, status: "closed" }, "Role closed."); }}>Close</button>}
                      <button className={ghost} onClick={() => setOpenRole(openRole === r.id ? null : r.id)}>{openRole === r.id ? "Hide applications" : "Applications"}</button>
                    </div>
                  </div>
                  {openRole === r.id && (
                    <ul className="mt-4 space-y-3">
                      {mine.length === 0 && <li className="text-sm text-slate">No applications yet.</li>}
                      {mine.map((a) => (
                        <li key={a.id} className="rounded-lg border border-rule p-4 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-ink">{a.name} <span className="font-normal text-slate">· {a.email}{a.phone ? ` · ${a.phone}` : ""}{a.city ? ` · ${a.city}` : ""}</span></p>
                              <p className="text-xs text-slate">Applied {day(a.createdAt)} · {APP_STATUS_LABEL[a.status]}{a.futureRoles ? " · keep for future roles" : ""}</p>
                            </div>
                            <select className="rounded-lg border border-rule bg-card px-2 py-1 text-xs" value={a.status} disabled={busy} onChange={(e) => run({ action: "appStatus", id: a.id, status: e.target.value as AppStatus }, "Status saved.")} aria-label={`Status of ${a.name}'s application`}>
                              {(Object.keys(APP_STATUS_LABEL) as AppStatus[]).map((k) => <option key={k} value={k}>{APP_STATUS_LABEL[k]}</option>)}
                            </select>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-ink">{a.coverNote}</p>
                          {a.links.length > 0 && <p className="mt-2 text-xs">{a.links.map((l) => <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="mr-3 text-crimson underline">{l}</a>)}</p>}
                          {a.summary ? (
                            <div className="mt-3 rounded bg-paper p-3"><p className="eyebrow">Nana-HR summary · {day(a.summary.at)}</p><p className="mt-1 whitespace-pre-wrap text-xs text-ink">{a.summary.text}</p></div>
                          ) : (
                            <button className={`${ghost} mt-3`} disabled={busy} onClick={() => run({ action: "summarise", id: a.id }, "Summary ready.")}>Summarise against the requirements</button>
                          )}
                          {a.status === "offer" || a.status === "hired" ? (
                            <button className={`${btn} mt-3 ml-2`} onClick={() => setTerms({ ...blankTerms, applicationId: a.id, name: a.name, title: r.title, reportsTo: r.reportsTo, arrangement: r.arrangement })}>Draft onboarding documents</button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {(data.drafts?.length ?? 0) > 0 && (
            <>
              <h3 className="mt-10 font-display text-xl text-ink">Earlier drafts</h3>
              <ul className="mt-3 space-y-1 text-sm">
                {data.drafts!.map((d) => <li key={d.id}><button className="text-crimson underline" onClick={() => setShownDrafts(d.drafts)}>{d.drafts.map((x) => x.title).join(" · ")}</button> <span className="text-xs text-slate">{day(d.createdAt)}</span></li>)}
              </ul>
            </>
          )}

          <h3 className="mt-10 font-display text-xl text-ink">Questions Nana-HR couldn&apos;t answer</h3>
          <p className="mt-1 text-sm text-slate">Fix the handbook or the SOP so the next person gets an answer.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {(data.unanswered ?? []).length === 0 && <li className="text-slate">None so far.</li>}
            {(data.unanswered ?? []).map((q, i) => <li key={i} className="rounded border border-rule p-3"><span className="text-xs text-slate">{day(q.at)} · {q.name}</span><p className="mt-1 text-ink">{q.question}</p></li>)}
          </ul>
        </>
      )}
    </section>
  );
}

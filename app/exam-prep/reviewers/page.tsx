"use client";
import { useEffect, useState } from "react";
import { EXAM_IDS, EXAMS, PREP_NAME, type ExamId } from "@/lib/exam-prep";
import { prepApi, useMe } from "@/lib/exam-prep-client";
import { BACKGROUNDS, REVIEWER_SUBJECTS, SUBJECT_GROUPS, subjectKeysFor, type Background } from "@/lib/prep-reviewers";
import { btnGo, card, input, Note, PLink } from "@/components/exam-prep/ui";

const chip = (on: boolean) => `inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${on ? "border-[#1E8E5A] bg-[#1E8E5A]/10 text-[#0F2747]" : "border-[#0F2747]/15 bg-white text-[#0F2747]/85 hover:border-[#1E8E5A]/50"}`;
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// Volunteer to review Naija Exam Prep questions (lib/prep-reviewers.ts). Open to everyone; members' name and email are filled in.
// A sign-up goes to Admin → Leads → Volunteers, where staff approve it.
export default function ReviewersPage() {
  const me = useMe();
  const [f, setF] = useState({ name: "", email: "", years: "", phone: "", note: "" });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [exams, setExams] = useState<ExamId[]>([]);
  const [background, setBackground] = useState<Background[]>([]);
  const [join, setJoin] = useState(false); // optional, so it starts unticked
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { again: boolean }>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (me) setF((x) => ({ ...x, name: x.name || me.displayName || "", email: x.email || me.email || "" })); }, [me]);

  const keys = subjectKeysFor(subjects, exams).length;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await prepApi<{ again: boolean }>("reviewers", { body: { ...f, years: Number(f.years), subjects, exams, background, joinCommunity: join } });
      setDone(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  if (done) return (
    <div className={`${card} mx-auto max-w-xl space-y-3`}>
      <h1 className="font-display text-2xl font-bold">Thank you for volunteering</h1>
      <p className="text-[15px] text-[#0F2747]/80">{done.again ? "We've updated your sign-up." : "We've got your sign-up."} We look at each one ourselves and will email you at <b>{f.email}</b> once you&apos;re approved, with how to start.</p>
      {join && <Note>You asked to join the Naija Exam Prep Reviewers community. Its invite link comes with your approval, so it stays a place for reviewers only.</Note>}
      <PLink href="/" className={btnGo}>Back to {PREP_NAME}</PLink>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-3xl bg-[#0F2747] px-5 py-7 text-white sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A227]">Volunteers wanted</p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Review {PREP_NAME} questions</h1>
        <p className="mt-2 max-w-xl text-[15px] text-white/85">Every question is checked by a person before students see it. Teachers, examiners, graduates in a subject and strong students: help us make sure every answer is right, every explanation is clear and every question is fair.</p>
      </section>

      <div className={card}>
        <p className="font-semibold">How it works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#0F2747]/80">
          <li>Sign up below with the subjects and exams you know.</li>
          <li>We look at your sign-up and email you once you&apos;re approved. With a NotesApp account on the same email, your access is switched on straight away; without one, you get an invite link to create it.</li>
          <li>Open the review queue: you see questions in your subjects only. Approve each one, or ask for changes with a note. Your reviews are counted.</li>
        </ol>
        <p className="mt-2 text-sm"><a className="font-semibold text-[#1E8E5A] underline" href="/help/naija-exam-prep-reviewers">How reviewing works</a></p>
      </div>

      <form onSubmit={submit} className={`${card} space-y-5`} aria-label="Reviewer sign-up">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Your full name<input className={`${input} mt-1`} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
          <label className="block text-sm font-semibold">Email<input className={`${input} mt-1`} required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
        </div>
        {me && <p className="-mt-3 text-xs text-[#0F2747]/60">Filled in from your account. Approval switches reviewer access on for this account.</p>}

        <fieldset>
          <legend className="text-sm font-semibold">Subjects you can review</legend>
          {SUBJECT_GROUPS.map((g) => (
            <div key={g.id} className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0F2747]/60">{g.name}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {REVIEWER_SUBJECTS.filter((s) => s.group === g.id).map((s) => (
                  <label key={s.id} className={chip(subjects.includes(s.id))}><input type="checkbox" className="accent-[#1E8E5A]" checked={subjects.includes(s.id)} onChange={() => setSubjects(toggle(subjects, s.id))} />{s.name}</label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Exams</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {EXAM_IDS.map((x) => <label key={x} className={chip(exams.includes(x))}><input type="checkbox" className="accent-[#1E8E5A]" checked={exams.includes(x)} onChange={() => setExams(toggle(exams, x))} />{EXAMS[x].short}</label>)}
          </div>
          {subjects.length > 0 && exams.length > 0 && <p className="mt-1.5 text-xs text-[#0F2747]/60">{keys ? `${keys} subject${keys === 1 ? "" : "s"} across those exams.` : "None of those subjects is in those exams: JAMB has English, Mathematics, the sciences, Economics and Government."}</p>}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Your background</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {BACKGROUNDS.map((b) => <label key={b.id} className={chip(background.includes(b.id))}><input type="checkbox" className="accent-[#1E8E5A]" checked={background.includes(b.id)} onChange={() => setBackground(toggle(background, b.id))} />{b.label}</label>)}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Years of experience in these subjects<input className={`${input} mt-1`} required inputMode="numeric" value={f.years} onChange={(e) => setF({ ...f, years: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="For example 5" /></label>
          <label className="block text-sm font-semibold">Phone <span className="font-normal text-[#0F2747]/60">(optional)</span><input className={`${input} mt-1`} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></label>
        </div>
        <label className="block text-sm font-semibold">Anything else? <span className="font-normal text-[#0F2747]/60">(optional)</span><textarea className={`${input} mt-1 min-h-[80px] py-2`} maxLength={1000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Where you teach, which classes, a syllabus you know well" /></label>

        <label className="flex items-start gap-3 rounded-xl border border-[#0F2747]/15 p-3 text-sm">
          <input type="checkbox" className="mt-1 accent-[#1E8E5A]" checked={join} onChange={(e) => setJoin(e.target.checked)} />
          <span><b>Join the reviewers&apos; community (optional)</b><span className="mt-0.5 block text-[#0F2747]/70">A private Naija Exam Prep Reviewers community on NotesApp, with Spaces for Sciences, Arts and Commercial, and one for questions to discuss. You get its invite link once you&apos;re approved. You can review without joining.</span></span>
        </label>

        {error && <Note tone="error">{error}</Note>}
        <button disabled={busy} className={`${btnGo} w-full sm:w-auto`}>{busy ? "Sending…" : "Sign up to review"}</button>
        <p className="text-xs text-[#0F2747]/60">We use your details only to review your sign-up and contact you about reviewing. Your phone number is never shown to anyone outside our team.</p>
      </form>
    </div>
  );
}

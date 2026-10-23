"use client";
import { useCallback, useEffect, useState } from "react";
import { EXAM_IDS, EXAMS, type ExamId } from "@/lib/exam-prep";
import { loadCatalogue, prepApi, useMe, usePrepHref } from "@/lib/exam-prep-client";
import { AGREEMENT_POINTS, MAX_SEATS, PILOT_NOTE, SCHOOL_PACK_MONTHS, SCHOOL_ROLES, type School, type SchoolClass } from "@/lib/prep-schools";
import { btnGo, btnLine, card, input, Note, PLink, Spinner } from "@/components/exam-prep/ui";

type Mine = { schools: School[]; classes: SchoolClass[]; agreement: { version: string; text: string } | null };
const STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];

// For schools: a key staff member applies, signs the onboarding data agreement once we've approved the school, then makes classes
// with access codes and adds teachers (lib/prep-schools.ts).
export default function SchoolsPage() {
  const me = useMe();
  const h = usePrepHref();
  const [d, setD] = useState<Mine | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", state: "", address: "", leadName: "", leadRole: "", phone: "", students: "" });
  const [sign, setSign] = useState({ name: "", agree: false });
  const [cls, setCls] = useState<{ name: string; exam: ExamId; subjects: string[]; seats: string }>({ name: "", exam: "waec", subjects: [], seats: "" });
  const [teacher, setTeacher] = useState("");
  const [subjects, setSubjects] = useState<{ exam: ExamId; id: string; name: string }[]>([]);
  const load = useCallback(() => prepApi<Mine>("schools").then(setD).catch((e) => setMsg({ tone: "error", text: e.message })), []);
  useEffect(() => { if (me) void load(); }, [me, load]);
  useEffect(() => { loadCatalogue().then((c) => setSubjects(c.subjects.map((s) => ({ exam: s.exam, id: s.id, name: s.name })))).catch(() => undefined); }, []);
  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { const r = await prepApi<Record<string, unknown>>("schools", { body }); setMsg({ tone: "ok", text: ok.replace("{code}", String(r.code ?? "")) }); await load(); return r; } catch (e) { setMsg({ tone: "error", text: (e as Error).message }); return null; } finally { setBusy(false); }
  };

  if (me === undefined) return <Spinner />;
  if (!me) return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Naija Exam Prep for schools</h1>
      <p className="mt-2 text-sm text-[#0F2747]/75">Classes with access codes, and each teacher sees their class&apos;s practice: questions answered, scores and weakest topics. {PILOT_NOTE}</p>
      <a className={`${btnGo} mt-4 inline-flex`} href={h(`/signin?next=${encodeURIComponent(h("/schools"))}`)}>Sign in to apply</a>
    </div>
  );
  if (!d) return <Spinner />;
  const school = d.schools[0];
  const lead = school && school.staff[me.uid] === "lead";
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">{school ? school.name : "Naija Exam Prep for schools"}</h1>
        <p className="mt-1 text-sm text-[#0F2747]/75">{PILOT_NOTE}</p>
      </div>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}

      {!school && (
        <form className={`${card} space-y-3`} onSubmit={(e) => { e.preventDefault(); void run({ action: "apply", ...f, students: Number(f.students) }, "Thanks. We'll review the school and email you, usually within two working days."); }}>
          <p className="font-semibold">Apply for your school</p>
          <p className="text-sm text-[#0F2747]/70">By a key member of staff: the principal, the proprietor, or another senior role.</p>
          <input className={input} required placeholder="School's full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={input} required value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} aria-label="State"><option value="">State</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
            <input className={input} required inputMode="numeric" placeholder="About how many students?" value={f.students} onChange={(e) => setF({ ...f, students: e.target.value.replace(/\D/g, "") })} />
          </div>
          <input className={input} placeholder="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={input} required placeholder="Your full name" value={f.leadName} onChange={(e) => setF({ ...f, leadName: e.target.value })} />
            <select className={input} required value={f.leadRole} onChange={(e) => setF({ ...f, leadRole: e.target.value })} aria-label="Your role"><option value="">Your role</option>{SCHOOL_ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <input className={input} inputMode="tel" placeholder="School phone (optional)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <button disabled={busy} className={btnGo}>Apply</button>
        </form>
      )}

      {school?.status === "pending" && <Note>We&apos;re reviewing {school.name}. We&apos;ll email you once it&apos;s approved; then you sign the data agreement and make your classes.</Note>}
      {school?.status === "declined" && <Note tone="error">We couldn&apos;t approve {school.name} this time. Check your email for why.</Note>}

      {school?.status === "approved" && !school.signature && lead && (
        <div className={`${card} space-y-3`}>
          <p className="font-semibold">Step 1 · The onboarding data agreement</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#0F2747]/80">{AGREEMENT_POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
          {d.agreement ? (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void run({ action: "sign", schoolId: school.id, ...sign }, "Signed. A copy is on its way to your email. Now make your classes."); }}>
              <details className="rounded-xl border border-[#0F2747]/15 p-3 text-sm"><summary className="cursor-pointer font-semibold">Read the full agreement ({d.agreement.version})</summary><div className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap text-[#0F2747]/80">{d.agreement.text}</div></details>
              <input className={input} required placeholder="Type your full name to sign" value={sign.name} onChange={(e) => setSign({ ...sign, name: e.target.value })} />
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={sign.agree} onChange={(e) => setSign({ ...sign, agree: e.target.checked })} /> I agree to it on behalf of {school.name}, as its {school.leadRole.toLowerCase()}.</label>
              <button disabled={busy || !sign.agree} className={btnGo}>Sign the agreement</button>
            </form>
          ) : <Note>The agreement is being finalised. We&apos;ll email you when it&apos;s ready to sign.</Note>}
        </div>
      )}
      {school?.signature && <Note tone="ok">Data agreement {school.signature.version} signed by {school.signature.name} on {school.signature.at.slice(0, 10)}.</Note>}

      {school?.signature && (
        <div className={`${card} space-y-3`}>
          <p className="font-semibold">Classes and access codes</p>
          <div className="space-y-2">
            {d.classes.map((c) => (
              <PLink key={c.id} href={`/class/${c.id}`} className="flex items-center justify-between rounded-xl border border-[#0F2747]/15 p-3 text-sm hover:border-[#1E8E5A]">
                <span><b>{c.name}</b> · {EXAMS[c.exam].short} · {c.members ?? 0} of {c.seats ?? "?"} students{c.subjects.length ? ` · ${c.subjects.length} subject${c.subjects.length === 1 ? "" : "s"}` : ""}{c.teacherName ? ` · ${c.teacherName}` : ""}</span>
                <span className="font-mono font-bold">{c.code}</span>
              </PLink>
            ))}
            {!d.classes.length && <p className="text-sm text-[#0F2747]/60">No classes yet.</p>}
          </div>
          {lead && (
            <form className="space-y-2 border-t border-[#0F2747]/10 pt-3" onSubmit={(e) => { e.preventDefault(); void run({ action: "class", schoolId: school.id, ...cls, seats: Number(cls.seats) }, "Class made. Its code is {code}: give it to the students. Each one who joins gets the school pack."); }}>
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={input} required placeholder="Class name, for example SS3 Gold" value={cls.name} onChange={(e) => setCls({ ...cls, name: e.target.value })} />
                <select className={input} value={cls.exam} onChange={(e) => setCls({ ...cls, exam: e.target.value as ExamId, subjects: [] })} aria-label="Exam">{EXAM_IDS.map((x) => <option key={x} value={x}>{EXAMS[x].short}</option>)}</select>
                <input className={input} required type="number" min={1} max={MAX_SEATS} inputMode="numeric" placeholder="Students, for example 41" aria-label="Number of students" value={cls.seats} onChange={(e) => setCls({ ...cls, seats: e.target.value })} />
              </div>
              <p className="text-xs text-[#0F2747]/65">The school pack: each student who joins with the class code gets the full {EXAMS[cls.exam].short} pack for {SCHOOL_PACK_MONTHS} months, free during the pilot, up to the number of students you give.</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{subjects.filter((s) => s.exam === cls.exam).map((s) => <label key={s.id} className="flex items-center gap-1.5"><input type="checkbox" checked={cls.subjects.includes(s.id)} onChange={(e) => setCls({ ...cls, subjects: e.target.checked ? [...cls.subjects, s.id] : cls.subjects.filter((x) => x !== s.id) })} /> {s.name}</label>)}</div>
              <button disabled={busy} className={btnGo}>Make the class</button>
            </form>
          )}
          {lead && (
            <form className="flex flex-col gap-2 border-t border-[#0F2747]/10 pt-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void run({ action: "teacher", schoolId: school.id, email: teacher }, "Teacher added.").then((r) => { if (r) setTeacher(""); }); }}>
              <input className={input} type="email" required placeholder="A teacher's email (their NotesApp account)" value={teacher} onChange={(e) => setTeacher(e.target.value)} />
              <button disabled={busy} className={btnLine}>Add teacher</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/moments-client";
import { MODE_PROMPTS, TUTOR_LANGUAGES, TUTOR_LANGUAGES_SOON, TUTOR_MESSAGE_MAX, TUTOR_NOTES_MAX, isTutorLang, type TutorLang, type TutorMode, type TutorMsg, type TutorSettings } from "@/lib/tutor";

const LANG_KEY = "nana-tutor-lang";
const readLang = (): TutorLang => { try { const v = localStorage.getItem(LANG_KEY); return isTutorLang(v) ? v : "en"; } catch { return "en"; } };

// The Nana tutor under a lesson (lib/tutor.ts): ask about the course, have the lesson explained, be quizzed or get a summary, in English,
// Pidgin or Kiswahili. Text only and short, for basic phones and little data. The conversation lives only on this page.
export function TutorPanel({ courseId, lessonId, teacher, trying }: { courseId: string; lessonId: string; teacher: string; trying?: boolean }) {
  const [lang, setLang] = useState<TutorLang>("en");
  const [msgs, setMsgs] = useState<TutorMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => setLang(readLang()), []);
  useEffect(() => { setMsgs([]); setError(""); }, [lessonId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy]);

  const pickLang = (l: TutorLang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch {} };
  async function send(content: string) {
    const q = content.trim().slice(0, TUTOR_MESSAGE_MAX);
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setText(""); setBusy(true); setError("");
    try {
      const r = await api<{ reply: string; notice?: string }>("/api/academy/tutor", { body: { courseId, lessonId, lang, messages: next } });
      setMsgs([...next, { role: "assistant", content: r.reply }]);
      if (r.notice) setError(r.notice);
    } catch (e) {
      setMsgs(msgs);
      setText(q);
      setError(e instanceof Error ? e.message : "The tutor couldn't answer just now.");
    } finally { setBusy(false); }
  }
  const quick = (m: TutorMode) => send(MODE_PROMPTS[m][lang]);

  return (
    <section className="card mt-8 p-4 sm:p-5" aria-label="Nana tutor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-xl text-ink">Ask your Nana tutor</p>
          <p className="text-xs text-slate">{trying ? "Trying it as a tutor. " : ""}Answers only from {teacher}&apos;s lessons in this course.</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Language">
          {TUTOR_LANGUAGES.map((l) => (
            <button key={l.id} onClick={() => pickLang(l.id)} aria-pressed={lang === l.id}
              className={`rounded-full px-3 py-1 font-ui text-xs font-semibold ${lang === l.id ? "bg-crimson text-paper" : "border border-rule text-ink"}`}>{l.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["explain", "quiz", "summary"] as const).map((m) => (
          <button key={m} onClick={() => quick(m)} disabled={busy} className="rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold text-ink hover:border-crimson disabled:opacity-50">
            {m === "explain" ? "Explain this lesson" : m === "quiz" ? "Quiz me" : "Summarise"}
          </button>
        ))}
      </div>
      {msgs.length > 0 && (
        <div className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-8 rounded-2xl bg-crimson/10 px-3 py-2 text-sm text-ink" : "mr-8 whitespace-pre-wrap rounded-2xl border border-rule px-3 py-2 text-sm text-ink"}>{m.content}</div>
          ))}
          {busy && <p className="mr-8 text-sm text-slate">Thinking…</p>}
          <div ref={end} />
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="mt-3 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={TUTOR_MESSAGE_MAX} placeholder={lang === "pcm" ? "Ask about dis lesson…" : lang === "sw" ? "Uliza kuhusu somo hili…" : "Ask about this lesson…"}
          className="min-w-0 flex-1 rounded-full border border-rule bg-card px-4 py-2 text-sm outline-none focus:border-crimson" aria-label="Your question" />
        <button disabled={busy || !text.trim()} className="btn-primary !px-5 !py-2 text-sm disabled:opacity-50">Ask</button>
      </form>
      {error && <p className="mt-2 text-xs text-crimson" role="alert">{error}</p>}
      <p className="mt-2 text-[11px] text-slate">{TUTOR_LANGUAGES_SOON.join(", ")} coming soon. Uses your Nana allowance (<Link href="/nana" className="underline">Nana</Link>). It never gives the answers to graded quizzes.</p>
    </section>
  );
}

// The teacher's card in the course editor: switch the tutor on for learners, and tell it what to keep in mind.
export function TutorSettingsCard({ courseId, canEdit, slug, firstLessonId }: { courseId: string; canEdit: boolean; slug: string; firstLessonId?: string }) {
  const [s, setS] = useState<TutorSettings | null>(null);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ settings: TutorSettings }>(`/api/academy/tutor?courseId=${encodeURIComponent(courseId)}`).then((r) => { setS(r.settings); setNotes(r.settings.notes); }).catch((e) => setMsg(e instanceof Error ? e.message : "Couldn't load."));
  }, [courseId]);
  async function save(on: boolean) {
    setBusy(true); setMsg("");
    try {
      const r = await api<{ settings: TutorSettings }>("/api/academy/tutor", { body: { action: "settings", courseId, on, notes } });
      setS(r.settings); setMsg(on ? "Saved. Your learners can now ask the tutor under every lesson." : "Saved. The tutor is off for learners.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save."); } finally { setBusy(false); }
  }
  return (
    <section className="card mt-6 p-5 sm:p-6">
      <h2 className="font-display text-2xl text-ink">Nana tutor</h2>
      <p className="mt-1 text-sm text-slate">A tutor for your learners that answers only from this course&apos;s lessons, in English, Pidgin or Kiswahili ({TUTOR_LANGUAGES_SOON.join(", ")} soon). It explains a lesson simply, quizzes learners one question at a time and summarises, and never gives away your graded quiz answers. It reads your reading lessons and your notes under videos; it can&apos;t see inside uploaded videos or PDFs, so add notes for those. Learners use their own Nana allowance.</p>
      {!s ? <p className="mt-3 text-sm text-slate">{msg || "Loading…"}</p> : (
        <>
          <label className="mt-4 block text-sm text-ink">What should the tutor keep in mind? <span className="text-slate">(optional: who your learners are, words to use, what to stress)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={TUTOR_NOTES_MAX} rows={4} disabled={!canEdit} className="mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson" placeholder="For example: My learners are SS2 students in rural schools; use farming examples; always remind them of the formula in Lesson 2." />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {canEdit && <button onClick={() => save(!s.on)} disabled={busy} className="btn-primary !py-2 text-sm disabled:opacity-50">{s.on ? "Switch the tutor off" : "Switch the tutor on"}</button>}
            {canEdit && s.on && <button onClick={() => save(true)} disabled={busy} className="rounded-full border border-rule px-4 py-2 font-ui text-sm font-semibold">Save notes</button>}
            <span className={`text-sm ${s.on ? "text-emerald-700" : "text-slate"}`}>{s.on ? "On for learners" : "Off"}</span>
            {firstLessonId && <Link href={`/academy/${slug}/${firstLessonId}`} className="text-sm text-crimson underline">Try it on a lesson</Link>}
          </div>
          {msg && <p className="mt-2 text-sm text-slate" role="status">{msg}</p>}
        </>
      )}
    </section>
  );
}

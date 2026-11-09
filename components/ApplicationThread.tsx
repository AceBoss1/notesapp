"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import Link from "next/link";
import { INTENT_MAX, REPLY_MAX, type AppKind, type Reply, type SendAs } from "@/lib/app-replies";
import { INTERVIEW_MINUTES, INTERVIEW_NOTE_MAX, interviewWhen, maxInterviewers, type Interview, type InterviewMode } from "@/lib/interviews";

// The conversation on one job application (lib/app-replies.ts). Reviewers choose who a reply is from (HR, Nana-HR or themselves) and can
// ask Nana-HR for a draft to edit; the applicant reads and replies. Opens on demand so a long list of applications stays light.
export function ApplicationThread({ kind, applicationId, startOpen = false }: { kind: AppKind; applicationId: string; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [data, setData] = useState<{ replies: Reply[]; reviewer: boolean; org: string; username: string; interviews: Interview[] } | null>(null);
  const [booking, setBooking] = useState(false);
  const [iv, setIv] = useState({ date: "", time: "10:00", minutes: 30, mode: "video" as InterviewMode, interviewers: "", note: "" });
  const [text, setText] = useState("");
  const [as, setAs] = useState<SendAs>("hr");
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const q = `kind=${kind}&id=${encodeURIComponent(applicationId)}`;
  useEffect(() => {
    if (!open || data) return;
    api<NonNullable<typeof data>>(`/api/applications/replies?${q}`).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the messages."));
  }, [open, data, q]);

  async function send() {
    if (!text.trim() || busy || !data) return;
    setBusy(true); setError("");
    try {
      const r = await api<{ reply: Reply }>("/api/applications/replies", { body: { action: "send", kind, id: applicationId, as, text } });
      setData({ ...data, replies: [...data.replies, r.reply] }); setText(""); setIntent("");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't send."); } finally { setBusy(false); }
  }
  const reload = () => api<NonNullable<typeof data>>(`/api/applications/replies?${q}`).then(setData);
  async function book() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api("/api/applications/replies", { body: { action: "interview", kind, id: applicationId, ...iv } });
      setBooking(false); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't book the interview."); } finally { setBusy(false); }
  }
  async function cancel(id: string) {
    if (busy || !confirm("Cancel this interview? The applicant is told.")) return;
    setBusy(true); setError("");
    try { await api("/api/applications/replies", { body: { action: "cancelInterview", interviewId: id } }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't cancel."); } finally { setBusy(false); }
  }
  async function draft() {
    if (!intent.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const r = await api<{ draft: string }>("/api/applications/replies", { body: { action: "draft", kind, id: applicationId, intent } });
      setText(r.draft);
    } catch (e) { setError(e instanceof Error ? e.message : "Nana-HR couldn't draft that."); } finally { setBusy(false); }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="mt-2 text-xs font-semibold text-crimson underline">Messages</button>;
  const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
  return (
    <div className="mt-3 rounded-xl border border-rule p-3 text-sm" aria-label="Messages about this application">
      {!data ? <p className="text-xs text-slate">{error || "Loading…"}</p> : (
        <>
          {data.interviews.filter((i) => i.status === "scheduled" && Date.parse(i.endAt) > Date.now()).map((i) => (
            <div key={i.id} className="mb-3 rounded-xl border border-crimson/40 bg-crimson/5 p-3">
              <p className="font-ui text-xs font-semibold uppercase tracking-wide text-crimson">Interview · {i.mode === "video" ? "video" : "voice"} call on NotesApp</p>
              <p className="mt-1 font-semibold text-ink">{interviewWhen(i)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Link href={`/messages/${i.roomId}`} className="btn-primary !px-4 !py-1.5 text-xs">Join the interview room</Link>
                {data.reviewer && <button onClick={() => cancel(i.id)} disabled={busy} className="text-xs text-slate underline">Cancel</button>}
              </div>
              <p className="mt-1 text-[11px] text-slate">Start the call from the room when it&apos;s time; everyone gets a reminder a day and an hour before.</p>
            </div>
          ))}
          {data.replies.length === 0
            ? <p className="text-xs text-slate">{data.reviewer ? "No messages yet. The applicant gets a bell when you write." : "No messages yet. You'll get a bell when the hiring team writes."}</p>
            : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {data.replies.map((r) => (
                  <div key={r.id} className={r.from === "applicant" ? "mr-8 rounded-xl border border-rule px-3 py-2" : "ml-8 rounded-xl bg-crimson/5 px-3 py-2"}>
                    <p className="text-[11px] font-semibold text-slate">{r.label}{data.reviewer && r.byUsername && r.from !== "me" && r.from !== "applicant" ? ` · sent by @${r.byUsername}` : ""} · {new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="mt-1 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{r.text}</p>
                  </div>
                ))}
              </div>
            )}
          {data.reviewer && !booking && <button onClick={() => setBooking(true)} className="mt-3 rounded-full border border-rule px-3 py-1 text-xs font-semibold">Schedule interview</button>}
          {data.reviewer && booking && (
            <div className="mt-3 grid gap-2 rounded-xl border border-rule p-3 text-xs sm:grid-cols-2">
              <p className="font-semibold text-ink sm:col-span-2">Schedule an interview on NotesApp (Lagos time)</p>
              <label>Date<input type="date" value={iv.date} onChange={(e) => setIv({ ...iv, date: e.target.value })} className={field} /></label>
              <label>Time<input type="time" value={iv.time} onChange={(e) => setIv({ ...iv, time: e.target.value })} className={field} /></label>
              <label>Length<select value={iv.minutes} onChange={(e) => setIv({ ...iv, minutes: Number(e.target.value) })} className={field}>{INTERVIEW_MINUTES.map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
              <label>Call<select value={iv.mode} onChange={(e) => setIv({ ...iv, mode: e.target.value as InterviewMode })} className={field}><option value="video">Video (you and up to {maxInterviewers("video") - 1} more)</option><option value="audio">Voice (you and up to {maxInterviewers("audio") - 1} more)</option></select></label>
              <label className="sm:col-span-2">Other interviewers (optional, from your hiring team)<input value={iv.interviewers} onChange={(e) => setIv({ ...iv, interviewers: e.target.value })} className={field} placeholder="@ada @wole" /></label>
              <label className="sm:col-span-2">Note for the applicant (optional)<input value={iv.note} maxLength={INTERVIEW_NOTE_MAX} onChange={(e) => setIv({ ...iv, note: e.target.value })} className={field} placeholder="What to prepare, who they'll meet" /></label>
              <div className="flex gap-2 sm:col-span-2">
                <button onClick={book} disabled={busy || !iv.date} className="btn-primary !px-4 !py-1.5 text-xs disabled:opacity-50">{busy ? "Booking…" : "Book and send the link"}</button>
                <button onClick={() => setBooking(false)} className="text-xs text-slate underline">Not now</button>
              </div>
              <p className="text-[11px] text-slate sm:col-span-2">The interview gets its own room in Messages with the applicant and the interviewers; the link goes in this conversation.</p>
            </div>
          )}
          {data.reviewer && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" role="group" aria-label="Send as">
              <span className="text-slate">Send as</span>
              {([["hr", `HR, ${data.org}`], ["nana", "Nana-HR"], ["me", data.username ? `@${data.username}` : "Me"]] as [SendAs, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setAs(k)} aria-pressed={as === k} disabled={k === "me" && !data.username}
                  className={`rounded-full px-3 py-1 font-semibold disabled:opacity-40 ${as === k ? "bg-crimson text-paper" : "border border-rule text-ink"}`}>{label}</button>
              ))}
            </div>
          )}
          {data.reviewer && as === "nana" && (
            <div className="mt-2 flex gap-2">
              <input value={intent} onChange={(e) => setIntent(e.target.value)} maxLength={INTENT_MAX} className={`${field} !mt-0`} placeholder="What should Nana-HR say? e.g. invite them to a 30-minute call on Tuesday at 10am" />
              <button onClick={draft} disabled={busy || !intent.trim()} className="shrink-0 rounded-full border border-rule px-3 py-1 text-xs font-semibold disabled:opacity-50">{busy ? "…" : "Draft"}</button>
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={REPLY_MAX} rows={3} className={field}
            placeholder={data.reviewer ? (as === "nana" ? "Nana-HR's draft appears here: read it and edit before you send." : "Write to the applicant…") : "Reply to the hiring team…"} />
          <div className="mt-2 flex items-center gap-3">
            <button onClick={send} disabled={busy || !text.trim()} className="btn-primary !px-5 !py-1.5 text-xs disabled:opacity-50">{busy ? "Sending…" : "Send"}</button>
            {data.reviewer && as === "nana" && <span className="text-[11px] text-slate">Nana-HR only drafts; you send it, so read it first.</span>}
          </div>
          {error && <p className="mt-2 text-xs text-crimson" role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { INTENT_MAX, REPLY_MAX, type AppKind, type Reply, type SendAs } from "@/lib/app-replies";

// The conversation on one job application (lib/app-replies.ts). Reviewers choose who a reply is from (HR, Nana-HR or themselves) and can
// ask Nana-HR for a draft to edit; the applicant reads and replies. Opens on demand so a long list of applications stays light.
export function ApplicationThread({ kind, applicationId, startOpen = false }: { kind: AppKind; applicationId: string; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [data, setData] = useState<{ replies: Reply[]; reviewer: boolean; org: string; username: string } | null>(null);
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
          {data.replies.length === 0
            ? <p className="text-xs text-slate">{data.reviewer ? "No messages yet. The applicant gets a bell when you write." : "No messages yet. You'll get a bell when the hiring team writes."}</p>
            : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {data.replies.map((r) => (
                  <div key={r.id} className={r.from === "applicant" ? "mr-8 rounded-xl border border-rule px-3 py-2" : "ml-8 rounded-xl bg-crimson/5 px-3 py-2"}>
                    <p className="text-[11px] font-semibold text-slate">{r.label}{data.reviewer && r.byUsername && r.from !== "me" && r.from !== "applicant" ? ` · sent by @${r.byUsername}` : ""} · {new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="mt-1 whitespace-pre-wrap text-ink">{r.text}</p>
                  </div>
                ))}
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

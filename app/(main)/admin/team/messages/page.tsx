"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { putFile, useAdminCall } from "@/lib/useAdminCall";
import { FILE_MAX_BYTES, MAX_FILES, MSG, type HubMessage } from "@/lib/staff-ops";

type Msg = HubMessage & { unread: boolean; canOpenFiles: boolean; box: "inbox" | "cc" | "sent" };
type Data = { messages: Msg[]; people: { uid: string; name: string }[]; names: Record<string, string>; unread: number; filesReady: boolean };
const field = "mt-1 block w-full rounded-lg border border-rule bg-card px-2 py-1.5 text-sm";
const btn = "rounded-full bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const blank = { to: [] as string[], cc: [] as string[], subject: "", body: "", alsoEmail: false };
const BOXES = [["inbox", "Inbox"], ["cc", "Copied to me"], ["sent", "Sent"]] as const;

// The message hub: internal messages between staff, with To and optional Cc and attachments. They always stay here; ones marked "Also send by email"
// are emailed too. Attachments go to the sender and the people in To; people copied (Cc) get the message but not the files, which is how personal
// material is kept personal.
export default function HubPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/hub");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState<"inbox" | "cc" | "sent">("inbox");
  const [form, setForm] = useState<typeof blank | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const load = useCallback(() => call().then(setData).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setError(""); setNote("");
    try {
      const prep = await call({ action: "prepare", files: files.map((f) => ({ name: f.name, size: f.size })) });
      for (let i = 0; i < files.length; i++) await putFile(prep.uploads[i].uploadUrl, prep.uploads[i].contentType, files[i]);
      const r = await call({ action: "send", id: prep.id, message: { ...form, attachments: prep.uploads.map((u: { key: string; name: string }) => ({ key: u.key, name: u.name })) } });
      setNote(form.alsoEmail ? `Sent. ${r.emailed} email${r.emailed === 1 ? "" : "s"} went out as well.` : "Sent.");
      setForm(null); setFiles([]); setBox("sent"); await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function toggle(m: Msg) {
    setOpenId(openId === m.id ? null : m.id);
    if (m.unread) { await call({ action: "read", id: m.id }).catch(() => {}); setData((d) => d && { ...d, unread: Math.max(0, d.unread - 1), messages: d.messages.map((x) => (x.id === m.id ? { ...x, unread: false } : x)) }); }
  }
  async function openFile(id: string, i: number) {
    try { const r = await call(undefined, `?file=${encodeURIComponent(id)}&i=${i}`); window.open(r.url, "_blank", "noopener"); } catch (e) { setError((e as Error).message); }
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const nameOf = (u: string) => data?.names[u] ?? "Someone";
  const list = (data?.messages ?? []).filter((m) => m.box === box);
  const who = (ids: string[], key: "to" | "cc") => ids.map(nameOf).join(", ") || (key === "cc" ? "" : "—");
  const set = (key: "to" | "cc", uid: string, on: boolean) => setForm((f) => f && { ...f, [key]: on ? [...f[key], uid] : f[key].filter((x) => x !== uid), ...(on ? { [key === "to" ? "cc" : "to"]: f[key === "to" ? "cc" : "to"].filter((x) => x !== uid) } : {}) });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/admin/team" className="font-ui text-xs font-semibold text-crimson">← Team hub</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Message hub</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">Messages between staff. They always stay here; tick <em>Also send by email</em> to email them as well. Files go to the people in <strong>To</strong>, not to people in Cc. Group conversations live in the <Link href="/messages" className="text-crimson underline">Team room</Link>.</p>
      {error && <p className="mt-4 whitespace-pre-line text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}
      {!data ? <p className="mt-8 text-slate">Loading…</p> : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {BOXES.map(([k, l]) => <button key={k} onClick={() => setBox(k)} className={`rounded-full border px-3 py-1 font-ui text-xs font-semibold ${box === k ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>{l}{k === "inbox" && data.unread ? ` (${data.unread})` : ""}</button>)}
            </div>
            {!form && <button className={btn} onClick={() => setForm({ ...blank })}>New message</button>}
          </div>

          {form && (
            <form className="mt-4 space-y-3 rounded-xl bg-paper p-4" onSubmit={send}>
              <fieldset className="text-xs"><legend className="font-semibold">To</legend>
                <div className="mt-1 flex flex-wrap gap-3">{data.people.map((p) => <label key={p.uid} className="inline-flex items-center gap-1.5"><input type="checkbox" checked={form.to.includes(p.uid)} onChange={(e) => set("to", p.uid, e.target.checked)} />{p.name}</label>)}</div>
              </fieldset>
              <fieldset className="text-xs"><legend className="font-semibold">Cc <span className="font-normal text-slate">(gets the message, not the files)</span></legend>
                <div className="mt-1 flex flex-wrap gap-3">{data.people.map((p) => <label key={p.uid} className="inline-flex items-center gap-1.5"><input type="checkbox" checked={form.cc.includes(p.uid)} onChange={(e) => set("cc", p.uid, e.target.checked)} />{p.name}</label>)}</div>
              </fieldset>
              <label className="block text-xs">Subject<input className={field} required maxLength={MSG.subject} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
              <label className="block text-xs">Message<textarea className={`${field} min-h-[8rem]`} required maxLength={MSG.body} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
              <div className="text-xs">
                <button type="button" className={ghost} disabled={!data.filesReady || files.length >= MAX_FILES} title={data.filesReady ? "" : "File storage isn't set up yet"} onClick={() => pick.current?.click()}>Attach files</button>
                <input ref={pick} type="file" multiple className="hidden" onChange={(e) => { const add = Array.from(e.target.files ?? []).filter((f) => f.size <= FILE_MAX_BYTES); setFiles((cur) => [...cur, ...add].slice(0, MAX_FILES)); if (pick.current) pick.current.value = ""; }} />
                {files.map((f, i) => <span key={i} className="ml-2 inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5">{f.name}<button type="button" aria-label={`Remove ${f.name}`} className="text-slate" onClick={() => setFiles(files.filter((_, n) => n !== i))}>✕</button></span>)}
              </div>
              <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={form.alsoEmail} onChange={(e) => setForm({ ...form, alsoEmail: e.target.checked })} /> Also send by email</label>
              <div className="flex gap-2"><button className={btn} disabled={busy || !form.to.length}>{busy ? "Sending…" : "Send"}</button><button type="button" className={ghost} onClick={() => { setForm(null); setFiles([]); }}>Cancel</button></div>
            </form>
          )}

          <ul className="mt-6 divide-y divide-rule border-y border-rule">
            {list.map((m) => (
              <li key={m.id}>
                <button onClick={() => toggle(m)} className="flex w-full flex-wrap items-baseline gap-x-3 px-1 py-3 text-left hover:bg-paper">
                  <span className={`min-w-0 flex-1 truncate text-sm ${m.unread ? "font-bold text-ink" : "text-ink"}`}>{m.unread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-crimson" aria-label="unread" />}{m.subject}</span>
                  <span className="text-xs text-slate">{m.box === "sent" ? `To ${who(m.to, "to")}` : m.fromName}</span>
                  <span className="text-xs text-slate">{when(m.createdAt)}</span>
                  {m.attachments.length > 0 && <span className="text-xs text-slate">📎 {m.attachments.length}</span>}
                </button>
                {openId === m.id && (
                  <div className="px-1 pb-4">
                    <p className="text-xs text-slate">From {m.fromName} · To {who(m.to, "to")}{m.cc.length ? ` · Cc ${who(m.cc, "cc")}` : ""}{m.alsoEmail ? ` · also emailed (${m.emailed})` : ""}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{m.body}</p>
                    {m.attachments.length > 0 && (m.canOpenFiles
                      ? <ul className="mt-3 space-y-1 text-sm">{m.attachments.map((a, i) => <li key={a.key}><button className="text-crimson underline" onClick={() => openFile(m.id, i)}>{a.name}</button></li>)}</ul>
                      : <p className="mt-3 text-xs text-slate">{m.attachments.length} file{m.attachments.length === 1 ? "" : "s"} went to the people in To. You were copied (Cc).</p>)}
                    {m.box !== "sent" && <p className="mt-3"><button className={ghost} onClick={() => { setForm({ ...blank, to: [m.fromUid], subject: m.subject.startsWith("Re: ") ? m.subject : `Re: ${m.subject}` }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Reply</button></p>}
                  </div>
                )}
              </li>
            ))}
            {list.length === 0 && <li className="py-4 text-sm text-slate">Nothing here.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

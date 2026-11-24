"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import Avatar from "@/components/Avatar";
import FormattedText from "@/components/messages/FormattedText";
import { stickerById } from "@/lib/stickers";
import { stripFormat } from "@/lib/message-format";
import { MESSAGE_MAX } from "@/lib/messages-rules";
import { OFFICIAL_PERSON } from "@/lib/official-account";
import type { InboxMessage, InboxRow } from "@/lib/official-inbox-server";

// Admin → #NotesApp inbox: read and answer what members write to the official account @na-notesapp (owner, 24 Nov 2026: "Set
// OFFICIAL_MESSAGES_USERNAME is #NotesApp: naapp.tech/u/na-notesapp"). Tournament winners reply here to confirm their details. Every
// answer goes out as @na-notesapp; who on the team wrote it shows here only (lib/official-inbox-server.ts).
type Thread = { id: string; memberUid: string; member: InboxRow["member"]; messages: InboxMessage[] };

const when = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export default function OfficialInboxPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/official-inbox");
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    call().then((j) => { setRows(j.rows); setUnread(j.unread); }).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the inbox"));
  }, [call]);
  const openThread = useCallback(async (id: string) => {
    setError("");
    try { setOpen(await call(undefined, `?id=${encodeURIComponent(id)}`)); reload(); } // opening it marks it read
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't open that conversation"); }
  }, [call, reload]);
  useEffect(() => { if (user) reload(); }, [user, reload]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [open]);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!open || !text.trim() || busy) return;
    setBusy(true); setError("");
    try { await call({ id: open.id, text }); setText(""); await openThread(open.id); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't send that"); }
    finally { setBusy(false); }
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <Link href="/admin" className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← Dashboard</Link>
      <p className="eyebrow mt-6">{rows ? (unread ? `${unread} unread` : "All read") : ""}</p>
      <h1 className="mt-3 font-display text-4xl">#NotesApp inbox</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate">
        What members write back to <Link href="/u/na-notesapp" className="text-crimson underline">@na-notesapp</Link>, the official account
        tournament winners are told from. Members can only reply where @na-notesapp wrote first. Your answer goes out as @na-notesapp;
        your name beside it shows to the team only.
      </p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <ul className={`card divide-y divide-rule ${open ? "max-lg:hidden" : ""}`}>
          {rows === null && <li className="p-5 text-sm text-slate">Loading…</li>}
          {rows?.length === 0 && <li className="p-5 text-sm text-slate">Nothing yet. Replies to @na-notesapp show here.</li>}
          {rows?.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => void openThread(r.id)} className={`flex w-full items-center gap-3 p-4 text-left hover:bg-paper ${open?.id === r.id ? "bg-paper" : ""}`}>
                <Avatar src={r.member.avatar} alt={r.member.displayName} size={40} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate font-ui text-sm ${r.unread ? "font-bold text-ink" : "font-semibold text-ink"}`}>
                      {r.member.displayName}{r.member.username && <span className="ml-1.5 font-normal text-slate">@{r.member.username}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate">{when(r.lastAt)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${r.unread ? "text-ink" : "text-slate"}`}>{r.lastFromMember ? "" : "You: "}{stripFormat(r.lastText)}</span>
                    {r.unread > 0 && <span className="shrink-0 rounded-full bg-crimson px-2 py-0.5 font-ui text-[10px] font-bold text-paper" aria-label={`${r.unread} unread`}>{r.unread}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className={`card flex min-h-[24rem] flex-col ${open ? "" : "max-lg:hidden"}`}>
          {!open ? <p className="m-auto p-6 text-sm text-slate">Pick a conversation.</p> : (
            <>
              <div className="flex items-center gap-3 border-b border-rule p-4">
                <button type="button" onClick={() => setOpen(null)} className="font-ui text-xs font-semibold text-crimson lg:hidden">← Back</button>
                <Avatar src={open.member.avatar} alt={open.member.displayName} size={36} className="shrink-0" />
                <div className="min-w-0">
                  <p className="truncate font-ui text-sm font-bold text-ink">{open.member.displayName}</p>
                  {open.member.username && <Link href={`/u/${open.member.username}`} className="text-xs text-slate hover:underline">@{open.member.username}</Link>}
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "60vh" }}>
                {open.messages.map((m) => {
                  const sticker = m.sticker ? stickerById(m.sticker) : undefined;
                  return (
                    <div key={m.id} className={`flex ${m.fromOfficial ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.fromOfficial ? "bg-crimson text-paper" : "bg-paper text-ink"}`}>
                        {m.removed ? <em className="opacity-80">Removed</em> : (
                          <>
                            {sticker && <Image src={sticker.src} alt={sticker.label} width={96} height={96} className="h-24 w-auto" />}
                            {m.files && <p className="opacity-90">{m.files} (not shown here)</p>}
                            {m.text && <div className="whitespace-pre-wrap break-words"><FormattedText text={m.text} /></div>}
                          </>
                        )}
                        <p className={`mt-1 text-[11px] ${m.fromOfficial ? "text-paper/80" : "text-slate"}`}>
                          {when(m.createdAt)}
                          {m.fromOfficial && (m.sentByAdmin ? ` · ${m.sentByAdmin.name}` : ` · ${OFFICIAL_PERSON.displayName}`)}
                          {m.fromOfficial && m.readAt ? " · Read" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={end} />
              </div>
              <form onSubmit={reply} className="flex items-end gap-2 border-t border-rule p-3">
                <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MESSAGE_MAX} rows={2} placeholder="Answer as @na-notesapp…"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                  className="min-w-0 flex-1 resize-none rounded-xl border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-crimson" />
                <button disabled={busy || !text.trim()} className="btn-primary !px-5 !py-2.5 text-xs disabled:opacity-60">{busy ? "Sending…" : "Send"}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

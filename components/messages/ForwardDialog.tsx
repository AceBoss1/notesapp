"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/moments-client";
import Avatar from "@/components/Avatar";
import GroupAvatar from "./GroupAvatar";
import { fold } from "@/lib/chat-tools";

type Chat = { id: string; kind: "direct" | "group"; with?: { username: string; displayName: string; avatar: string }; group?: { title: string; scope: string } };
const FORWARD_MAX = 5;

// Forward a message: tick up to five of your chats and send. Your own written message can also start a journal draft (someone else's
// words stay in the chat: quoting them in public needs their say-so).
export default function ForwardDialog({ cid, messageId, draftText, onDone, onClose }: { cid: string; messageId: string; draftText?: string; onDone: (note: string) => void; onClose: () => void }) {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api<{ conversations: Chat[] }>("/api/messages").then((r) => setChats(r.conversations)).catch((e) => setError(e.message)); }, []);
  const name = (c: Chat) => (c.kind === "group" ? c.group?.title ?? "Group" : c.with?.displayName ?? "Member");
  const shown = (chats ?? []).filter((c) => !q.trim() || fold(`${name(c)} ${c.with?.username ?? ""}`).includes(fold(q.trim().replace(/^@/, ""))));
  async function send() {
    setBusy(true); setError("");
    try {
      const r = await api<{ sent: string[]; failed: { id: string; error: string }[] }>(`/api/messages/${cid}`, { body: { action: "forward", messageId, to: picked } });
      if (r.failed.length) setError(r.failed.map((f) => `${name(chats!.find((c) => c.id === f.id) ?? ({} as Chat))}: ${f.error}`).join(" "));
      if (r.sent.length) { onDone(`Forwarded to ${r.sent.length} chat${r.sent.length === 1 ? "" : "s"}`); if (!r.failed.length) onClose(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't forward it."); }
    finally { setBusy(false); }
  }
  function toDraft() {
    try { sessionStorage.setItem("notesapp:chatDraft", JSON.stringify({ content: draftText ?? "" })); } catch {}
    window.location.href = "/write/new?from=chat";
  }
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/30 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Forward message" className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-display text-2xl text-ink">Forward to…</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-paper">×</button>
        </div>
        {draftText !== undefined && (
          <button type="button" onClick={toDraft} className="mx-5 mt-3 flex items-center gap-3 rounded-xl border border-crimson/30 bg-crimson/5 px-4 py-3 text-left hover:bg-crimson/10">
            <span aria-hidden="true" className="text-xl">📝</span>
            <span><span className="block font-ui text-sm font-bold text-crimson">Start a journal draft</span><span className="block text-xs text-slate">Your message becomes the start of a new journal entry. Nothing is published until you do.</span></span>
          </button>
        )}
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your chats" aria-label="Search your chats" className="mx-5 mt-3 rounded-full bg-paper px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-crimson/20" />
        <ul className="mt-2 min-h-0 flex-1 overflow-y-auto px-2">
          {chats === null && !error && <li className="px-3 py-4 text-sm text-slate">Loading your chats…</li>}
          {shown.map((c) => {
            const on = picked.includes(c.id);
            const full = !on && picked.length >= FORWARD_MAX;
            return (
              <li key={c.id}>
                <label className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${full ? "opacity-40" : "cursor-pointer hover:bg-paper"}`}>
                  {c.kind === "group" ? <GroupAvatar title={c.group?.title ?? "Group"} size={36} team={c.group?.scope === "team"} /> : <Avatar src={c.with?.avatar ?? ""} alt={name(c)} size={36} />}
                  <span className="min-w-0 flex-1"><span className="block truncate font-ui text-sm font-bold text-ink">{name(c)}</span>{c.with?.username && <span className="block text-xs text-slate">@{c.with.username}</span>}</span>
                  <input type="checkbox" checked={on} disabled={full} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))} className="h-5 w-5 accent-[#7A0328]" aria-label={`Forward to ${name(c)}`} />
                </label>
              </li>
            );
          })}
          {chats && !shown.length && <li className="px-3 py-4 text-sm text-slate">No chats match.</li>}
        </ul>
        {error && <p role="alert" className="px-5 pt-2 text-sm text-red-700">{error}</p>}
        <div className="flex items-center gap-3 border-t border-rule px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <span className="flex-1 text-xs text-slate">{picked.length ? `${picked.length} of up to ${FORWARD_MAX} chosen` : `Choose up to ${FORWARD_MAX} chats`}</span>
          <button type="button" disabled={!picked.length || busy} onClick={send} className="btn-primary !px-6 !py-2.5 text-sm disabled:opacity-50">{busy ? "Sending…" : "Forward"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

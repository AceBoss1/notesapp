"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { ATTACHMENT_ACCEPT, MESSAGE_MAX, attachmentTypeOf, formatBytes, type ThreadMessage } from "@/lib/messages-rules";
import { wrapSelection } from "@/lib/message-format";
import FormattedText from "./FormattedText";
import MessageAttachments from "./MessageAttachments";
import VoiceNoteButton from "./VoiceNoteButton";
import StickerPicker from "./StickerPicker";
import { stickerById } from "@/lib/stickers";
import { isMomentExpired } from "@/lib/moments-rules";
import ReportDialog from "@/components/moments/ReportDialog";

// "2:05 PM" today, "12 Oct, 2:05 PM" on another day.
const stamp = (iso: string) => {
  const d = new Date(iso);
  const t = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? t : `${d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}, ${t}`;
};

type Who = { uid: string; username: string; displayName: string; avatar: string };

// One conversation. `to` (a username) starts a new one; `id` opens an existing one. Replies to moments carry a small note:
// "Replied to a moment" while it's live, "…that has expired" after — the moment itself can't be opened once it's gone.
export default function Thread({ id, to }: { id?: string; to?: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cid, setCid] = useState(id);
  const [who, setWho] = useState<Who | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [allowed, setAllowed] = useState<{ maxBytes: number; maxCount: number; maxVoiceSeconds: number } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const voiceLength = useRef(new WeakMap<File, number>()); // how long each recorded voice note is
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [reporting, setReporting] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user) api<{ maxBytes: number; maxCount: number; maxVoiceSeconds: number }>("/api/messages/attachments").then(setAllowed).catch(() => {}); }, [user]);

  // Who it's with, and whether you've blocked them (this also marks the conversation read).
  const loadMeta = useCallback(() => {
    if (!user || !cid) return;
    api<{ with: Who; blockedByMe: boolean }>(`/api/messages/${cid}`).then((r) => { setWho(r.with); setBlockedByMe(r.blockedByMe); }).catch((e) => setError(e.message));
  }, [user, cid]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  // The messages themselves, live: they appear as they arrive. Only the two people in a conversation can read it (firestore.rules).
  useEffect(() => {
    if (!user || !cid) return;
    const uid = user.uid;
    return onSnapshot(
      query(collection(db, `conversations/${cid}/messages`), orderBy("createdAt", "desc"), limit(100)),
      (snap) => {
        const rows: ThreadMessage[] = snap.docs.reverse().map((d) => {
          const m = d.data();
          // A reply to a moment says whether the moment has expired; the moment itself is never in the message.
          return { id: d.id, from: m.from, text: m.text, createdAt: m.createdAt, ...(m.readAt ? { readAt: m.readAt } : {}), ...(m.sticker ? { sticker: m.sticker } : {}), ...(m.attachments ? { attachments: (m.attachments as { name: string; size: number; type: string; kind: "image" | "video" | "document" | "audio"; durationSec?: number }[]).map(({ name, size, type, kind, durationSec }) => ({ name, size, type, kind, ...(durationSec ? { durationSec } : {}) })) } : {}), ...(m.momentRef ? { moment: { momentId: m.momentRef.momentId, expired: isMomentExpired(m.momentRef.expiresAt) } } : {}) };
        });
        setMessages(rows);
        // Something new from them while this is open: it's read.
        if (snap.docChanges().some((c) => c.type === "added" && c.doc.data().from !== uid && !c.doc.metadata.hasPendingWrites)) api(`/api/messages/${cid}`, { method: "POST", body: {} }).catch(() => {});
      },
      (e) => setError(e.message)
    );
  }, [user, cid]);
  // Braces matter: an effect must return nothing or a clean-up function. Some browsers' scrollIntoView() now returns a Promise, and
  // returning it made React call it as a clean-up ("destroy is not a function"), which crashed the page.
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  function pick(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!attachmentTypeOf(f.name)) { setError(`${f.name}: that kind of file can't be sent. Pictures, videos, PDFs, Office files, text and zip files can.`); continue; }
      if (allowed && f.size > allowed.maxBytes) { setError(`${f.name} is ${formatBytes(f.size)}. Files can be up to ${formatBytes(allowed.maxBytes)} on your plan.`); continue; }
      if (allowed && next.length >= allowed.maxCount) { setError(`You can send ${allowed.maxCount} file${allowed.maxCount === 1 ? "" : "s"} in one message on your plan.`); break; }
      next.push(f);
    }
    setFiles(next);
    if (picker.current) picker.current.value = "";
  }

  // **bold**, _italic_ and __underline__ are typed as plain text; these buttons (and Ctrl/Cmd + B, I, U) add the marks around the selection.
  function format(marker: "**" | "_" | "__") {
    const el = box.current;
    if (!el) return;
    const r = wrapSelection(text, el.selectionStart, el.selectionEnd, marker);
    setText(r.value);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.selStart, r.selEnd); });
  }

  async function send() {
    setBusy(true); setError(null);
    try {
      // Files go straight to private storage first; the message then names them.
      const attachmentIds: string[] = [];
      for (const f of files) {
        const up = await api<{ id: string; uploadUrl: string; contentType: string }>("/api/messages/attachments", { body: { name: f.name, size: f.size, ...(voiceLength.current.get(f) ? { durationSec: voiceLength.current.get(f) } : {}) } });
        const put = await fetch(up.uploadUrl, { method: "PUT", headers: { "Content-Type": up.contentType }, body: f });
        if (!put.ok) throw new Error(`${f.name} didn't upload. Try again.`);
        attachmentIds.push(up.id);
      }
      const r = await api<{ conversationId: string }>("/api/messages", { body: to ? { toUsername: to, text, attachmentIds } : { toUid: who?.uid, text, attachmentIds } });
      setText(""); setFiles([]); setCid(r.conversationId);
      if (!id) window.history.replaceState(null, "", `/messages/${r.conversationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setBusy(false);
    }
  }

  // A sticker is sent the moment it is picked, as a message of its own.
  async function sendSticker(stickerId: string) {
    setBusy(true); setError(null);
    try {
      const r = await api<{ conversationId: string }>("/api/messages", { body: to ? { toUsername: to, text: "", sticker: stickerId } : { toUid: who?.uid, text: "", sticker: stickerId } });
      setCid(r.conversationId);
      if (!id) window.history.replaceState(null, "", `/messages/${r.conversationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setBusy(false);
    }
  }

  // A finished voice note joins the files waiting to be sent (it counts as one of them).
  function addVoiceNote(file: File, durationSec: number) {
    setError(null);
    if (allowed && files.length >= allowed.maxCount) { setError(`You can send ${allowed.maxCount} file${allowed.maxCount === 1 ? "" : "s"} in one message on your plan.`); return; }
    if (allowed && file.size > allowed.maxBytes) { setError(`That voice note is ${formatBytes(file.size)}. Files can be up to ${formatBytes(allowed.maxBytes)} on your plan.`); return; }
    voiceLength.current.set(file, durationSec);
    setFiles((f) => [...f, file]);
  }

  async function toggleBlock() {
    if (!who) return;
    if (!blockedByMe && !confirm(`Block ${who.displayName}? They won't be able to message you or see your moments, and you won't see theirs.`)) return;
    setError(null);
    try { await api("/api/messages/block", { body: { uid: who.uid, block: !blockedByMe } }); setBlockedByMe(!blockedByMe); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't update the block."); }
  }

  if (user === null) return <p className="text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to message.</p>;
  return (
    <div className="flex flex-col">
      <p className="mb-4 text-sm text-slate"><Link href="/messages" className="text-crimson underline">← Messages</Link>{who ? <> · <Link href={`/u/${who.username}`} className="font-bold text-ink">{who.displayName}</Link></> : to ? ` · @${to}` : ""}</p>
      {cid && who && (
        <p className="-mt-2 mb-4 flex gap-4 text-xs">
          <button onClick={toggleBlock} className="text-slate underline">{blockedByMe ? "Unblock" : "Block"}</button>
          <button onClick={() => setReporting(true)} className="text-slate underline">Report</button>
        </p>
      )}
      <div className="min-h-[40vh] space-y-2">
        {messages.map((m) => {
          const mine = m.from === user?.uid;
          const sticker = m.sticker ? stickerById(m.sticker) : undefined;
          if (sticker) {
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[60%]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sticker.src} alt={`${sticker.label} sticker`} className="h-28 w-28 object-contain" />
                  <p className={`flex gap-x-3 text-[11px] text-slate ${mine ? "justify-end" : ""}`}>
                    <span>{mine && <span aria-label="Sent">✔ </span>}{stamp(m.createdAt)}</span>
                    {mine && m.readAt && <span><span aria-label="Read">✔✔ </span>{stamp(m.readAt)}</span>}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-crimson text-white" : "bg-paper text-ink"}`}>
                {m.moment && (
                  <p className={`mb-1 text-xs italic ${mine ? "text-white/80" : "text-slate"}`}>
                    {m.moment.expired ? "Replied to a moment that has expired" : "Replied to a moment"}
                  </p>
                )}
                {m.attachments && cid && <MessageAttachments cid={cid} mid={m.id} files={m.attachments} mine={mine} />}
                {m.text && <p className="whitespace-pre-wrap break-words"><FormattedText text={m.text} /></p>}
                <p className={`mt-1 flex flex-wrap justify-end gap-x-3 text-[11px] ${mine ? "text-white/80" : "text-slate"}`}>
                  <span>{mine && <span aria-label="Sent">✔ </span>}{stamp(m.createdAt)}</span>
                  {mine && m.readAt && <span><span aria-label="Read">✔✔ </span>{stamp(m.readAt)}</span>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {blockedByMe && <p className="mt-3 text-sm text-slate">You&apos;ve blocked this member. Unblock them to send a message.</p>}
      {reporting && cid && <ReportDialog kind="conversation" targetId={cid} onClose={() => setReporting(false)} />}
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); if ((text.trim() || files.length) && !busy && !blockedByMe) send(); }}>
        <div className="mb-1 flex flex-wrap items-center gap-1 text-sm">
          <button type="button" onClick={() => format("**")} aria-label="Bold" title="Bold (Ctrl+B)" className="w-8 rounded border border-rule py-1 font-bold">B</button>
          <button type="button" onClick={() => format("_")} aria-label="Italic" title="Italic (Ctrl+I)" className="w-8 rounded border border-rule py-1 italic">I</button>
          <button type="button" onClick={() => format("__")} aria-label="Underline" title="Underline (Ctrl+U)" className="w-8 rounded border border-rule py-1 underline">U</button>
          <StickerPicker onPick={sendSticker} disabled={busy || blockedByMe} />
          <button type="button" onClick={() => picker.current?.click()} aria-label="Attach files" title="Attach pictures, videos, voice notes or documents" className="ml-1 rounded border border-rule px-3 py-1">📎 Attach</button>
          <input ref={picker} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />
          {allowed && <span className="ml-1 text-xs text-slate">up to {allowed.maxCount} file{allowed.maxCount === 1 ? "" : "s"}, {formatBytes(allowed.maxBytes)} each</span>}
        </div>
        {files.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2 text-xs">
            {files.map((f, k) => (
              <li key={k} className="flex items-center gap-2 rounded border border-rule px-2 py-1">
                <span className="max-w-[12rem] truncate">{voiceLength.current.has(f) ? `🎙 Voice note ${Math.floor(voiceLength.current.get(f)! / 60)}:${String(Math.floor(voiceLength.current.get(f)! % 60)).padStart(2, "0")}` : f.name}</span><span className="text-slate">{formatBytes(f.size)}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== k))} aria-label={`Remove ${f.name}`} className="text-slate">×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <textarea
            ref={box} value={text} rows={2} maxLength={MESSAGE_MAX} placeholder="Write a message" onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              const k = e.key.toLowerCase();
              if ((e.ctrlKey || e.metaKey) && (k === "b" || k === "i" || k === "u")) { e.preventDefault(); format(k === "b" ? "**" : k === "i" ? "_" : "__"); }
              else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
            }}
            className="min-w-0 flex-1 resize-y rounded border border-rule px-3 py-2 text-sm"
          />
          <VoiceNoteButton maxSeconds={allowed?.maxVoiceSeconds ?? 300} disabled={busy || blockedByMe} onRecorded={addVoiceNote} onError={setError} />
          <button disabled={busy || (!text.trim() && !files.length) || blockedByMe} className="btn-primary self-end disabled:opacity-50">{busy ? "Sending…" : "Send"}</button>
        </div>
      </form>
    </div>
  );
}

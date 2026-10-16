"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { conversationId, MESSAGE_MAX } from "@/lib/messages-rules";
import { firstUrl } from "@/lib/linkify";
import { SITE } from "@/lib/site";
import LinkedText from "@/components/LinkedText";
import LinkPreview from "@/components/LinkPreview";
import MentionPicker from "@/components/MentionPicker";

export type ChatFriend = { uid: string; username: string; name: string; avatar: string };
type Line = { id: string; from: string; text: string; createdAt: string; sticker?: string; attachments?: unknown[]; removed?: unknown };
type Gain = { after: string; text: string };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true });

// A chat with a friend (players who follow each other on NotesApp), inside the game. It is the same conversation as NotesApp Messages:
// the messages are read live from conversations/{cid}/messages (firestore.rules lets only the two people read it) and sent through
// POST /api/messages, with all the usual rules (blocks, rate limits, notifications). On phones it is a sheet over the game; on desktop
// it docks on the right and the game keeps running. onSent reports a sent message so the game can add Social (see CHAT_SOCIAL).
export default function FriendChat({ user, friend, here, where, social, gains, onSent, onClose }: {
  user: User;
  friend: ChatFriend;
  here: boolean;
  where: string;
  social: number;
  gains: Gain[];
  onSent: (messageId: string) => void;
  onClose: () => void;
}) {
  const cid = conversationId(user.uid, friend.uid);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  // Before the first message the conversation doesn't exist, so the live read is refused and stops; it starts again after a send.
  const [listen, setListen] = useState(0);
  const waiting = useRef(false);

  useEffect(() => {
    waiting.current = false;
    return onSnapshot(
      query(collection(db, `conversations/${cid}/messages`), orderBy("createdAt", "desc"), limit(40)),
      (snap) => {
        setLines(snap.docs.reverse().map((d) => ({ id: d.id, ...(d.data() as Omit<Line, "id">) })));
        // Something new from them while this is open: it's read (as in Messages).
        if (snap.docChanges().some((c) => c.type === "added" && c.doc.data().from !== user.uid && !c.doc.metadata.hasPendingWrites)) markRead();
      },
      // A conversation that doesn't exist yet can't be read: it starts with the first message.
      () => { waiting.current = true; setLines((cur) => cur ?? []); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, listen]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [lines, gains]);

  async function markRead() {
    try { await fetch(`/api/messages/${cid}`, { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, body: "{}" }); } catch { /* the badge clears next time */ }
  }
  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/messages", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ toUid: friend.uid, text: t }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send the message.");
      setText("");
      if (waiting.current) setListen((n) => n + 1);
      onSent(String(j.messageId ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the message.");
    } finally {
      setBusy(false);
    }
  }

  const first = friend.name.split(" ")[0];
  const what = (l: Line) => l.removed ? "This message was deleted" : l.text || (l.sticker ? "🖼 Sticker" : l.attachments?.length ? "📎 Attachment (open in Messages)" : "");
  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-30 flex max-h-[78%] flex-col rounded-[1.75rem] bg-white p-4 text-ink shadow-2xl lg:inset-x-auto lg:bottom-28 lg:right-6 lg:top-24 lg:max-h-none lg:w-[400px]">
      <div className="flex items-center gap-3 border-b pb-3">
        <span className="relative shrink-0">{friend.avatar ? <img src={friend.avatar} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-crimson text-sm font-bold text-white">{friend.name.slice(0, 2).toUpperCase()}</span>}<i className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" /></span>
        <div className="min-w-0 flex-1"><b className="block truncate leading-tight">{friend.name}</b><span className="text-[11px] text-slate">{here ? `Here with you · ${where}` : "Friend · you follow each other"}</span></div>
        <button onClick={onClose} aria-label="Close the chat" className="text-2xl leading-none text-slate">×</button>
      </div>
      <div ref={box} className="min-h-[8rem] flex-1 space-y-1.5 overflow-y-auto py-3 text-sm">
        {lines === null ? <p className="text-slate">Loading…</p> : lines.length === 0 ? <p className="text-slate">Say hello to {first}. It&apos;s the same chat as your NotesApp Messages.</p> : lines.map((l) => {
          const mine = l.from === user.uid;
          return (<div key={l.id} className="flex flex-col">
            <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 ${mine ? "self-end rounded-tr-sm bg-crimson text-white" : "rounded-tl-sm bg-[#f1f5f9]"}`}>{l.text && !l.removed ? <LinkedText text={l.text} format base={SITE.url} linkClass={mine ? "font-semibold text-white underline" : undefined} /> : what(l)}{l.text && !l.removed && firstUrl(l.text) && <LinkPreview url={firstUrl(l.text)!} user={user} mine={mine} />}<span className={`mt-0.5 block text-[10px] ${mine ? "text-white/70" : "text-slate"}`}>{time(l.createdAt)}</span></div>
            {gains.filter((g) => g.after === l.id).map((g, i) => <span key={i} className="mt-1 self-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">{g.text}</span>)}
          </div>);
        })}
      </div>
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate">💬 Social<span className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5e7eb]"><i className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(social)}%` }} /></span>{Math.round(social)}</div>
      {error && <p className="mt-1 text-xs text-crimson">{error}</p>}
      <form className="relative mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <MentionPicker target={field} value={text} onChange={(v) => setText(v.slice(0, MESSAGE_MAX))} place="above" />
        <input ref={field} value={text} onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX))} placeholder={`Message ${first}…`} className="min-w-0 flex-1 rounded-full border px-4 py-2.5 text-sm" />
        <button disabled={busy || !text.trim()} className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">Send</button>
      </form>
      <p className="mt-2 text-center text-[10px] text-slate">Also in your <a href={`/messages/${cid}`} target="_blank" rel="noreferrer" className="underline">NotesApp Messages</a> · only friends who follow each other</p>
    </div>
  );
}

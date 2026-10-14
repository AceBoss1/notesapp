"use client";

import NanaAssist from "@/components/NanaAssist";
import { DROP_RING, useFileDrop } from "@/lib/useFileDrop";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { ATTACHMENT_ACCEPT, MESSAGE_MAX, REMOVED_TEXT, attachmentTypeOf, formatBytes, type ThreadMessage } from "@/lib/messages-rules";
import { wrapSelection } from "@/lib/message-format";
import FormattedText from "./FormattedText";
import MessageAttachments from "./MessageAttachments";
import VoiceNoteButton from "./VoiceNoteButton";
import StickerPicker from "./StickerPicker";
import EmojiPicker from "./EmojiPicker";
import ProfileAvatar from "@/components/ProfileAvatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import TeamBadge from "@/components/TeamBadge";
import { badgeLevel, getUserByUid, goldKindOf, isTeamMember } from "@/lib/users";
import { stickerById } from "@/lib/stickers";
import { isMomentExpired } from "@/lib/moments-rules";
import ReportDialog from "@/components/moments/ReportDialog";
import GroupAvatar from "./GroupAvatar";
import ThreadHeader from "./ThreadHeader";
import { placeCall } from "@/components/calls/CallManager";
import { CALLS_LIVE } from "@/lib/moments-rules";
import { callLogText } from "@/lib/calls";
import Avatar from "@/components/Avatar";
import MomentViewer from "@/components/moments/MomentViewer";
import { MOMENTS_LIVE } from "@/lib/moments-rules";
import type { MomentView } from "@/lib/moments-server";
import GroupMembers, { type GroupMember } from "./GroupMembers";
import { isGroupId, type GroupInfo } from "@/lib/messages-rules";
import PresenceText from "@/components/PresenceText";
import { usePresence } from "@/lib/presence-client";

// "2:05 PM" today, "12 Oct, 2:05 PM" on another day.
const stamp = (iso: string) => {
  const d = new Date(iso);
  const t = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true });
  return d.toDateString() === new Date().toDateString() ? t : `${d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}, ${t}`;
};

// The divider above a new day: TODAY, YESTERDAY, or the date.
const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string): string {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}
const GROUP_GAP_MS = 5 * 60_000; // messages from one person within five minutes share one name line

type Person = { name: string; username: string; avatar: string; level: "verified" | "gold" | null; goldKind?: ReturnType<typeof goldKindOf>; team?: boolean; isOrg?: boolean };
type Who = { uid: string; username: string; displayName: string; avatar: string };

// One conversation. `to` (a username) starts a new one; `id` opens an existing one. Replies to moments carry a small note:
// "Replied to a moment" while it's live, "…that has expired" after — the moment itself can't be opened once it's gone.
export default function Thread({ id, to, embedded = false }: { id?: string; to?: string; embedded?: boolean }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cid, setCid] = useState(id);
  const [who, setWho] = useState<Who | null>(null);
  const [group, setGroup] = useState<(GroupInfo & { members: GroupMember[] }) | null>(null); // set when this is a group chat
  const [showMembers, setShowMembers] = useState(false);
  const [banned, setBanned] = useState<GroupMember[]>([]);
  const [muted, setMuted] = useState(false);
  const [moments, setMoments] = useState<MomentView[] | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [allowed, setAllowed] = useState<{ maxBytes: number; maxCount: number; maxVoiceSeconds: number } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const { dragging, bind } = useFileDrop((f) => pick(f), true);
  const voiceLength = useRef(new WeakMap<File, number>()); // how long each recorded voice note is
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportingMsg, setReportingMsg] = useState<string | null>(null); // a message in a group
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [editing, setEditing] = useState<ThreadMessage | null>(null); // your message being edited in the box
  const [menuFor, setMenuFor] = useState<string | null>(null); // the message whose ⋯ menu is open
  const [pinned, setPinned] = useState<{ id: string; by: string; at: string }[]>([]);
  const [typing, setTyping] = useState<Record<string, number>>({}); // who else is typing, and when they last typed
  const [, setTick] = useState(0);
  const lastTyped = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const presence = usePresence(who && !group && who.uid && who.uid !== user?.uid ? [who.uid] : []);
  const isGroup = !!group || (!!cid && isGroupId(cid)); // known from the id, so a message sent before the details arrive still goes to the group
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user) api<{ maxBytes: number; maxCount: number; maxVoiceSeconds: number }>("/api/messages/attachments").then(setAllowed).catch(() => {}); }, [user]);

  // Who it's with, and whether you've blocked them (this also marks the conversation read).
  const loadMeta = useCallback(() => {
    if (!user || !cid) return;
    api<{ kind: "direct" | "group"; with?: Who; blockedByMe?: boolean; muted?: boolean; group?: GroupInfo; members?: GroupMember[]; banned?: GroupMember[] }>(`/api/messages/${cid}`).then((r) => {
      setMuted(r.muted === true);
      if (r.kind === "group" && r.group) { setGroup({ ...r.group, members: r.members ?? [] }); setBanned(r.banned ?? []); return; }
      if (r.with) { setWho(r.with); setBlockedByMe(r.blockedByMe === true); }
    }).catch((e) => setError(e.message));
  }, [user, cid]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  // Names, pictures and badges for both people (the badge shows beside the name, as everywhere else).
  // A group: everyone in it, so each message shows its sender.
  useEffect(() => {
    if (!user || !group) return;
    let live = true;
    Promise.all(group.members.map((m) => getUserByUid(m.uid).catch(() => null))).then((profiles) => {
      if (!live) return;
      setPeople(Object.fromEntries(group.members.map((m, i) => {
        const p = profiles[i];
        return [m.uid, p ? { name: p.displayName, username: p.username, avatar: p.avatar, level: badgeLevel(p), goldKind: goldKindOf(p), team: isTeamMember(p), isOrg: p.accountKind === "organisation" } : { name: m.displayName, username: m.username, avatar: m.avatar, level: null }];
      })));
    });
    return () => { live = false; };
  }, [user, group]);

  useEffect(() => {
    if (!user || !who) return;
    let live = true;
    Promise.all([getUserByUid(user.uid).catch(() => null), getUserByUid(who.uid).catch(() => null)]).then(([me, them]) => {
      if (!live) return;
      const make = (p: Awaited<ReturnType<typeof getUserByUid>>, fallback: { name: string; username: string; avatar: string }): Person =>
        p ? { name: p.displayName, username: p.username, avatar: p.avatar, level: badgeLevel(p), goldKind: goldKindOf(p), team: isTeamMember(p), isOrg: p.accountKind === "organisation" } : { ...fallback, level: null };
      setPeople({
        [user.uid]: make(me, { name: user.displayName || "You", username: "", avatar: "" }),
        [who.uid]: make(them, { name: who.displayName, username: who.username, avatar: who.avatar }),
      });
    });
    return () => { live = false; };
  }, [user, who]);

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
          return { id: d.id, from: m.from, text: m.text, createdAt: m.createdAt, ...(m.readAt ? { readAt: m.readAt } : {}), ...(m.call ? { call: m.call } : {}), ...(m.removed ? { removed: m.removed } : {}), ...(m.editedAt ? { editedAt: m.editedAt } : {}), ...(m.deleted ? { deleted: m.deleted } : {}), ...(m.pendingRequest ? { pendingRequest: m.pendingRequest } : {}), ...(m.sticker ? { sticker: m.sticker } : {}), ...(m.replyTo ? { replyTo: m.replyTo } : {}), ...(m.attachments ? { attachments: (m.attachments as { name: string; size: number; type: string; kind: "image" | "video" | "document" | "audio"; durationSec?: number }[]).map(({ name, size, type, kind, durationSec }) => ({ name, size, type, kind, ...(durationSec ? { durationSec } : {}) })) } : {}), ...(m.momentRef ? { moment: { momentId: m.momentRef.momentId, expired: isMomentExpired(m.momentRef.expiresAt) } } : {}) };
        });
        setMessages(rows);
        // Something new from them while this is open: it's read.
        if (snap.docChanges().some((c) => c.type === "added" && c.doc.data().from !== uid && !c.doc.metadata.hasPendingWrites)) api(`/api/messages/${cid}`, { method: "POST", body: {} }).catch(() => {});
      },
      (e) => setError(e.message)
    );
  }, [user, cid]);
  // Pinned messages (on the conversation, the same for everyone in it) and who is typing (conversations/{cid}/typing/{uid}).
  useEffect(() => {
    if (!user || !cid) return;
    const uid = user.uid;
    const a = onSnapshot(doc(db, "conversations", cid), (d) => setPinned((d.data()?.pinned as { id: string; by: string; at: string }[] | undefined) ?? []), () => {});
    const b = onSnapshot(collection(db, `conversations/${cid}/typing`), (snap) => setTyping(Object.fromEntries(snap.docs.filter((d) => d.id !== uid).map((d) => [d.id, Number(d.data().at) || 0]))), () => {});
    const t = setInterval(() => setTick((n) => n + 1), 2000); // "typing…" fades by itself
    return () => { a(); b(); clearInterval(t); if (lastTyped.current) deleteDoc(doc(db, `conversations/${cid}/typing/${uid}`)).catch(() => {}); };
  }, [user, cid]);
  // Telling the others you're typing: at most every 3 seconds while you type; cleared when you send.
  function typed(v: string) {
    setText(v);
    if (!user || !cid || editing) return;
    const now = Date.now();
    if (v && now - lastTyped.current > 3000) { lastTyped.current = now; setDoc(doc(db, `conversations/${cid}/typing/${user.uid}`), { at: now }).catch(() => {}); }
  }
  function stopTyping() { if (user && cid && lastTyped.current) { lastTyped.current = 0; deleteDoc(doc(db, `conversations/${cid}/typing/${user.uid}`)).catch(() => {}); } }
  const typers = Object.entries(typing).filter(([, at]) => Date.now() - at < 7000).map(([u]) => u);

  async function msgAction(body: Record<string, unknown>, ok?: (r: Record<string, unknown>) => void) {
    if (!cid) return;
    setError(null); setMenuFor(null);
    try { const r = await api<Record<string, unknown>>(`/api/messages/${cid}`, { body }); ok?.(r); }
    catch (e) { setError(e instanceof Error ? e.message : "That didn't work."); }
  }
  const pinMsg = (m: ThreadMessage, pin: boolean) => msgAction({ action: "pin", messageId: m.id, pin });
  const deleteMsg = (m: ThreadMessage) => {
    if (!confirm(m.readAt || isGroup ? "Delete this message? If it has been read, the people who read it are asked to agree first." : "Delete this message for everyone?")) return;
    void msgAction({ action: "delete", messageId: m.id }, (r) => { if (r.done === false) setError(`Waiting for ${Number(r.waitingFor) === 1 ? "the reader" : `${r.waitingFor} readers`} to agree. The request ends after 30 days.`); });
  };
  const startEdit = (m: ThreadMessage) => { setMenuFor(null); setReplyingTo(null); setEditing(m); setText(m.text); setTimeout(() => box.current?.focus(), 0); };
  async function saveEdit() {
    if (!editing) return;
    const m = editing;
    await msgAction({ action: "edit", messageId: m.id, text }, (r) => {
      setEditing(null); setText("");
      if (r.done === false) setError(`Your edit is waiting for ${Number(r.waitingFor) === 1 ? "the reader" : `${r.waitingFor} readers`} to agree. The request ends after 30 days.`);
    });
  }
  const answer = (requestId: string, a: "allow" | "decline" | "withdraw") => msgAction({ action: "request", requestId, answer: a });

  // Braces matter: an effect must return nothing or a clean-up function. Some browsers' scrollIntoView() now returns a Promise, and
  // returning it made React call it as a clean-up ("destroy is not a function"), which crashed the page.
  useEffect(() => {
    // On a wide screen the messages scroll inside their own box: move that box to the newest message and leave the page where it is.
    const box = end.current?.parentElement;
    if (box && getComputedStyle(box).overflowY === "auto") box.scrollTop = box.scrollHeight;
    else end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function pick(list: FileList | File[] | null) {
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

  // An emoji goes in where the cursor is (replacing any selected text), and the cursor lands just after it.
  function insertEmoji(emoji: string) {
    const el = box.current;
    const start = el?.selectionStart ?? text.length, end = el?.selectionEnd ?? text.length;
    if (text.length + emoji.length > MESSAGE_MAX) return;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + emoji.length, start + emoji.length); });
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
      const r = await api<{ conversationId: string }>("/api/messages", { body: isGroup ? { conversationId: cid, text, attachmentIds, replyToId: replyingTo?.id } : to ? { toUsername: to, text, attachmentIds, replyToId: replyingTo?.id } : { toUid: who?.uid, text, attachmentIds, replyToId: replyingTo?.id } });
      setText(""); setFiles([]); setReplyingTo(null); setCid(r.conversationId); stopTyping();
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
      const r = await api<{ conversationId: string }>("/api/messages", { body: isGroup ? { conversationId: cid, text: "", sticker: stickerId } : to ? { toUsername: to, text: "", sticker: stickerId } : { toUid: who?.uid, text: "", sticker: stickerId } });
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

  async function toggleMute() {
    if (!cid) return;
    try { await api(`/api/messages/${cid}`, { body: { action: "mute", muted: !muted } }); setMuted(!muted); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't change that."); }
  }
  async function removeMessage(msg: ThreadMessage) {
    if (!cid || !confirm("Remove this message from the group? Everyone will see \"Message removed by a group admin\" in its place, and any files in it are deleted.")) return;
    try { await api(`/api/messages/groups/${cid}`, { body: { action: "remove_message", messageId: msg.id } }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove the message."); }
  }

  async function viewMoments() {
    if (!who) return;
    try {
      const r = await api<{ moments: MomentView[] }>(`/api/moments?username=${encodeURIComponent(who.username)}`);
      if (r.moments.length) setMoments(r.moments); else setError(`${who.displayName} has no moments you can see right now.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't open their moments."); }
  }

  if (user === null) return <p className="text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to message.</p>;
  return (
    <div className={`relative flex flex-col ${embedded ? "" : "lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]"} ${dragging ? DROP_RING : ""}`} {...bind}>
      {dragging && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded bg-paper/80 font-ui text-sm font-bold text-crimson">Drop to attach</div>}
      {group ? (
        <ThreadHeader
          back={!embedded ? <Link href="/messages" className="text-crimson underline">← Messages</Link> : undefined}
          avatar={<GroupAvatar title={group.title} size={48} team={group.scope === "team"} src={group.avatar} />}
          title={<>{group.title}{group.scope === "team" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">TEAM</span>}</>}
          subtitle={<>{group.scope === "team" ? "Team room" : "Group"} · {group.members.length.toLocaleString("en-NG")} member{group.members.length === 1 ? "" : "s"}{group.sendLocked ? " · only admins can send" : ""}</>}
          actions={group.adminUids.includes(user?.uid ?? "") && group.scope !== "team" ? (
            <button type="button" onClick={() => setShowMembers(true)} title="Manage the group: members, admins, bans, who can send, picture" className="rounded-full border border-crimson/40 px-3 py-1.5 font-ui text-xs font-semibold text-crimson hover:bg-crimson/5">⚙️ Manage</button>
          ) : undefined}
          items={[
            { label: "Members", icon: "👥", onClick: () => setShowMembers(true) },
            { label: group.adminUids.includes(user?.uid ?? "") && group.scope !== "team" ? "Group settings" : "", icon: "⚙️", onClick: () => setShowMembers(true), hidden: !(group.adminUids.includes(user?.uid ?? "") && group.scope !== "team") },
            { label: "Create group", icon: "➕", href: "/messages/new-group", divider: true },
            { label: muted ? "Unmute notifications" : "Mute notifications", icon: muted ? "🔔" : "🔕", onClick: toggleMute },
            { label: "Leave group", icon: "↪", danger: true, hidden: group.scope === "team", onClick: () => { if (confirm("Leave this group? You won't see its messages any more.")) api(`/api/messages/groups/${cid}`, { body: { action: "leave" } }).then(() => { window.location.href = "/messages"; }).catch((e) => setError(e.message)); } },
          ]}
        />
      ) : who ? (
        <ThreadHeader
          back={!embedded ? <Link href="/messages" className="text-crimson underline">← Messages</Link> : undefined}
          avatar={<Link href={`/u/${who.username}`}><Avatar src={who.avatar} alt={who.displayName} size={48} square={!!people[who.uid]?.isOrg} /></Link>}
          title={<><Link href={`/u/${who.username}`} className="hover:underline">{people[who.uid]?.name || who.displayName}</Link>{people[who.uid]?.level && <VerifiedBadge size={16} level={people[who.uid]!.level} goldKind={people[who.uid]!.goldKind} />}{people[who.uid]?.team && <TeamBadge size={16} />}</>}
          subtitle={presence.statuses[who.uid] ? <PresenceText status={presence.statuses[who.uid]} /> : <span>@{who.username}</span>}
          actions={CALLS_LIVE && !blockedByMe ? (
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => placeCall({ toUid: who.uid, kind: "audio", name: people[who.uid]?.name || who.displayName, avatar: who.avatar })} aria-label={`Voice call ${who.displayName}`} title="Voice call (free)" className="flex h-9 w-9 items-center justify-center rounded-full text-crimson hover:bg-paper">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" /></svg>
              </button>
              <button type="button" onClick={() => placeCall({ toUid: who.uid, kind: "video", name: people[who.uid]?.name || who.displayName, avatar: who.avatar })} aria-label={`Video call ${who.displayName}`} title="Video call (free)" className="flex h-9 w-9 items-center justify-center rounded-full text-crimson hover:bg-paper">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 6h11a2 2 0 012 2v1.6l3.4-2.3A1 1 0 0122 8.1v7.8a1 1 0 01-1.6.8L17 14.4V16a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /></svg>
              </button>
            </span>
          ) : undefined}
          items={[
            { label: "View profile", icon: "👤", href: `/u/${who.username}` },
            { label: "View moments", icon: "✨", onClick: viewMoments, hidden: !MOMENTS_LIVE },
            { label: "Create group", icon: "➕", href: "/messages/new-group", divider: true },
            { label: muted ? "Unmute notifications" : "Mute notifications", icon: muted ? "🔔" : "🔕", onClick: toggleMute },
            { label: blockedByMe ? "Unblock" : "Block", icon: "⛔", onClick: toggleBlock, danger: !blockedByMe },
            { label: "Report", icon: "⚑", onClick: () => setReporting(true), danger: true },
          ]}
        />
      ) : (
        <p className="mb-4 text-sm text-slate"><Link href="/messages" className="text-crimson underline">← Messages</Link>{to ? ` · @${to}` : ""}</p>
      )}
      {group && showMembers && cid && user && <GroupMembers cid={cid} group={group} members={group.members} banned={banned} meUid={user.uid} onChanged={loadMeta} onLeft={() => { window.location.href = "/messages"; }} />}
      {pinned.length > 0 && (
        <div className="mb-2 space-y-1 rounded-lg border border-rule bg-paper p-2 text-xs">
          {pinned.map((p) => { const pm = messages.find((x) => x.id === p.id); return (
            <div key={p.id} className="flex items-center gap-2">
              <button type="button" onClick={() => document.getElementById(`m-${p.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" })} className="min-w-0 flex-1 truncate text-left"><span aria-hidden="true">📌 </span><strong>{(people[pm?.from ?? ""]?.name || "Message").split(" ")[0]}:</strong> {pm ? (pm.text || (pm.attachments?.length ? "📎 Attachment" : pm.sticker ? "🖼 Sticker" : "…")) : "an earlier message"}</button>
              {(!isGroup || group?.adminUids.includes(user?.uid ?? "")) && <button type="button" onClick={() => pm && pinMsg(pm, false)} disabled={!pm} aria-label="Unpin" title="Unpin" className="text-slate hover:text-crimson">×</button>}
            </div>
          ); })}
        </div>
      )}
      <div className={`min-h-[40vh] space-y-1 ${embedded ? "" : "lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2"}`}>
        {messages.map((m, idx) => {
          const mine = m.from === user?.uid;
          const person = people[m.from];
          const prev = messages[idx - 1];
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const newGroup = newDay || prev.from !== m.from || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS;
          const sticker = m.sticker ? stickerById(m.sticker) : undefined;
          const quoted = m.replyTo ? people[m.replyTo.from] : undefined;
          const replyButton = (msg: ThreadMessage) => !blockedByMe && (
            <button type="button" onClick={() => { setReplyingTo(msg); box.current?.focus(); }} className="font-bold opacity-80 hover:opacity-100" aria-label="Reply to this message" title="Reply">↩ Reply</button>
          );
          const reportButton = (msg: ThreadMessage) => isGroup && msg.from !== user?.uid && (
            <button type="button" onClick={() => setReportingMsg(msg.id)} className="opacity-80 hover:opacity-100" aria-label="Report this message">Report</button>
          );
          const firstName = (p?: Person) => (p?.name || "").split(" ")[0] || "Member";
          // Group admins can take any message out of the group (it is replaced by "Message removed by a group admin").
          const amGroupAdmin = !!group && group.adminUids.includes(user?.uid ?? "");
          const removeButton = (msg: ThreadMessage) => amGroupAdmin && !msg.removed && (
            <button type="button" onClick={() => removeMessage(msg)} className="opacity-80 hover:opacity-100" aria-label="Remove this message from the group">Remove</button>
          );
          // ⋯ : pin, edit and delete (your own), report and remove, in one small menu.
          const isPinned = pinned.some((p) => p.id === m.id);
          const canPin = !blockedByMe && (!isGroup || amGroupAdmin);
          const moreMenu = (msg: ThreadMessage) => (
            <span className="relative">
              <button type="button" onClick={() => setMenuFor(menuFor === msg.id ? null : msg.id)} className="px-1 font-bold opacity-80 hover:opacity-100" aria-label="More actions for this message" aria-expanded={menuFor === msg.id}>⋯</button>
              {menuFor === msg.id && (
                <span className={`absolute bottom-6 z-20 flex w-40 flex-col rounded-lg border border-rule bg-card py-1 text-left text-xs text-ink shadow-xl ${mine ? "right-0" : "left-0"}`}>
                  {canPin && <button type="button" onClick={() => pinMsg(msg, !isPinned)} className="px-3 py-1.5 text-left hover:bg-paper">📌 {isPinned ? "Unpin" : "Pin"}</button>}
                  {mine && !msg.pendingRequest && msg.text && <button type="button" onClick={() => startEdit(msg)} className="px-3 py-1.5 text-left hover:bg-paper">✏️ Edit</button>}
                  {mine && !msg.pendingRequest && <button type="button" onClick={() => deleteMsg(msg)} className="px-3 py-1.5 text-left text-red-700 hover:bg-paper">🗑 Delete</button>}
                  {isGroup && msg.from !== user?.uid && <button type="button" onClick={() => { setMenuFor(null); setReportingMsg(msg.id); }} className="px-3 py-1.5 text-left hover:bg-paper">⚑ Report</button>}
                  {amGroupAdmin && !msg.removed && <button type="button" onClick={() => { setMenuFor(null); void removeMessage(msg); }} className="px-3 py-1.5 text-left text-red-700 hover:bg-paper">🚫 Remove (admin)</button>}
                </span>
              )}
            </span>
          );
          // Waiting for consent: the sender sees who it's waiting for; each reader who hasn't answered can allow or decline.
          const pending = (msg: ThreadMessage) => {
            const r = msg.pendingRequest; if (!r) return null;
            const iMustAnswer = r.readers.includes(user?.uid ?? "") && !r.approved.includes(user?.uid ?? "");
            return (
              <div className={`mt-1 max-w-full rounded-lg border px-2 py-1.5 text-xs ${mine ? "border-amber-300 bg-amber-50 text-amber-900" : "border-crimson/30 bg-crimson/5 text-ink"}`}>
                {mine ? <>⏳ Asked to {r.kind} · waiting for {r.readers.length - r.approved.length} of {r.readers.length} to agree · <button type="button" onClick={() => answer(r.id, "withdraw")} className="font-bold underline">Withdraw</button></>
                  : <>{firstName(person)} asks to {r.kind === "edit" ? <>change this message to: <q className="italic">{r.text}</q></> : "delete this message"}.{iMustAnswer ? <span className="ml-1 inline-flex gap-2"><button type="button" onClick={() => answer(r.id, "allow")} className="font-bold text-green-700 underline">Allow</button><button type="button" onClick={() => answer(r.id, "decline")} className="font-bold text-red-700 underline">Decline</button></span> : " You agreed."}</>}
              </div>
            );
          };
          if (m.deleted) return (
            <div key={m.id} id={`m-${m.id}`} className={`my-2 flex ${mine ? "justify-end" : "justify-start"}`}>
              <span className="rounded-lg border border-dashed border-rule px-3 py-1.5 text-xs italic text-slate">🗑 {mine ? "You deleted this message" : "This message was deleted"} · {stamp(m.createdAt)}</span>
            </div>
          );
          if (m.removed) return (
            <div key={m.id} id={`m-${m.id}`} className={`my-2 flex ${mine ? "justify-end" : "justify-start"}`}>
              <span className="rounded-lg border border-dashed border-rule px-3 py-1.5 text-xs italic text-slate">🚫 {REMOVED_TEXT[m.removed.by]}{!mine && person?.name ? ` (was from ${firstName(person)})` : ""} · {stamp(m.createdAt)}</span>
            </div>
          );
          if (m.call) {
            const callCls = `rounded-full border px-3 py-1 text-xs ${m.call.outcome === "missed" && !mine ? "border-crimson/40 bg-crimson/5 text-crimson" : "border-rule bg-paper text-slate"}`;
            const callLine = <>📞 {m.call.outcome === "missed" && mine ? `${m.call.kind === "video" ? "Video" : "Voice"} call · no answer` : callLogText(m.call)} · {stamp(m.createdAt)}</>;
            // In a one-to-one chat, tapping a call line calls back, the same kind of call (voice or video).
            const kind = m.call.kind;
            const canRedial = CALLS_LIVE && !blockedByMe && !isGroup && !!who;
            return (
              <div key={m.id} className="my-3 flex justify-center">
                {canRedial ? (
                  <button type="button" onClick={() => placeCall({ toUid: who!.uid, kind, name: people[who!.uid]?.name || who!.displayName, avatar: who!.avatar })} title={`Tap to ${kind === "video" ? "video" : "voice"} call back`} aria-label={`${kind === "video" ? "Video" : "Voice"} call ${who!.displayName} back`} className={`${callCls} hover:border-crimson hover:text-crimson`}>
                    {callLine} · <span className="font-semibold underline">Call back</span>
                  </button>
                ) : <span className={callCls}>{callLine}</span>}
              </div>
            );
          }
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-5 flex items-center gap-4" role="separator" aria-label={dayLabel(m.createdAt)}>
                  <span className="h-px flex-1 bg-rule" />
                  <span className="font-ui text-xs font-semibold uppercase tracking-eyebrow text-slate">{dayLabel(m.createdAt)}</span>
                  <span className="h-px flex-1 bg-rule" />
                </div>
              )}
              <div id={`m-${m.id}`} className={`flex items-start gap-2 ${mine ? "flex-row-reverse" : ""} ${newGroup ? "mt-4" : "mt-1"}`}>
                <ProfileAvatar username={person?.username || (mine ? "" : who?.username ?? "")} src={person?.avatar ?? ""} alt={person?.name ?? ""} size={32} square={!!person?.isOrg} from="chat" />
                <div className={`flex min-w-0 max-w-[80%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  {newGroup && (
                    <p className="mb-1 flex items-center gap-1.5 font-ui text-sm font-bold text-ink">
                      {person?.name ?? ""}
                      {person?.level && <VerifiedBadge size={14} level={person.level} goldKind={person.goldKind} />}
                      {person?.team && <TeamBadge size={14} />}
                    </p>
                  )}
                  {sticker ? (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sticker.src} alt={`${sticker.label} sticker`} className={sticker.wide ? "h-auto w-56 max-w-full object-contain" : "h-28 w-28 object-contain"} />
                      <p className={`flex gap-x-3 text-[11px] text-slate ${mine ? "justify-end" : ""}`}>
                        <span>{mine && <span aria-label="Sent">✔ </span>}{stamp(m.createdAt)}</span>
                        {mine && m.readAt && <span><span aria-label="Read">✔✔ </span>{stamp(m.readAt)}</span>}
                        {replyButton(m)}
                        {moreMenu(m)}
                      </p>
                      {pending(m)}
                    </div>
                  ) : (<>
                    <div className={`rounded-lg px-3 py-2 text-sm ${mine ? "bg-crimson text-white" : "border border-rule bg-card text-ink"}`}>
                      {m.replyTo && (
                        <button
                          type="button"
                          onClick={() => document.getElementById(`m-${m.replyTo!.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" })}
                          className={`mb-2 block w-full border-l-4 pl-2 text-left text-xs ${mine ? "border-white/60 text-white/85" : "border-crimson text-slate"}`}
                          aria-label="Go to the message this answers"
                        >
                          <span className="line-clamp-3 whitespace-pre-wrap"><strong>{firstName(quoted)}:</strong> {(m.replyTo.text || "…").replace(/\n{2,}/g, "\n")}</span>
                        </button>
                      )}
                      {m.moment && (
                        <p className={`mb-1 text-xs italic ${mine ? "text-white/80" : "text-slate"}`}>
                          {m.moment.expired ? "Replied to a moment that has expired" : "Replied to a moment"}
                        </p>
                      )}
                      {m.attachments && cid && <MessageAttachments cid={cid} mid={m.id} files={m.attachments} mine={mine} />}
                      {m.text && <p className="whitespace-pre-wrap break-words"><FormattedText text={m.text} /></p>}
                      <p className={`mt-1 flex flex-wrap items-center justify-end gap-x-3 text-[11px] ${mine ? "text-white/80" : "text-slate"}`}>
                        {isPinned && <span aria-label="Pinned">📌</span>}
                        {m.editedAt && <span className="italic">edited</span>}
                        <span>{mine && <span aria-label="Sent">✔ </span>}{stamp(m.createdAt)}</span>
                        {mine && m.readAt && <span><span aria-label="Read">✔✔ </span>{stamp(m.readAt)}</span>}
                        {replyButton(m)}
                        {moreMenu(m)}
                      </p>
                    </div>
                    {pending(m)}
                  </>)}
                </div>
              </div>
            </div>
          );
        })}
        {typers.length > 0 && <p className="mt-2 text-xs italic text-slate" aria-live="polite">{isGroup ? `${typers.map((u) => (people[u]?.name || "Someone").split(" ")[0]).slice(0, 2).join(", ")} ${typers.length > 1 ? "are" : "is"} typing…` : "…typing"}</p>}
        <div ref={end} />
      </div>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {blockedByMe && <p className="mt-3 text-sm text-slate">You&apos;ve blocked this member. Unblock them to send a message.</p>}
      {moments && <MomentViewer moments={moments} onClose={() => setMoments(null)} onChanged={() => {}} />}
      {reporting && cid && <ReportDialog kind="conversation" targetId={cid} onClose={() => setReporting(false)} />}
      {reportingMsg && cid && <ReportDialog kind="conversation" targetId={cid} messageId={reportingMsg} onClose={() => setReportingMsg(null)} />}
      {group?.sendLocked && (group.adminUids.includes(user?.uid ?? "")
        ? <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-ink">Sending is limited to admins in this group. You can still write because you are an admin.</p>
        : <p className="mt-4 rounded-lg border border-rule bg-paper p-3 text-center text-sm text-slate">Only group admins can send messages in this group. You can still read it.</p>)}
      <form className={group?.sendLocked && !group.adminUids.includes(user?.uid ?? "") ? "hidden" : "mt-4"} onSubmit={(e) => { e.preventDefault(); if (editing) { if (text.trim()) void saveEdit(); return; } if ((text.trim() || files.length) && !busy && !blockedByMe) send(); }}>
        <div className="mb-1 flex flex-wrap items-center gap-1 text-sm">
          <EmojiPicker onPick={insertEmoji} disabled={blockedByMe} />
          <button type="button" onClick={() => format("**")} aria-label="Bold" title="Bold (Ctrl+B)" className="w-8 rounded border border-rule py-1 font-bold">B</button>
          <button type="button" onClick={() => format("_")} aria-label="Italic" title="Italic (Ctrl+I)" className="w-8 rounded border border-rule py-1 italic">I</button>
          <button type="button" onClick={() => format("__")} aria-label="Underline" title="Underline (Ctrl+U)" className="w-8 rounded border border-rule py-1 underline">U</button>
          <StickerPicker onPick={sendSticker} disabled={busy || blockedByMe} />
          {!blockedByMe && <NanaAssist surface="chat" label="Nana" getText={() => text} onApply={(t) => { setText(t); setTimeout(() => box.current?.focus(), 0); }}
            getContext={() => messages.slice(-8).map((m) => `${m.from === user?.uid ? "Me" : (people[m.from]?.name || "Them").split(" ")[0]}: ${m.text || (m.sticker ? "(sticker)" : m.attachments?.length ? "(attachment)" : "")}`).join("\n")} />}
          <button type="button" onClick={() => picker.current?.click()} aria-label="Attach files" title="Attach pictures, videos, voice notes or documents" className="ml-1 rounded border border-rule px-3 py-1">📎 Attach</button>
          <input ref={picker} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />
          {allowed && <span className="ml-1 text-xs text-slate">up to {allowed.maxCount} file{allowed.maxCount === 1 ? "" : "s"}, {formatBytes(allowed.maxBytes)} each</span>}
        </div>
        {editing && (
          <div className="mb-2 flex items-start justify-between gap-3 border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-xs text-ink">
            <span className="min-w-0">✏️ <strong>Editing your message.</strong> {editing.readAt || isGroup ? "If it has been read, the reader is asked to agree first." : "It hasn't been read yet, so it changes straight away."}</span>
            <button type="button" onClick={() => { setEditing(null); setText(""); }} aria-label="Cancel editing" className="text-base leading-none">×</button>
          </div>
        )}
        {replyingTo && (
          <div className="mb-2 flex items-start justify-between gap-3 border-l-4 border-crimson bg-paper px-3 py-2 text-xs text-slate">
            <span className="line-clamp-2 min-w-0"><strong className="text-ink">Replying to {replyingTo.from === user?.uid ? "yourself" : (people[replyingTo.from]?.name || "them").split(" ")[0]}:</strong> {replyingTo.text || (replyingTo.sticker ? "🖼 Sticker" : replyingTo.attachments?.length ? "📎 Attachment" : "")}</span>
            <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel the reply" className="text-base leading-none">×</button>
          </div>
        )}
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
            ref={box} value={text} rows={2} maxLength={MESSAGE_MAX} placeholder="Start or reply a conversation" onChange={(e) => typed(e.target.value)} onBlur={stopTyping}
            onKeyDown={(e) => {
              const k = e.key.toLowerCase();
              if ((e.ctrlKey || e.metaKey) && (k === "b" || k === "i" || k === "u")) { e.preventDefault(); format(k === "b" ? "**" : k === "i" ? "_" : "__"); }
              else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
            }}
            className="min-w-0 flex-1 resize-y rounded border border-rule px-3 py-2 text-sm"
          />
          <VoiceNoteButton maxSeconds={allowed?.maxVoiceSeconds ?? 300} disabled={busy || blockedByMe} onRecorded={addVoiceNote} onError={setError} />
          <button disabled={busy || (!text.trim() && !files.length) || blockedByMe} className="btn-primary self-end disabled:opacity-50">{busy ? "Sending…" : editing ? "Save" : "Send"}</button>
        </div>
      </form>
    </div>
  );
}

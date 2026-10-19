"use client";

import NanaAssist from "@/components/NanaAssist";
import { DROP_RING, useFileDrop } from "@/lib/useFileDrop";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { ATTACHMENT_ACCEPT, MESSAGE_MAX, NOTESAPP_EMOJI, REMOVED_TEXT, attachmentTypeOf, formatBytes, reactionSummary, type ThreadMessage } from "@/lib/messages-rules";
import { stripFormat, wrapSelection } from "@/lib/message-format";
import { searchThread } from "@/lib/chat-tools";
import MessageMenu, { DeleteChoice, MessageInfo, type MenuItem } from "./MessageMenu";
import ForwardDialog from "./ForwardDialog";
import NotesAppCard from "./NotesAppCard";
import { SummaryDialog, TranslateDialog, askNana } from "./ChatNana";
import { parseCardLink } from "@/lib/chat-cards";
import { KNOWN_ROOTS } from "@/lib/host";
import FormattedText from "./FormattedText";
import { Emoji } from "@/components/NotesAppEmoji";
import LinkPreview from "@/components/LinkPreview";
import MentionPicker from "@/components/MentionPicker";
import { firstUrl } from "@/lib/linkify";
import MessageAttachments from "./MessageAttachments";
import VoiceNoteButton from "./VoiceNoteButton";
import StickerPicker from "./StickerPicker";
import EmojiPicker from "./EmojiPicker";
import ProfileAvatar from "@/components/ProfileAvatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { badgeLevel, getUserByUid, goldKindOf, isTeamMember } from "@/lib/users";
import { stickerById } from "@/lib/stickers";
import { isMomentExpired } from "@/lib/moments-rules";
import ReportDialog from "@/components/moments/ReportDialog";
import GroupAvatar from "./GroupAvatar";
import ThreadHeader, { HEADER_BUTTON } from "./ThreadHeader";
import HandleLine from "./HandleLine";
import { CheckIcon, PhoneIcon, PinIcon, SendIcon, TickIcon, VideoIcon } from "./icons";
import { placeCall } from "@/components/calls/CallManager";
import { openGroupCall, useLiveGroupCalls } from "@/components/calls/GroupCall";
import { groupCallText, present } from "@/lib/group-calls";
import { CALLS_LIVE } from "@/lib/moments-rules";
import { callLogText } from "@/lib/calls";
import Avatar from "@/components/Avatar";
import MomentViewer from "@/components/moments/MomentViewer";
import { MOMENTS_LIVE } from "@/lib/moments-rules";
import type { MomentView } from "@/lib/moments-server";
import GroupMembers, { type GroupMember } from "./GroupMembers";
import { isGroupId, type GroupInfo } from "@/lib/messages-rules";
import { usePresence } from "@/lib/presence-client";
import { isThreadRoute } from "@/lib/chrome";

const FORWARD_MANY = 10; // messages forwarded together from a selection

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

// The row of chips above the box: white tiles on a phone, plain text buttons on desktop. Nana's is the filled one (its button is drawn
// by NanaAssist, so it's restyled from here).
const CHIP = "inline-flex h-10 items-center justify-center rounded-xl bg-card px-4 font-ui text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(26,18,16,0.06)] hover:text-crimson disabled:opacity-50 lg:h-9 lg:rounded-lg lg:bg-transparent lg:px-2.5 lg:shadow-none lg:hover:bg-paper";
const NANA_CHIP = "[&>button:first-child]:h-10 [&>button:first-child]:rounded-xl [&>button:first-child]:border-crimson-deep [&>button:first-child]:bg-crimson-deep [&>button:first-child]:px-5 [&>button:first-child]:text-sm [&>button:first-child]:text-white [&>button:first-child:hover]:bg-crimson [&>button:first-child>img]:hidden lg:[&>button:first-child]:h-9 lg:[&>button:first-child]:rounded-lg lg:mx-1";

type Person = { name: string; username: string; avatar: string; level: "verified" | "gold" | null; goldKind?: ReturnType<typeof goldKindOf>; team?: boolean; isOrg?: boolean };
type Who = { uid: string; username: string; displayName: string; avatar: string };

// One conversation. `to` (a username) starts a new one; `id` opens an existing one. Replies to moments carry a small note:
// "Replied to a moment" while it's live, "…that has expired" after — the moment itself can't be opened once it's gone.
export default function Thread({ id, to, embedded = false }: { id?: string; to?: string; embedded?: boolean }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cid, setCid] = useState(id);
  const [who, setWho] = useState<Who | null>(null);
  const [group, setGroup] = useState<(GroupInfo & { members: GroupMember[] }) | null>(null); // set when this is a group chat
  const [showMembers, setShowMembers] = useState(false);
  const [banned, setBanned] = useState<GroupMember[]>([]);
  const [muted, setMuted] = useState(false);
  const [moments, setMoments] = useState<MomentView[] | null>(null);
  const [all, setMessages] = useState<ThreadMessage[]>([]);
  const [hidden, setHidden] = useState<string[]>([]); // deleted for you only (chatHidden/{uid}/chats/{cid})
  const messages = hidden.length ? all.filter((m) => !hidden.includes(m.id)) : all;
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
  const [menu, setMenu] = useState<{ id: string; at: { x: number; y: number } | null } | null>(null); // the message whose menu is open (at: where, on a computer)
  const [info, setInfo] = useState<string | null>(null); // the message whose info is open
  const [selected, setSelected] = useState<string[] | null>(null); // selecting messages (null = not selecting)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [hit, setHit] = useState(0); // which search match is in view
  const [readMarks, setReadMarks] = useState<Record<string, string>>({}); // in a group: the newest message each member has read
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null); // a message being swiped right to reply (phones)
  const touch = useRef<{ id: string; x: number; y: number; timer?: ReturnType<typeof setTimeout>; opened?: boolean } | null>(null);
  const [toast, setToast] = useState("");
  const [forwarding, setForwarding] = useState<ThreadMessage[] | null>(null);
  const [deleting, setDeleting] = useState<ThreadMessage[] | null>(null); // choosing: for everyone, or just for you
  const [kept, setKept] = useState<string[]>([]); // the messages here you kept (Saved → From chats)
  const [translatingId, setTranslatingId] = useState<string | null>(null); // choosing a language for this message
  const [translations, setTranslations] = useState<Record<string, { label: string; text?: string; error?: string }>>({});
  const [summary, setSummary] = useState<{ context: string; count: number } | null>(null);
  const openedMark = useRef<string | null>(null); // where you had read up to when you opened the chat (for "N new · Summarise")
  const openedAt = useRef("");
  const [pinned, setPinned] = useState<{ id: string; by: string; at: string }[]>([]);
  const [typing, setTyping] = useState<Record<string, number>>({}); // who else is typing, and when they last typed
  const [, setTick] = useState(0);
  const lastTyped = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const presence = usePresence(who && !group && who.uid && who.uid !== user?.uid ? [who.uid] : []);
  const isGroup = !!group || (!!cid && isGroupId(cid)); // known from the id, so a message sent before the details arrive still goes to the group
  const groupLive = useLiveGroupCalls().find((c) => c.cid === cid && present(c).length > 0) ?? null; // a group call someone is in, in this group, now
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
          return { id: d.id, from: m.from, text: m.text, createdAt: m.createdAt, ...(m.readAt ? { readAt: m.readAt } : {}), ...(m.call ? { call: m.call } : {}), ...(m.removed ? { removed: m.removed } : {}), ...(m.editedAt ? { editedAt: m.editedAt } : {}), ...(m.deleted ? { deleted: m.deleted } : {}), ...(m.pendingRequest ? { pendingRequest: m.pendingRequest } : {}), ...(m.sticker ? { sticker: m.sticker } : {}), ...(m.replyTo ? { replyTo: m.replyTo } : {}), ...(m.attachments ? { attachments: (m.attachments as { name: string; size: number; type: string; kind: "image" | "video" | "document" | "audio"; durationSec?: number }[]).map(({ name, size, type, kind, durationSec }) => ({ name, size, type, kind, ...(durationSec ? { durationSec } : {}) })) } : {}), ...(m.momentRef ? { moment: { momentId: m.momentRef.momentId, expired: isMomentExpired(m.momentRef.expiresAt) } } : {}), ...(m.reactions && Object.keys(m.reactions).length ? { reactions: m.reactions } : {}), ...(m.forwarded ? { forwarded: true } : {}) };
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
    const a = onSnapshot(doc(db, "conversations", cid), (d) => {
      setPinned((d.data()?.pinned as { id: string; by: string; at: string }[] | undefined) ?? []);
      const marks = (d.data()?.readMarker as Record<string, string> | undefined) ?? {};
      if (openedMark.current === null) { openedMark.current = marks[uid] ?? ""; openedAt.current = new Date().toISOString(); }
      setReadMarks(marks);
    }, () => {});
    const k = onSnapshot(query(collection(db, "keptMessages"), where("uid", "==", uid), where("cid", "==", cid)), (snap) => setKept(snap.docs.map((d) => String(d.data().messageId))), () => {});
    const h = onSnapshot(doc(db, `chatHidden/${uid}/chats/${cid}`), (d) => setHidden((d.data()?.ids as string[] | undefined) ?? []), () => {});
    const b = onSnapshot(collection(db, `conversations/${cid}/typing`), (snap) => setTyping(Object.fromEntries(snap.docs.filter((d) => d.id !== uid).map((d) => [d.id, Number(d.data().at) || 0]))), () => {});
    const t = setInterval(() => setTick((n) => n + 1), 2000); // "typing…" fades by itself
    return () => { a(); b(); k(); h(); clearInterval(t); openedMark.current = null; if (lastTyped.current) deleteDoc(doc(db, `conversations/${cid}/typing/${uid}`)).catch(() => {}); };
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
    setError(null); setMenu(null);
    try { const r = await api<Record<string, unknown>>(`/api/messages/${cid}`, { body }); ok?.(r); }
    catch (e) { setError(e instanceof Error ? e.message : "That didn't work."); }
  }
  const pinMsg = (m: ThreadMessage, pin: boolean) => msgAction({ action: "pin", messageId: m.id, pin });
  // Deleted for you only: gone from your view of the chat; everyone else still sees it.
  const hideMany = (list: ThreadMessage[]) => msgAction({ action: "hide", messageIds: list.map((m) => m.id) }, () => { setSelected(null); flash(list.length === 1 ? "Deleted for you" : `${list.length} messages deleted for you`); });
  const startEdit = (m: ThreadMessage) => { setMenu(null); setReplyingTo(null); setEditing(m); setText(m.text); setTimeout(() => box.current?.focus(), 0); };
  async function saveEdit() {
    if (!editing) return;
    const m = editing;
    await msgAction({ action: "edit", messageId: m.id, text }, (r) => {
      setEditing(null); setText("");
      if (r.done === false) setError(`Your edit is waiting for ${Number(r.waitingFor) === 1 ? "the reader" : `${r.waitingFor} readers`} to agree. The request ends after 30 days.`);
    });
  }
  const answer = (requestId: string, a: "allow" | "decline" | "withdraw") => msgAction({ action: "request", requestId, answer: a });
  const react = (m: ThreadMessage, emoji: string) => msgAction({ action: "react", messageId: m.id, emoji });
  const keep = (m: ThreadMessage, on: boolean) => msgAction({ action: "keep", messageId: m.id, keep: on }, () => flash(on ? "Kept. Find it in Saved → From chats" : "No longer kept"));
  async function translate(m: ThreadMessage, lang: string, label: string) {
    if (!user) return;
    setTranslations((t) => ({ ...t, [m.id]: { label } }));
    try { const text = await askNana(user, { task: "translate", text: stripFormat(m.text), language: lang }); setTranslations((t) => ({ ...t, [m.id]: { label, text } })); }
    catch (e) { setTranslations((t) => ({ ...t, [m.id]: { label, error: e instanceof Error ? e.message : "Couldn't translate it." } })); }
  }
  // The chat as plain lines for Nana's summary: "Ada: …", oldest first.
  const asLines = (list: ThreadMessage[]) => list.filter((x) => !x.deleted && !x.removed && !x.call).map((x) => `${nameOf(x.from)}: ${plain(x)}`).join("\n");
  const missed = messages.filter((x) => openedMark.current !== null && x.from !== user?.uid && x.createdAt > openedMark.current && x.createdAt <= openedAt.current && !x.call && !x.deleted && !x.removed);
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };
  const nameOf = (uid: string) => (uid === user?.uid ? "You" : people[uid]?.name || "Member");
  const plain = (m: ThreadMessage) => stripFormat(m.text || "") || (m.sticker ? "[Sticker]" : m.attachments?.length ? m.attachments.map((a) => `[${a.name}]`).join(" ") : "");
  async function copy(list: ThreadMessage[]) {
    const text = list.length === 1 ? plain(list[0]) : list.map((m) => `[${stamp(m.createdAt)}] ${nameOf(m.from)}: ${plain(m)}`).join("\n");
    try { await navigator.clipboard.writeText(text); flash(list.length === 1 ? "Copied" : `Copied ${list.length} messages`); } catch { setError("Couldn't copy. Select the words and copy them instead."); }
  }
  // Deleting your own for everyone (one or several): each goes through the same rules as one (read ones wait for the readers).
  async function deleteMany(list: ThreadMessage[]) {
    if (!cid || !list.length) return;
    let waiting = 0;
    for (const m of list) { try { const r = await api<{ done: boolean }>(`/api/messages/${cid}`, { body: { action: "delete", messageId: m.id } }); if (r.done === false) waiting++; } catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete one of them."); } }
    setSelected(null);
    if (waiting) setError(`${waiting} of them ${waiting === 1 ? "is" : "are"} waiting for the readers to agree.`);
  }
  const openMenu = (m: ThreadMessage, at: { x: number; y: number } | null) => { if (selected) return; setMenu({ id: m.id, at }); };
  // Phones: hold a message for the menu; swipe it right to reply.
  const touchHandlers = (m: ThreadMessage, canReply: boolean) => ({
    onTouchStart: (e: React.TouchEvent) => {
      if (selected) return;
      const t = e.touches[0];
      const timer = setTimeout(() => { if (touch.current?.id === m.id) { touch.current.opened = true; setSwipe(null); navigator.vibrate?.(15); openMenu(m, null); } }, 450);
      touch.current = { id: m.id, x: t.clientX, y: t.clientY, timer };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const c = touch.current; if (!c || c.id !== m.id) return;
      const dx = e.touches[0].clientX - c.x, dy = e.touches[0].clientY - c.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(c.timer);
      if (canReply && !c.opened && dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) setSwipe({ id: m.id, dx: Math.min(dx, 90) });
    },
    onTouchEnd: () => {
      const c = touch.current; if (c) clearTimeout(c.timer);
      if (swipe?.id === m.id && swipe.dx > 60) { setReplyingTo(m); setTimeout(() => box.current?.focus(), 0); navigator.vibrate?.(10); }
      setSwipe(null); touch.current = null;
    },
  });
  const searchHits = searchOpen ? searchThread(messages, searchQ) : [];
  const hitKey = searchHits.join(",");
  // A new search shows the newest match first; ↑ goes to older ones.
  useEffect(() => { setHit(Math.max(0, searchHits.length - 1)); }, [hitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = searchHits[hit]; if (id) document.getElementById(`m-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [hit, hitKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // On a phone an open conversation is the whole screen (the site hides its own bars there, lib/chrome.ts); a new one, still under the
  // site's bars, just fills the page. On desktop it is a card beside the list, as tall as the window allows, scrolling inside.
  const frame = embedded ? "card" : `${isThreadRoute(pathname) ? "h-[100dvh]" : "min-h-[calc(100dvh-9rem)]"} bg-paper lg:h-[calc(100dvh-7.5rem)] lg:min-h-0 lg:rounded-xl2 lg:border lg:border-rule lg:bg-card`;
  const back = embedded ? undefined : "/messages";
  const limits = allowed ? `${allowed.maxCount} file${allowed.maxCount === 1 ? "" : "s"}, ${formatBytes(allowed.maxBytes)} each` : "";
  return (
    <div className={`relative flex flex-col ${frame} ${dragging ? DROP_RING : ""}`} {...bind}>
      {dragging && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-paper/80 font-ui text-sm font-bold text-crimson lg:rounded-xl2">Drop to attach</div>}
      {group ? (
        <ThreadHeader
          back={back}
          avatar={<GroupAvatar title={group.title} size={48} team={group.scope === "team"} src={group.avatar} />}
          title={<><span className="truncate">{group.title}</span>{group.scope === "team" && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 font-ui text-[10px] font-bold text-amber-900">TEAM</span>}</>}
          subtitle={<>{group.scope === "team" ? "Team room" : "Group"} · {group.members.length.toLocaleString("en-NG")} member{group.members.length === 1 ? "" : "s"}{group.sendLocked ? " · only admins can send" : ""}</>}
          actions={<span className="flex shrink-0 items-center gap-0.5 lg:gap-3">
            {CALLS_LIVE && cid && (groupLive ? (
              <button type="button" onClick={() => openGroupCall({ cid, title: group.title, kind: groupLive.kind, id: groupLive.id })} title={`Join the group ${groupLive.kind === "video" ? "video" : "voice"} call`}
                className="shrink-0 rounded-full bg-[#2FA36B] px-4 py-2 font-ui text-xs font-bold text-white hover:bg-[#29925F]">📞 Join call</button>
            ) : <>
              <button type="button" onClick={() => openGroupCall({ cid, title: group.title, kind: "audio" })} aria-label={`Group voice call in ${group.title}`} title="Group voice call (free, up to 6 people)" className={HEADER_BUTTON}><PhoneIcon size={22} /></button>
              <button type="button" onClick={() => openGroupCall({ cid, title: group.title, kind: "video" })} aria-label={`Group video call in ${group.title}`} title="Group video call (free, up to 4 people)" className={HEADER_BUTTON}><VideoIcon size={24} /></button>
            </>)}
            {group.adminUids.includes(user?.uid ?? "") && group.scope !== "team" && (
            <button type="button" onClick={() => setShowMembers(true)} title="Manage the group: members, admins, bans, who can send, picture" className="hidden shrink-0 rounded-full border border-rule px-4 py-2 font-ui text-xs font-semibold text-crimson hover:bg-paper sm:inline-flex">⚙️ Manage</button>
            )}
          </span>}
          items={[
            { label: "Search in this chat", icon: "🔍", onClick: () => setSearchOpen(true) },
            { label: "Summarise with Nana", icon: "✨", onClick: () => { const list = missed.length >= 3 ? missed : messages.slice(-50); setSummary({ context: asLines(list), count: list.length }); } },
            { label: "Select messages", icon: "☑️", onClick: () => setSelected([]) },
            { label: "Members", icon: "👥", onClick: () => setShowMembers(true) },
            { label: group.adminUids.includes(user?.uid ?? "") && group.scope !== "team" ? "Group settings" : "", icon: "⚙️", onClick: () => setShowMembers(true), hidden: !(group.adminUids.includes(user?.uid ?? "") && group.scope !== "team") },
            { label: "Create group", icon: "➕", href: "/messages/new-group", divider: true },
            { label: muted ? "Unmute notifications" : "Mute notifications", icon: muted ? "🔔" : "🔕", onClick: toggleMute },
            { label: "Leave group", icon: "↪", danger: true, hidden: group.scope === "team", onClick: () => { if (confirm("Leave this group? You won't see its messages any more.")) api(`/api/messages/groups/${cid}`, { body: { action: "leave" } }).then(() => { window.location.href = "/messages"; }).catch((e) => setError(e.message)); } },
          ]}
        />
      ) : who ? (
        <ThreadHeader
          back={back}
          avatar={<Link href={`/u/${who.username}`} className="shrink-0"><Avatar src={who.avatar} alt={who.displayName} size={48} square={!!people[who.uid]?.isOrg} /></Link>}
          title={<><Link href={`/u/${who.username}`} className="truncate hover:underline">{people[who.uid]?.name || who.displayName}</Link><NameBadgeIcons username={who.username} size={16} badges={people[who.uid] ? { level: people[who.uid]!.level, goldKind: people[who.uid]!.goldKind, team: !!people[who.uid]!.team } : undefined} /></>}
          subtitle={<HandleLine username={who.username} status={presence.statuses[who.uid]} />}
          actions={CALLS_LIVE && !blockedByMe ? (
            <span className="flex shrink-0 items-center gap-0.5 lg:gap-3">
              <button type="button" onClick={() => placeCall({ toUid: who.uid, kind: "audio", name: people[who.uid]?.name || who.displayName, avatar: who.avatar })} aria-label={`Voice call ${who.displayName}`} title="Voice call (free)" className={HEADER_BUTTON}>
                <PhoneIcon size={22} />
              </button>
              <button type="button" onClick={() => placeCall({ toUid: who.uid, kind: "video", name: people[who.uid]?.name || who.displayName, avatar: who.avatar })} aria-label={`Video call ${who.displayName}`} title="Video call (free)" className={HEADER_BUTTON}>
                <VideoIcon size={24} />
              </button>
            </span>
          ) : undefined}
          items={[
            { label: "Search in this chat", icon: "🔍", onClick: () => setSearchOpen(true) },
            { label: "Summarise with Nana", icon: "✨", onClick: () => { const list = missed.length >= 3 ? missed : messages.slice(-50); setSummary({ context: asLines(list), count: list.length }); } },
            { label: "Select messages", icon: "☑️", onClick: () => setSelected([]) },
            { label: "View profile", icon: "👤", href: `/u/${who.username}`, divider: true },
            { label: "View moments", icon: "✨", onClick: viewMoments, hidden: !MOMENTS_LIVE },
            { label: "Create group", icon: "➕", href: "/messages/new-group", divider: true },
            { label: muted ? "Unmute notifications" : "Mute notifications", icon: muted ? "🔔" : "🔕", onClick: toggleMute },
            { label: blockedByMe ? "Unblock" : "Block", icon: "⛔", onClick: toggleBlock, danger: !blockedByMe },
            { label: "Report", icon: "⚑", onClick: () => setReporting(true), danger: true },
          ]}
        />
      ) : (
        <p className="shrink-0 border-b border-rule bg-card px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] font-ui text-sm text-slate lg:rounded-t-xl2 lg:px-7 lg:pt-5"><Link href="/messages" className="font-semibold text-crimson hover:underline">← Messages</Link>{to ? ` · @${to}` : ""}</p>
      )}
      {group && showMembers && cid && user && <GroupMembers cid={cid} group={group} members={group.members} banned={banned} meUid={user.uid} onChanged={loadMeta} onLeft={() => { window.location.href = "/messages"; }} />}
      {searchOpen && (
        <div className="flex shrink-0 items-center gap-2 border-b border-rule bg-card px-3 py-2 lg:px-7" role="search">
          <input autoFocus type="search" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setHit((h) => (searchHits.length ? (h - 1 + searchHits.length) % searchHits.length : 0)); } if (e.key === "Escape") { setSearchOpen(false); setSearchQ(""); } }}
            placeholder="Search this chat" aria-label="Search this chat" className="min-w-0 flex-1 rounded-full bg-paper px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-crimson/20" />
          <span className="shrink-0 font-mono text-xs text-slate" aria-live="polite">{searchQ.trim().length < 2 ? "" : searchHits.length ? `${hit + 1} of ${searchHits.length}` : "No matches"}</span>
          <button type="button" disabled={searchHits.length < 2} onClick={() => setHit((h) => (h - 1 + searchHits.length) % searchHits.length)} aria-label="Older match" className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-paper disabled:opacity-30">↑</button>
          <button type="button" disabled={searchHits.length < 2} onClick={() => setHit((h) => (h + 1) % searchHits.length)} aria-label="Newer match" className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-paper disabled:opacity-30">↓</button>
          <button type="button" onClick={() => { setSearchOpen(false); setSearchQ(""); }} aria-label="Close search" className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate hover:bg-paper">×</button>
        </div>
      )}
      {missed.length >= 5 && !searchOpen && (
        <div className="mx-4 mt-3 flex shrink-0 items-center gap-3 rounded-xl border border-crimson/20 bg-crimson/5 px-3 py-2 text-sm lg:mx-7">
          <span className="flex-1 text-ink"><strong>{missed.length} new messages</strong> since you were last here</span>
          <button type="button" onClick={() => setSummary({ context: asLines(missed), count: missed.length })} className="shrink-0 rounded-full bg-crimson-deep px-3.5 py-1.5 font-ui text-xs font-bold text-white hover:bg-crimson">✨ Summarise</button>
        </div>
      )}
      {pinned.length > 0 && (
        <div className="mx-4 mt-3 shrink-0 space-y-1 rounded-xl border border-rule bg-card px-3 py-2 text-xs lg:mx-7 lg:bg-paper">
          {pinned.map((p) => { const pm = messages.find((x) => x.id === p.id); return (
            <div key={p.id} className="flex items-center gap-2">
              <button type="button" onClick={() => document.getElementById(`m-${p.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" })} className="flex min-w-0 flex-1 items-center gap-1.5 text-left"><PinIcon size={13} className="shrink-0 text-crimson" /><span className="truncate"><strong>{(people[pm?.from ?? ""]?.name || "Message").split(" ")[0]}:</strong> {pm ? (pm.text || (pm.attachments?.length ? "📎 Attachment" : pm.sticker ? "🖼 Sticker" : "…")) : "an earlier message"}</span></button>
              {(!isGroup || group?.adminUids.includes(user?.uid ?? "")) && <button type="button" onClick={() => pm && pinMsg(pm, false)} disabled={!pm} aria-label="Unpin" title="Unpin" className="text-slate hover:text-crimson">×</button>}
            </div>
          ); })}
        </div>
      )}
      <div className={embedded ? "min-h-[40vh] px-4 py-4 lg:px-7" : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 lg:px-7 lg:py-5"}>
        {messages.map((m, idx) => {
          const mine = m.from === user?.uid;
          const person = people[m.from];
          const prev = messages[idx - 1];
          const next = messages[idx + 1];
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const newGroup = newDay || prev.from !== m.from || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS;
          // The picture sits beside the last message of a run from one person, as in most messengers.
          const endOfRun = !next || !!next.call || !!next.deleted || !!next.removed || next.from !== m.from || dayKey(next.createdAt) !== dayKey(m.createdAt) || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() > GROUP_GAP_MS;
          const sticker = m.sticker ? stickerById(m.sticker) : undefined;
          const quoted = m.replyTo ? people[m.replyTo.from] : undefined;
          const replyButton = (msg: ThreadMessage) => !blockedByMe && (
            <button type="button" onClick={() => { setReplyingTo(msg); box.current?.focus(); }} className="font-medium opacity-90 hover:underline hover:opacity-100" aria-label="Reply to this message" title="Reply">↩ Reply</button>
          );
          const firstName = (p?: Person) => (p?.name || "").split(" ")[0] || "Member";
          // ⋯ opens the same menu as a right-click or a long press.
          const isPinned = pinned.some((p) => p.id === m.id);
          const moreMenu = (msg: ThreadMessage) => (
            <button type="button" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); openMenu(msg, { x: mine ? r.right : r.left, y: r.bottom + 4 }); }} className="px-1 font-bold opacity-80 hover:opacity-100" aria-label="More actions for this message" aria-haspopup="menu" aria-expanded={menu?.id === msg.id}>⋯</button>
          );
          // The small line inside each bubble: ✓ sent time · ✓✓ read time · ↩ Reply, then ⋯.
          const meta = (msg: ThreadMessage) => {
            const parts = [
              isPinned && <span aria-label="Pinned" className="inline-flex"><PinIcon size={12} /></span>,
              kept.includes(msg.id) && <span aria-label="Kept" title="Kept: in Saved → From chats">🔖</span>,
              msg.editedAt && <span className="italic">edited</span>,
              <span key="sent" className="inline-flex items-center gap-1">{mine && <span aria-label="Sent"><TickIcon /></span>}{stamp(msg.createdAt)}</span>,
              mine && msg.readAt && <span className="inline-flex items-center gap-1"><span aria-label="Read"><TickIcon read /></span>{stamp(msg.readAt)}</span>,
              replyButton(msg),
            ].filter(Boolean);
            return <>{parts.map((x, k) => <Fragment key={k}>{k > 0 && <span aria-hidden="true">·</span>}{x}</Fragment>)}{moreMenu(msg)}</>;
          };
          // The reactions under a bubble: tap one to add yours (or take it off); the names show on hover.
          const chips = (msg: ThreadMessage) => {
            const list = reactionSummary(msg.reactions);
            if (!list.length) return null;
            const mineR = msg.reactions?.[user?.uid ?? ""] ?? "";
            return (
              <div className={`relative z-[1] -mt-2 flex flex-wrap gap-1 ${mine ? "justify-end pr-2" : "pl-2"}`}>
                {list.map((r) => (
                  <button key={r.emoji} type="button" disabled={blockedByMe} onClick={() => react(msg, mineR === r.emoji ? "" : r.emoji)} title={r.uids.map(nameOf).join(", ")}
                    aria-label={`${NOTESAPP_EMOJI[r.emoji]?.label ?? r.emoji} ${r.count}: ${r.uids.map(nameOf).join(", ")}${mineR === r.emoji ? ". Tap to take yours off" : ". Tap to react the same"}`}
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm shadow-sm ${mineR === r.emoji ? "border-crimson/40 bg-crimson/10" : "border-rule bg-card"}`}>
                    <Emoji e={r.emoji} />{r.count > 1 && <span className="font-ui text-[11px] font-semibold text-slate">{r.count}</span>}
                  </button>
                ))}
              </div>
            );
          };
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
              <span className="rounded-full border border-dashed border-rule px-3 py-1.5 text-xs italic text-slate">🗑 {mine ? "You deleted this message" : "This message was deleted"} · {stamp(m.createdAt)}</span>
            </div>
          );
          if (m.removed) return (
            <div key={m.id} id={`m-${m.id}`} className={`my-2 flex ${mine ? "justify-end" : "justify-start"}`}>
              <span className="rounded-full border border-dashed border-rule px-3 py-1.5 text-xs italic text-slate">🚫 {REMOVED_TEXT[m.removed.by]}{!mine && person?.name ? ` (was from ${firstName(person)})` : ""} · {stamp(m.createdAt)}</span>
            </div>
          );
          if (m.call) {
            const callCls = `rounded-full border px-3 py-1 text-xs ${m.call.outcome === "missed" && !mine ? "border-crimson/40 bg-crimson/5 text-crimson" : "border-rule bg-card text-slate lg:bg-paper"}`;
            const callLine = <>📞 {m.call.group ? groupCallText(m.call.kind, m.call.seconds, m.call.peak ?? 1) : m.call.outcome === "missed" && mine ? `${m.call.kind === "video" ? "Video" : "Voice"} call · no answer` : callLogText(m.call)} · {stamp(m.createdAt)}</>;
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
                  <span className="font-mono text-[11px] uppercase tracking-eyebrow text-slate">{dayLabel(m.createdAt)}</span>
                  <span className="h-px flex-1 bg-rule" />
                </div>
              )}
              <div id={`m-${m.id}`}
                onClick={selected ? () => setSelected((l) => (l ?? []).includes(m.id) ? (l ?? []).filter((x) => x !== m.id) : [...(l ?? []), m.id]) : undefined}
                className={`relative flex items-end gap-2 lg:gap-3 ${mine ? "flex-row-reverse" : ""} ${newGroup ? "mt-3" : "mt-1"} ${selected ? "-mx-2 cursor-pointer rounded-xl px-2 py-0.5" : ""} ${selected?.includes(m.id) ? "bg-crimson/10" : ""}`}>
                {selected && <span aria-hidden="true" className={`absolute top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[11px] font-bold ${mine ? "left-2" : "right-2"} ${selected.includes(m.id) ? "border-crimson bg-crimson text-white" : "border-slate/40 bg-card"}`}>{selected.includes(m.id) ? "✓" : ""}</span>}
                {swipe?.id === m.id && <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 text-lg text-crimson" style={{ opacity: Math.min(1, swipe.dx / 60) }}>↩</span>}
                <span className={`shrink-0 ${mine ? "hidden lg:block" : ""} ${endOfRun ? "" : "invisible"}`}>
                  <ProfileAvatar username={person?.username || (mine ? "" : who?.username ?? "")} src={person?.avatar ?? ""} alt={person?.name ?? ""} size={32} square={!!person?.isOrg} from="chat" />
                </span>
                <div
                  {...touchHandlers(m, !blockedByMe)}
                  onContextMenu={(e) => { if (selected) return; e.preventDefault(); openMenu(m, { x: e.clientX, y: e.clientY }); }}
                  style={swipe?.id === m.id ? { transform: `translateX(${swipe.dx}px)` } : undefined}
                  className={`flex min-w-0 max-w-[80%] flex-col transition-transform duration-150 [-webkit-touch-callout:none] lg:max-w-[70%] ${swipe?.id === m.id ? "!duration-0" : ""} ${mine ? "items-end" : "items-start"} ${selected ? "pointer-events-none" : ""} ${searchHits.includes(m.id) ? `rounded-2xl ring-2 ring-offset-2 ring-offset-paper ${searchHits[hit] === m.id ? "ring-amber-500" : "ring-amber-200"}` : ""}`}>
                  {newGroup && isGroup && (
                    <p className="mb-1 flex items-center gap-1.5 font-ui text-xs font-bold text-ink">
                      {person?.name ?? ""}
                      {person && <NameBadgeIcons username={person.username} size={13} badges={{ level: person.level, goldKind: person.goldKind, team: !!person.team }} />}
                    </p>
                  )}
                  {sticker ? (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sticker.src} alt={`${sticker.label} sticker`} className={sticker.wide ? "h-auto w-56 max-w-full object-contain" : "h-28 w-28 object-contain"} />
                      <p className={`mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate ${mine ? "justify-end" : ""}`}>{meta(m)}</p>
                      {chips(m)}
                      {pending(m)}
                    </div>
                  ) : (<>
                    <div className={`min-w-0 max-w-full rounded-xl2 px-4 py-3 text-[15px] leading-snug lg:rounded-2xl lg:text-sm ${mine ? "bg-crimson text-white" : "border border-rule bg-card text-ink lg:bg-paper"}`}>
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
                      {m.forwarded && <p className={`mb-1 flex items-center gap-1 text-xs italic ${mine ? "text-white/80" : "text-slate"}`}><span aria-hidden="true">↪</span> Forwarded</p>}
                      {m.moment && (
                        <p className={`mb-1 text-xs italic ${mine ? "text-white/80" : "text-slate"}`}>
                          {m.moment.expired ? "Replied to a moment that has expired" : "Replied to a moment"}
                        </p>
                      )}
                      {m.attachments && cid && <MessageAttachments cid={cid} mid={m.id} files={m.attachments} mine={mine} />}
                      {m.text && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]"><FormattedText text={m.text} linkClass={mine ? "font-semibold text-white underline underline-offset-2" : undefined} /></p>}
                      {translations[m.id] && (
                        <div className={`mt-2 border-t pt-2 text-sm ${mine ? "border-white/30" : "border-rule"}`}>
                          <p className={`mb-0.5 flex items-center gap-2 text-[11px] ${mine ? "text-white/75" : "text-slate"}`}>✨ {translations[m.id].label} · Nana<button type="button" onClick={() => setTranslations((t) => { const n = { ...t }; delete n[m.id]; return n; })} className="underline">Hide</button></p>
                          <p className="whitespace-pre-wrap">{translations[m.id].error ? <span className={mine ? "" : "text-red-700"}>{translations[m.id].error}</span> : translations[m.id].text ?? "Translating…"}</p>
                        </div>
                      )}
                      {m.text && firstUrl(m.text) && (parseCardLink(firstUrl(m.text)!, KNOWN_ROOTS) ? <NotesAppCard url={firstUrl(m.text)!} user={user ?? null} mine={mine} /> : <LinkPreview url={firstUrl(m.text)!} user={user ?? null} mine={mine} />)}
                      <p className={`mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs lg:text-[11px] ${mine ? "text-white/80" : "text-slate"}`}>{meta(m)}</p>
                    </div>
                    {chips(m)}
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
      <div className={`shrink-0 lg:border-t lg:border-rule lg:px-7 lg:pb-5 lg:pt-4 ${embedded ? "" : "pb-[env(safe-area-inset-bottom)]"}`}>
        {error && <p className="px-4 pb-2 text-sm text-red-700 lg:px-0" role="alert">{error}</p>}
        {toast && <p className="px-4 pb-2 text-center text-sm font-semibold text-emerald-800 lg:px-0" role="status">{toast}</p>}
        {selected && (() => {
          const list = messages.filter((x) => selected.includes(x.id));
          const sendable = list.filter((x) => !x.deleted && !x.removed && !x.call && !x.pendingRequest);
          return (
            <div className="flex items-center gap-1.5 border-t border-rule bg-card px-3 py-3 lg:gap-2 lg:border-0 lg:bg-transparent lg:px-0">
              <button type="button" onClick={() => setSelected(null)} aria-label="Stop selecting" className="flex h-10 w-8 shrink-0 items-center justify-center rounded-full text-xl text-slate hover:bg-paper">×</button>
              <span className={`min-w-0 flex-1 font-ui text-sm font-semibold text-ink ${list.length ? "whitespace-nowrap" : ""}`}>{list.length ? `${list.length} selected` : "Tap messages to select them"}</span>
              <button type="button" disabled={!list.length} onClick={() => { void copy(list); setSelected(null); }} className="rounded-full border border-rule px-3 py-2 font-ui text-sm font-semibold text-ink hover:bg-paper disabled:opacity-40">Copy</button>
              <button type="button" disabled={!sendable.length || sendable.length > FORWARD_MANY} title={sendable.length > FORWARD_MANY ? `Forward up to ${FORWARD_MANY} at a time` : undefined} onClick={() => setForwarding(sendable)} className="rounded-full border border-rule px-3 py-2 font-ui text-sm font-semibold text-ink hover:bg-paper disabled:opacity-40">Forward</button>
              <button type="button" disabled={!list.length} onClick={() => setDeleting(list)} className="rounded-full border border-red-200 px-3 py-2 font-ui text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">Delete</button>
            </div>
          );
        })()}
        {blockedByMe && <p className="px-4 pb-3 text-sm text-slate lg:px-0">You&apos;ve blocked this member. Unblock them to send a message.</p>}
        {group?.sendLocked && (group.adminUids.includes(user?.uid ?? "")
          ? <p className="mx-4 mb-2 rounded-lg bg-amber-50 p-2 text-xs text-ink lg:mx-0">Sending is limited to admins in this group. You can still write because you are an admin.</p>
          : <p className="mx-4 mb-4 rounded-lg border border-rule bg-card p-3 text-center text-sm text-slate lg:mx-0 lg:mb-0 lg:bg-paper">Only group admins can send messages in this group. You can still read it.</p>)}
        <form className={selected || (group?.sendLocked && !group.adminUids.includes(user?.uid ?? "")) ? "hidden" : ""} onSubmit={(e) => { e.preventDefault(); if (editing) { if (text.trim()) void saveEdit(); return; } if ((text.trim() || files.length) && !busy && !blockedByMe) send(); }}>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3 lg:gap-1 lg:px-0">
            <EmojiPicker onPick={insertEmoji} disabled={blockedByMe} className={`${CHIP} !px-3.5 text-base`} />
            {/* Bold, italic and underline are always there on desktop; on a phone they show once there's something to format, which keeps the row to one line. */}
            <button type="button" onClick={() => format("**")} aria-label="Bold" title="Bold (Ctrl+B)" className={`${CHIP} w-9 !px-0 font-bold ${text ? "" : "!hidden lg:!inline-flex"}`}>B</button>
            <button type="button" onClick={() => format("_")} aria-label="Italic" title="Italic (Ctrl+I)" className={`${CHIP} w-9 !px-0 font-medium italic ${text ? "" : "!hidden lg:!inline-flex"}`}>I</button>
            <button type="button" onClick={() => format("__")} aria-label="Underline" title="Underline (Ctrl+U)" className={`${CHIP} w-9 !px-0 font-medium underline ${text ? "" : "!hidden lg:!inline-flex"}`}>U</button>
            <StickerPicker onPick={sendSticker} disabled={busy || blockedByMe} className={`${CHIP} lg:!px-4`} label="Stickers" />
            {!blockedByMe && <NanaAssist surface="chat" label="Nana" className={NANA_CHIP} getText={() => text} onApply={(t) => { setText(t); setTimeout(() => box.current?.focus(), 0); }}
              getContext={() => messages.slice(-8).map((m) => `${m.from === user?.uid ? "Me" : (people[m.from]?.name || "Them").split(" ")[0]}: ${m.text || (m.sticker ? "(sticker)" : m.attachments?.length ? "(attachment)" : "")}`).join("\n")} />}
            <button type="button" onClick={() => picker.current?.click()} aria-label="Attach files" title="Attach pictures, videos, voice notes or documents" className={`${CHIP} lg:!px-4`}>Attach</button>
            <input ref={picker} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />
            {limits && <span className="ml-2 hidden text-xs text-slate lg:inline">up to {limits}</span>}
          </div>
          {editing && (
            <div className="mx-4 mb-2 flex items-start justify-between gap-3 rounded-r-lg border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-xs text-ink lg:mx-0">
              <span className="min-w-0">✏️ <strong>Editing your message.</strong> {editing.readAt || isGroup ? "If it has been read, the reader is asked to agree first." : "It hasn't been read yet, so it changes straight away."}</span>
              <button type="button" onClick={() => { setEditing(null); setText(""); }} aria-label="Cancel editing" className="text-base leading-none">×</button>
            </div>
          )}
          {replyingTo && (
            <div className="mx-4 mb-2 flex items-start justify-between gap-3 rounded-r-lg border-l-4 border-crimson bg-card px-3 py-2 text-xs text-slate lg:mx-0 lg:bg-paper">
              <span className="line-clamp-2 min-w-0"><strong className="text-ink">Replying to {replyingTo.from === user?.uid ? "yourself" : (people[replyingTo.from]?.name || "them").split(" ")[0]}:</strong> {replyingTo.text || (replyingTo.sticker ? "🖼 Sticker" : replyingTo.attachments?.length ? "📎 Attachment" : "")}</span>
              <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel the reply" className="text-base leading-none">×</button>
            </div>
          )}
          {files.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2 px-4 text-xs lg:px-0">
              {files.map((f, k) => (
                <li key={k} className="flex items-center gap-2 rounded-full border border-rule bg-card px-3 py-1">
                  <span className="max-w-[12rem] truncate">{voiceLength.current.has(f) ? `🎙 Voice note ${Math.floor(voiceLength.current.get(f)! / 60)}:${String(Math.floor(voiceLength.current.get(f)! % 60)).padStart(2, "0")}` : f.name}</span><span className="text-slate">{formatBytes(f.size)}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== k))} aria-label={`Remove ${f.name}`} className="text-slate">×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="relative flex items-end gap-1.5 border-t border-rule bg-card px-4 py-2.5 lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0">
            <MentionPicker target={box} value={text} onChange={typed} place="above" />
            {/* Grows with what's typed where the browser can (field-sizing), up to a few lines, then scrolls. */}
            <textarea
              ref={box} value={text} rows={1} maxLength={MESSAGE_MAX} placeholder="Start or reply a conversation" onChange={(e) => typed(e.target.value)} onBlur={stopTyping}
              onKeyDown={(e) => {
                const k = e.key.toLowerCase();
                if ((e.ctrlKey || e.metaKey) && (k === "b" || k === "i" || k === "u")) { e.preventDefault(); format(k === "b" ? "**" : k === "i" ? "_" : "__"); }
                else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
              }}
              className="max-h-40 min-h-[3rem] min-w-0 flex-1 resize-none rounded-3xl border border-transparent bg-paper px-4 py-3 text-[15px] leading-6 text-ink outline-none [field-sizing:content] placeholder:text-slate/80 focus:border-crimson/30 lg:min-h-[3.5rem] lg:rounded-2xl lg:py-4 lg:text-sm"
            />
            <VoiceNoteButton maxSeconds={allowed?.maxVoiceSeconds ?? 300} disabled={busy || blockedByMe} onRecorded={addVoiceNote} onError={setError} />
            <button disabled={busy || (!text.trim() && !files.length) || blockedByMe} aria-label={busy ? "Sending" : editing ? "Save" : "Send"} className="flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-full bg-crimson-bright text-white transition-colors hover:bg-crimson disabled:opacity-60 lg:h-12 lg:w-auto lg:bg-crimson lg:px-8 lg:font-ui lg:text-sm lg:font-semibold lg:hover:bg-crimson-bright">
              {editing ? <CheckIcon className="lg:hidden" /> : <SendIcon className="-mr-0.5 lg:hidden" />}
              <span className="hidden lg:inline">{busy ? "Sending…" : editing ? "Save" : "Send"}</span>
            </button>
          </div>
          {limits && <p className="pt-2 text-center text-xs text-slate lg:hidden">Up to {limits}</p>}
        </form>
      </div>
      {menu && (() => {
        const m = messages.find((x) => x.id === menu.id);
        if (!m) return null;
        const mine = m.from === user?.uid;
        const amAdmin = !!group && group.adminUids.includes(user?.uid ?? "");
        const isPinned = pinned.some((p) => p.id === m.id);
        const items: MenuItem[] = [
          { label: "Reply", icon: "↩", onClick: () => { setReplyingTo(m); setTimeout(() => box.current?.focus(), 0); }, hidden: blockedByMe },
          { label: "Forward", icon: "↪", onClick: () => setForwarding([m]), hidden: !!m.deleted || !!m.removed || !!m.call },
          { label: "Copy", icon: "⧉", onClick: () => copy([m]), hidden: !plain(m) },
          { label: kept.includes(m.id) ? "Stop keeping" : "Keep", icon: "🔖", onClick: () => keep(m, !kept.includes(m.id)) },
          { label: "Translate", icon: "🌍", onClick: () => setTranslatingId(m.id), hidden: !m.text },
          { label: isPinned ? "Unpin" : "Pin", icon: "📌", onClick: () => pinMsg(m, !isPinned), hidden: blockedByMe || (isGroup && !amAdmin) },
          { label: "Message info", icon: "ⓘ", onClick: () => setInfo(m.id), hidden: !mine },
          { label: "Select", icon: "☑️", onClick: () => setSelected([m.id]) },
          { label: "Edit", icon: "✏️", onClick: () => startEdit(m), hidden: !mine || !!m.pendingRequest || !m.text },
          { label: "Report", icon: "⚑", onClick: () => setReportingMsg(m.id), hidden: !isGroup || mine },
          { label: "Remove (admin)", icon: "🚫", onClick: () => void removeMessage(m), danger: true, hidden: !amAdmin || !!m.removed },
          { label: "Delete", icon: "🗑", onClick: () => setDeleting([m]), danger: true, hidden: mine && !!m.pendingRequest },
        ];
        return <MessageMenu at={menu.at} mine={mine} current={m.reactions?.[user?.uid ?? ""] ?? ""} canReact={!blockedByMe} items={items} onReact={(e) => void react(m, e)} onClose={() => setMenu(null)} />;
      })()}
      {info && (() => {
        const m = messages.find((x) => x.id === info);
        if (!m) return null;
        if (!group) return <MessageInfo sent={m.createdAt} readAt={m.readAt} edited={m.editedAt} onClose={() => setInfo(null)} />;
        const others = group.members.filter((x) => x.uid !== m.from);
        const read = others.filter((x) => (readMarks[x.uid] ?? "") >= m.createdAt);
        return <MessageInfo sent={m.createdAt} edited={m.editedAt} readers={read.map((x) => nameOf(x.uid) || x.displayName)} notYet={others.filter((x) => !read.includes(x)).map((x) => nameOf(x.uid) || x.displayName)} onClose={() => setInfo(null)} />;
      })()}
      {forwarding && cid && <ForwardDialog cid={cid} messageIds={forwarding.map((m) => m.id)} draftText={forwarding.every((m) => m.from === user?.uid && m.text) ? forwarding.map((m) => m.text).join("\n\n") : undefined} onDone={(note) => { flash(note); setSelected(null); }} onClose={() => setForwarding(null)} />}
      {deleting && (() => {
        const everyone = deleting.every((m) => m.from === user?.uid && !m.pendingRequest && !m.deleted && !m.removed && !m.call);
        const read = deleting.some((m) => m.readAt) || isGroup;
        return <DeleteChoice count={deleting.length} everyone={everyone} read={read} onClose={() => setDeleting(null)}
          onMe={() => { const l = deleting; setDeleting(null); void hideMany(l); }}
          onEveryone={() => { const l = deleting; setDeleting(null); void deleteMany(l); }} />;
      })()}
      {translatingId && <TranslateDialog onPick={(lang, label) => { const m = messages.find((x) => x.id === translatingId); if (m) void translate(m, lang, label); }} onClose={() => setTranslatingId(null)} />}
      {summary && user && <SummaryDialog user={user} context={summary.context} count={summary.count} onClose={() => setSummary(null)} />}
      {moments && <MomentViewer moments={moments} onClose={() => setMoments(null)} onChanged={() => {}} />}
      {reporting && cid && <ReportDialog kind="conversation" targetId={cid} onClose={() => setReporting(false)} />}
      {reportingMsg && cid && <ReportDialog kind="conversation" targetId={cid} messageId={reportingMsg} onClose={() => setReportingMsg(null)} />}
    </div>
  );
}

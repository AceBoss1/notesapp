// Direct messages: client-safe constants and helpers.
export const MESSAGE_MAX = 2000;
export const MESSAGES_PER_MINUTE = 20; // per sender, per instance (see lib/rate-limit.ts)

// One conversation per pair of members; the id is the two uids in sorted order so either side finds it by id.
export const conversationId = (a: string, b: string) => [a, b].sort().join("_");

// Group chats: a conversation with `kind: "group"` has a title, any number of members and some admins. "team" groups are the staff-only rooms and
// meetings (only people with the admin claim, managed from the team hub); "public" groups are ordinary members' groups.
export const GROUP_TITLE_MAX = 60;
export const GROUP_MEMBERS_MAX = 50;
export type GroupScope = "public" | "team";
export type GroupInfo = { title: string; scope: GroupScope; memberUids: string[]; adminUids: string[]; createdBy: string; meetingId?: string; avatar?: string; sendLocked?: boolean; bannedUids?: string[] };
// A group's id never looks like the two-uids id of a direct conversation.
export const newGroupId = (rand: string) => `g_${rand}`;
export const isGroupId = (id: string) => id.startsWith("g_") || id.startsWith("meeting_") || id === "team_room";

export type MomentRef = { momentId: string; expiresAt: string };
export type ThreadMessage = {
  id: string;
  from: string;
  text: string;
  createdAt: string;
  // A reply to a moment. The moment itself is never copied into the message: once it has expired it can't be viewed.
  moment?: { momentId: string; expired: boolean };
  replyTo?: { id: string; from: string; text: string }; // the message this one answers (a short copy, so the quote still reads if it is long gone)
  sticker?: string; // a sticker's id (lib/stickers.ts); a sticker is a message of its own
  readAt?: string; // when the other person opened it (shown to the sender as a double tick)
  attachments?: AttachmentInfo[];
  call?: { kind: "audio" | "video"; outcome: "declined" | "missed" | "ended" | "failed"; seconds: number }; // a line recording a call (lib/calls.ts)
  removed?: { by: "admin" | "notesapp"; at: string }; // taken out by a group admin or by #NotesApp after a report: text and files are gone
  editedAt?: string; // changed by its sender (lib/message-edits.ts)
  deleted?: { at: string }; // deleted by its sender
  pendingRequest?: { id: string; kind: "edit" | "delete"; text?: string; readers: string[]; approved: string[]; expiresAt: string }; // waiting for the readers to agree
  reactions?: Record<string, string>; // uid → one of REACTIONS (one each; lib/message-edits.ts)
  forwarded?: boolean; // sent on from another chat (lib/message-forward.ts)
};

// #NotesApp's own emojis: typed as :na: or :academy: and drawn as small pictures inside #NotesApp (components/NotesAppEmoji.tsx).
// Anywhere that only shows text (the inbox, a bell, an email) they read as their label.
export const NOTESAPP_EMOJI: Record<string, { src: string; label: string }> = {
  ":na:": { src: "/images/emoji/na.png", label: "#NotesApp" },
  ":academy:": { src: "/images/emoji/academy.svg", label: "Notes Academy" },
};
export const NOTESAPP_EMOJI_RE = /:(?:na|academy):/g;
export const isNotesAppEmoji = (e: unknown): e is string => typeof e === "string" && Object.prototype.hasOwnProperty.call(NOTESAPP_EMOJI, e);
export const emojiAsText = (s: string) => s.replace(NOTESAPP_EMOJI_RE, (t) => NOTESAPP_EMOJI[t].label);

// Reactions: one per person per message. Any single emoji, or one of ours; each member keeps their own quick set of QUICK_COUNT along
// the top of the message menu (userPrefs/{uid}.quickReactions), starting from these.
export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", ":na:"] as const;
export const QUICK_COUNT = REACTIONS.length;
const PICTOGRAPH = new RegExp("^(?:\\p{Extended_Pictographic}|\\p{Regional_Indicator}|[#*0-9]\\uFE0F?\\u20E3)", "u");
const LETTER = new RegExp("[\\p{L}\\p{N}]", "u");
function oneEmoji(s: string): boolean {
  if (!s || s.length > 32 || /\s/.test(s) || !PICTOGRAPH.test(s)) return false;
  // One character on screen (a family, a flag or a skin tone is several code points but one grapheme), and no letters after it.
  if (typeof Intl.Segmenter === "function") return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)).length === 1;
  return !LETTER.test(s.replace(/^[#*0-9]/, ""));
}
export const isReaction = (e: unknown): e is string => typeof e === "string" && (isNotesAppEmoji(e) || oneEmoji(e));
// A member's quick set: QUICK_COUNT different reactions, or nothing (the default).
export function cleanQuickReactions(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length !== QUICK_COUNT || !v.every(isReaction) || new Set(v).size !== v.length) return null;
  return v as string[];
}
// The chips under a bubble: each emoji used, how many and who; the most used first, then in the default list's order.
export function reactionSummary(r: Record<string, string> | undefined): { emoji: string; count: number; uids: string[] }[] {
  if (!r) return [];
  const by = new Map<string, string[]>();
  for (const [u, e] of Object.entries(r)) if (e) by.set(e, [...(by.get(e) ?? []), u]);
  const rank = (e: string) => { const i = (REACTIONS as readonly string[]).indexOf(e); return i === -1 ? REACTIONS.length : i; };
  return Array.from(by, ([emoji, uids]) => ({ emoji, uids, count: uids.length })).sort((a, b) => b.count - a.count || rank(a.emoji) - rank(b.emoji) || a.emoji.localeCompare(b.emoji));
}

export const REMOVED_TEXT = { admin: "Message removed by a group admin", notesapp: "Message removed by #NotesApp" } as const;

// ---- Files in messages (images, video, documents). Kept in the private bucket and only handed out, as short-lived links, to the two
// people in the conversation. How big and how many depends on the plan (lib/limits.ts, set by admins in /admin/limits).
export type AttachmentKind = "image" | "video" | "document" | "audio";
export type MessageAttachment = { key: string; name: string; size: number; type: string; kind: AttachmentKind; durationSec?: number };
export type AttachmentInfo = Omit<MessageAttachment, "key">;

// Allowed files by extension. Nothing that can run (no programs, scripts or web pages).
export const ATTACHMENT_EXTENSIONS: Record<string, { type: string; kind: AttachmentKind }> = {
  jpg: { type: "image/jpeg", kind: "image" }, jpeg: { type: "image/jpeg", kind: "image" }, png: { type: "image/png", kind: "image" },
  webp: { type: "image/webp", kind: "image" }, gif: { type: "image/gif", kind: "image" },
  mp4: { type: "video/mp4", kind: "video" }, webm: { type: "video/webm", kind: "video" }, mov: { type: "video/quicktime", kind: "video" },
  pdf: { type: "application/pdf", kind: "document" }, txt: { type: "text/plain", kind: "document" }, csv: { type: "text/csv", kind: "document" },
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "document" },
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "document" },
  pptx: { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "document" },
  zip: { type: "application/zip", kind: "document" },
  // Voice notes recorded in the browser (WebM in Chrome and Firefox, MP4 in Safari) and common audio files.
  weba: { type: "audio/webm", kind: "audio" }, m4a: { type: "audio/mp4", kind: "audio" }, mp3: { type: "audio/mpeg", kind: "audio" },
};
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_EXTENSIONS).map((e) => `.${e}`).join(",");

// What a file is, going by its name (browsers often leave the type blank for documents). The stored type always comes from here.
export function attachmentTypeOf(filename: string): { type: string; kind: AttachmentKind } | null {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  return filename.includes(".") ? ATTACHMENT_EXTENSIONS[ext] ?? null : null;
}

export const attachmentLabel = (a: { kind: AttachmentKind; name: string }[]) =>
  a.length > 1 ? `📎 ${a.length} files` : a[0].kind === "image" ? "📷 Photo" : a[0].kind === "video" ? "🎥 Video" : a[0].kind === "audio" ? "🎙 Voice note" : `📄 ${a[0].name}`;

export const formatBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(n >= 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

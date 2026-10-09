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
export type GroupInfo = { title: string; scope: GroupScope; memberUids: string[]; adminUids: string[]; createdBy: string; meetingId?: string };
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
};

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

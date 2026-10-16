import type { Firestore } from "firebase-admin/firestore";
import { linkTokens } from "./linkify";

// Server-only. "@ada mentioned you" bells for mentions in public places: comments on journals, journals, moments, store reviews
// and sellers' replies, and approved recommendations. Never for chats (messages, group chats, Notes Life chat): those are
// conversations the person is already in, or not, and a mention there must not pull anyone in.
//
// Each person is told once per thing they're mentioned in (mentionNotices/{kind}_{sourceId}_{uid}), so editing a comment or a
// journal only tells the people who are newly mentioned. Nobody is told about their own mention, and a block either way
// (dmBlocks) means no bell. At most MENTION_MAX people per thing.
export type MentionKind = "comment" | "journal" | "moment" | "review" | "review_reply" | "recommendation";
export const MENTION_MAX = 10;
const NO_INBOX = new Set(["na-notesapp"]);

// The usernames mentioned in some text, in order, each once. Markdown and HTML are reduced to plain text first, and code is ignored.
// Markdown or HTML (journals) as plain text, keeping underscores (usernames have them) and dropping code.
export function flatten(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ").replace(/<(script|style|code|pre)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*>~]+/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
export function mentionedUsernames(text: string, markdown = false): string[] {
  const src = markdown ? flatten(text) : text;
  const out: string[] = [];
  for (const t of linkTokens(src)) if (t.kind === "mention" && !out.includes(t.username)) out.push(t.username);
  return out;
}

// A short piece of the text around the first mention of `username`, for the bell.
export function snippetAround(text: string, username: string, max = 90): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(`@${username}`);
  if (flat.length <= max) return flat;
  const start = Math.max(0, Math.min(at < 0 ? 0 : at - 30, flat.length - max));
  return `${start > 0 ? "…" : ""}${flat.slice(start, start + max).trim()}${start + max < flat.length ? "…" : ""}`;
}

export type MentionSource = {
  kind: MentionKind;
  sourceId: string;
  text: string;
  markdown?: boolean;
  author: { uid: string; name: string; username?: string; avatar?: string };
  // "in a comment on “Minding the pay gap”", "in a moment", …
  where: string;
  linkHref: string;
  // People who get their own bell about this thing already (the journal's author for a comment, the seller for a review).
  skipUids?: string[];
};

export async function notifyMentions(db: Firestore, s: MentionSource, now = new Date()): Promise<{ sent: number }> {
  const names = mentionedUsernames(s.text, s.markdown).filter((n) => !NO_INBOX.has(n)).slice(0, MENTION_MAX);
  if (!names.length) return { sent: 0 };
  const claims = await db.getAll(...names.map((n) => db.doc(`usernames/${n}`)));
  const people = claims
    .map((c, i) => ({ username: names[i], uid: c.exists ? String(c.data()?.uid ?? "") : "" }))
    .filter((p) => p.uid && p.uid !== s.author.uid && !(s.skipUids ?? []).includes(p.uid));
  if (!people.length) return { sent: 0 };

  const refs = people.flatMap((p) => [
    db.doc(`mentionNotices/${s.kind}_${s.sourceId}_${p.uid}`),
    db.doc(`dmBlocks/${p.uid}_${s.author.uid}`),
    db.doc(`dmBlocks/${s.author.uid}_${p.uid}`),
    db.doc(`users/${p.uid}`),
  ]);
  const snaps = await db.getAll(...refs);
  const batch = db.batch();
  let sent = 0;
  people.forEach((p, i) => {
    const [notice, blockedBy, blocked, user] = snaps.slice(i * 4, i * 4 + 4);
    if (notice.exists || blockedBy.exists || blocked.exists || !user.exists || user.data()?.suspended === true) return;
    const at = now.toISOString();
    batch.set(notice.ref, { kind: s.kind, sourceId: s.sourceId, recipientUid: p.uid, authorUid: s.author.uid, createdAt: at });
    batch.set(db.collection("notifications").doc(), {
      recipientUid: p.uid, type: "mention",
      message: `${s.author.name} mentioned you ${s.where}: “${snippetAround(s.markdown ? flatten(s.text) : s.text, p.username)}”`.slice(0, 280),
      ...(s.author.username ? { actorUsername: s.author.username } : {}),
      actorDisplayName: s.author.name,
      ...(s.author.avatar ? { actorAvatar: s.author.avatar } : {}),
      linkHref: s.linkHref, read: false, createdAt: at,
    });
    sent++;
  });
  if (sent) await batch.commit();
  return { sent };
}

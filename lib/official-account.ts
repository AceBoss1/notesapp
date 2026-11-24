import { NA_UID } from "./social-graph";
import { NA_NOTESAPP_PROFILE } from "./journals-directory";

// #NotesApp's official account (@na-notesapp, naapp.tech/u/na-notesapp) as a party to direct messages. Owner, 24 Nov 2026: "Set
// OFFICIAL_MESSAGES_USERNAME is #NotesApp: naapp.tech/u/na-notesapp". It has no login and no `users` doc (lib/journals-directory.ts),
// so its messages are written under the stand-in id NA_UID (as its follows are, lib/follows-server.ts), and every screen that would
// read the other person's `users` doc asks here first. Pure, so the browser (Inbox, Thread) and the server agree.

export const OFFICIAL_UID = NA_UID;
export const OFFICIAL_USERNAME = NA_NOTESAPP_PROFILE.username;
export const isOfficialUid = (uid: string | null | undefined) => uid === NA_UID;

/** How the official account shows in Messages: its channel name and picture, the ✔ and the team mark, and a link to /u/na-notesapp. */
export const OFFICIAL_PERSON = {
  uid: NA_UID, username: NA_NOTESAPP_PROFILE.username, displayName: NA_NOTESAPP_PROFILE.displayName, avatar: NA_NOTESAPP_PROFILE.avatar,
  level: "verified" as const, team: true,
};

/** The other side of a conversation as the Messages screens show it, from a `users` doc, or the official account. */
export function messagePerson(uid: string, u: { username?: unknown; displayName?: unknown; avatar?: unknown } | undefined) {
  if (isOfficialUid(uid)) return { uid, username: OFFICIAL_PERSON.username, displayName: OFFICIAL_PERSON.displayName, avatar: OFFICIAL_PERSON.avatar, official: true as const };
  return { uid, username: String(u?.username ?? ""), displayName: String(u?.displayName ?? "") || "Member", avatar: String(u?.avatar ?? "") };
}

/**
 * The username in OFFICIAL_MESSAGES_USERNAME, in any of the forms people paste: "na-notesapp", "@na-notesapp",
 * "naapp.tech/u/na-notesapp", "https://www.naapp.tech/u/na-notesapp/", even the owner's own "#NotesApp: naapp.tech/u/na-notesapp".
 */
export function officialUsernameFrom(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim().toLowerCase();
  const fromLink = /\/u\/@?([a-z0-9._-]+)/.exec(s);
  if (fromLink) return fromLink[1];
  return s.replace(/^.*\s/, "").replace(/^@/, "").replace(/\/+$/, "");
}

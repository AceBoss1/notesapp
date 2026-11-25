import type { Firestore } from "firebase-admin/firestore";
import { setting } from "./config";
import { MessageError, sendSystemMessage, type Alerts } from "./messages-server";
import { OFFICIAL_UID, OFFICIAL_USERNAME, officialUsernameFrom } from "./official-account";

// Direct messages from #NotesApp's own account (owner, 24 Nov 2026: "telling winners in Messages"; docs/ARCADE_TOURNAMENTS.md §5).
//
// Who they come from (owner, 24 Nov 2026: "Set OFFICIAL_MESSAGES_USERNAME is #NotesApp: naapp.tech/u/na-notesapp"): by default the
// official account @na-notesapp itself, under its stand-in id NA_UID (lib/official-account.ts). It has no login, so a winner's reply
// can't go to anyone's phone; it lands in Admin → #NotesApp inbox (lib/official-inbox-server.ts), where Customer care reads and
// answers as @na-notesapp. OFFICIAL_MESSAGES_USERNAME (lib/config.ts) can still name a real member account the team signs in as
// instead (how it worked first); unset, empty or any form of "na-notesapp" means the official account.
//
// Only server code calls this (Admin → Arcade tournaments, "Tell winners"; the inbox's replies); no route lets a browser choose the
// text or the recipient freely. It goes through sendSystemMessage (lib/messages-server.ts), which skips only the member-to-member rules
// (follow-only messages, the sender's plan) and keeps the rest (recipient exists, not suspended, hasn't blocked the account).

export type OfficialSender = { ok: true; uid: string; username: string } | { ok: false; error: string };

/** Who #NotesApp's messages come from, or why there's no one. `username` overrides the setting (tests); passing "" means "nobody set
 *  up" (so callers' "can't send" paths stay testable), while the setting left unset or empty means @na-notesapp. */
export async function officialSender(db: Firestore, username?: string): Promise<OfficialSender> {
  const raw = username === undefined ? setting("OFFICIAL_MESSAGES_USERNAME")?.trim() || OFFICIAL_USERNAME : username;
  const name = officialUsernameFrom(raw);
  if (!name) return { ok: false, error: "#NotesApp's own messaging account isn't set up: set OFFICIAL_MESSAGES_USERNAME (na-notesapp, or the team's own account) and redeploy." };
  if (name === OFFICIAL_USERNAME) return { ok: true, uid: OFFICIAL_UID, username: OFFICIAL_USERNAME };
  const uid = String((await db.doc(`usernames/${name}`).get()).data()?.uid ?? "");
  const u = uid ? (await db.doc(`users/${uid}`).get()).data() : undefined;
  if (!u) return { ok: false, error: `OFFICIAL_MESSAGES_USERNAME is @${name}, but there's no such account.` };
  if (u.suspended === true) return { ok: false, error: `@${name}, #NotesApp's messaging account, is suspended.` };
  return { ok: true, uid, username: name };
}

export type OfficialDeps = { sender?: OfficialSender; alerts?: Alerts; now?: Date };

/** Send one plain-text message from #NotesApp's account. The generic "New message" bell is left out: callers send their own bell,
 *  which says what it's about (a winner's bell links to the tournament). Push still goes, as for any message. */
export async function sendOfficialMessage(db: Firestore, toUid: string, text: string, deps: OfficialDeps = {}) {
  const sender = deps.sender ?? (await officialSender(db));
  if (!sender.ok) throw new MessageError(503, sender.error);
  return sendSystemMessage(db, sender.uid, toUid, text, deps.now ?? new Date(), async () => {}, deps.alerts);
}

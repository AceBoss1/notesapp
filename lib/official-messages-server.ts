import type { Firestore } from "firebase-admin/firestore";
import { setting } from "./config";
import { MessageError, sendSystemMessage, type Alerts } from "./messages-server";

// Direct messages from #NotesApp's own account (owner, 24 Nov 2026: "telling winners in Messages"; docs/ARCADE_TOURNAMENTS.md §5).
//
// Why a configured account: @notesapp and @na-notesapp are channels with no login and no inbox (lib/journals-directory.ts,
// lib/social-graph.ts NA_UID), so a winner's reply to them would land nowhere. §5 asks winners to reply to confirm their details, so the
// message comes from a real member account the team signs in as: OFFICIAL_MESSAGES_USERNAME (lib/config.ts). Unset, nothing is sent and
// the caller says why.
//
// Only server code calls this (Admin → Arcade tournaments, "Tell winners"); no route lets a browser choose the text or the recipient
// freely. It goes through sendSystemMessage (lib/messages-server.ts), which skips only the member-to-member rules (follow-only
// messages, the sender's plan) and keeps the rest (recipient exists, not suspended, hasn't blocked the account).

export type OfficialSender = { ok: true; uid: string; username: string } | { ok: false; error: string };

/** Who #NotesApp's messages come from, or why there's no one. `username` overrides the setting (tests). */
export async function officialSender(db: Firestore, username = setting("OFFICIAL_MESSAGES_USERNAME")): Promise<OfficialSender> {
  const name = String(username ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!name) return { ok: false, error: "#NotesApp's own messaging account isn't set up: set OFFICIAL_MESSAGES_USERNAME (the team's #NotesApp account) and redeploy." };
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

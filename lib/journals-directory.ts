import { ADMIN_PROFILES } from "./admin";

export type JournalDirectoryEntry = {
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  mandatory: boolean; // auto-followed for every new member, can't unfollow
  type: "channel" | "person"; // brand/company journal vs. an individual's
  synthetic: boolean; // no real Firebase Auth account / `users` doc — special-cased in app/u/[username]/page.tsx instead of calling getUserByUsername()
  firestoreBacked: boolean; // does this journal's content live in the real `notes` collection, with real comments/likes?
  verified: boolean; // gets the ✔ badge — see VERIFIED_USERNAMES below
};

// @notesapp — the platform's own voice. Fully synthetic: no login, no
// `users` doc, no `notes` documents. Its "journal" is 5 hardcoded
// posts (lib/notesapp-posts.ts), and it has no comments — there's
// nothing in Firestore to comment on.
export const OFFICIAL_NOTESAPP_PROFILE: JournalDirectoryEntry = {
  username: "notesapp",
  displayName: "#NotesApp",
  avatar: "/images/brand/notesapp-icon.webp",
  bio: "Platform updates, ships-log, and announcements from the #NotesApp team.",
  mandatory: true,
  type: "channel",
  synthetic: true,
  firestoreBacked: false,
  verified: true,
};

// @na-notesapp — the social cross-post mirror: everything published
// on the official social handles (LinkedIn, etc.) also lands here.
// Also synthetic in the sense that it has no login of its own — an
// admin posts as it by picking "NotesApp" from the author toggle in
// NoteForm.tsx, same mechanic already used to pick between Chimdinma
// and Emmanuel — but its entries are REAL published notes in the
// shared `notes` collection, with real comments, likes, and shares
// enabled exactly like any other note.
export const NA_NOTESAPP_PROFILE: JournalDirectoryEntry = {
  username: "na-notesapp",
  displayName: "NotesApp",
  avatar: "/images/brand/notesapp-icon.webp",
  bio: "Everything we publish on our official social handles, mirrored here — comments open.",
  mandatory: false,
  type: "channel",
  synthetic: true,
  firestoreBacked: true,
  verified: true,
};

// The three journals every new member is auto-following from the
// moment they sign up, and can't unfollow on the free tier (see
// lib/follows.ts — enforced both client-side and in firestore.rules).
// @na-notesapp is deliberately NOT in this list — it's a regular
// followable channel, not a mandatory one.
export const MANDATORY_JOURNALS: JournalDirectoryEntry[] = [
  OFFICIAL_NOTESAPP_PROFILE,
  {
    username: ADMIN_PROFILES["ezurukam@gmail.com"].username,
    displayName: ADMIN_PROFILES["ezurukam@gmail.com"].displayName,
    avatar: ADMIN_PROFILES["ezurukam@gmail.com"].avatar,
    bio: "Founder & CEO, #NotesApp.",
    mandatory: true,
    type: "person",
    synthetic: false,
    firestoreBacked: true,
    verified: true,
  },
  {
    username: ADMIN_PROFILES["precheks.info@gmail.com"].username,
    displayName: ADMIN_PROFILES["precheks.info@gmail.com"].displayName,
    avatar: ADMIN_PROFILES["precheks.info@gmail.com"].avatar,
    bio: "Co-Founder & COO, #NotesApp.",
    mandatory: true,
    type: "person",
    synthetic: false,
    firestoreBacked: true,
    verified: true,
  },
];

export const MANDATORY_USERNAMES = MANDATORY_JOURNALS.map((j) => j.username);

// Every username that gets the ✔ verified badge today — the 4
// official accounts. Real members don't have a path to this yet; see
// UserProfile.verified in lib/users.ts for where that's headed
// (Pro/Business tier accounts that pass basic verification).
export const VERIFIED_USERNAMES = [
  OFFICIAL_NOTESAPP_PROFILE.username,
  NA_NOTESAPP_PROFILE.username,
  ...MANDATORY_JOURNALS.filter((j) => j.type === "person").map((j) => j.username),
];

// Every synthetic (no real `users` doc) username — app/u/[username]/page.tsx
// checks against this list before ever calling getUserByUsername().
export const SYNTHETIC_JOURNALS: JournalDirectoryEntry[] = [
  OFFICIAL_NOTESAPP_PROFILE,
  NA_NOTESAPP_PROFILE,
];
export const SYNTHETIC_USERNAMES = SYNTHETIC_JOURNALS.map((j) => j.username);

// Brand/company journals — "Channels" in the /journals taxonomy.
export const CHANNEL_JOURNALS: JournalDirectoryEntry[] = [
  OFFICIAL_NOTESAPP_PROFILE,
  NA_NOTESAPP_PROFILE,
];

// Individual founders — "People" in the /journals taxonomy. Any other
// signed-up member is also a "person" journal; this constant is only
// the two who get the featured spotlight treatment.
export const FOUNDER_JOURNALS: JournalDirectoryEntry[] = MANDATORY_JOURNALS.filter(
  (j) => j.type === "person"
);

// Mirrors firestore.rules' usernames/{username} create-rule regex —
// used client-side (app/signup/page.tsx) for a friendly error instead
// of a raw permission-denied. Keep both in sync if this ever changes.
export function isReservedUsername(username: string): boolean {
  return username.toLowerCase().includes("notesapp");
}

import { ADMIN_PROFILES } from "./admin";

export type JournalDirectoryEntry = {
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  mandatory: boolean; // auto-followed for every new member, can't unfollow
  type: "channel" | "person"; // brand/company journal vs. an individual's
};

// @NotesApp itself isn't a real Firebase Auth account — no login, no
// entry in the `users` collection — so it's a synthetic profile,
// hardcoded here rather than fetched. app/u/notesapp/page.tsx special-
// cases this username instead of calling getUserByUsername().
export const OFFICIAL_NOTESAPP_PROFILE: JournalDirectoryEntry = {
  username: "notesapp",
  displayName: "#NotesApp",
  avatar: "/images/brand/notesapp-icon.webp",
  bio: "Platform updates, ships-log, and announcements from the #NotesApp team.",
  mandatory: true,
  type: "channel",
};

// The three journals every new member is auto-following from the
// moment they sign up, and can't unfollow on the free tier (see
// lib/follows.ts — enforced both client-side and in firestore.rules).
export const MANDATORY_JOURNALS: JournalDirectoryEntry[] = [
  OFFICIAL_NOTESAPP_PROFILE,
  {
    username: ADMIN_PROFILES["ezurukam@gmail.com"].username,
    displayName: ADMIN_PROFILES["ezurukam@gmail.com"].displayName,
    avatar: ADMIN_PROFILES["ezurukam@gmail.com"].avatar,
    bio: "Founder & CEO, #NotesApp.",
    mandatory: true,
    type: "person",
  },
  {
    username: ADMIN_PROFILES["precheks.info@gmail.com"].username,
    displayName: ADMIN_PROFILES["precheks.info@gmail.com"].displayName,
    avatar: ADMIN_PROFILES["precheks.info@gmail.com"].avatar,
    bio: "Co-Founder & COO, #NotesApp.",
    mandatory: true,
    type: "person",
  },
];

export const MANDATORY_USERNAMES = MANDATORY_JOURNALS.map((j) => j.username);

// Brand/company journals — "Channels" in the /journals taxonomy.
// Just @notesapp today; a future brand account (e.g. if Precheks ever
// ran its own journal on here) would be added to this array, not to
// MANDATORY_JOURNALS unless it should also be auto-followed.
export const CHANNEL_JOURNALS: JournalDirectoryEntry[] = MANDATORY_JOURNALS.filter(
  (j) => j.type === "channel"
);

// Individual founders — "People" in the /journals taxonomy. Any other
// signed-up member is also a "person" journal; this constant is only
// the two who get the featured spotlight treatment.
export const FOUNDER_JOURNALS: JournalDirectoryEntry[] = MANDATORY_JOURNALS.filter(
  (j) => j.type === "person"
);

import { ADMIN_PROFILES } from "./admin";

export type JournalDirectoryEntry = {
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  mandatory: boolean; // auto-followed for every new member, can't unfollow
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
  },
  {
    username: ADMIN_PROFILES["precheks.info@gmail.com"].username,
    displayName: ADMIN_PROFILES["precheks.info@gmail.com"].displayName,
    avatar: ADMIN_PROFILES["precheks.info@gmail.com"].avatar,
    bio: "Co-Founder & COO, #NotesApp.",
    mandatory: true,
  },
];

export const MANDATORY_USERNAMES = MANDATORY_JOURNALS.map((j) => j.username);

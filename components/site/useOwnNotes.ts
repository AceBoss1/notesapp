"use client";

import { useEffect, useState } from "react";
import { getAllNotes, isNoteBy, NoteWithComputed } from "@/lib/firestore-notes";
import { useSite } from "./SiteContext";

// The member's published notes (undefined while loading).
export function useOwnNotes(): NoteWithComputed[] | undefined {
  const { uid, username, displayName } = useSite();
  const [notes, setNotes] = useState<NoteWithComputed[] | undefined>(undefined);
  useEffect(() => {
    getAllNotes({ publishedOnly: true })
      .then((all) => setNotes(all.filter((n) => isNoteBy(n, { uid, username, displayName }))))
      .catch(() => setNotes([]));
  }, [uid, username, displayName]);
  return notes;
}

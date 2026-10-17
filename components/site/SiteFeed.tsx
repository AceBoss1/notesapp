"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { NoteWithComputed } from "@/lib/firestore-notes";
import { useSavedJournals } from "@/lib/saved-journals-client";
import FeedPost from "@/components/feed/FeedPost";
import { useSite } from "./SiteContext";

// The Maroon theme's notes: the same posts as the /journals feed (like, comment, share, save), stacked on a white card.
export default function SiteFeed({ notes }: { notes: NoteWithComputed[] }) {
  const site = useSite();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const { saved, toggle } = useSavedJournals(user);
  return (
    <div className="overflow-hidden rounded-2xl border border-rule bg-card">
      {notes.map((n) => (
        <FeedPost
          key={n.id}
          note={n}
          author={{ avatar: site.avatar, username: site.username, role: n.author_role || undefined, isOrg: site.isOrg }}
          user={user}
          views={n.viewCount || 0}
          saved={saved.has(n.id)}
          onSave={(id) => { void toggle(id); }}
        />
      ))}
    </div>
  );
}

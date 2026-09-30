"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getAllNotes, isAuthorOf, NoteWithComputed } from "@/lib/firestore-notes";
import { getUserByUid } from "@/lib/users";

// Signed-in publishers see their own published posts with a Boost
// button; everyone else gets sign-in / sign-up prompts.
export default function BoostablePosts() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [posts, setPosts] = useState<NoteWithComputed[] | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (!u) return;
        try {
          const [profile, all] = await Promise.all([getUserByUid(u.uid), getAllNotes({ publishedOnly: true })]);
          setPosts(all.filter((n) => n.authorUid === u.uid || (profile ? isAuthorOf(n, profile.displayName) : false)));
        } catch {
          setPosts([]);
        }
      }),
    []
  );

  if (user === undefined) return null;
  if (!user) {
    return (
      <div className="card mt-10 p-6 text-sm text-slate">
        <Link href="/login" className="font-semibold text-crimson underline">Sign in</Link> or{" "}
        <Link href="/signup" className="font-semibold text-crimson underline">create an account</Link> to boost a post.
      </div>
    );
  }
  if (posts === null) return <p className="mt-10 text-sm text-slate">Loading your posts…</p>;
  if (posts.length === 0) {
    return (
      <div className="card mt-10 p-6 text-sm text-slate">
        You don't have any published posts yet — publish one, then come back to boost it.
      </div>
    );
  }
  return (
    <div className="mt-10">
      <p className="eyebrow">Your published posts</p>
      <ul className="mt-3 divide-y divide-rule border border-rule">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-ui text-sm font-bold text-ink">{p.title}</p>
              <p className="font-mono text-xs text-slate">👁 {p.viewCount || 0} views</p>
            </div>
            <Link href={`/boost/${p.id}`} className="btn-primary shrink-0 !px-4 !py-2 text-xs">
              Boost
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

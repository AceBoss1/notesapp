"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getAllNotes, isNoteBy, NoteWithComputed } from "@/lib/firestore-notes";
import { getUserByUid } from "@/lib/users";
import { getStoreItems, StoreItem } from "@/lib/store";

// Signed-in publishers see their own published posts with a Boost
// button; everyone else gets sign-in / sign-up prompts.
export default function BoostablePosts() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [posts, setPosts] = useState<NoteWithComputed[] | null>(null);
  const [items, setItems] = useState<StoreItem[]>([]);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (!u) return;
        try {
          const [profile, all] = await Promise.all([getUserByUid(u.uid), getAllNotes({ publishedOnly: true })]);
          // Store items can be boosted too (a download needs its file attached first).
          if (profile) {
            const own = await getStoreItems(u.uid, profile.username).catch(() => [] as StoreItem[]);
            setItems(own.filter((i) => i.id && i.sellable && (i.kind !== "digital" || i.fileName)));
          }
          setPosts(all.filter((n) => isNoteBy(n, { uid: u.uid, username: profile?.username, displayName: profile?.displayName || "" })));
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
  if (posts.length === 0 && items.length === 0) {
    return (
      <div className="card mt-10 p-6 text-sm text-slate">
        You don't have any published posts or store items yet — publish a post or add an item to your store, then come back to boost it.
      </div>
    );
  }
  return (
    <div className="mt-10">
      {posts.length > 0 && (
        <>
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
        </>
      )}
      {items.length > 0 && (
        <>
          <p className={`eyebrow ${posts.length > 0 ? "mt-8" : ""}`}>Your store items</p>
          <ul className="mt-3 divide-y divide-rule border border-rule">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.image} alt="" className="h-12 w-10 shrink-0 object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-ui text-sm font-bold text-ink">{i.title}</p>
                    <p className="font-mono text-xs text-slate">{i.price}{i.kind === "digital" ? " · download" : ""}</p>
                  </div>
                </div>
                <Link href={`/boost/item/${i.id}`} className="btn-primary shrink-0 !px-4 !py-2 text-xs">
                  Boost
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

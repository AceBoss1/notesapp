"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useSavedItems } from "@/lib/store-social";
import type { StoreItem } from "@/lib/store";
import ItemCard from "@/components/StoreItemCard";
import JournalRow from "@/components/JournalRow";
import { useSavedJournals } from "@/lib/saved-journals-client";
import { getNoteById, type NoteWithComputed } from "@/lib/firestore-notes";

// What the member saved: journals (the bookmark in the feed) and store items (the heart on an item). They appear in the order
// they load.
export default function SavedItemsClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const { saved, toggle } = useSavedItems(user);
  const [items, setItems] = useState<Record<string, StoreItem | null>>({});
  const { saved: savedJournals } = useSavedJournals(user);
  const [journals, setJournals] = useState<Record<string, NoteWithComputed | null>>({});
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user === null) router.replace("/login"); }, [user, router]);
  useEffect(() => {
    for (const id of saved) {
      if (id in items) continue;
      getDoc(doc(db, "storeItems", id)).then((s) => setItems((cur) => ({ ...cur, [id]: s.exists() && s.data()?.sellable ? ({ ...(s.data() as StoreItem), id }) : null }))).catch(() => setItems((cur) => ({ ...cur, [id]: null })));
    }
  }, [saved, items]);
  useEffect(() => {
    for (const id of savedJournals) {
      if (id in journals) continue;
      getNoteById(id).then((n) => setJournals((cur) => ({ ...cur, [id]: n && n.status === "published" ? ({ ...n, excerpt: "", reading_time: 0 } as NoteWithComputed) : null }))).catch(() => setJournals((cur) => ({ ...cur, [id]: null })));
    }
  }, [savedJournals, journals]);
  const journalList = [...savedJournals].map((id) => journals[id]).filter((n): n is NoteWithComputed => !!n);
  const list = [...saved].map((id) => items[id]).filter((i): i is StoreItem => !!i);
  const loading = user === undefined || [...saved].some((id) => !(id in items));
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <span className="eyebrow">Your list</span>
      <h1 className="mt-2 font-display text-4xl text-ink">Saved</h1>
      {journalList.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl text-ink">Journals</h2>
          <p className="mt-1 text-sm text-slate">Journals you saved with the bookmark. Tap it again on the journal to remove one.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{journalList.map((n) => <JournalRow key={n.id} note={n} showAuthor />)}</div>
        </section>
      )}
      <h2 className="mt-10 font-display text-2xl text-ink">Store items</h2>
      <p className="mt-1 text-sm text-slate">Items you saved with the ♥ in any store. Tap the heart again to remove one.</p>
      {loading ? (
        <p className="mt-10 text-sm text-slate">Loading…</p>
      ) : list.length === 0 ? (
        <p className="mt-10 text-sm text-slate">You haven&apos;t saved anything yet. Open a store, such as the <Link href="/merchstore" className="text-crimson underline">shops</Link>, and tap the ♡ on an item.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((i) => <ItemCard key={i.id} item={i} saved onToggleSave={(id) => { toggle(id); }} />)}
        </div>
      )}
    </div>
  );
}

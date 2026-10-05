"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import BookingCard from "@/components/BookingCard";
import { recordView } from "@/lib/track";
import SocialLinksRow from "@/components/SocialLinksRow";
import { ItemCard } from "@/components/StorePageClient";
import { useSite } from "./SiteContext";
import { useOwnNotes } from "./useOwnNotes";
import { useOwnItems } from "./useOwnItems";
import NoteCard from "./NoteCard";

// Home: who they are, how to book them, and a taste of the notes and the shop.
export default function SiteHome() {
  const site = useSite();
  const notes = useOwnNotes();
  const items = useOwnItems();
  const [viewer, setViewer] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    recordView("profile", site.username);
    return onAuthStateChanged(auth, setViewer);
  }, [site.username]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <section className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.avatar} alt={site.displayName} className="h-28 w-28 shrink-0 rounded-full object-cover" />
        <div>
          <h1 className="font-display text-4xl text-ink">{site.displayName}</h1>
          {site.bio && <p className="mt-3 max-w-xl text-base text-slate">{site.bio}</p>}
          <SocialLinksRow social={site.social} />
        </div>
      </section>

      {/* Booking runs right here: pick a time, sign in if needed (the visitor is brought back signed in), pay with Paystack. */}
      <BookingCard username={site.username} publisherUid={site.uid} viewer={viewer} signInHref="/login" />

      {notes && notes.length > 0 && (
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Latest notes</p>
            <Link href={`${site.base}/notes`} className="font-ui text-xs font-semibold text-crimson hover:text-crimson-bright">All notes →</Link>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {notes.slice(0, 3).map((n) => <NoteCard key={n.id} note={n} base={site.base} />)}
          </div>
        </section>
      )}

      {items && items.length > 0 && (
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <p className="eyebrow">From the shop</p>
            <Link href={`${site.base}/shop`} className="font-ui text-xs font-semibold text-crimson hover:text-crimson-bright">Visit the shop →</Link>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {items.slice(0, 3).map((i) => <ItemCard key={i.id} item={i} shopBase={`${site.base}/shop`} />)}
          </div>
        </section>
      )}
    </div>
  );
}

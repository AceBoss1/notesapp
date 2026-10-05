"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import BookingCard from "@/components/BookingCard";
import { recordView } from "@/lib/track";
import ItemCard from "@/components/StoreItemCard";
import { useSite } from "./SiteContext";
import { useOwnNotes } from "./useOwnNotes";
import { useOwnItems } from "./useOwnItems";
import NoteCard from "./NoteCard";
import SiteProfileHeader from "./SiteProfileHeader";
import ScrollToHash from "@/components/ScrollToHash";

// Home: who they are, how to book them, and a taste of the notes and the shop.
export default function SiteHome() {
  const site = useSite();
  const notes = useOwnNotes();
  const items = useOwnItems();
  // No notes published (yet): the shop is what the home page is about, so show all of it.
  const storeFirst = notes !== undefined && notes.length === 0;
  // The shop comes before the notes when they have no notes, or chose the store as their front page.
  const shopFirst = storeFirst || site.home === "store";
  const [viewer, setViewer] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    recordView("profile", site.username);
    return onAuthStateChanged(auth, setViewer);
  }, [site.username]);

  const notesSection = notes && notes.length > 0 && (
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Latest notes</p>
            <Link href={`${site.base}/notes`} className="font-ui text-xs font-semibold text-crimson hover:text-crimson-bright">All notes →</Link>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {notes.slice(0, 3).map((n) => <NoteCard key={n.id} note={n} base={site.base} />)}
          </div>
        </section>
  );
  const itemsSection = items && items.length > 0 && (
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <p className="eyebrow">{shopFirst ? "Shop" : "From the shop"}</p>
            {!shopFirst && items.length > 3 && <Link href={`${site.base}/shop`} className="font-ui text-xs font-semibold text-crimson hover:text-crimson-bright">Visit the shop →</Link>}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(shopFirst ? items : items.slice(0, 3)).map((i) => <ItemCard key={i.id} item={i} shopBase={`${site.base}/shop`} />)}
          </div>
        </section>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <SiteProfileHeader />

      {/* Booking runs right here: pick a time, sign in if needed (the visitor is brought back signed in), pay with Paystack. */}
      <div id="book" className="scroll-mt-28">
        <BookingCard username={site.username} publisherUid={site.uid} viewer={viewer} signInHref="/login" />
      </div>
      <ScrollToHash />

      {shopFirst ? <>{itemsSection}{notesSection}</> : <>{notesSection}{itemsSection}</>}
    </div>
  );
}

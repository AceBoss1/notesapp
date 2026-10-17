"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import BookingCard from "@/components/BookingCard";
import { recordView } from "@/lib/track";
import ItemCard from "@/components/StoreItemCard";
import { isCrimsonTheme } from "@/lib/site-themes";
import { useSite } from "./SiteContext";
import { useOwnNotes } from "./useOwnNotes";
import { useOwnItems } from "./useOwnItems";
import NoteCard from "./NoteCard";
import SiteFeed from "./SiteFeed";
import SiteProfileHeader from "./SiteProfileHeader";
import AuroraBand from "./AuroraBand";
import ScrollToHash from "@/components/ScrollToHash";

const seeAll = "font-ui text-xs font-semibold text-crimson hover:text-crimson-bright";

// Home: who they are, then what they chose to show (Journals, Shop, Courses, in that order, or the shop first if that's their
// domain's front page), then how to book them.
export default function SiteHome() {
  const site = useSite();
  const { journals, shop, courses } = site.sections;
  const notes = useOwnNotes();
  const items = useOwnItems();
  const [viewer, setViewer] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    recordView("profile", site.username);
    return onAuthStateChanged(auth, setViewer);
  }, [site.username]);

  const shownNotes = journals ? notes ?? [] : [];
  const shownItems = shop ? items ?? [] : [];
  const hasNotes = shownNotes.length > 0;
  const hasItems = shownItems.length > 0;
  const loading = (journals && notes === undefined) || (shop && items === undefined);
  // Only one section has anything in it (for example they chose just the Shop, or have no notes yet): show all of it.
  // With several, a short preview of each and a link to its page.
  const full = !loading && Number(hasNotes) + Number(hasItems) === 1;
  // The shop comes first (and in full) when it's their domain's front page.
  const shopFirst = site.home === "store";

  const notesSection = hasNotes && (
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <p className="eyebrow">{full ? "Notes" : "Latest notes"}</p>
            {!full && <Link href={`${site.base}/notes`} className={seeAll}>See all notes →</Link>}
          </div>
          {site.theme === "maroon" ? (
            <div className="mt-5"><SiteFeed notes={full ? shownNotes : shownNotes.slice(0, 3)} /></div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(full ? shownNotes : shownNotes.slice(0, 3)).map((n) => <NoteCard key={n.id} note={n} base={site.base} />)}
            </div>
          )}
        </section>
  );
  const itemsSection = hasItems && (
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <p className="eyebrow">{full || shopFirst ? "Shop" : "From the shop"}</p>
            {!full && !shopFirst && shownItems.length > 3 && <Link href={`${site.base}/shop`} className={seeAll}>See the whole shop →</Link>}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(full || shopFirst ? shownItems : shownItems.slice(0, 3)).map((i) => <ItemCard key={i.id} item={i} shopBase={`${site.base}/shop`} />)}
          </div>
        </section>
  );
  // Courses aren't on #NotesApp yet, so they only get a line here when they're all the member chose to show.
  const coursesSection = courses && !journals && !shop && (
        <section className="mt-14">
          <p className="eyebrow">Courses</p>
          <div className="card mt-5 p-6">
            <p className="font-display text-xl text-ink">Courses are coming soon</p>
            <p className="mt-1 text-sm text-slate">{site.displayName}&apos;s courses will be listed here.</p>
          </div>
        </section>
  );
  const sections = <>{shopFirst ? <>{itemsSection}{notesSection}</> : <>{notesSection}{itemsSection}</>}{coursesSection}</>;

  // Booking runs right here: pick a time, sign in if needed (the visitor is brought back signed in), pay with Paystack.
  const booking = (
    <>
      <div id="book" className="scroll-mt-28">
        <BookingCard username={site.username} publisherUid={site.uid} viewer={viewer} signInHref="/login" />
      </div>
      <ScrollToHash />
    </>
  );

  // Aurora and Maroon: the profile sits on a card over a crimson band.
  if (isCrimsonTheme(site.theme)) {
    return (
      <div>
        <AuroraBand />
        <div className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
          <div className="card relative z-10 -mt-16 p-6"><SiteProfileHeader /></div>
          {sections}
          {booking}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <SiteProfileHeader />
      {sections}
      {booking}
    </div>
  );
}

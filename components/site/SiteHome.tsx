"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatNaira, PublisherSettings } from "@/lib/booking-time";
import { MAIN_HOST } from "@/lib/host";
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
  const [origin, setOrigin] = useState("");
  const [session, setSession] = useState<PublisherSettings["session"] | null>(null);

  useEffect(() => {
    setOrigin(window.location.hostname);
    recordView("profile", site.username);
    getDoc(doc(db, "publisherSettings", site.uid))
      .then((s) => {
        const x = (s.data() as PublisherSettings | undefined)?.session;
        setSession(x?.enabled ? x : null);
      })
      .catch(() => setSession(null));
  }, [site.uid, site.username]);

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

      {session && (
        <section className="card mt-12 flex flex-col items-start justify-between gap-5 p-7 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">Book a session</p>
            <h2 className="mt-2 font-display text-2xl text-ink">1:1 session with {site.displayName}</h2>
            <p className="mt-2 text-sm text-slate">
              {session.minutes} minutes · {formatNaira(session.priceKobo)} · pick a time and pay securely.
            </p>
          </div>
          {/* Signing in and paying happen on the main site; the booking page there is theirs. */}
          <a href={`https://${MAIN_HOST}/u/${site.username}${origin ? `?from=${encodeURIComponent(origin)}` : ""}`} className="btn-primary shrink-0">Book a time</a>
        </section>
      )}

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

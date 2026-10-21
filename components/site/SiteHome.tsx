"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import BookingCard from "@/components/BookingCard";
import { recordView } from "@/lib/track";
import { isCleanLike, isCrimsonTheme } from "@/lib/site-themes";
import { isBeautyKit, shopStyleOf, sortItems } from "@/lib/site-kits";
import { STORE_CATEGORIES, categoryOf } from "@/lib/store-meta";
import type { StoreItem } from "@/lib/store";
import { ProductGrid } from "./Storefront";
import { useSite } from "./SiteContext";
import { useOwnNotes } from "./useOwnNotes";
import { useOwnItems } from "./useOwnItems";
import NoteCard from "./NoteCard";
import SiteFeed from "./SiteFeed";
import TrackBox from "./TrackBox";
import SiteProfileHeader from "./SiteProfileHeader";
import AuroraBand from "./AuroraBand";
import { SiteContentBlocks, SiteHero, SiteInfoStrip, SitePhotoHero } from "./SiteBlocks";
import ScrollToHash from "@/components/ScrollToHash";
import CourseCard, { courseCardOf } from "@/components/CourseCard";
import { COURSES_LIVE } from "@/lib/site-settings";
import { useAcademy } from "@/lib/courses-client";
import { byRecent } from "@/lib/discovery";

const seeAll = "font-ui text-xs font-semibold text-crimson hover:text-crimson-bright";

// Home: who they are, their banner and hours strip (lib/site-kits.ts), then what they chose to show (a tracking box for logistics businesses, then
// Journals, Shop, Courses, in that order, or the shop first if that's their domain's front page), their other content sections in their order
// (services, gallery, testimonials, team, questions), then how to book them. The Clean look leads with the banner.
export default function SiteHome() {
  const site = useSite();
  const { journals, shop, courses } = site.sections;
  const notes = useOwnNotes();
  const items = useOwnItems();
  const courseList = useAcademy(site.username, COURSES_LIVE && courses);
  const [viewer, setViewer] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    recordView("profile", site.username);
    return onAuthStateChanged(auth, setViewer);
  }, [site.username]);

  const shownNotes = journals ? notes ?? [] : [];
  const shownItems = shop ? items ?? [] : [];
  const shownCourses = COURSES_LIVE && courses ? byRecent(courseList ?? []) : [];
  const hasNotes = shownNotes.length > 0;
  const hasItems = shownItems.length > 0;
  const hasCourses = shownCourses.length > 0;
  const loading = (journals && notes === undefined) || (shop && items === undefined) || (COURSES_LIVE && courses && courseList === undefined);
  // Only one section has anything in it (for example they chose just the Shop, or have no notes yet): show all of it.
  // With several, a short preview of each and a link to its page.
  const full = !loading && Number(hasNotes) + Number(hasItems) + Number(hasCourses) === 1;
  // What Home leads with (Your site, step 3: their shop, services, courses or notes, first and in full); "mix", the default, gives a
  // little of each. A domain set to open on the store leads with the shop.
  const focus = site.focus;
  const shopFirst = focus === "shop";

  const notesSection = hasNotes && (
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <p className="eyebrow">{full || focus === "notes" ? "Notes" : "Latest notes"}</p>
            {!full && <Link href={`${site.base}/notes`} className={seeAll}>See all notes →</Link>}
          </div>
          {site.theme === "maroon" ? (
            <div className="mt-5"><SiteFeed notes={full ? shownNotes : shownNotes.slice(0, focus === "notes" ? 9 : 3)} /></div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(full ? shownNotes : shownNotes.slice(0, focus === "notes" ? 9 : 3)).map((n) => <NoteCard key={n.id} note={n} base={site.base} />)}
            </div>
          )}
        </section>
  );
  // The shop as product tiles (components/site/Storefront.tsx): up to eight when it's the main thing they show, four beside other sections.
  const shopCount = full || shopFirst ? 8 : 4;
  const luxe = site.theme === "luxe";
  const itemsSection = hasItems && (luxe ? (
        // Luxe: the shop under centred titles, categories first, like a boutique's home page.
        <section className="mt-16">
          {(full || shopFirst) && <ShopByCategory items={shownItems} centred />}
          <h2 className="mt-16 text-center font-display text-3xl text-ink sm:text-4xl">New in</h2>
          <div className="mt-8"><ProductGrid items={sortItems(shownItems, "new").slice(0, shopCount)} base={site.base} style={shopStyleOf(site.kit)} /></div>
          <div className="mt-10 text-center"><Link href={`${site.base}/shop`} className="inline-block border border-ink px-8 py-3 font-ui text-xs font-bold uppercase tracking-[0.25em] text-ink hover:bg-ink hover:text-paper">Shop all {shownItems.length}</Link></div>
        </section>
  ) : (
        <section className="mt-14">
          <div className="flex items-end justify-between gap-3">
            <div><p className="eyebrow">{full || shopFirst ? "Shop" : "From the shop"}</p>{(full || shopFirst) && <h2 className="mt-1 font-display text-3xl text-ink">New in</h2>}</div>
            {shownItems.length > shopCount && <Link href={`${site.base}/shop`} className={seeAll}>Shop all {shownItems.length} →</Link>}
          </div>
          {(full || shopFirst) && <ShopByCategory items={shownItems} />}
          <div className="mt-5"><ProductGrid items={sortItems(shownItems, "new").slice(0, shopCount)} base={site.base} style={shopStyleOf(site.kit)} /></div>
          {shownItems.length > shopCount && <div className="mt-8 text-center"><Link href={`${site.base}/shop`} className="btn-primary inline-block !px-6 !py-2.5 text-sm">See the whole shop</Link></div>}
        </section>
  ));
  // Their Notes Academy courses, like the other sections. With none (or while Notes Academy is switched off) they only get a line
  // here when courses are all the member chose to show.
  const coursesSection = hasCourses ? (
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Courses</p>
            {!full && shownCourses.length > (focus === "courses" ? 9 : 3) && <Link href={`${site.base}/courses`} className={seeAll}>See all courses →</Link>}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(full ? shownCourses : shownCourses.slice(0, focus === "courses" ? 9 : 3)).map((c) => <CourseCard key={c.id} c={courseCardOf(c)} href={`${site.base}/courses/${c.slug}`} />)}
          </div>
        </section>
  ) : courses && !journals && !shop && !loading && (
        <section className="mt-14">
          <p className="eyebrow">Courses</p>
          <div className="card mt-5 p-6">
            <p className="font-display text-xl text-ink">{COURSES_LIVE ? "No courses yet" : "Courses are coming soon"}</p>
            <p className="mt-1 text-sm text-slate">{site.displayName}&apos;s courses will be listed here.</p>
          </div>
        </section>
  );
  // A logistics business (the Track section): tracking comes first, right under who they are.
  // Scholar puts their work (publications, talks…) before their journals.
  const pages = focus === "shop" ? <>{itemsSection}{notesSection}{coursesSection}</>
    : focus === "courses" ? <>{coursesSection}{itemsSection}{notesSection}</>
    : focus === "notes" ? <>{notesSection}{itemsSection}{coursesSection}</>
    : <>{itemsSection}{notesSection}{coursesSection}</>; // a mix: a short look at each
  const sections = focus === "services" || site.theme === "scholar"
    ? <>{site.sections.track && <TrackBox />}<SiteContentBlocks {...(focus === "services" ? { lead: "services" as const } : {})} />{pages}</>
    : <>{site.sections.track && <TrackBox />}{pages}<SiteContentBlocks /></>;
  const hero = site.shownBlocks.includes("hero"), strip = site.shownBlocks.includes("info");
  // A shop first and foremost (the shop is their front page, or on without journals) with a cover photo: the cover goes edge to edge at the
  // top with Shop now over it, the way online shops open (Scholar keeps its reading layout).
  // The beauty kits' banner as a full photo (hero style "photo"): edge to edge at the top, on the Clean look; it takes the place of the shop banner.
  // Luxe always opens with it; Clean when the banner's style is Full photo. The cover photo stands in for a banner picture.
  const photoHero = hero && !!(site.blocks.hero.image || site.cover) && (site.theme === "luxe" || (site.theme === "clean" && site.blocks.hero.style === "photo"));
  const banner = !photoHero && shop && !!site.cover && (shopFirst || !journals) && site.theme !== "scholar";
  const storeBanner = banner && <StoreBanner />;

  // Booking runs right here: pick a time, sign in if needed (the visitor is brought back signed in), pay with Paystack.
  const booking = (
    <>
      <div id="book" className="scroll-mt-28">
        <BookingCard username={site.username} publisherUid={site.uid} viewer={viewer} signInHref="/login" {...(isBeautyKit(site.kit) ? { title: "Book your appointment" } : {})} />
      </div>
      <ScrollToHash />
    </>
  );

  // Aurora and Maroon: the profile sits on a card over a crimson band.
  if (isCrimsonTheme(site.theme)) {
    return (
      <div>
        {storeBanner || <AuroraBand />}
        <div className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
          <div className={`card relative z-10 p-6 ${banner ? "mt-8" : "-mt-16"}`}><SiteProfileHeader noCover={banner} /></div>
          {hero && <SiteHero clean={false} />}
          {strip && <SiteInfoStrip />}
          {sections}
          {booking}
        </div>
      </div>
    );
  }

  // Clean: the banner first (or who they are, without one), the strip, what they show, then who they are on a card, and booking.
  if (isCleanLike(site.theme)) {
    return (
      <>
      {photoHero ? <SitePhotoHero /> : storeBanner}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {photoHero ? null : hero ? <SiteHero clean /> : <SiteProfileHeader noCover={banner} />}
        {strip && <SiteInfoStrip />}
        {sections}
        {hero && <div className="card mt-14 p-6"><SiteProfileHeader noCover={banner || photoHero} /></div>}
        {booking}
      </div>
      </>
    );
  }

  // Scholar: a narrow reading column; who they are, a few words, then their work (publications, talks, awards, news in their order).
  if (site.theme === "scholar") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SiteProfileHeader />
        {hero && <SiteHero clean={false} plain />}
        {strip && <SiteInfoStrip />}
        {sections}
        {booking}
      </div>
    );
  }

  return (
    <>
    {storeBanner}
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <SiteProfileHeader noCover={banner} />
      {hero && <SiteHero clean={false} />}
      {strip && <SiteInfoStrip />}
      {sections}
      {booking}
    </div>
    </>
  );
}

// The cover photo edge to edge and uncropped (members design covers with their own words on them), like an online shop's opening banner:
// the picture opens the shop, with a Shop now button under it.
function StoreBanner() {
  const site = useSite();
  return (
    <section className="border-b border-rule bg-card">
      <Link href={`${site.base}/shop`} aria-label={`Shop ${site.displayName}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.cover} alt="" className="max-h-[80vh] w-full object-cover" />
      </Link>
      <div className="py-5 text-center">
        <Link href={`${site.base}/shop`} className="inline-block rounded-full bg-crimson px-8 py-3 font-ui text-sm font-bold uppercase tracking-[0.2em] text-paper shadow-sm hover:bg-crimson-bright">Shop now</Link>
      </div>
    </section>
  );
}

// Shop by category (the shop's main page on Home): a tile for each category they sell in, with the newest item's picture, opening the shop
// filtered to it.
function ShopByCategory({ items, centred = false }: { items: StoreItem[]; centred?: boolean }) {
  const { base } = useSite();
  const cats = STORE_CATEGORIES.map((c) => ({ c, first: sortItems(items.filter((i) => categoryOf(i) === c), "new")[0] })).filter((x) => x.first);
  if (cats.length < 2) return null;
  return (
    <div className="mt-6">
      {centred ? <h2 className="text-center font-display text-3xl text-ink sm:text-4xl">Shop by category</h2> : <p className="font-ui text-xs font-semibold uppercase tracking-[0.25em] text-slate">Shop by category</p>}
      <div className={`-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 ${centred ? "mt-8" : "mt-3"} ${cats.length === 2 ? "sm:grid-cols-2" : cats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        {cats.slice(0, 8).map(({ c, first }) => (
          <Link key={c} href={`${base}/shop?cat=${encodeURIComponent(c)}`} className="group relative w-40 shrink-0 snap-start overflow-hidden rounded-2xl sm:w-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={first!.image} alt="" className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10 font-ui text-sm font-bold text-white">{c}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { buttonHref, resolveButton, type BlockId, type SiteButton } from "@/lib/site-kits";
import { useSite } from "./SiteContext";

// The content sections of a member's site (lib/site-kits.ts), in the member's order. Colours come from the site's colour set (the crimson
// classes follow it), so every look and every colour set draws them the same way.

const outward = (b: SiteButton) => (b.kind === "link" || b.kind === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {});
function Btn({ b, primary }: { b: SiteButton; primary?: boolean }) {
  const site = useSite();
  return (
    <a href={buttonHref(b, site.base, `Hello ${site.displayName}, `)} {...outward(b)}
      className={primary
        ? "inline-flex items-center justify-center rounded-xl bg-crimson px-5 py-3 font-ui text-sm font-bold text-paper hover:bg-crimson-bright"
        : "inline-flex items-center justify-center rounded-xl border border-crimson/30 px-5 py-3 font-ui text-sm font-bold text-crimson hover:bg-crimson/5"}>
      {b.label}{b.kind === "link" ? " →" : ""}
    </a>
  );
}

// The banner. Clean: words on the left, the picture on the right, big. Other looks: a card.
export function SiteHero({ clean }: { clean: boolean }) {
  const { blocks } = useSite();
  const h = blocks.hero;
  const first = resolveButton(h.button, blocks.info), second = resolveButton(h.second, blocks.info);
  const words = (
    <div>
      {h.headline && <h1 className={`font-display leading-tight text-ink ${clean ? "text-4xl sm:text-5xl" : "text-3xl"}`}>{h.headline}</h1>}
      {h.subline && <p className="mt-4 max-w-xl text-base text-slate sm:text-lg">{h.subline}</p>}
      {(first || second) && <div className="mt-6 flex flex-wrap gap-3">{first && <Btn b={first} primary />}{second && <Btn b={second} />}</div>}
    </div>
  );
  if (!clean) return <section className="card mt-10 p-6 sm:p-8">{words}</section>;
  return (
    <section className={`grid items-center gap-8 ${h.image ? "md:grid-cols-2" : ""}`}>
      {words}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {h.image && <img src={h.image} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-sm" />}
    </section>
  );
}

const Icon = ({ c }: { c: string }) => <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-crimson/10 text-lg">{c}</span>;
// The hours card is connected to their booking calendar: its hours can come from the calendar, and while their sessions are on it opens the
// booking card.
export function SiteInfoStrip() {
  const { blocks, booking, base } = useSite();
  const i = blocks.info;
  const wa = i.whatsapp ? buttonHref({ kind: "whatsapp", label: "", value: i.whatsapp }, "") : "";
  const hours = (i.bookingHours && booking.hours) || i.hours;
  const cards = [
    hours && { icon: "🕘", text: hours, href: booking.offered ? `${base}/#book` : "" },
    i.whatsapp && { icon: "💬", text: "Chat on WhatsApp", href: wa },
    i.phone && { icon: "📞", text: i.phone, href: `tel:${i.phone}` },
    i.address && { icon: "📍", text: i.address, href: i.mapUrl },
  ].filter(Boolean) as { icon: string; text: string; href: string }[];
  return (
    <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Opening hours and contacts">
      {cards.map((c) => {
        const inner = <><Icon c={c.icon} /><span className="text-sm font-semibold text-ink">{c.text}</span></>;
        return c.href
          ? <a key={c.icon} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="card flex items-center gap-3 p-4 hover:border-crimson">{inner}</a>
          : <div key={c.icon} className="card flex items-center gap-3 p-4">{inner}</div>;
      })}
    </section>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => <p className="eyebrow">{children}</p>;
function Services() {
  const { blocks } = useSite();
  return (
    <section className="mt-14">
      <Heading>Services and prices</Heading>
      <ul className="card mt-5 divide-y divide-rule">
        {blocks.services.items.map((s, n) => (
          <li key={n} className="flex items-start justify-between gap-4 p-4">
            <span><span className="block font-ui text-sm font-bold text-ink">{s.name}</span>{s.note && <span className="block text-xs text-slate">{s.note}</span>}</span>
            {s.price && <span className="shrink-0 font-ui text-sm font-bold text-crimson">{s.price}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
function Gallery() {
  const { blocks } = useSite();
  const [open, setOpen] = useState<number | null>(null);
  const items = blocks.gallery.items;
  return (
    <section className="mt-14">
      <Heading>Gallery</Heading>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((g, n) => (
          <button key={n} type="button" onClick={() => setOpen(n)} className="group overflow-hidden rounded-2xl text-left" aria-label={g.caption || `Picture ${n + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.image} alt={g.caption} loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <figure className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={items[open].image} alt={items[open].caption} className="max-h-[80vh] w-auto rounded-2xl" />
            {items[open].caption && <figcaption className="mt-2 text-center text-sm text-paper">{items[open].caption}</figcaption>}
            <button type="button" onClick={() => setOpen(null)} className="mx-auto mt-3 block rounded-full bg-paper px-4 py-1.5 text-xs font-semibold text-ink">Close</button>
          </figure>
        </div>
      )}
    </section>
  );
}
function Testimonials() {
  const { blocks } = useSite();
  return (
    <section className="mt-14">
      <Heading>What people say</Heading>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.testimonials.items.map((x, n) => (
          <figure key={n} className="card p-5">
            <blockquote className="whitespace-pre-line text-sm text-ink">“{x.quote}”</blockquote>
            <figcaption className="mt-3 text-xs"><b className="text-ink">{x.name}</b>{x.role && <span className="text-slate"> · {x.role}</span>}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
function Team() {
  const { blocks } = useSite();
  return (
    <section className="mt-14">
      <Heading>Our team</Heading>
      <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {blocks.team.items.map((x, n) => (
          <li key={n} className="card p-4 text-center">
            {x.photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={x.photo} alt="" loading="lazy" className="mx-auto h-20 w-20 rounded-full object-cover" />
              : <span aria-hidden className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-crimson/10 font-display text-2xl text-crimson">{x.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>}
            <p className="mt-3 font-ui text-sm font-bold text-ink">{x.name}</p>
            {x.role && <p className="text-xs text-slate">{x.role}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
function Faq() {
  const { blocks } = useSite();
  return (
    <section className="mt-14">
      <Heading>Questions and answers</Heading>
      <div className="card mt-5 divide-y divide-rule">
        {blocks.faq.items.map((x, n) => (
          <details key={n} className="group p-4">
            <summary className="cursor-pointer list-none font-ui text-sm font-bold text-ink"><span className="mr-2 inline-block text-crimson transition-transform group-open:rotate-90">›</span>{x.q}</summary>
            <p className="mt-2 whitespace-pre-line pl-5 text-sm text-slate">{x.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

const PARTS: Record<Exclude<BlockId, "hero" | "info">, () => JSX.Element> = { services: Services, gallery: Gallery, testimonials: Testimonials, team: Team, faq: Faq };
// The sections after the banner and the strip, in the member's order.
export function SiteContentBlocks() {
  const { shownBlocks } = useSite();
  return <>{shownBlocks.filter((id): id is keyof typeof PARTS => id in PARTS).map((id) => { const P = PARTS[id]; return <P key={id} />; })}</>;
}

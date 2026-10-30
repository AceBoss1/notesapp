"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHero from "@/components/PageHero";
import { CopyLink } from "@/components/ReferralsPanel";
import { api } from "@/lib/moments-client";
import { useMember } from "@/lib/member-client";
import { affiliateKobo, referralLink } from "@/lib/referrals";
import { naira } from "@/lib/discounts";

// The affiliate marketplace: every product whose publisher pays a share to members who promote it (lib/referrals-server.ts
// setOffer). A member picks one, copies their link (/r/<username>?to=<the product>) and shares it with their audience.
type Offer = { id: string; itemId: string; ownerUsername: string; percent: number; title: string; image: string; priceKobo: number; path: string; kind: "store" | "digital" | "course" };
const KINDS = [["all", "Everything"], ["store", "Shop"], ["digital", "Downloads"], ["course", "Courses"]] as const;
const KIND_LABEL = { store: "Shop", digital: "Download", course: "Course" };

export default function AffiliatesPage() {
  const { user } = useMember();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [me, setMe] = useState<{ username: string; verified: boolean } | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"share" | "earn" | "price">("earn");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/referrals/offers").then((r) => r.json()).then((r) => setOffers(r.offers ?? [])).catch(() => setOffers([]));
  }, []);
  useEffect(() => {
    if (!user) { setMe(null); return; }
    api<{ username: string; verified: boolean }>("/api/referrals").then(setMe).catch(() => setMe(null));
  }, [user]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return (offers ?? [])
      .filter((o) => (kind === "all" || o.kind === kind) && (!words || `${o.title} ${o.ownerUsername}`.toLowerCase().includes(words)))
      .sort((a, b) => sort === "share" ? b.percent - a.percent : sort === "price" ? a.priceKobo - b.priceKobo : affiliateKobo(b.priceKobo, b.percent) - affiliateKobo(a.priceKobo, a.percent));
  }, [offers, kind, q, sort]);

  return (
    <>
      <PageHero eyebrow="Earn on #NotesApp" title="Affiliate marketplace" compact>
        Find products to promote to your audience. Their publishers pay you a share of every sale that comes through your link.
      </PageHero>
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1.5 font-ui text-xs font-semibold ${kind === k ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-slate"}`}>{label}</button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or publishers" aria-label="Search"
            className="ml-auto w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson sm:w-64" />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="rounded-lg border border-rule bg-card px-3 py-2 text-sm text-ink">
            <option value="earn">Most you earn</option>
            <option value="share">Highest share</option>
            <option value="price">Lowest price</option>
          </select>
        </div>

        {!user && <p className="mt-4 text-sm text-slate"><Link href="/login?next=/affiliates" className="text-crimson underline">Sign in</Link> to get your links. Any member with a verified email can promote.</p>}
        {user && me && !me.verified && <p className="mt-4 text-sm text-slate">Verify your email to get your links.</p>}

        {offers === null ? <p className="mt-8 text-sm text-slate">Loading…</p> : shown.length === 0 ? (
          <p className="mt-8 text-sm text-slate">{offers.length ? "Nothing matches that." : "No products are open to affiliates yet. Publishers: set a share on yours under Account → Referrals."}</p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((o) => (
              <li key={o.id} className="card flex flex-col overflow-hidden">
                <Link href={o.path} className="block aspect-[4/3] bg-field">
                  {o.image ? <img src={o.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full items-center justify-center font-display text-3xl text-slate">{o.title.slice(0, 1)}</span>}
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-ui text-[11px] font-bold uppercase tracking-wide text-slate">{KIND_LABEL[o.kind]} · @{o.ownerUsername}</p>
                  <Link href={o.path} className="mt-1 font-display text-lg leading-snug text-ink hover:text-crimson">{o.title}</Link>
                  <p className="mt-2 text-sm text-ink">
                    {naira(o.priceKobo)} · <b className="text-moss">{o.percent}%</b> to you: <b className="text-moss">{naira(affiliateKobo(o.priceKobo, o.percent))}</b> a sale
                  </p>
                  <div className="mt-auto pt-4">
                    {me?.verified && me.username ? (
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-lg border border-rule bg-field px-2 py-1.5 text-xs text-slate">{referralLink(origin, me.username, o.path)}</code>
                        <CopyLink url={referralLink(origin, me.username, o.path)} label="Get my link" />
                      </div>
                    ) : <Link href={user ? "/profile/referrals" : "/login?next=/affiliates"} className="btn-ghost !px-4 !py-2 text-sm">Get my link</Link>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-xs text-slate">
          You earn on what the buyer actually pays (after any discount code), once the payment clears. Not on your own purchases.
          See <Link href="/help/referrals" className="text-crimson underline">Referrals and affiliates</Link> and your earnings in <Link href="/profile/referrals" className="text-crimson underline">Account → Referrals</Link>.
        </p>
      </section>
    </>
  );
}

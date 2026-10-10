"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUsername, canPublish, UserProfile } from "@/lib/users";
import Avatar from "@/components/Avatar";
import StoreManager from "@/components/StoreManager";
import { digitalReady, getStoreItems, StoreItem } from "@/lib/store";
import { useMemberships } from "@/lib/useMemberships";
import ItemCard from "@/components/StoreItemCard";
import BoostedStrip from "@/components/BoostedStrip";
import MessageButton from "@/components/messages/MessageButton";
import FavoriteButton from "@/components/FavoriteButton";
import { getStoreStats, useSavedItems, type StoreStat } from "@/lib/store-social";
import { STORE_CATEGORIES, categoryOf } from "@/lib/store-meta";

export default function StorePageClient({ params }: { params: { username: string } }) {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [viewer, setViewer] = useState<User | null>(null);
  const [stats, setStats] = useState<Record<string, StoreStat>>({});
  const [filter, setFilter] = useState<string>("All");
  const [saveError, setSaveError] = useState("");
  const router = useRouter();
  const { saved, toggle } = useSavedItems(viewer);
  const onSave = async (itemId: string) => {
    if (!viewer) return router.push("/login");
    setSaveError("");
    const r = await toggle(itemId);
    if (!r.ok) setSaveError(r.error || "Couldn't save that.");
  };

  useEffect(() => onAuthStateChanged(auth, setViewer), []);
  const { orgs } = useMemberships(viewer);

  async function loadItems(p: UserProfile) {
    setItems(await getStoreItems(p.uid, p.username));
    setStats(await getStoreStats(p.uid));
  }

  useEffect(() => {
    getUserByUsername(params.username)
      .then((p) => {
        setProfile(p);
        if (p) loadItems(p);
      })
      .catch(() => setProfile(null));
  }, [params.username]);

  if (profile === undefined) {
    return <div className="py-24 text-center text-sm text-slate">Loading…</div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="font-display text-2xl text-ink">Store not found</p>
      </div>
    );
  }

  const isOwner = !!viewer && viewer.uid === profile.uid;
  // An organisation's owner can give team members store access; funds and liability stay with the organisation.
  const teamAccess = !!viewer && !isOwner && (orgs || []).some((o) => o.uid === profile.uid && o.store && o.canPublish);
  const ownerCanEdit = (isOwner && canPublish(profile)) || teamAccess;
  const isOrg = profile.accountKind === "organisation";
  // Publisher listings are on-platform physical goods only; legacy link-out listings stay hidden.
  const shown = items.filter((i) => !i.id || i.sellable);
  // A download isn't shown to buyers until its file is attached.
  const visible = shown.filter((i) => i.kind !== "digital" || isOwner || teamAccess || digitalReady(i));
  const counts = STORE_CATEGORIES.map((c) => ({ c, n: visible.filter((i) => categoryOf(i) === c).length })).filter((x) => x.n > 0);
  const inFilter = (i: StoreItem) => filter === "All" || categoryOf(i) === filter;
  const digitalItems = visible.filter((i) => i.kind === "digital" && inFilter(i));
  const physicalItems = visible.filter((i) => i.kind !== "digital" && inFilter(i));
  const statOf = (i: StoreItem) => (i.id ? stats[i.id] : undefined);
  const totalSaved = visible.reduce((n, i) => n + (statOf(i)?.favs ?? 0), 0);
  // The most looked-at items (only ones somebody has looked at), and a featured pick: most saved and viewed among what can be bought.
  const mostViewed = visible.filter((i) => i.id && (statOf(i)?.views ?? 0) > 0).sort((a, b) => (statOf(b)!.views - statOf(a)!.views)).slice(0, 4);
  const buyable = visible.filter((i) => i.id && i.sellable && (i.kind === "digital" || (i.stock ?? 0) > 0));
  const featured = buyable.length >= 2 ? [...buyable].sort((a, b) => ((statOf(b)?.favs ?? 0) * 3 + (statOf(b)?.views ?? 0)) - ((statOf(a)?.favs ?? 0) * 3 + (statOf(a)?.views ?? 0)))[0] : null;

  return (
    <div>
      <div className="bg-crimson-deep px-4 pb-24 pt-10 text-paper sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow !text-paper/70">Brand store</p>
          <p className="mt-3 max-w-2xl text-sm text-paper/80">
            You pay here and #NotesApp holds your money until you confirm the parcel arrived. Every order gets a parcel ID you can{" "}
            <Link href="/track" className="underline">track</Link>. Physical items are delivered by the seller; downloads are instant.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="card -mt-16 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar src={profile.avatar} alt={profile.displayName} size={72} square={isOrg} />
            <div>
              <h1 className="font-display text-3xl text-ink">{profile.displayName}&apos;s store</h1>
              <p className="mt-1 text-sm text-slate">
                {visible.length} item{visible.length === 1 ? "" : "s"}{totalSaved > 0 ? ` · ♥ ${totalSaved} saved` : ""}{profile.bio ? ` · ${profile.bio.slice(0, 90)}${profile.bio.length > 90 ? "…" : ""}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <MessageButton username={profile.username} profileUid={profile.uid} />
            {viewer && <Link href="/saved" className="btn-ghost">♥ Saved items</Link>}
            <Link href={`/u/${profile.username}`} className="btn-ghost shrink-0">Back to profile</Link>
          </div>
        </div>

        {ownerCanEdit && <StoreManager profile={profile} items={items} onChanged={() => loadItems(profile)} />}
        {isOwner && !ownerCanEdit && (
          <p className="mt-6 text-sm text-slate">
            This is your store. Once you can publish, you&apos;ll be able to add items here —{" "}
            <Link href="/profile/publishing" className="text-crimson">start publishing</Link>.
          </p>
        )}

        <BoostedStrip owner={profile.uid} title="Boosted in this store" />

        {saveError && <p className="mt-4 text-sm text-crimson" role="alert">{saveError}</p>}

        {visible.length === 0 ? (
          <p className="mt-10 text-sm text-slate">This store is empty for now.</p>
        ) : (
          <>
            {featured && (
              <section className="card mt-10 grid overflow-hidden sm:grid-cols-2" aria-label="Featured in this store">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featured.image} alt={featured.title} className="h-72 w-full object-cover sm:h-96" />
                <div className="flex flex-col justify-center gap-3 bg-crimson-deep p-8 text-paper">
                  <p className="eyebrow !text-paper/70">Featured in this store</p>
                  <h2 className="font-display text-3xl">{featured.title}</h2>
                  <p className="font-mono text-lg">{featured.price}</p>
                  {featured.subtitle && <p className="text-sm text-paper/80">{featured.subtitle.length > 140 ? `${featured.subtitle.slice(0, 140).replace(/\s+\S*$/, "")}…` : featured.subtitle}</p>}
                  <p className="text-xs text-paper/70">{categoryOf(featured)}{featured.kind !== "digital" && featured.shipsFrom ? ` · Ships from ${featured.shipsFrom}` : ""}</p>
                  <div><Link href={`/shop/${featured.id}`} className="btn-primary !bg-paper !text-crimson-deep">View item</Link></div>
                </div>
              </section>
            )}

            {counts.length > 1 && (
              <section className="mt-10" aria-label="Browse by category">
                <h2 className="font-display text-xl text-ink">Browse by category</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[{ c: "All", n: visible.length }, ...counts].map((x) => (
                    <button key={x.c} type="button" aria-pressed={filter === x.c} onClick={() => setFilter(x.c)}
                      className={`rounded-full border px-4 py-1.5 text-sm ${filter === x.c ? "border-crimson bg-crimson text-white" : "border-rule bg-card text-ink hover:border-crimson"}`}>
                      {x.c} <span className="font-mono text-xs opacity-70">{x.n}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {digitalItems.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-2xl text-ink">Digital downloads</h2>
                <p className="mt-1 text-xs text-slate">Pay once, download instantly. Digital sales are final once downloaded.</p>
                <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {digitalItems.map((item) => <ItemCard key={item.id ?? item.title} item={item} saved={!!item.id && saved.has(item.id)} onToggleSave={onSave} favs={statOf(item)?.favs} />)}
                </div>
              </section>
            )}
            {physicalItems.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-2xl text-ink">Physical items</h2>
                <p className="mt-1 text-xs text-slate">Delivered to you; your money is held until you confirm the parcel arrived. Each item says where it ships from.</p>
                <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {physicalItems.map((item) => <ItemCard key={item.id ?? item.title} item={item} saved={!!item.id && saved.has(item.id)} onToggleSave={onSave} favs={statOf(item)?.favs} />)}
                </div>
              </section>
            )}
            {digitalItems.length === 0 && physicalItems.length === 0 && <p className="mt-10 text-sm text-slate">Nothing in this category yet.</p>}

            {mostViewed.length >= 2 && (
              <section className="mt-12" aria-label="What buyers check more">
                <p className="eyebrow">What buyers check more</p>
                <h2 className="mt-1 font-display text-2xl text-ink">Most viewed in this store</h2>
                <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {mostViewed.map((i) => (
                    <Link key={i.id} href={`/shop/${i.id}`} className="card flex gap-3 overflow-hidden p-3 hover:border-crimson">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.image} alt="" className="h-20 w-16 shrink-0 object-cover" />
                      <span className="min-w-0">
                        <span className="block truncate font-ui text-sm font-bold text-ink">{i.title}</span>
                        <span className="block font-mono text-xs text-crimson-bright">{i.price}</span>
                        <span className="block text-[11px] text-slate">{statOf(i)!.views} view{statOf(i)!.views === 1 ? "" : "s"}{(statOf(i)!.favs ?? 0) > 0 ? ` · ♥ ${statOf(i)!.favs}` : ""}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="How buying works">
          {[["You pay here", "Through #NotesApp checkout, with Paystack."], ["Money is held", "The seller is paid only after you confirm delivery."], ["Parcel ID on every order", "Track it any time on the Track a parcel page."], ["Delivered by the seller", "Each item says where it ships from."]].map(([h, t]) => (
            <div key={h} className="card p-5"><p className="font-ui text-sm font-bold text-ink">{h}</p><p className="mt-1 text-xs text-slate">{t}</p></div>
          ))}
        </section>
      </div>
    </div>
  );
}

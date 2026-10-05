"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUsername, canPublish, UserProfile } from "@/lib/users";
import Avatar from "@/components/Avatar";
import StoreManager from "@/components/StoreManager";
import { getStoreItems, StoreItem } from "@/lib/store";
import { useMemberships } from "@/lib/useMemberships";
import NotifyWhenBack from "@/components/NotifyWhenBack";
import BoostedStrip from "@/components/BoostedStrip";
import { fmtSize } from "@/lib/store-files";

export function ItemCard({ item, shopBase = "/shop" }: { item: StoreItem; shopBase?: string }) {
  const digital = item.kind === "digital";
  return (
    <div className="card flex flex-col overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image} alt={item.title} className="aspect-[3/4] w-full object-cover" />
      <div className="flex flex-1 flex-col p-5">
        {(item.badge || digital) && (
          <span className="mb-2 inline-block w-fit rounded-full bg-crimson/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wideish text-crimson">
            {digital ? "Digital download" : item.badge}
          </span>
        )}
        <h3 className="font-ui text-base font-bold leading-snug text-ink">{item.title}</h3>
        {item.subtitle && <p className="mt-2 flex-1 text-sm text-slate">{item.subtitle}</p>}
        {digital && item.fileName && <p className="mt-2 font-mono text-[11px] text-slate">{item.fileName}{item.fileSize ? ` · ${fmtSize(item.fileSize)}` : ""}</p>}
        {digital && !item.fileName && <p className="mt-2 font-mono text-[11px] text-amber-800">File not attached yet — buyers can&apos;t see this item.</p>}
        <div className="mt-5 flex items-center justify-between">
          <span className="font-mono text-sm text-crimson-bright">{item.price}</span>
          {item.sellable && item.id ? (
            digital ? (
              <Link href={`${shopBase}/${item.id}`} className="btn-primary !px-4 !py-2 text-xs">Buy &amp; download</Link>
            ) : (item.stock ?? 0) > 0 ? (
              <span className="flex items-center gap-3">
                {(item.stock ?? 0) <= 5 && <span className="font-mono text-[11px] text-slate">Only {item.stock} left</span>}
                <Link href={`${shopBase}/${item.id}`} className="btn-primary !px-4 !py-2 text-xs">Buy now</Link>
              </span>
            ) : (
              <span className="flex items-center gap-3"><span className="font-mono text-xs text-slate">Sold out</span><NotifyWhenBack itemId={item.id} compact /></span>
            )
          ) : (
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn-primary !px-4 !py-2 text-xs">{item.cta}</a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StorePageClient({ params }: { params: { username: string } }) {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [viewer, setViewer] = useState<User | null>(null);

  useEffect(() => onAuthStateChanged(auth, setViewer), []);
  const { orgs } = useMemberships(viewer);

  async function loadItems(p: UserProfile) {
    setItems(await getStoreItems(p.uid, p.username));
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
  // Publisher listings are on-platform physical goods only; legacy link-out listings stay hidden.
  const shown = items.filter((i) => !i.id || i.sellable);
  // Downloads first, then physical items. A download isn't shown to buyers until its file is attached.
  const digitalItems = shown.filter((i) => i.kind === "digital" && (isOwner || teamAccess || i.fileName));
  const physicalItems = shown.filter((i) => i.kind !== "digital");

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatar} alt={profile.displayName} size={56} />
          <div>
            <p className="eyebrow">Brand store</p>
            <h1 className="font-display text-3xl text-ink">
              {profile.displayName}&apos;s store
            </h1>
          </div>
        </div>
        <Link href={`/u/${profile.username}`} className="btn-ghost shrink-0">
          Back to profile
        </Link>
      </div>

      <p className="mt-6 max-w-2xl text-sm text-slate">
        Every journal on #NotesApp gets its own storefront instead of a
        shared marketplace — this is {profile.displayName.split(" ")[0]}
        &apos;s shelf, branded to them, not to us. You pay here and #NotesApp
        holds your money until you confirm the parcel arrived; every order gets a parcel ID you can{" "}
        <Link href="/track" className="text-crimson underline">track</Link>. Physical items are delivered by the seller; downloads are instant.
      </p>

      {ownerCanEdit && <StoreManager profile={profile} items={items} onChanged={() => loadItems(profile)} />}
      {isOwner && !ownerCanEdit && (
        <p className="mt-6 text-sm text-slate">
          This is your store. Once you can publish, you&apos;ll be able to add items here —{" "}
          <Link href="/profile/publishing" className="text-crimson">start publishing</Link>.
        </p>
      )}

      <BoostedStrip owner={profile.uid} title="Boosted in this store" />

      {digitalItems.length === 0 && physicalItems.length === 0 ? (
        <p className="mt-10 text-sm text-slate">This store is empty for now.</p>
      ) : (
        <>
          {digitalItems.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-2xl text-ink">Digital downloads</h2>
              <p className="mt-1 text-xs text-slate">Pay once, download instantly. Digital sales are final once downloaded.</p>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {digitalItems.map((item) => <ItemCard key={item.id ?? item.title} item={item} />)}
              </div>
            </section>
          )}
          {physicalItems.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-2xl text-ink">Physical items</h2>
              <p className="mt-1 text-xs text-slate">Delivered to you; your money is held until you confirm the parcel arrived.</p>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {physicalItems.map((item) => <ItemCard key={item.id ?? item.title} item={item} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

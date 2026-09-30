"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUsername, canPublish, UserProfile } from "@/lib/users";
import Avatar from "@/components/Avatar";
import StoreManager from "@/components/StoreManager";
import { getStoreItems, StoreItem } from "@/lib/store";

export default function StorePageClient({ params }: { params: { username: string } }) {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [viewer, setViewer] = useState<User | null>(null);

  useEffect(() => onAuthStateChanged(auth, setViewer), []);

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
  const ownerCanEdit = isOwner && canPublish(profile);

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
        &apos;s shelf, branded to them, not to us. Checkout hands off to
        wherever each item already lives (Selar, Amazon, a payment link or
        their own site); #NotesApp doesn&apos;t take payment for these items.
      </p>

      {ownerCanEdit && <StoreManager profile={profile} items={items} onChanged={() => loadItems(profile)} />}
      {isOwner && !ownerCanEdit && (
        <p className="mt-6 text-sm text-slate">
          This is your store. Once you can publish, you&apos;ll be able to add items here —{" "}
          <Link href="/profile/publishing" className="text-crimson">start publishing</Link>.
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-10 text-sm text-slate">This store is empty for now.</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id ?? item.title} className="card flex flex-col overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={item.title}
                className="aspect-[3/4] w-full object-cover"
              />
              <div className="flex flex-1 flex-col p-5">
                {item.badge && (
                  <span className="mb-2 inline-block w-fit rounded-full bg-crimson/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wideish text-crimson">
                    {item.badge}
                  </span>
                )}
                <h3 className="font-ui text-base font-bold leading-snug text-ink">
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="mt-2 flex-1 text-sm text-slate">{item.subtitle}</p>
                )}
                <div className="mt-5 flex items-center justify-between">
                  <span className="font-mono text-sm text-crimson-bright">
                    {item.price}
                  </span>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary !px-4 !py-2 text-xs"
                  >
                    {item.cta}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

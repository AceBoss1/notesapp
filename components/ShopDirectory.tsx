"use client";

import { useState } from "react";
import Link from "next/link";
import type { DirectoryShop } from "@/lib/shop-directory";
import Avatar from "@/components/Avatar";

const PAGE = 12;

// The publishers' shops on the Merch Store page: a card each, 12 at first with "Show more", and a search box once there
// are more than fit. A shop on its own domain opens there.
export default function ShopDirectory({ shops }: { shops: DirectoryShop[] }) {
  const [shown, setShown] = useState(PAGE);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const matches = needle ? shops.filter((s) => `${s.displayName} ${s.username}`.toLowerCase().includes(needle)) : shops;
  const visible = matches.slice(0, shown);

  if (shops.length === 0) return null;
  return (
    <div className="mt-10">
      {shops.length > PAGE && (
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
          placeholder="Search shops…"
          aria-label="Search shops"
          className="mb-6 w-full max-w-sm border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson"
        />
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {visible.map((s) => {
          const body = (
            <>
              <div className="flex items-center gap-4">
                <Avatar src={s.avatar} alt={s.displayName} size={56} square={!!s.isOrg} />
                <div className="min-w-0">
                  <p className="truncate font-ui text-base font-bold text-ink">
                    {s.displayName}&apos;s store
                    {s.boosted && <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-wideish text-crimson">↗ Boosted</span>}
                  </p>
                  <p className="font-mono text-xs text-slate">@{s.username} · {s.itemCount} item{s.itemCount === 1 ? "" : "s"}</p>
                </div>
              </div>
              {s.images.length > 0 && (
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {s.images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt="" className="aspect-[3/4] w-full rounded-md object-cover" />
                  ))}
                </div>
              )}
              <span className="mt-5 text-sm font-semibold text-crimson">Visit store →</span>
            </>
          );
          const cls = "card flex flex-col p-6 hover:shadow-lg";
          return s.href.startsWith("http") ? (
            <a key={s.uid} href={s.href} className={cls}>{body}</a>
          ) : (
            <Link key={s.uid} href={s.href} className={cls}>{body}</Link>
          );
        })}
      </div>
      {matches.length === 0 && <p className="mt-6 text-sm text-slate">No shops match &ldquo;{q}&rdquo;.</p>}
      {matches.length > shown && (
        <div className="mt-8 text-center">
          <button onClick={() => setShown((n) => n + PAGE)} className="btn-ghost !px-6 !py-2 text-sm">Show more shops</button>
        </div>
      )}
    </div>
  );
}

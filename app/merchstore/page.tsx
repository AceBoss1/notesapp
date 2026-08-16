import { ADMIN_PROFILES } from "@/lib/admin";
import { STORE_ITEMS } from "@/lib/store";
import { MERCH_ITEMS } from "@/lib/merch";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merch Store",
  description:
    "Official #NotesApp merch — t-shirts, caps, mugs, and more, any core or seasonal logo — plus Emmanuel's and Chimdinma's individual brand stores.",
};
import MerchCard from "@/components/MerchCard";
import Avatar from "@/components/Avatar";
import Link from "next/link";

// Order matters here — Emmanuel's shop renders before Chimdinma's,
// per how this page was specced.
const SHOP_ORDER = [
  ADMIN_PROFILES["ezurukam@gmail.com"],
  ADMIN_PROFILES["precheks.info@gmail.com"],
];

export default function MerchStorePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Merch Store</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        Official #NotesApp Merch
      </h1>
      <p className="mt-5 max-w-2xl text-slate">
        T-shirts, caps, mugs, and more — every item can carry the core
        mark or any of our seasonal logos from{" "}
        <Link href="/brand" className="text-crimson underline underline-offset-2">
          the Brand page
        </Link>
        . This is a demo catalogue — checkout and print-on-demand
        fulfillment aren't wired up yet.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MERCH_ITEMS.map((item) => (
          <MerchCard key={item.id} item={item} />
        ))}
      </div>

      <div className="mt-20 border-t border-rule pt-14">
        <span className="eyebrow">Individual Shops</span>
        <h2 className="mt-3 font-display text-3xl text-ink">
          Each journal's own storefront
        </h2>
        <p className="mt-3 max-w-2xl text-slate">
          Every #NotesApp journal gets its own brand store, separate
          from this one — here are the two live today.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {SHOP_ORDER.map((profile) => {
            const items = STORE_ITEMS[profile.username] ?? [];
            return (
              <Link
                key={profile.username}
                href={`/u/${profile.username}/store`}
                className="card flex flex-col p-6 hover:shadow-lg"
              >
                <div className="flex items-center gap-4">
                  <Avatar src={profile.avatar} alt={profile.displayName} size={56} />
                  <div>
                    <p className="font-ui text-base font-bold text-ink">
                      {profile.displayName}'s store
                    </p>
                    <p className="font-mono text-xs text-slate">
                      @{profile.username} · {items.length} item{items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                {items.length > 0 && (
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {items.slice(0, 3).map((it) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={it.title}
                        src={it.image}
                        alt={it.title}
                        className="aspect-[3/4] w-full rounded-md object-cover"
                      />
                    ))}
                  </div>
                )}
                <span className="mt-5 text-sm font-semibold text-crimson">
                  Visit store →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

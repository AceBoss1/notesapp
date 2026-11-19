import { ADMIN_PROFILES } from "@/lib/admin";
import { STORE_ITEMS } from "@/lib/store";
import { LOGO_OPTIONS, MERCH_DESIGNS, MERCH_ITEMS, colourOf, currentMerch, merchBatchState, merchDeliveryKobo } from "@/lib/merch";
import { loadLivePricing } from "@/lib/pricing-server";
import MerchMockup from "@/components/MerchMockup";
import { formatNaira } from "@/lib/booking-time";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merch Store",
  description:
    "Official #NotesApp merch in 3D: custom shirts, T-shirts, caps, mugs and more, in your colour with any core or seasonal logo, plus every publisher's own shop.",
};
import ShopDirectory from "@/components/ShopDirectory";
import { getShopDirectory } from "@/lib/shop-directory";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import Link from "next/link";
import PageHero from "@/components/PageHero";

// Order matters here — Emmanuel's shop renders before Chimdinma's,
// per how this page was specced.
const SHOP_ORDER = [
  ADMIN_PROFILES["ezurukam@gmail.com"],
  ADMIN_PROFILES["precheks.info@gmail.com"],
];

// The publishers' shops come from live data; refreshed every minute.
export const revalidate = 60;

export default async function MerchStorePage() {
  await loadLivePricing();
  const m = currentMerch();
  const state = merchBatchState();
  const founderNames = SHOP_ORDER.map((p) => p.username);
  const shops = (await getShopDirectory()).filter((s) => !founderNames.includes(s.username));
  const designs = MERCH_DESIGNS.filter((d) => m.designs.find((x) => x.id === d.id)?.on);
  const items = MERCH_ITEMS.filter((i) => m.items.find((x) => x.id === i.id)?.on);
  const from = (kobo: number) => `From ${formatNaira(kobo)}`;
  return (
    <>
      <PageHero eyebrow="Merch Store" title={<>Official #NotesApp Merch</>}>
        <p>Custom shirts, T-shirts, caps, mugs and more. Open any of them to turn it all the way round in 3D, choose the colour, the logo
        from <Link href="/brand" className="text-crimson underline underline-offset-2">the Brand page</Link> and where it&apos;s printed, add a name on the back of a shirt,
        and see the price as you go. Pre-order and pay with Paystack; we print after the batch closes and deliver anywhere in Nigeria for a flat {formatNaira(merchDeliveryKobo())}.</p>
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className={`rounded-xl border px-4 py-3 text-sm ${state === "open" ? "border-[#b9e2d1] bg-[#e9f7f1] text-[#17694a]" : "border-rule bg-card text-ink"}`} role="status">
        {state === "open" ? <><b>{m.batch.label} is open</b> until {m.batch.closesOn}. {m.batch.note}</>
          : state === "soon" ? <><b>{m.batch.label} opens on {m.batch.opensOn}</b> and closes {m.batch.closesOn}. You can look at everything now.</>
          : <><b>Orders aren&apos;t open right now.</b> The next batch opens soon; you can still look at everything and see the prices.</>}
      </p>

      {designs.length > 0 && (
        <section className="mt-10" aria-labelledby="custom-h">
          <h2 id="custom-h" className="font-display text-2xl text-ink">Custom shirts</h2>
          <p className="mt-1 text-sm text-slate">Printed all over, with a name on the back for {formatNaira(m.extras.nameKobo)} more.</p>
          <ul className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {designs.map((d) => (
              <li key={d.id}>
                <Link href={`/merchstore/${d.id}`} className="card block overflow-hidden p-3 transition hover:border-crimson">
                  <div className="flex aspect-square items-center justify-center rounded-2xl" style={{ background: "radial-gradient(ellipse at 50% 85%, #e9dcd4 0, #fff 75%)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.image} alt={`Custom shirt: ${d.name}`} className="h-[88%] w-auto object-contain drop-shadow-lg" loading="lazy" />
                  </div>
                  <p className="mt-2 font-ui text-sm font-bold text-ink">{d.name}</p>
                  <p className="text-xs text-slate">{formatNaira(m.designs.find((x) => x.id === d.id)!.priceKobo)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12" aria-labelledby="items-h">
        <h2 id="items-h" className="font-display text-2xl text-ink">Choose your colour and logo</h2>
        <ul className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((item) => {
            const s = m.items.find((x) => x.id === item.id)!;
            const first = colourOf(s.colours[0]);
            return (
              <li key={item.id}>
                <Link href={`/merchstore/${item.id}`} className="card block overflow-hidden p-3 transition hover:border-crimson">
                  <div className="overflow-hidden rounded-2xl"><MerchMockup item={item} logoSrc={LOGO_OPTIONS[0].image} logoAlt={LOGO_OPTIONS[0].label} colour={first?.hex} /></div>
                  <p className="mt-2 font-ui text-sm font-bold text-ink">{item.name}</p>
                  <div className="flex items-center justify-between text-xs text-slate">
                    <span>{from(s.priceKobo)}</span>
                    <span className="flex gap-1" aria-label={`Comes in ${s.colours.map((c) => colourOf(c)?.name).join(", ")}`}>
                      {s.colours.map((c) => <i key={c} className="block h-2.5 w-2.5 rounded-full border border-rule" style={{ background: colourOf(c)?.hex }} />)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-center text-xs text-slate">Open an item to turn it in 3D.</p>
      </section>

      <div className="mt-20 border-t border-rule pt-14">
        <span className="eyebrow">Individual Shops</span>
        <h2 className="mt-3 font-display text-3xl text-ink">
          Each journal's own storefront
        </h2>
        <p className="mt-3 max-w-2xl text-slate">
          Every #NotesApp journal gets its own brand store, separate
          from this one — the two founder shops come first, then every publisher shop that has something to buy right now. Any publisher can open one and sell physical goods or digital downloads through
          #NotesApp checkout — physical orders held until delivery with a tracking ID for every parcel, downloads delivered instantly:{" "}
          <Link href="/store-selling" className="text-crimson underline underline-offset-2">
            how selling works
          </Link>
          .
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
                      <NameBadgeIcons username={profile.username} size={15} />
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

        <ShopDirectory shops={shops} />
      </div>
    </div>
    </>
  );
}

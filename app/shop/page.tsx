import Image from "next/image";
import { PRODUCTS } from "@/lib/products";

export const metadata = { title: "Shop — Precheks" };

export default function ShopPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14">
      <p className="eyebrow">Digital Products &amp; Courses</p>
      <h1 className="font-display text-5xl mt-3">Shop</h1>
      <p className="mt-6 text-lg text-slate font-body max-w-2xl">
        Our courses and digital products are sold through Selar — click any
        card to purchase and receive instant access.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10 border-t-2 border-ink pt-10">
        {PRODUCTS.map((p) => (
          <a
            key={p.title}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex flex-col border bg-card hover:border-gold transition-colors ${
              p.featured ? "border-gold" : "border-rule"
            }`}
          >
            {/* Product image */}
            <div className="relative w-full aspect-[4/3] overflow-hidden bg-paper">
              <Image
                src={p.image}
                alt={p.title}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              {/* Badges overlaid on image */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                <span className="bg-ink/80 text-paper font-mono text-[10px] uppercase tracking-eyebrow px-2 py-0.5">
                  {p.type}
                </span>
                {p.featured && (
                  <span className="bg-gold text-ink text-[10px] font-ui font-semibold uppercase tracking-wide px-2 py-0.5">
                    Best Seller
                  </span>
                )}
              </div>
            </div>

            {/* Card body */}
            <div className="flex flex-col flex-1 p-6">

            <h3 className="font-display text-xl group-hover:text-gold-deep leading-snug">
              {p.title}
            </h3>

            <p className="mt-3 text-sm text-slate leading-relaxed flex-1">
              {p.description}
            </p>

            {/* Price */}
            <div className="mt-5 flex items-baseline gap-2">
              <span
                className={`font-ui font-bold text-lg ${
                  p.price === "Free" ? "text-gold-deep" : "text-ink"
                }`}
              >
                {p.price}
              </span>
              {p.originalPrice && (
                <span className="font-ui text-sm text-slate line-through">
                  {p.originalPrice}
                </span>
              )}
            </div>

            <span className="mt-4 inline-block font-ui text-xs font-semibold uppercase tracking-wideish text-gold-deep group-hover:text-ink transition-colors">
              {p.price === "Free" ? "Download Free →" : "Buy on Selar →"}
            </span>
            </div>{/* end card body */}
          </a>
        ))}
      </div>

      {/* Store link */}
      <p className="mt-10 text-sm text-slate font-body">
        Browse the full store at{" "}
        <a
          href="https://selar.com/m/precheks"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-deep hover:text-ink underline underline-offset-2 transition-colors"
        >
          selar.com/m/precheks
        </a>
      </p>
    </section>
  );
}

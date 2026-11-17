import Link from "next/link";

// On Your site, above the kits: Nana sets it up, and Review my site (docs/SITE_NANA.md).
export default function NanaCards() {
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border-2 border-crimson bg-gradient-to-br from-card to-[#fbeff3] p-5">
        <p className="font-ui text-sm font-bold text-ink"><span aria-hidden className="mr-1.5">✨</span>Let Nana set it up</p>
        <p className="mt-1 text-sm text-slate">Answer about eight questions. Nana picks the kit and look that suit you and drafts your words. You check everything before it goes on.</p>
        <Link href="/profile/site/nana" className="btn-primary mt-3 inline-block !px-4 !py-2 text-xs">Start with Nana</Link>
      </div>
      <div className="rounded-2xl border border-rule bg-card p-5">
        <p className="font-ui text-sm font-bold text-ink"><span aria-hidden className="mr-1.5">🔎</span>Review my site</p>
        <p className="mt-1 text-sm text-slate">See what is stopping visitors from booking, buying or getting in touch, most important first. Free.</p>
        <Link href="/profile/site/review" className="mt-3 inline-block rounded-full border border-rule px-4 py-2 text-xs font-semibold text-ink hover:border-crimson">Review my site</Link>
      </div>
    </div>
  );
}

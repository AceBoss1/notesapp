import Link from "next/link";
import { CAMPAIGNS, DAVIDO_DISCLAIMER } from "@/lib/promos";

// Under a journal post that announces a promo campaign (the campaign's postPath, e.g. "Happy 34th birthday, Davido"): where to use the
// code, and the statement that it isn't affiliated with or endorsed by the person it celebrates (owner, 21 Nov 2026). Server component.
export default function PromoPostBox({ slug }: { slug: string }) {
  const c = CAMPAIGNS.find((x) => x.postPath === `/journals/${slug}`);
  if (!c) return null;
  return (
    <aside className="card mt-10 p-6 sm:p-7" aria-label={`${c.code}: where to use the code`}>
      <p className="font-ui text-xs font-bold uppercase tracking-[0.16em] text-crimson">Code · {c.code}</p>
      <p className="mt-2 font-ui text-base font-bold text-ink">Claim a free plan, pitch for a venture slot, or play tonight&apos;s tournament</p>
      <p className="mt-1 text-sm text-slate">Type the code on the offer page, or on the Arcade home at arcade.notesapp.name.ng. Plans go while they last, one per account.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/offers/${c.code}`} className="btn-primary">Use {c.code}</Link>
        {c.tournament && <Link href="/arcade/tournament" className="rounded-full border border-rule px-5 py-2.5 font-ui text-sm font-semibold text-ink">The Arcade tournament</Link>}
      </div>
      {c.id === "davido-at-34" && <p className="mt-5 border-t border-rule pt-4 text-xs text-slate">{DAVIDO_DISCLAIMER}</p>}
    </aside>
  );
}
